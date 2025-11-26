/**
 * Queue Service
 * Manages deployment queue to prevent concurrent deployments on same project
 * Following SOLID principles and PascalCase naming convention
 */

import Logger from '@Utils/Logger';
import { EventEmitter } from 'events';

interface IQueueItem {
  DeploymentId: number;
  ProjectId: number;
  ExecuteFunction: () => Promise<void>;
  Priority: number;
}

export class QueueService extends EventEmitter {
  private static Instance: QueueService;
  private Queues: Map<number, IQueueItem[]> = new Map();
  private Running: Map<number, boolean> = new Map();

  private constructor() {
    super();
  }

  /**
   * Get singleton instance
   */
  public static GetInstance(): QueueService {
    if (!QueueService.Instance) {
      QueueService.Instance = new QueueService();
    }
    return QueueService.Instance;
  }

  /**
   * Add deployment to queue
   */
  public async Add(
    deploymentId: number,
    projectId: number,
    executeFunction: () => Promise<void>,
    priority: number = 0
  ): Promise<void> {
    Logger.Info(`Adding deployment ${deploymentId} to queue`, { deploymentId, projectId });

    // Initialize queue for project if doesn't exist
    if (!this.Queues.has(projectId)) {
      this.Queues.set(projectId, []);
    }

    // Add to queue
    const queue = this.Queues.get(projectId)!;
    queue.push({
      DeploymentId: deploymentId,
      ProjectId: projectId,
      ExecuteFunction: executeFunction,
      Priority: priority,
    });

    // Sort by priority (higher priority first)
    queue.sort((a, b) => b.Priority - a.Priority);

    // Emit event
    this.emit('deployment-queued', { deploymentId, projectId, queueLength: queue.length });

    // Process queue if not already running
    if (!this.Running.get(projectId)) {
      await this.ProcessQueue(projectId);
    }
  }

  /**
   * Process queue for a project
   */
  private async ProcessQueue(projectId: number): Promise<void> {
    this.Running.set(projectId, true);

    const queue = this.Queues.get(projectId);
    if (!queue) {
      this.Running.set(projectId, false);
      return;
    }

    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      Logger.Info(`Processing deployment ${item.DeploymentId} from queue`, {
        deploymentId: item.DeploymentId,
        projectId: item.ProjectId,
        remainingInQueue: queue.length,
      });

      try {
        this.emit('deployment-started', {
          deploymentId: item.DeploymentId,
          projectId: item.ProjectId,
        });

        await item.ExecuteFunction();

        this.emit('deployment-completed', {
          deploymentId: item.DeploymentId,
          projectId: item.ProjectId,
        });
      } catch (error) {
        Logger.Error(
          `Deployment ${item.DeploymentId} failed in queue processing`,
          error as Error,
          {
            deploymentId: item.DeploymentId,
            projectId: item.ProjectId,
          }
        );

        this.emit('deployment-failed', {
          deploymentId: item.DeploymentId,
          projectId: item.ProjectId,
          error: (error as Error).message,
        });
      }
    }

    this.Running.set(projectId, false);
    Logger.Info(`Queue processing completed for project ${projectId}`, { projectId });
  }

  /**
   * Get queue length for a project
   */
  public GetQueueLength(projectId: number): number {
    const queue = this.Queues.get(projectId);
    return queue ? queue.length : 0;
  }

  /**
   * Check if project has running deployment
   */
  public IsRunning(projectId: number): boolean {
    return this.Running.get(projectId) || false;
  }

  /**
   * Get all queue status
   */
  public GetAllQueuesStatus(): Array<{
    ProjectId: number;
    QueueLength: number;
    IsRunning: boolean;
  }> {
    const status: Array<{ ProjectId: number; QueueLength: number; IsRunning: boolean }> = [];

    this.Queues.forEach((queue, projectId) => {
      status.push({
        ProjectId: projectId,
        QueueLength: queue.length,
        IsRunning: this.Running.get(projectId) || false,
      });
    });

    return status;
  }

  /**
   * Cancel all pending deployments for a project
   */
  public CancelPendingDeployments(projectId: number): number {
    const queue = this.Queues.get(projectId);
    if (!queue) return 0;

    const canceledCount = queue.length;
    this.Queues.set(projectId, []);

    Logger.Info(`Canceled ${canceledCount} pending deployments for project ${projectId}`, {
      projectId,
      canceledCount,
    });

    return canceledCount;
  }
}

export default QueueService;
