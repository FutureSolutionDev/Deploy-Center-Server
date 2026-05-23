/**
 * ProjectNotificationSubscriptionController — v3.0 F-006 (T061).
 * Scoped to project: /api/projects/:projectId/notification-subscriptions
 */

import { Request, Response } from 'express';
import Joi from 'joi';
import ProjectNotificationSubscriptionService from '@Services/ProjectNotificationSubscriptionService';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import { ENotificationEvent } from '@Types/ICommon';

const CreateSchema = Joi.object({
  ChannelId: Joi.number().integer().positive().required(),
  Events: Joi.array()
    .items(Joi.string().valid(...Object.values(ENotificationEvent)))
    .min(1)
    .unique()
    .required(),
});
const UpdateSchema = Joi.object({
  Events: Joi.array()
    .items(Joi.string().valid(...Object.values(ENotificationEvent)))
    .min(1)
    .unique()
    .optional(),
  IsActive: Joi.boolean().optional(),
}).min(1);

function parseProjectId(req: Request, res: Response): number | null {
  const id = parseInt(req.params.projectId!, 10);
  if (Number.isNaN(id) || id <= 0) {
    ResponseHelper.ValidationError(res, 'Invalid projectId');
    return null;
  }
  return id;
}
function parseId(req: Request, res: Response): number | null {
  const id = parseInt(req.params.id!, 10);
  if (Number.isNaN(id) || id <= 0) {
    ResponseHelper.ValidationError(res, 'Invalid id');
    return null;
  }
  return id;
}

export class ProjectNotificationSubscriptionController {
  private readonly Service = new ProjectNotificationSubscriptionService();

  public List = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseProjectId(req, res); if (projectId === null) return;
      const items = await this.Service.ListByProject(projectId);
      ResponseHelper.Success(res, 'Subscriptions retrieved', { Items: items });
    } catch (err) {
      Logger.Error('SubscriptionController.List failed', err as Error);
      ResponseHelper.Error(res, 'Failed to list subscriptions');
    }
  };

  public Create = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseProjectId(req, res); if (projectId === null) return;
      const { value, error } = CreateSchema.validate(req.body, { stripUnknown: true });
      if (error) { ResponseHelper.ValidationError(res, error.message); return; }
      const row = await this.Service.Create({
        ProjectId: projectId,
        ChannelId: value.ChannelId,
        Events: value.Events,
      });
      ResponseHelper.Success(res, 'Subscription created', {
        Id: row.Id, ProjectId: row.ProjectId, ChannelId: row.ChannelId,
        Events: row.Events, IsActive: row.IsActive,
        CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
      });
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('not found') || msg.includes('already subscribed') || msg.includes('Unknown event') || msg.includes('Duplicate')) {
        ResponseHelper.ValidationError(res, msg);
        return;
      }
      Logger.Error('SubscriptionController.Create failed', err as Error);
      ResponseHelper.Error(res, 'Failed to create subscription');
    }
  };

  public Update = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseProjectId(req, res);
      const id = parseId(req, res);
      if (projectId === null || id === null) return;
      const { value, error } = UpdateSchema.validate(req.body, { stripUnknown: true });
      if (error) { ResponseHelper.ValidationError(res, error.message); return; }
      const row = await this.Service.Update(projectId, id, value);
      if (!row) { ResponseHelper.NotFound(res, 'Subscription not found'); return; }
      ResponseHelper.Success(res, 'Subscription updated', {
        Id: row.Id, ProjectId: row.ProjectId, ChannelId: row.ChannelId,
        Events: row.Events, IsActive: row.IsActive,
        CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
      });
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('Unknown event') || msg.includes('Duplicate')) {
        ResponseHelper.ValidationError(res, msg);
        return;
      }
      Logger.Error('SubscriptionController.Update failed', err as Error);
      ResponseHelper.Error(res, 'Failed to update subscription');
    }
  };

  public Delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseProjectId(req, res);
      const id = parseId(req, res);
      if (projectId === null || id === null) return;
      const ok = await this.Service.Delete(projectId, id);
      if (!ok) { ResponseHelper.NotFound(res, 'Subscription not found'); return; }
      ResponseHelper.Success(res, 'Subscription deleted', {});
    } catch (err) {
      Logger.Error('SubscriptionController.Delete failed', err as Error);
      ResponseHelper.Error(res, 'Failed to delete subscription');
    }
  };
}

export default ProjectNotificationSubscriptionController;
