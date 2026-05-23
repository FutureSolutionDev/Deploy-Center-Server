/**
 * NotificationProviderRoutes — v3.0 F-006 (T062).
 * Mount path: /api/notifications/providers
 * RBAC: Admin only (provider holds credentials).
 */

import { Router } from 'express';
import NotificationProviderController from '@Controllers/NotificationProviderController';
import AuthMiddleware from '@Middleware/AuthMiddleware';
import RoleMiddleware from '@Middleware/RoleMiddleware';
import { EUserRole } from '@Types/ICommon';

export class NotificationProviderRoutes {
  public Router: Router;
  private readonly Controller = new NotificationProviderController();
  private readonly AuthMiddleware = new AuthMiddleware();
  private readonly RoleMiddleware = new RoleMiddleware();

  constructor() {
    this.Router = Router();
    const auth = this.AuthMiddleware.Authenticate;
    const adminOnly = this.RoleMiddleware.RequireRole([EUserRole.Admin]);

    this.Router.get('/', auth, adminOnly, this.Controller.List);
    this.Router.post('/', auth, adminOnly, this.Controller.Create);
    this.Router.put('/:id', auth, adminOnly, this.Controller.Update);
    this.Router.delete('/:id', auth, adminOnly, this.Controller.Delete);
    this.Router.post('/:id/test', auth, adminOnly, this.Controller.Test);
  }
}

export default NotificationProviderRoutes;
