/**
 * WebhookSecretRotationService — v3.0.1 operational helper.
 *
 * Before v3.0.1 every project's webhook secret was broadcast over an
 * unauthenticated Socket.IO connection (SEC-C2), so operators must assume
 * they leaked and rotate them. Used by `npm run rotate:webhook-secrets`.
 */

import crypto from 'crypto';
import { Op, WhereOptions } from 'sequelize';
import { AuditLog, Project } from '@Models/index';
import Logger from '@Utils/Logger';

/** AuditLog action recorded for every CLI rotation. */
export const WEBHOOK_SECRET_ROTATED = 'webhook_secret_rotated';

export interface IRotationTarget {
  All?: boolean;
  /** Project id or exact name. */
  Project?: string;
  DryRun?: boolean;
}

export interface IRotatedSecret {
  ProjectId: number;
  Name: string;
  WebhookPath: string;
  WebhookSecret: string | null;
}

export class WebhookSecretRotationService {
  public static NewSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Choose the projects and generate their new secrets without touching the
   * database, so the caller can store the secrets safely before applying them.
   */
  public static async Plan(target: IRotationTarget): Promise<IRotatedSecret[]> {
    if (!target.All && !target.Project) {
      throw new Error('Choose --all or --only <id|name>');
    }

    let where: WhereOptions = {};
    if (!target.All && target.Project) {
      const asId = /^[1-9][0-9]*$/.test(target.Project) ? Number(target.Project) : null;
      where = asId !== null
        ? { [Op.or]: [{ Id: asId }, { Name: target.Project }] }
        : { Name: target.Project };
    }

    const projects = await Project.findAll({ where, order: [['Id', 'ASC']] });
    if (projects.length === 0) {
      throw new Error('No matching projects');
    }

    return projects.map((project) => ({
      ProjectId: project.Id,
      Name: project.Name,
      WebhookPath: `/api/webhooks/github/${project.Name}`,
      WebhookSecret: target.DryRun ? null : WebhookSecretRotationService.NewSecret(),
    }));
  }

  /** Store planned secrets in one transaction: all projects rotate or none do. */
  public static async Apply(plan: IRotatedSecret[]): Promise<void> {
    const sequelize = Project.sequelize;
    if (!sequelize) {
      throw new Error('Database is not initialized');
    }
    await sequelize.transaction(async (transaction) => {
      for (const entry of plan) {
        if (!entry.WebhookSecret) continue;
        const [updated] = await Project.update(
          { WebhookSecret: entry.WebhookSecret },
          { where: { Id: entry.ProjectId }, transaction }
        );
        if (updated !== 1) {
          throw new Error(`Project #${entry.ProjectId} no longer exists`);
        }
        await AuditLog.create(
          {
            Action: WEBHOOK_SECRET_ROTATED,
            ResourceType: 'project',
            ResourceId: entry.ProjectId,
            Details: { source: 'cli', projectName: entry.Name },
          },
          { transaction }
        );
      }
    });
    Logger.Info('Webhook secrets rotated', { projectIds: plan.map((r) => r.ProjectId) });
  }

  /** How many planned secrets the database currently holds. */
  public static async CountApplied(plan: IRotatedSecret[]): Promise<number> {
    const planned = plan.filter((entry) => entry.WebhookSecret);
    if (planned.length === 0) return 0;
    const projects = await Project.findAll({
      where: { Id: planned.map((entry) => entry.ProjectId) },
      attributes: ['Id', 'WebhookSecret'],
    });
    const stored = new Map(projects.map((project) => [project.Id, project.get('WebhookSecret')]));
    return planned.filter((entry) => stored.get(entry.ProjectId) === entry.WebhookSecret).length;
  }

  public static async Rotate(target: IRotationTarget): Promise<IRotatedSecret[]> {
    const plan = await WebhookSecretRotationService.Plan(target);
    if (target.DryRun) {
      Logger.Info('Webhook secrets selected (dry run)', { projectIds: plan.map((r) => r.ProjectId) });
      return plan;
    }
    await WebhookSecretRotationService.Apply(plan);
    return plan;
  }
}

export default WebhookSecretRotationService;
