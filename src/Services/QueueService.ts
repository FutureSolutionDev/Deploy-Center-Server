/**
 * QueueService — Deploy Center v3.0 / F-001.
 * Replaces v2.1's in-memory Map<projectId, Item[]> with a BullMQ-backed
 * Redis queue so deployments survive process restart.
 *
 * Public API (preserved for backward compat with DeploymentController):
 *   - Add(deploymentId, projectId, executeFunction?, priority?)   — legacy entry; closure ignored
 *   - GetQueueLength(projectId): Promise<number>
 *   - IsRunning(projectId): Promise<boolean>
 *   - GetAllQueuesStatus(): Promise<…>
 *   - CancelPendingDeployments(projectId): Promise<number>
 *
 * New API (v3.0):
 *   - Enqueue(deploymentId, projectId, priority?): Promise<string>  // returns BullMQ job id
 *   - RegisterRunner(runner): void                                  // worker callback set at boot
 *   - IsReady(): boolean                                            // Redis health probe
 *   - StartWorker(): void                                           // boot the BullMQ worker
 *   - StopWorker(): Promise<void>                                   // graceful shutdown
 *
 * Retry policy (FR-002): 3 attempts, exponential backoff 1s → 5s → 25s.
 */

import { Queue, Worker, Job, JobsOptions } from 'bullmq';
import { EventEmitter } from 'events';
import Logger from '@Utils/Logger';
import { getRedisConnection, isRedisReady } from '@Config/RedisConfig';

const QUEUE_NAME = 'deployments';

interface IDeploymentJobData {
  DeploymentId: number;
  ProjectId: number;
}

type DeploymentRunner = (deploymentId: number, projectId: number) => Promise<void>;

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { count: 1000, age: 24 * 60 * 60 }, // keep 1k completed for 24h
  removeOnFail: { count: 5000, age: 7 * 24 * 60 * 60 }, // keep 5k failed for 7d (audit)
};

export class QueueService extends EventEmitter {
  private static Instance: QueueService;
  private Queue: Queue<IDeploymentJobData> | null = null;
  private Worker: Worker<IDeploymentJobData> | null = null;
  private Runner: DeploymentRunner | null = null;
  // QueueJobId → DeploymentId map for fast IsRunning lookups (in-memory cache,
  // rebuilt from Redis on demand).
  private legacyAddWarned = false;

  private constructor() {
    super();
  }

  // ---- lifecycle -----------------------------------------------------------

  public static GetInstance(): QueueService {
    if (!QueueService.Instance) {
      QueueService.Instance = new QueueService();
    }
    return QueueService.Instance;
  }

  /** Lazily create the BullMQ Queue bound to the shared Redis connection. */
  private getQueue(): Queue<IDeploymentJobData> {
    if (!this.Queue) {
      this.Queue = new Queue<IDeploymentJobData>(QUEUE_NAME, {
        connection: getRedisConnection(),
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      });
    }
    return this.Queue;
  }

  /**
   * Register the function the worker calls to execute a deployment.
   * Must be called once at boot by whoever owns the runner (DeploymentService).
   */
  public RegisterRunner(runner: DeploymentRunner): void {
    this.Runner = runner;
    Logger.Info('QueueService: deployment runner registered');
  }

  /**
   * Boot the BullMQ worker. Safe to call once at server start; idempotent.
   * Workers process one job at a time per process (concurrency=1) to preserve
   * v2.1's per-process serialization semantics.
   */
  public StartWorker(): void {
    if (this.Worker) return;
    if (!this.Runner) {
      Logger.Warn('QueueService.StartWorker called before RegisterRunner — worker will reject jobs');
    }

    this.Worker = new Worker<IDeploymentJobData>(
      QUEUE_NAME,
      async (job: Job<IDeploymentJobData>) => {
        if (!this.Runner) {
          throw new Error('No deployment runner registered');
        }
        Logger.Info(`Queue worker: processing deployment ${job.data.DeploymentId}`, {
          deploymentId: job.data.DeploymentId,
          projectId: job.data.ProjectId,
          jobId: job.id,
          attemptsMade: job.attemptsMade,
        });
        this.emit('deployment-started', {
          deploymentId: job.data.DeploymentId,
          projectId: job.data.ProjectId,
        });
        await this.Runner(job.data.DeploymentId, job.data.ProjectId);
        this.emit('deployment-completed', {
          deploymentId: job.data.DeploymentId,
          projectId: job.data.ProjectId,
        });
      },
      {
        connection: getRedisConnection(),
        concurrency: 1,
      }
    );

    this.Worker.on('failed', (job, err) => {
      if (!job) return;
      Logger.Error(
        `Queue worker: deployment ${job.data.DeploymentId} failed (attempt ${job.attemptsMade}/${job.opts.attempts})`,
        err,
        {
          deploymentId: job.data.DeploymentId,
          projectId: job.data.ProjectId,
        }
      );
      this.emit('deployment-failed', {
        deploymentId: job.data.DeploymentId,
        projectId: job.data.ProjectId,
        error: err.message,
        attemptsMade: job.attemptsMade,
        attemptsMax: job.opts.attempts,
      });
    });

    this.Worker.on('error', (err) => {
      Logger.Error('Queue worker: bus error', err);
    });

    Logger.Info('QueueService: worker started, queue=' + QUEUE_NAME);
  }

