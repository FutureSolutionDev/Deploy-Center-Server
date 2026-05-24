/**
 * RollbackService — Deploy Center v3.0 / F-007 (T067).
 *
 * Given a Failed deployment, re-deploys the last Successful commit for the
 * same project as a NEW deployment row (TriggerType=rollback). The new
 * deployment goes through the standard BullMQ queue.
 *
 * Status-code contract (mirrored in DeploymentController.Rollback):
 *   422 — target is not Status='Failed'
 *   422 — no prior Success for the project
 *   409 — last-successful commit equals the failed deployment's commit
 *         (rolling back would be a no-op)
 *   503 — Redis down (raised by QueueReadyMiddleware before we get here)
 *
 * Writes an AuditLog entry with action=DeploymentRolledBack on success.
 * Emits a `deployment:rollback-queued` Socket.IO event after enqueue.
 */

import { Op } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';
import { Deployment, AuditLog } from '@Models/index';
import QueueService, { QUEUE_PRIORITY } from '@Services/QueueService';
import SocketService from '@Services/SocketService';
import Logger from '@Utils/Logger';
import {
  EAuditAction,
  EDeploymentStatus,
  ETriggerType,
} from '@Types/ICommon';

export class RollbackError extends Error {
  constructor(message: string, public readonly StatusCode: 409 | 422) {
    super(message);
    this.name = 'RollbackError';
  }
}

export interface IRollbackResult {
  FromDeploymentId: number;
  NewDeploymentId: number;
  ToCommitHash: string;
  QueueJobId: string;
}

export class RollbackService {
  private static Instance: RollbackService | null = null;

  public static GetInstance(): RollbackService {
    if (!RollbackService.Instance) {
      RollbackService.Instance = new RollbackService();
    }
    return RollbackService.Instance;
  }

  /**
   * Rollback the project that owns `failedDeploymentId` to its most recent
   * Successful commit. Throws RollbackError with the appropriate status code
   * if preconditions fail.
   */
  public async RollbackToLastSuccessful(
    failedDeploymentId: number,
    userId: number
  ): Promise<IRollbackResult> {
    // 1. Load the target deployment.
    const target = await Deployment.findByPk(failedDeploymentId);
    if (!target) {
      throw new RollbackError(
        `Deployment ${failedDeploymentId} not found`,
        422
      );
    }

    // 2. Must be in the Failed state — rolling back a Running or Success
    //    deployment is meaningless and is rejected per FR-029.
    if (target.Status !== EDeploymentStatus.Failed) {
      throw new RollbackError(
        `Can only rollback failed deployments (current status: ${target.Status})`,
        422
      );
    }

    // 3. Find the latest Success for the same project.
    const lastSuccess = await Deployment.findOne({
      where: {
        ProjectId: target.ProjectId,
        Status: EDeploymentStatus.Success,
        Id: { [Op.ne]: failedDeploymentId },
      },
      order: [['CreatedAt', 'DESC']],
    });

    if (!lastSuccess) {
      throw new RollbackError(
        'No prior successful deployment to roll back to',
        422
      );
    }

    // 4. Reject if the commits already match — nothing to do.
    if (lastSuccess.CommitHash === target.CommitHash) {
      throw new RollbackError(
        'Last successful deployment is already on this commit',
        409
      );
    }

    // 5-7. Atomic create+enqueue+audit. If ANY step throws we roll back the
    //      DB transaction AND remove the BullMQ job (if it was created), so
    //      we never leave an orphan Queued deployment or an enqueued job
    //      without its audit row.
    const sequelize = DatabaseConnection.GetInstance();
    const tx = await sequelize.transaction();
    let enqueuedJobId: string | null = null;
    let rollbackDeployment: Deployment;

    try {
      // 5. Create the rollback deployment row.
      rollbackDeployment = await Deployment.create(
        {
          ProjectId: target.ProjectId,
          Status: EDeploymentStatus.Queued,
          TriggerType: ETriggerType.Rollback,
          Branch: lastSuccess.Branch,
          CommitHash: lastSuccess.CommitHash,
          CommitMessage: `Rollback to deployment #${lastSuccess.Id} (${(lastSuccess.CommitHash ?? '').substring(0, 7) || 'unknown'})`,
          CommitAuthor: lastSuccess.CommitAuthor,
          Author: lastSuccess.Author,
          TriggeredBy: userId,
          StartedAt: new Date(),
        },
        { transaction: tx }
      );

      // 6. Enqueue via BullMQ. Outside the SQL transaction by necessity
      //    (Redis is not transactional with MySQL) — we compensate below if
      //    the audit step throws by removing the job we just added.
      enqueuedJobId = await QueueService.GetInstance().Enqueue(
        rollbackDeployment.Id,
        rollbackDeployment.ProjectId,
        QUEUE_PRIORITY.Rollback
      );
      rollbackDeployment.QueueJobId = enqueuedJobId;
      await rollbackDeployment.save({ transaction: tx });

      // 7. Audit log — single global row with full context for analytics.
      await AuditLog.create(
        {
          UserId: userId,
          Action: EAuditAction.DeploymentRolledBack,
          ResourceType: 'deployment',
          ResourceId: rollbackDeployment.Id,
          Details: {
            FromDeploymentId: failedDeploymentId,
            NewDeploymentId: rollbackDeployment.Id,
            ToCommitHash: lastSuccess.CommitHash,
            FromCommitHash: target.CommitHash,
            ProjectId: target.ProjectId,
            QueueJobId: enqueuedJobId,
          },
        },
        { transaction: tx }
      );

      await tx.commit();
    } catch (err) {
      await tx.rollback();
      // Compensate the side effect: if we already added a BullMQ job before
      // the audit row threw, remove it so the worker doesn't pick up a job
      // whose deployment row no longer exists.
      if (enqueuedJobId) {
        try {
          const queue = QueueService.GetInstance().GetBullMqQueue();
          const job = await queue.getJob(enqueuedJobId);
          if (job) await job.remove();
        } catch (cleanupErr) {
          Logger.Error('Rollback compensation: failed to remove orphan BullMQ job', cleanupErr as Error, {
            jobId: enqueuedJobId,
          });
        }
      }
      throw err;
    }

    // 8. Push socket events ONLY after commit succeeded — never broadcast a
    //    rollback the DB doesn't reflect.
    const io = SocketService.GetInstance();
    io.EmitDeploymentUpdate(rollbackDeployment);
    io.EmitRollbackQueued({
      FromDeploymentId: failedDeploymentId,
      NewDeploymentId: rollbackDeployment.Id,
      ToCommitHash: lastSuccess.CommitHash,
    });

    Logger.Info('Rollback queued', {
      fromDeploymentId: failedDeploymentId,
      newDeploymentId: rollbackDeployment.Id,
      projectId: target.ProjectId,
      toCommitHash: lastSuccess.CommitHash,
      userId,
      jobId: enqueuedJobId,
    });

    return {
      FromDeploymentId: failedDeploymentId,
      NewDeploymentId: rollbackDeployment.Id,
      ToCommitHash: lastSuccess.CommitHash,
      QueueJobId: enqueuedJobId!,
    };
  }
}

export default RollbackService;
