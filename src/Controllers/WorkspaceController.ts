/**
 * WorkspaceController — Deploy Center v3.0 / F-009 (T088).
 * No role gating beyond Authenticate (FR-035 — open to anyone who sees projects).
 * Owner-only edit/delete enforced inside handlers (or Admin).
 */

import { Request, Response } from 'express';
import Joi from 'joi';
import WorkspaceService from '@Services/WorkspaceService';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import { EUserRole } from '@Types/ICommon';
import { WORKSPACE_ICON_KEYS } from '@Types/IWorkspaceIcons';

const ColorRule = Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).message('Color must be #RRGGBB');
const IconRule = Joi.string().valid(...WORKSPACE_ICON_KEYS);

const CreateSchema = Joi.object({
  Name: Joi.string().min(1).max(100).required(),
  Description: Joi.string().allow('', null).max(1000).optional(),
  Color: ColorRule.required(),
  Icon: IconRule.optional(),
});
const UpdateSchema = Joi.object({
  Name: Joi.string().min(1).max(100).optional(),
  Description: Joi.string().allow('', null).max(1000).optional(),
  Color: ColorRule.optional(),
  Icon: IconRule.optional(),
  IsActive: Joi.boolean().optional(),
}).min(1);
const AssignSchema = Joi.object({
  WorkspaceId: Joi.number().integer().positive().allow(null).required(),
});

function parseId(req: Request, res: Response, name = 'id'): number | null {
  const raw = req.params[name];
  const id = raw ? parseInt(raw, 10) : NaN;
  if (Number.isNaN(id) || id <= 0) {
    ResponseHelper.ValidationError(res, `Invalid ${name}`);
    return null;
  }
  return id;
}

function requireUser(req: Request, res: Response): { UserId: number; Role: EUserRole } | null {
  const user = (req as unknown as { user?: { UserId: number; Role: EUserRole } }).user;
  if (!user || typeof user.UserId !== 'number') {
    ResponseHelper.Unauthorized(res, 'Authentication required');
    return null;
  }
  return user;
}

export class WorkspaceController {
  private readonly Service = new WorkspaceService();

  public List = async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await this.Service.List();
      const unassigned = await this.Service.UnassignedProjectCount();
      ResponseHelper.Success(res, 'Workspaces retrieved', {
        Items: items,
        UnassignedProjectCount: unassigned,
      });
    } catch (err) {
      Logger.Error('WorkspaceController.List failed', err as Error);
      ResponseHelper.Error(res, 'Failed to list workspaces');
    }
  };

  public Create = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = requireUser(req, res); if (!user) return;
      const { value, error } = CreateSchema.validate(req.body, { stripUnknown: true });
      if (error) { ResponseHelper.ValidationError(res, error.message); return; }
      const row = await this.Service.Create({ ...value, CreatedBy: user.UserId });
      ResponseHelper.Success(res, 'Workspace created', row.toJSON());
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('already exists') || msg.includes('Unknown') || msg.includes('Color must')) {
        ResponseHelper.ValidationError(res, msg);
        return;
      }
      Logger.Error('WorkspaceController.Create failed', err as Error);
      ResponseHelper.Error(res, 'Failed to create workspace');
    }
  };

  public Update = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = requireUser(req, res); if (!user) return;
      const id = parseId(req, res); if (id === null) return;
      const existing = await this.Service.GetById(id);
      if (!existing) { ResponseHelper.NotFound(res, 'Workspace not found'); return; }
      // Owner or Admin only
      if (existing.CreatedBy !== user.UserId && user.Role !== EUserRole.Admin) {
        ResponseHelper.Forbidden(res, 'Only the workspace owner (or Admin) can edit it');
        return;
      }
      const { value, error } = UpdateSchema.validate(req.body, { stripUnknown: true });
      if (error) { ResponseHelper.ValidationError(res, error.message); return; }
      const row = await this.Service.Update(id, value);
      if (!row) { ResponseHelper.NotFound(res, 'Workspace not found'); return; }
      ResponseHelper.Success(res, 'Workspace updated', row.toJSON());
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('already exists') || msg.includes('Unknown') || msg.includes('Color must')) {
        ResponseHelper.ValidationError(res, msg);
        return;
      }
      Logger.Error('WorkspaceController.Update failed', err as Error);
      ResponseHelper.Error(res, 'Failed to update workspace');
    }
  };

  public Delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = requireUser(req, res); if (!user) return;
      const id = parseId(req, res); if (id === null) return;
      const existing = await this.Service.GetById(id);
      if (!existing) { ResponseHelper.NotFound(res, 'Workspace not found'); return; }
      if (existing.CreatedBy !== user.UserId && user.Role !== EUserRole.Admin) {
        ResponseHelper.Forbidden(res, 'Only the workspace owner (or Admin) can delete it');
        return;
      }
      await this.Service.Delete(id);
      ResponseHelper.Success(res, 'Workspace deleted; projects moved to Unassigned', {});
    } catch (err) {
      Logger.Error('WorkspaceController.Delete failed', err as Error);
      ResponseHelper.Error(res, 'Failed to delete workspace');
    }
  };

  /**
   * PATCH /api/projects/:projectId/workspace
   * Body: { WorkspaceId: number | null }
   * Open to any authenticated user — same RBAC as viewing projects.
   */
  public AssignProjectWorkspace = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = requireUser(req, res); if (!user) return;
      const projectId = parseId(req, res, 'projectId'); if (projectId === null) return;
      const { value, error } = AssignSchema.validate(req.body, { stripUnknown: true });
      if (error) { ResponseHelper.ValidationError(res, error.message); return; }
      const project = await this.Service.AssignProject(projectId, value.WorkspaceId);
      if (!project) { ResponseHelper.NotFound(res, 'Project not found'); return; }
      ResponseHelper.Success(res, 'Project workspace updated', {
        ProjectId: project.Id, WorkspaceId: project.WorkspaceId,
      });
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('not found')) {
        ResponseHelper.ValidationError(res, msg);
        return;
      }
      Logger.Error('WorkspaceController.AssignProjectWorkspace failed', err as Error);
      ResponseHelper.Error(res, 'Failed to update project workspace');
    }
  };
}

export default WorkspaceController;
