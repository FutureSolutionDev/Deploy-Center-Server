/**
 * NotificationProviderRoutes — v3.0 F-006 (T062).
 * Mount path: /api/notifications/providers
 * RBAC: Admin only (provider holds credentials).
 */

import { Router } from 'express';
import NotificationProviderController from '@Controllers/NotificationProviderController';
import AuthMiddleware from '@Middleware/AuthMiddleware';
import RoleMiddleware from '@Middleware/RoleMiddleware';
import RateLimiterMiddleware from '@Middleware/RateLimiterMiddleware';
import { EUserRole } from '@Types/ICommon';

export class NotificationProviderRoutes {
  public Router: Router;
  private readonly Controller = new NotificationProviderController();
  private readonly AuthMiddleware = new AuthMiddleware();
  private readonly RoleMiddleware = new RoleMiddleware();
  private readonly RateLimiter = new RateLimiterMiddleware();

  constructor() {
    this.Router = Router();
    const auth = this.AuthMiddleware.Authenticate;
    const adminOnly = this.RoleMiddleware.RequireRole([EUserRole.Admin]);
    const rateLimit = this.RateLimiter.ApiLimiter;

    this.Router.get('/', auth, adminOnly, rateLimit, this.Controller.List);
    this.Router.post('/', auth, adminOnly, rateLimit, this.Controller.Create);
    this.Router.put('/:id', auth, adminOnly, rateLimit, this.Controller.Update);
    this.Router.delete('/:id', auth, adminOnly, rateLimit, this.Controller.Delete);
    this.Router.post('/:id/test', auth, adminOnly, rateLimit, this.Controller.Test);
  }
}

export default NotificationProviderRoutes;
