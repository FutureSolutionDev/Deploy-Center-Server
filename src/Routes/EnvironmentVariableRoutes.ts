/**
 * EnvironmentVariableRoutes — Deploy Center v3.0 / F-003.
 * Mounted under /api/projects/:projectId/env-vars.
 * Gated by AuthMiddleware + RoleMiddleware(Admin | Manager) per FR-010.
 */

import { Router } from 'express';
import EnvironmentVariableController from '@Controllers/EnvironmentVariableController';
import AuthMiddleware from '@Middleware/AuthMiddleware';
import RoleMiddleware from '@Middleware/RoleMiddleware';
import RateLimiterMiddleware from '@Middleware/RateLimiterMiddleware';
import { EUserRole } from '@Types/ICommon';

export class EnvironmentVariableRoutes {
  public Router: Router;
  private readonly Controller: EnvironmentVariableController;
  private readonly AuthMiddleware: AuthMiddleware;
  private readonly RoleMiddleware: RoleMiddleware;
  private readonly RateLimiter: RateLimiterMiddleware;

  constructor() {
    this.Router = Router({ mergeParams: true });
    this.Controller = new EnvironmentVariableController();
    this.AuthMiddleware = new AuthMiddleware();
    this.RoleMiddleware = new RoleMiddleware();
    this.RateLimiter = new RateLimiterMiddleware();
    this.InitializeRoutes();
  }

  private InitializeRoutes(): void {
    const auth = this.AuthMiddleware.Authenticate;
    const adminOrManager = this.RoleMiddleware.RequireRole([
      EUserRole.Admin,
      EUserRole.Manager,
    ]);
    const rateLimit = this.RateLimiter.ApiLimiter;

    /** GET    /api/projects/:projectId/env-vars       — list (secret values redacted) */
    this.Router.get('/', auth, adminOrManager, rateLimit, this.Controller.List);

    /** POST   /api/projects/:projectId/env-vars       — create */
    this.Router.post('/', auth, adminOrManager, rateLimit, this.Controller.Create);

    /** PUT    /api/projects/:projectId/env-vars/:id   — update */
    this.Router.put('/:id', auth, adminOrManager, rateLimit, this.Controller.Update);

    /** DELETE /api/projects/:projectId/env-vars/:id   — delete */
    this.Router.delete('/:id', auth, adminOrManager, rateLimit, this.Controller.Delete);
  }
}

export default EnvironmentVariableRoutes;
