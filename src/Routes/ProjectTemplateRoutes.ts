/**
 * ProjectTemplateRoutes — Deploy Center v3.0 / F-008 (T082).
 * Mount path: /api/project-templates
 * RBAC: reads open to all authenticated users; writes Admin/Manager.
 */

import { Router } from 'express';
import ProjectTemplateController from '@Controllers/ProjectTemplateController';
import AuthMiddleware from '@Middleware/AuthMiddleware';
import RoleMiddleware from '@Middleware/RoleMiddleware';
import { EUserRole } from '@Types/ICommon';

export class ProjectTemplateRoutes {
  public Router: Router;
  private readonly Controller = new ProjectTemplateController();
  private readonly AuthMiddleware = new AuthMiddleware();
  private readonly RoleMiddleware = new RoleMiddleware();

  constructor() {
    this.Router = Router();
    const auth = this.AuthMiddleware.Authenticate;
    const adminOrManager = this.RoleMiddleware.RequireRole([
      EUserRole.Admin,
      EUserRole.Manager,
    ]);

    this.Router.get('/', auth, this.Controller.List);
    this.Router.get('/:id', auth, this.Controller.GetById);
    this.Router.post('/', auth, adminOrManager, this.Controller.Create);
    this.Router.put('/:id', auth, adminOrManager, this.Controller.Update);
    this.Router.delete('/:id', auth, adminOrManager, this.Controller.Delete);
  }
}

export default ProjectTemplateRoutes;
