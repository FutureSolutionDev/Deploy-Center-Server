/**
 * ProjectTemplateController — Deploy Center v3.0 / F-008 (T082).
 *
 * REST surface:
 *   GET    /api/project-templates         — list (filter by ?category=)
 *   GET    /api/project-templates/:id     — get one
 *   POST   /api/project-templates         — create (Admin/Manager)
 *   PUT    /api/project-templates/:id     — update (Admin/Manager; 422 on built-ins)
 *   DELETE /api/project-templates/:id     — delete (Admin/Manager; 422 on built-ins)
 *
 * Read endpoints are open to all authenticated users (the wizard needs them).
 * Write endpoints are gated at the route layer.
 */

import { Request, Response } from 'express';
import Joi from 'joi';
import ProjectTemplateService, {
  TemplateImmutableError,
} from '@Services/ProjectTemplateService';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';

const CATEGORIES = ['backend', 'frontend', 'static', 'other'] as const;

const CreateSchema = Joi.object({
  Name: Joi.string().min(1).max(100).required(),
  Description: Joi.string().allow('', null).optional(),
  Icon: Joi.string().allow('', null).optional(),
  Category: Joi.string().valid(...CATEGORIES).required(),
  DefaultConfig: Joi.object().required(),
});

const UpdateSchema = Joi.object({
  Name: Joi.string().min(1).max(100).optional(),
  Description: Joi.string().allow('', null).optional(),
  Icon: Joi.string().allow('', null).optional(),
  Category: Joi.string().valid(...CATEGORIES).optional(),
  DefaultConfig: Joi.object().optional(),
}).min(1);

function parseId(req: Request, res: Response): number | null {
  const id = parseInt(req.params.id!, 10);
  if (Number.isNaN(id) || id <= 0) {
    ResponseHelper.ValidationError(res, 'Invalid id');
    return null;
  }
  return id;
}

export class ProjectTemplateController {
  private readonly Service = new ProjectTemplateService();

  public List = async (req: Request, res: Response): Promise<void> => {
    try {
      const category = req.query.category as
        | 'backend'
        | 'frontend'
        | 'static'
        | 'other'
        | undefined;
      if (category && !CATEGORIES.includes(category)) {
        ResponseHelper.ValidationError(res, 'Invalid category');
        return;
      }
      const items = await this.Service.List(category);
      ResponseHelper.Success(res, 'Templates retrieved', { Items: items });
    } catch (err) {
      Logger.Error('TemplateController.List failed', err as Error);
      ResponseHelper.Error(res, 'Failed to list templates');
    }
  };

  public GetById = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req, res);
      if (id === null) return;
      const row = await this.Service.GetById(id);
      if (!row) {
        ResponseHelper.NotFound(res, 'Template not found');
        return;
      }
      ResponseHelper.Success(res, 'Template retrieved', row);
    } catch (err) {
      Logger.Error('TemplateController.GetById failed', err as Error);
      ResponseHelper.Error(res, 'Failed to fetch template');
    }
  };

  public Create = async (req: Request, res: Response): Promise<void> => {
    try {
      const { value, error } = CreateSchema.validate(req.body, { stripUnknown: true });
      if (error) {
        ResponseHelper.ValidationError(res, error.message);
        return;
      }
      const user = (req as unknown as { user?: { UserId: number } }).user;
      const row = await this.Service.Create({
        Name: value.Name,
        Description: value.Description ?? null,
        Icon: value.Icon ?? null,
        Category: value.Category,
        DefaultConfig: value.DefaultConfig,
        CreatedBy: user?.UserId ?? null,
      });
      ResponseHelper.Created(res, 'Template created', row);
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('already exists')) {
        ResponseHelper.ValidationError(res, msg);
        return;
      }
      Logger.Error('TemplateController.Create failed', err as Error);
      ResponseHelper.Error(res, 'Failed to create template');
    }
  };

  public Update = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req, res);
      if (id === null) return;
      const { value, error } = UpdateSchema.validate(req.body, { stripUnknown: true });
      if (error) {
        ResponseHelper.ValidationError(res, error.message);
        return;
      }
      const row = await this.Service.Update(id, value);
      if (!row) {
        ResponseHelper.NotFound(res, 'Template not found');
        return;
      }
      ResponseHelper.Success(res, 'Template updated', row);
    } catch (err) {
      if (err instanceof TemplateImmutableError) {
        ResponseHelper.UnprocessableEntity(res, err.message);
        return;
      }
      const msg = (err as Error).message ?? '';
      if (msg.includes('already exists')) {
        ResponseHelper.ValidationError(res, msg);
        return;
      }
      Logger.Error('TemplateController.Update failed', err as Error);
      ResponseHelper.Error(res, 'Failed to update template');
    }
  };

  public Delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req, res);
      if (id === null) return;
      const ok = await this.Service.Delete(id);
      if (!ok) {
        ResponseHelper.NotFound(res, 'Template not found');
        return;
      }
      ResponseHelper.Success(res, 'Template deleted');
    } catch (err) {
      if (err instanceof TemplateImmutableError) {
        ResponseHelper.UnprocessableEntity(res, err.message);
        return;
      }
      Logger.Error('TemplateController.Delete failed', err as Error);
      ResponseHelper.Error(res, 'Failed to delete template');
    }
  };
}

export default ProjectTemplateController;
