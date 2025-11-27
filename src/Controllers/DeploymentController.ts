/**
 * Deployment Controller
 * Handles deployment management HTTP requests
 * Following SOLID principles and PascalCase naming convention
 */

import { Request, Response } from 'express';
import DeploymentService from '@Services/DeploymentService';
import QueueService from '@Services/QueueService';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import { EUserRole } from '@Types/ICommon';

export class DeploymentController {
  private readonly DeploymentService: DeploymentService;
  private readonly QueueService: QueueService;

  constructor() {
    this.DeploymentService = new DeploymentService();
    this.QueueService = QueueService.GetInstance();
  }

  /**
   * Get all deployments
   * GET /api/deployments
   */
  public GetAllDeployments = async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const offset = parseInt(req.query.offset as string, 10) || 0;
      const status = req.query.status as string | undefined;

      const result = await this.DeploymentService.GetAllDeployments(limit, offset, status);

      ResponseHelper.Success(res, 'Deployments retrieved successfully', {
        Deployments: result.Deployments,
        Total: result.Total,
        Limit: limit,
        Offset: offset,
      });
    } catch (error) {
      Logger.Error('Failed to get all deployments', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve deployments');
    }
  };

  /**
   * Get deployment by ID
   * GET /api/deployments/:id
   */
  public GetDeploymentById = async (req: Request, res: Response): Promise<void> => {
    try {
      const deploymentId = parseInt(req.params.id!, 10);

      if (isNaN(deploymentId)) {
        ResponseHelper.ValidationError(res, 'Invalid deployment ID');
        return;
      }

      const deployment = await this.DeploymentService.GetDeploymentById(deploymentId);

      if (!deployment) {
        ResponseHelper.NotFound(res, 'Deployment not found');
        return;
      }

      ResponseHelper.Success(res, 'Deployment retrieved successfully', { Deployment: deployment });
    } catch (error) {
      Logger.Error('Failed to get deployment', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve deployment');
    }
  };

  /**
   * Get deployment logs by ID
   * GET /api/deployments/:id/logs
   */
  public GetDeploymentLogs = async (req: Request, res: Response): Promise<void> => {
    try {
      const deploymentId = parseInt(req.params.id!, 10);

      if (isNaN(deploymentId)) {
        ResponseHelper.ValidationError(res, 'Invalid deployment ID');
        return;
      }

      const logs = await this.DeploymentService.GetDeploymentLogs(deploymentId);

      if (logs === null) {
        ResponseHelper.NotFound(res, 'Deployment logs not found');
        return;
      }

      ResponseHelper.Success(res, 'Logs retrieved successfully', { Logs: logs });
    } catch (error) {
      Logger.Error('Failed to get deployment logs', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve deployment logs');
    }
  };

  /**
   * Get deployments for a project
   * GET /api/projects/:projectId/deployments
   */
  public GetProjectDeployments = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.projectId!, 10);
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const offset = parseInt(req.query.offset as string, 10) || 0;

      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      const result = await this.DeploymentService.GetProjectDeployments(projectId, limit, offset);

      ResponseHelper.Success(res, 'Deployments retrieved successfully', {
        Deployments: result.Deployments,
        Total: result.Total,
        Limit: limit,
        Offset: offset,
      });
    } catch (error) {
      Logger.Error('Failed to get project deployments', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve deployments');
    }
  };

  /**
   * Create manual deployment
   * POST /api/projects/:projectId/deploy
   */
  public CreateManualDeployment = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.projectId!, 10);
      const userId = (req as any).user?.UserId;
      const username = (req as any).user?.Username;
      const userRole = (req as any).user?.Role;

      // Only admins and developers can trigger deployments
      if (userRole !== EUserRole.Admin && userRole !== EUserRole.Developer) {
        ResponseHelper.Forbidden(res, 'Insufficient permissions to trigger deployment');
        return;
      }

      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      const { Branch, CommitHash, CommitMessage } = req.body;

      const deployment = await this.DeploymentService.CreateDeployment({
        ProjectId: projectId,
        TriggeredBy: username || 'manual',
        Branch,
        CommitHash,
        CommitMessage,
        ManualTrigger: true,
        UserId: userId,
      });

      ResponseHelper.Created(res, 'Deployment created successfully', { Deployment: deployment });
    } catch (error) {
      Logger.Error('Failed to create manual deployment', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * Cancel deployment
   * POST /api/deployments/:id/cancel
   */
  public CancelDeployment = async (req: Request, res: Response): Promise<void> => {
    try {
      const deploymentId = parseInt(req.params.id!, 10);
      const userId = (req as any).user?.UserId;
      const userRole = (req as any).user?.Role;

      // Only admins and developers can cancel deployments
      if (userRole !== EUserRole.Admin && userRole !== EUserRole.Developer) {
        ResponseHelper.Forbidden(res, 'Insufficient permissions to cancel deployment');
        return;
      }

      if (isNaN(deploymentId)) {
        ResponseHelper.ValidationError(res, 'Invalid deployment ID');
        return;
      }

      await this.DeploymentService.CancelDeployment(deploymentId, userId);

      ResponseHelper.Success(res, 'Deployment cancelled successfully');
    } catch (error) {
      Logger.Error('Failed to cancel deployment', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * Retry failed deployment
   * POST /api/deployments/:id/retry
   */
  public RetryDeployment = async (req: Request, res: Response): Promise<void> => {
    try {
      const deploymentId = parseInt(req.params.id!, 10);
      const userId = (req as any).user?.UserId;
      const userRole = (req as any).user?.Role;

      // Only admins and developers can retry deployments
      if (userRole !== EUserRole.Admin && userRole !== EUserRole.Developer) {
        ResponseHelper.Forbidden(res, 'Insufficient permissions to retry deployment');
        return;
      }

      if (isNaN(deploymentId)) {
        ResponseHelper.ValidationError(res, 'Invalid deployment ID');
        return;
      }

      const newDeployment = await this.DeploymentService.RetryDeployment(deploymentId, userId);

      ResponseHelper.Created(res, 'Deployment retry initiated successfully', {
        Deployment: newDeployment,
      });
    } catch (error) {
      Logger.Error('Failed to retry deployment', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * Get deployment statistics
   * GET /api/deployments/statistics
   */
  public GetDeploymentStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = req.query.projectId
        ? parseInt(req.query.projectId as string, 10)
        : undefined;

      if (projectId !== undefined && isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      const statistics = await this.DeploymentService.GetDeploymentStatistics(projectId);

      ResponseHelper.Success(res, 'Statistics retrieved successfully', { Statistics: statistics });
    } catch (error) {
      Logger.Error('Failed to get deployment statistics', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve statistics');
    }
  };

  /**
   * Get queue status for all projects
   * GET /api/deployments/queue/status
   */
  public GetQueueStatus = async (_req: Request, res: Response): Promise<void> => {
    try {
      const queueStatus = this.QueueService.GetAllQueuesStatus();

      ResponseHelper.Success(res, 'Queue status retrieved successfully', {
        Queues: queueStatus,
      });
    } catch (error) {
      Logger.Error('Failed to get queue status', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve queue status');
    }
  };

  /**
   * Get queue status for specific project
   * GET /api/projects/:projectId/queue/status
   */
  public GetProjectQueueStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.projectId!, 10);

      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      const queueLength = this.QueueService.GetQueueLength(projectId);
      const isRunning = this.QueueService.IsRunning(projectId);

      ResponseHelper.Success(res, 'Queue status retrieved successfully', {
        ProjectId: projectId,
        QueueLength: queueLength,
        IsRunning: isRunning,
      });
    } catch (error) {
      Logger.Error('Failed to get project queue status', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve queue status');
    }
  };

  /**
   * Cancel all pending deployments for a project
   * POST /api/projects/:projectId/queue/cancel-all
   */
  public CancelPendingDeployments = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.projectId!, 10);
      const userRole = (req as any).user?.Role;

      // Only admins can cancel all pending deployments
      if (userRole !== EUserRole.Admin) {
        ResponseHelper.Forbidden(res, 'Only administrators can cancel all pending deployments');
        return;
      }

      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      const canceledCount = this.QueueService.CancelPendingDeployments(projectId);

      ResponseHelper.Success(res, `${canceledCount} pending deployments cancelled`, {
        CanceledCount: canceledCount,
      });
    } catch (error) {
      Logger.Error('Failed to cancel pending deployments', error as Error);
      ResponseHelper.Error(res, 'Failed to cancel pending deployments');
    }
  };
}

export default DeploymentController;
