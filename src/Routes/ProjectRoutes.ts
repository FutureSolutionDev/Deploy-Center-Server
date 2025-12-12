/**
 * Project Routes
 * Defines routes for project management endpoints
 * Following SOLID principles and PascalCase naming convention
 */

import { Router } from 'express';
import ProjectController from '@Controllers/ProjectController';
import AuthMiddleware from '@Middleware/AuthMiddleware';
import RoleMiddleware from '@Middleware/RoleMiddleware';
import RateLimiterMiddleware from '@Middleware/RateLimiterMiddleware';

export class ProjectRoutes {
  public Router: Router;
  private readonly ProjectController: ProjectController;
  private readonly AuthMiddleware: AuthMiddleware;
  private readonly RoleMiddleware: RoleMiddleware;
  private readonly RateLimiter: RateLimiterMiddleware;

  constructor() {
    this.Router = Router();
    this.ProjectController = new ProjectController();
    this.AuthMiddleware = new AuthMiddleware();
    this.RoleMiddleware = new RoleMiddleware();
    this.RateLimiter = new RateLimiterMiddleware();
    this.InitializeRoutes();
  }

  private InitializeRoutes(): void {
    /**
     * GET /api/projects
     * Get all projects
     */
    this.Router.get(
      '/',
      this.AuthMiddleware.Authenticate,
      this.RateLimiter.ApiLimiter,
      this.ProjectController.GetAllProjects
    );

    /**
     * GET /api/projects/:id
     * Get project by ID
     */
    this.Router.get(
      '/:id',
      this.AuthMiddleware.Authenticate,
      this.RateLimiter.ApiLimiter,
      this.ProjectController.GetProjectById
    );

    /**
     * GET /api/projects/name/:name
     * Get project by name
     */
    this.Router.get(
      '/name/:name',
      this.AuthMiddleware.Authenticate,
      this.RateLimiter.ApiLimiter,
      this.ProjectController.GetProjectByName
    );

    /**
     * POST /api/projects
     * Create new project (Admin only)
     */
    this.Router.post(
      '/',
      this.AuthMiddleware.Authenticate,
      this.RoleMiddleware.RequireAdmin,
      this.RateLimiter.ApiLimiter,
      this.ProjectController.CreateProject
    );

    /**
     * PUT /api/projects/:id
     * Update project (Admin only)
     */
    this.Router.put(
      '/:id',
      this.AuthMiddleware.Authenticate,
      this.RoleMiddleware.RequireAdmin,
      this.RateLimiter.ApiLimiter,
      this.ProjectController.UpdateProject
    );

    /**
     * DELETE /api/projects/:id
     * Delete project (Admin only)
     */
    this.Router.delete(
      '/:id',
      this.AuthMiddleware.Authenticate,
      this.RoleMiddleware.RequireAdmin,
      this.RateLimiter.ApiLimiter,
      this.ProjectController.DeleteProject
    );

    /**
     * POST /api/projects/:id/regenerate-webhook
     * Regenerate webhook secret (Admin only)
     */
    this.Router.post(
      '/:id/regenerate-webhook',
      this.AuthMiddleware.Authenticate,
      this.RoleMiddleware.RequireAdmin,
      this.RateLimiter.ApiLimiter,
      this.ProjectController.RegenerateWebhookSecret
    );

    /**
     * GET /api/projects/:id/statistics
     * Get project statistics
     */
    this.Router.get(
      '/:id/statistics',
      this.AuthMiddleware.Authenticate,
      this.RateLimiter.ApiLimiter,
      this.ProjectController.GetProjectStatistics
    );

    /**
     * POST /api/projects/:id/deploy
     * Trigger manual deployment for project (Admin/Developer only)
     */
    this.Router.post(
      '/:id/deploy',
      this.AuthMiddleware.Authenticate,
      this.RoleMiddleware.RequireAdminOrDeveloper,
      this.RateLimiter.ApiLimiter,
      this.ProjectController.DeployProject
    );

    /**
     * GET /api/projects/:id/deployments
     * Get deployments for a project
     */
    this.Router.get(
      '/:id/deployments',
      this.AuthMiddleware.Authenticate,
      this.RateLimiter.ApiLimiter,
      this.ProjectController.GetProjectDeployments
    );

    // ========================================
    // SSH KEY MANAGEMENT ROUTES
    // ========================================

    /**
     * POST /api/projects/:id/ssh-key
     * Generate SSH key for project (Admin/Developer only)
     */
    this.Router.post(
      '/:id/ssh-key',
      this.AuthMiddleware.Authenticate,
      this.RoleMiddleware.RequireAdminOrDeveloper,
      this.RateLimiter.ApiLimiter,
      this.ProjectController.GenerateSshKey
    );

    /**
     * PUT /api/projects/:id/ssh-key
     * Regenerate (rotate) SSH key (Admin/Developer only)
     */
    this.Router.put(
      '/:id/ssh-key',
      this.AuthMiddleware.Authenticate,
      this.RoleMiddleware.RequireAdminOrDeveloper,
      this.RateLimiter.ApiLimiter,
      this.ProjectController.RegenerateSshKey
    );

    /**
     * DELETE /api/projects/:id/ssh-key
     * Delete SSH key from project (Admin/Developer only)
     */
    this.Router.delete(
      '/:id/ssh-key',
      this.AuthMiddleware.Authenticate,
      this.RoleMiddleware.RequireAdminOrDeveloper,
      this.RateLimiter.ApiLimiter,
      this.ProjectController.DeleteSshKey
    );

    /**
     * GET /api/projects/:id/ssh-key
     * Get SSH public key info (All authenticated users)
     */
    this.Router.get(
      '/:id/ssh-key',
      this.AuthMiddleware.Authenticate,
      this.RateLimiter.ApiLimiter,
      this.ProjectController.GetSshPublicKey
    );

    /**
     * PATCH /api/projects/:id/ssh-key/toggle
     * Toggle SSH key usage (Admin/Developer only)
     */
    this.Router.patch(
      '/:id/ssh-key/toggle',
      this.AuthMiddleware.Authenticate,
      this.RoleMiddleware.RequireAdminOrDeveloper,
      this.RateLimiter.ApiLimiter,
      this.ProjectController.ToggleSshKeyUsage
    );
  }
}

export default ProjectRoutes;
