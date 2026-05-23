/**
 * NotificationChannelRoutes — v3.0 F-006 (T062).
 * Mount path: /api/notifications/channels
 * RBAC: Admin or Manager.
 */

import { Router } from 'express';
import NotificationChannelController from '@Controllers/NotificationChannelController';
import AuthMiddleware from '@Middleware/AuthMiddleware';
import RoleMiddleware from '@Middleware/RoleMiddleware';
import { EUserRole } from '@Types/ICommon';

export class NotificationChannelRoutes {
  public Router: Router;
  private readonly Controller = new NotificationChannelController();
  private readonly AuthMiddleware = new AuthMiddleware();
  private readonly RoleMiddleware = new RoleMiddleware();

  constructor() {
    this.Router = Router();
    const auth = this.AuthMiddleware.Authenticate;
    const adminOrManager = this.RoleMiddleware.RequireRole([EUserRole.Admin, EUserRole.Manager]);

    this.Router.get('/', auth, adminOrManager, this.Controller.List);
    this.Router.post('/', auth, adminOrManager, this.Controller.Create);
    this.Router.put('/:id', auth, adminOrManager, this.Controller.Update);
    this.Router.delete('/:id', auth, adminOrManager, this.Controller.Delete);
    this.Router.post('/:id/test', auth, adminOrManager, this.Controller.Test);
  }
}

export default NotificationChannelRoutes;