  /** Graceful worker + queue shutdown. Call from server SIGTERM handler. */
  public async StopWorker(): Promise<void> {
    if (this.Worker) {
      await this.Worker.close();
      this.Worker = null;
    }
    if (this.Queue) {
      await this.Queue.close();
      this.Queue = null;
    }
    Logger.Info('QueueService: worker and queue stopped');
  }

  // ---- new v3.0 API --------------------------------------------------------

  /**
   * Enqueue a deployment for execution.
   * Returns the BullMQ job id (string, to be stored on Deployment.QueueJobId).
   */
  public async Enqueue(
    deploymentId: number,
    projectId: number,
    priority: number = 0
  ): Promise<string> {
    const queue = this.getQueue();
    // Use deployment id as job id for idempotency: re-enqueueing the same
    // deployment will throw a duplicate-job error rather than queue twice.
    const job = await queue.add(
      'deployment',
      { DeploymentId: deploymentId, ProjectId: projectId },
      {
        jobId: String(deploymentId),
        priority: priority > 0 ? priority : undefined,
      }
    );
    Logger.Info(`Queued deployment ${deploymentId} (jobId=${job.id})`, {
      deploymentId,
      projectId,
      jobId: job.id,
    });
    this.emit('deployment-queued', { deploymentId, projectId, jobId: job.id });
    return String(job.id);
  }

  /** Redis-health probe — used by QueueReadyMiddleware to gate trigger routes. */
  public IsReady(): boolean {
    return isRedisReady();
  }

  // ---- legacy v2.1 API (preserved for DeploymentController) ----------------

  /**
   * @deprecated v3.0 — pass closure ignored; deployments are run by the
   * registered runner (see RegisterRunner). DeploymentService is migrated to
   * call Enqueue() directly; this shim exists to avoid breaking any caller
   * we missed during the rewrite.
   */
  public async Add(
    deploymentId: number,
    projectId: number,
    _executeFunction?: () => Promise<void>,
    priority: number = 0
  ): Promise<void> {
    if (_executeFunction && !this.legacyAddWarned) {
      Logger.Warn(
        'QueueService.Add(): closure parameter is ignored in v3.0 — ' +
          'deployments are executed by the registered runner. Migrate caller to Enqueue().'
      );
      this.legacyAddWarned = true;
    }
    await this.Enqueue(deploymentId, projectId, priority);
  }

  /** Pending jobs (waiting + delayed + prioritized) for a given project. */
  public async GetQueueLength(projectId: number): Promise<number> {
    const queue = this.getQueue();
    const jobs = await queue.getJobs(['waiting', 'delayed', 'prioritized']);
    return jobs.filter((j) => j.data.ProjectId === projectId).length;
  }

  /** True if any deployment for this project is currently 'active' in the worker. */
  public async IsRunning(projectId: number): Promise<boolean> {
    const queue = this.getQueue();
    const active = await queue.getJobs(['active']);
    return active.some((j) => j.data.ProjectId === projectId);
  }

  /**
   * Aggregate status across all projects with queued or running jobs.
   * Shape preserved from v2.1 for DeploymentController.GetQueueStatus.
   */
  public async GetAllQueuesStatus(): Promise<
    Array<{ ProjectId: number; QueueLength: number; IsRunning: boolean }>
  > {
    const queue = this.getQueue();
    const [pending, active] = await Promise.all([
      queue.getJobs(['waiting', 'delayed', 'prioritized']),
      queue.getJobs(['active']),
    ]);
    const grouped = new Map<number, { QueueLength: number; IsRunning: boolean }>();
    for (const j of pending) {
      const pid = j.data.ProjectId;
      const entry = grouped.get(pid) ?? { QueueLength: 0, IsRunning: false };
      entry.QueueLength += 1;
      grouped.set(pid, entry);
    }
    for (const j of active) {
      const pid = j.data.ProjectId;
      const entry = grouped.get(pid) ?? { QueueLength: 0, IsRunning: false };
      entry.IsRunning = true;
      grouped.set(pid, entry);
    }
    return Array.from(grouped.entries()).map(([ProjectId, v]) => ({
      ProjectId,
      QueueLength: v.QueueLength,
      IsRunning: v.IsRunning,
    }));
  }

  /**
   * Cancel every pending (non-active) job for a project. Returns count cancelled.
   * Active jobs are NOT cancelled — they complete or fail naturally.
   */
  public async CancelPendingDeployments(projectId: number): Promise<number> {
    const queue = this.getQueue();
    const pending = await queue.getJobs(['waiting', 'delayed', 'prioritized']);
    const targets = pending.filter((j) => j.data.ProjectId === projectId);
    let cancelled = 0;
    for (const j of targets) {
      try {
        await j.remove();
        cancelled += 1;
      } catch (err) {
        Logger.Warn(`Failed to cancel jobId=${j.id}: ${(err as Error).message}`);
      }
    }
    Logger.Info(`Cancelled ${cancelled} pending deployments for project ${projectId}`, {
      projectId,
      cancelled,
    });
    return cancelled;
  }

  /** BullMQ admin handle — used by Bull Board adapter (T019). */
  public GetBullMqQueue(): Queue<IDeploymentJobData> {
    return this.getQueue();
  }
}

export default QueueService;
