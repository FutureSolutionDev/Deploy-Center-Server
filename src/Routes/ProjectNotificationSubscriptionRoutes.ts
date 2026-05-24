/**
 * ProjectNotificationSubscriptionRoutes — v3.0 F-006 (T062).
 * Mount path: /api/projects/:projectId/notification-subscriptions
 * RBAC: Admin or Manager (v3.0 default; expandable later).
 */

import { Router } from 'express';
import ProjectNotificationSubscriptionController from '@Controllers/ProjectNotificationSubscriptionController';
import AuthMiddleware from '@Middleware/AuthMiddleware';
import RoleMiddleware from '@Middleware/RoleMiddleware';
import RateLimiterMiddleware from '@Middleware/RateLimiterMiddleware';
import { EUserRole } from '@Types/ICommon';

export class ProjectNotificationSubscriptionRoutes {
  public Router: Router;
  private readonly Controller = new ProjectNotificationSubscriptionController();
  private readonly AuthMiddleware = new AuthMiddleware();
  private readonly RoleMiddleware = new RoleMiddleware();
  private readonly RateLimiter = new RateLimiterMiddleware();

  constructor() {
    this.Router = Router({ mergeParams: true });
    const auth = this.AuthMiddleware.Authenticate;
    const adminOrManager = this.RoleMiddleware.RequireRole([EUserRole.Admin, EUserRole.Manager]);
    const rateLimit = this.RateLimiter.ApiLimiter;

    this.Router.get('/', auth, adminOrManager, rateLimit, this.Controller.List);
    this.Router.post('/', auth, adminOrManager, rateLimit, this.Controller.Create);
    this.Router.put('/:id', auth, adminOrManager, rateLimit, this.Controller.Update);
    this.Router.delete('/:id', auth, adminOrManager, rateLimit, this.Controller.Delete);
  }
}

export default ProjectNotificationSubscriptionRoutes;
