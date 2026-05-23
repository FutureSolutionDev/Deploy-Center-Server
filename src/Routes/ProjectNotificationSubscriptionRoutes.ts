/**
 * ProjectNotificationSubscriptionRoutes — v3.0 F-006 (T062).
 * Mount path: /api/projects/:projectId/notification-subscriptions
 * RBAC: Admin or Manager (v3.0 default; expandable later).
 */

import { Router } from 'express';
import ProjectNotificationSubscriptionController from '@Controllers/ProjectNotificationSubscriptionController';
import AuthMiddleware from '@Middleware/AuthMiddleware';
import RoleMiddleware from '@Middleware/RoleMiddleware';
import { EUserRole } from '@Types/ICommon';

export class ProjectNotificationSubscriptionRoutes {
  public Router: Router;
  private readonly Controller = new ProjectNotificationSubscriptionController();
  private readonly AuthMiddleware = new AuthMiddleware();
  private readonly RoleMiddleware = new RoleMiddleware();

  constructor() {
    this.Router = Router({ mergeParams: true });
    const auth = this.AuthMiddleware.Authenticate;
    const adminOrManager = this.RoleMiddleware.RequireRole([EUserRole.Admin, EUserRole.Manager]);

    this.Router.get('/', auth, adminOrManager, this.Controller.List);
    this.Router.post('/', auth, adminOrManager, this.Controller.Create);
    this.Router.put('/:id', auth, adminOrManager, this.Controller.Update);
    this.Router.delete('/:id', auth, adminOrManager, this.Controller.Delete);
  }
}

export default ProjectNotificationSubscriptionRoutes;
