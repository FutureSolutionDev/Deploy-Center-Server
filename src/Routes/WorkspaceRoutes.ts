/**
 * WorkspaceRoutes — Deploy Center v3.0 / F-009 (T088).
 * Mount path: /api/workspaces
 * RBAC: Authenticated only (FR-035 — no role gate).
 * Owner-or-Admin enforcement for edit/delete lives in the controller.
 */

import { Router } from 'express';
import WorkspaceController from '@Controllers/WorkspaceController';
import AuthMiddleware from '@Middleware/AuthMiddleware';

export class WorkspaceRoutes {
  public Router: Router;
  private readonly Controller = new WorkspaceController();
  private readonly AuthMiddleware = new AuthMiddleware();

  constructor() {
    this.Router = Router();
    const auth = this.AuthMiddleware.Authenticate;

    this.Router.get('/', auth, this.Controller.List);
    this.Router.post('/', auth, this.Controller.Create);
    this.Router.put('/:id', auth, this.Controller.Update);
    this.Router.delete('/:id', auth, this.Controller.Delete);
  }
}

export default WorkspaceRoutes;
