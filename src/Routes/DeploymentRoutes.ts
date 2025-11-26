/**
 * Deployment Routes
 * Defines routes for deployment management endpoints
 * Following SOLID principles and PascalCase naming convention
 */

import { Router } from 'express';
import DeploymentController from '@Controllers/DeploymentController';
import AuthMiddleware from '@Middleware/AuthMiddleware';
import RoleMiddleware from '@Middleware/RoleMiddleware';
import RateLimiterMiddleware from '@Middleware/RateLimiterMiddleware';

export class DeploymentRoutes {
  public Router: Router;
  private readonly DeploymentController: DeploymentController;
  private readonly AuthMiddleware: AuthMiddleware;
  private readonly RoleMiddleware: RoleMiddleware;
  private readonly RateLimiter: RateLimiterMiddleware;

  constructor() {
    this.Router = Router();
    this.DeploymentController = new DeploymentController();
    this.AuthMiddleware = new AuthMiddleware();
    this.RoleMiddleware = new RoleMiddleware();
    this.RateLimiter = new RateLimiterMiddleware();
    this.InitializeRoutes();
  }

  private InitializeRoutes(): void {
    /**
     * GET /api/deployments/:id
     * Get deployment by ID
     */
    this.Router.get(
      '/:id',
      this.AuthMiddleware.Authenticate,
      this.RateLimiter.ApiLimiter,
      this.DeploymentController.GetDeploymentById
    );

    /**
     * GET /api/deployments/statistics
     * Get deployment statistics
     */
    this.Router.get(
      '/statistics',
      this.AuthMiddleware.Authenticate,
      this.RateLimiter.ApiLimiter,
      this.DeploymentController.GetDeploymentStatistics
    );

    /**
     * GET /api/deployments/queue/status
     * Get queue status for all projects
     */
    this.Router.get(
      '/queue/status',
      this.AuthMiddleware.Authenticate,
      this.RateLimiter.ApiLimiter,
      this.DeploymentController.GetQueueStatus
    );

    /**
     * POST /api/deployments/:id/cancel
     * Cancel deployment (Admin/Developer only)
     */
    this.Router.post(
      '/:id/cancel',
      this.AuthMiddleware.Authenticate,
      this.RoleMiddleware.RequireAdminOrDeveloper,
      this.RateLimiter.ApiLimiter,
      this.DeploymentController.CancelDeployment
    );

    /**
     * POST /api/deployments/:id/retry
     * Retry failed deployment (Admin/Developer only)
     */
    this.Router.post(
      '/:id/retry',
      this.AuthMiddleware.Authenticate,
      this.RoleMiddleware.RequireAdminOrDeveloper,
      this.RateLimiter.DeploymentLimiter,
      this.DeploymentController.RetryDeployment
    );

    /**
     * GET /api/projects/:projectId/deployments
     * Get deployments for a project
     */
    this.Router.get(
      '/projects/:projectId/deployments',
      this.AuthMiddleware.Authenticate,
      this.RateLimiter.ApiLimiter,
      this.DeploymentController.GetProjectDeployments
    );

    /**
     * POST /api/projects/:projectId/deploy
     * Create manual deployment (Admin/Developer only)
     */
    this.Router.post(
      '/projects/:projectId/deploy',
      this.AuthMiddleware.Authenticate,
      this.RoleMiddleware.RequireAdminOrDeveloper,
      this.RateLimiter.DeploymentLimiter,
      this.DeploymentController.CreateManualDeployment
    );

    /**
     * GET /api/projects/:projectId/queue/status
     * Get queue status for specific project
     */
    this.Router.get(
      '/projects/:projectId/queue/status',
      this.AuthMiddleware.Authenticate,
      this.RateLimiter.ApiLimiter,
      this.DeploymentController.GetProjectQueueStatus
    );

    /**
     * POST /api/projects/:projectId/queue/cancel-all
     * Cancel all pending deployments for a project (Admin only)
     */
    this.Router.post(
      '/projects/:projectId/queue/cancel-all',
      this.AuthMiddleware.Authenticate,
      this.RoleMiddleware.RequireAdmin,
      this.RateLimiter.ApiLimiter,
      this.DeploymentController.CancelPendingDeployments
    );
  }
}

export default DeploymentRoutes;
