/**
 * Deployment Routes
 * Defines routes for deployment management endpoints
 * Following SOLID principles and PascalCase naming convention
 */

import { Router } from 'express';
import DeploymentController from '@Controllers/DeploymentController';
import AuthMiddleware from '@Middleware/AuthMiddleware';
import RoleMiddleware from '@Middleware/RoleMiddleware';
import DeploymentAccessMiddleware from '@Middleware/DeploymentAccessMiddleware';
import RateLimiterMiddleware from '@Middleware/RateLimiterMiddleware';
import { RequireQueueReady } from '@Middleware/QueueReadyMiddleware';

export class DeploymentRoutes {
  public Router: Router;
  private readonly DeploymentController: DeploymentController;
  private readonly AuthMiddleware: AuthMiddleware;
  private readonly RoleMiddleware: RoleMiddleware;
  private readonly DeploymentAccessMiddleware: DeploymentAccessMiddleware;
  private readonly RateLimiter: RateLimiterMiddleware;

  constructor() {
    this.Router = Router();
    this.DeploymentController = new DeploymentController();
    this.AuthMiddleware = new AuthMiddleware();
    this.RoleMiddleware = new RoleMiddleware();
    this.DeploymentAccessMiddleware = new DeploymentAccessMiddleware();
    this.RateLimiter = new RateLimiterMiddleware();
    this.InitializeRoutes();
  }

  private InitializeRoutes(): void {
    /**
     * GET /api/deployments
     * Get all deployments
     */
    this.Router.get(
      '/',
      this.AuthMiddleware.Authenticate,
      this.RateLimiter.ApiLimiter,
      this.DeploymentController.GetAllDeployments
    );

    /**
     * GET /api/deployments/statistics
     * Get deployment statistics
     * IMPORTANT: Must be before /:id route to avoid matching "statistics" as an ID
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
     * IMPORTANT: Must be before /:id route to avoid matching "queue" as an ID
     */
    this.Router.get(
      '/queue/status',
      this.AuthMiddleware.Authenticate,
      this.RateLimiter.ApiLimiter,
      this.DeploymentController.GetQueueStatus
    );

    /**
     * GET /api/deployments/:id
     * Get deployment by ID (with access control based on project ownership)
     */
    this.Router.get(
      '/:id',
      this.AuthMiddleware.Authenticate,
      this.DeploymentAccessMiddleware.CheckDeploymentAccess,
      this.RateLimiter.ApiLimiter,
      this.DeploymentController.GetDeploymentById
    );

    /**
     * GET /api/deployments/:id/log/download — F-004 (T037) download as attachment
     */
    this.Router.get(
      '/:id/log/download',
      this.AuthMiddleware.Authenticate,
      this.RateLimiter.ApiLimiter,
      this.DeploymentController.DownloadDeploymentLog
    );

    /**
     * GET /api/deployments/:id/logs
     * Get deployment logs by ID (with access control based on project ownership)
     */
    this.Router.get(
      '/:id/logs',
      this.AuthMiddleware.Authenticate,
      this.DeploymentAccessMiddleware.CheckDeploymentAccess,
      this.RateLimiter.ApiLimiter,
      this.DeploymentController.GetDeploymentLogs
    );

    /**
     * POST /api/deployments/:id/cancel
     * Cancel deployment (Admin or Project Owner only)
     */
    this.Router.post(
      '/:id/cancel',
      this.AuthMiddleware.Authenticate,
      this.DeploymentAccessMiddleware.CheckDeploymentModifyAccess,
      this.RateLimiter.ApiLimiter,
      this.DeploymentController.CancelDeployment
    );

    /**
     * POST /api/deployments/:id/retry
     * Retry failed deployment (Admin or Project Owner only)
     */
    this.Router.post(
      '/:id/retry',
      this.AuthMiddleware.Authenticate,
      this.DeploymentAccessMiddleware.CheckDeploymentModifyAccess,
      this.RateLimiter.DeploymentLimiter,
      RequireQueueReady, // F-001 FR-005b — 503 if Redis down
      this.DeploymentController.RetryDeployment
    );

    /**
     * POST /api/deployments/:id/rollback — F-007 (T068)
     * Rolls a Failed deployment back to the project's last successful commit.
     * RBAC: Admin / Manager / Developer-who-is-member (via DeploymentAccessMiddleware).
     */
    this.Router.post(
      '/:id/rollback',
      this.AuthMiddleware.Authenticate,
      this.DeploymentAccessMiddleware.CheckDeploymentModifyAccess,
      this.RateLimiter.DeploymentLimiter,
      RequireQueueReady,
      this.DeploymentController.Rollback
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
     * Create manual deployment (Admin / Manager / Developer)
     */
    this.Router.post(
      '/projects/:projectId/deploy',
      this.AuthMiddleware.Authenticate,
      this.RoleMiddleware.RequireAdminManagerOrDeveloper,
      this.RateLimiter.DeploymentLimiter,
      RequireQueueReady, // F-001 FR-005b — 503 if Redis down
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
