/**
 * Dashboard Routes
 * Defines routes for dashboard and statistics
 * Following SOLID principles and PascalCase naming convention
 */

import { Router } from 'express';
import { DashboardController } from '@Controllers/DashboardController';
import { AuthMiddleware } from '@Middleware/AuthMiddleware';

export class DashboardRoutes {
  public Router: Router;
  private readonly DashboardController: DashboardController;
  private readonly AuthMiddleware: AuthMiddleware;

  constructor() {
    this.Router = Router();
    this.DashboardController = new DashboardController();
    this.AuthMiddleware = new AuthMiddleware();
    this.InitializeRoutes();
  }

  private InitializeRoutes(): void {
    /**
     * GET /api/dashboard/summary
     * Get dashboard summary (stats + recent 5 deployments)
     * Requires: Authentication
     */
    this.Router.get(
      '/summary',
      this.AuthMiddleware.Authenticate,
      this.DashboardController.GetDashboardSummary
    );

    /**
     * GET /api/dashboard/stats
     * Get deployment statistics for a time range
     * Requires: Authentication
     * Query params:
     * - startDate: ISO date string (optional)
     * - endDate: ISO date string (optional)
     */
    this.Router.get(
      '/stats',
      this.AuthMiddleware.Authenticate,
      this.DashboardController.GetDeploymentStats
    );

    /**
     * GET /api/dashboard/project-activity
     * Get project activity summary (deployment counts per project)
     * Requires: Authentication
     * Query params:
     * - limit: number (optional, defaults to 10)
     */
    this.Router.get(
      '/project-activity',
      this.AuthMiddleware.Authenticate,
      this.DashboardController.GetProjectActivity
    );
  }
}

export default DashboardRoutes;
