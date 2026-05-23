/**
 * EnvironmentVariableController — Deploy Center v3.0 / F-003.
 * Thin REST controller mounted under /api/projects/:projectId/env-vars.
 * Joi validates inputs; service performs encrypt/decrypt + persistence.
 * Auth + Admin/Manager gating provided by the route layer (T026).
 */

import { Request, Response } from 'express';
import Joi from 'joi';
import EnvironmentVariableService from '@Services/EnvironmentVariableService';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';

// Schema mirrors data-model.md §2 validation rules.
const KEY_NAME_PATTERN = /^[A-Z_][A-Z0-9_]{0,99}$/;

const CreateSchema = Joi.object({
  // Note: the regex literal contains `{0,99}` which Joi would otherwise
  // interpret as a template variable in the error message — so we describe
  // the pattern in prose instead of embedding the regex directly.
  KeyName: Joi.string().pattern(KEY_NAME_PATTERN).required().messages({
    'string.pattern.base':
      'KeyName must be a POSIX env-var name: uppercase letters, digits, underscore; start with a letter or underscore; 1-100 chars',
  }),
  Value: Joi.string().max(8192).required(),
  IsSecret: Joi.boolean().default(true),
});

const UpdateSchema = Joi.object({
  KeyName: Joi.string().pattern(KEY_NAME_PATTERN).optional(),
  Value: Joi.string().max(8192).optional(),
  IsSecret: Joi.boolean().optional(),
}).min(1);

function parseProjectId(req: Request, res: Response): number | null {
  const raw = req.params.projectId;
  const id = raw ? parseInt(raw, 10) : NaN;
  if (Number.isNaN(id) || id <= 0) {
    ResponseHelper.ValidationError(res, 'Invalid projectId');
    return null;
  }
  return id;
}

function parseId(req: Request, res: Response): number | null {
  const raw = req.params.id;
  const id = raw ? parseInt(raw, 10) : NaN;
  if (Number.isNaN(id) || id <= 0) {
    ResponseHelper.ValidationError(res, 'Invalid id');
    return null;
  }
  return id;
}

export class EnvironmentVariableController {
  private readonly Service: EnvironmentVariableService;

  constructor() {
    this.Service = new EnvironmentVariableService();
  }

  public List = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseProjectId(req, res);
      if (projectId === null) return;
      const items = await this.Service.ListByProject(projectId);
      ResponseHelper.Success(res, 'Environment variables retrieved', { Items: items });
    } catch (error) {
      Logger.Error('EnvVarController.List failed', error as Error);
      ResponseHelper.Error(res, 'Failed to list environment variables');
    }
  };

  public Create = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseProjectId(req, res);
      if (projectId === null) return;
      const { value, error } = CreateSchema.validate(req.body, { stripUnknown: true });
      if (error) {
        ResponseHelper.ValidationError(res, error.message);
        return;
      }
      const row = await this.Service.Create(projectId, value);
      ResponseHelper.Success(res, 'Environment variable created', {
        Id: row.Id,
        KeyName: row.KeyName,
        Value: row.IsSecret ? '***' : value.Value,
        IsSecret: row.IsSecret,
        CreatedAt: row.CreatedAt,
        UpdatedAt: row.UpdatedAt,
      });
    } catch (error) {
      const msg = (error as Error).message ?? '';
      if (msg.includes('already exists')) {
        ResponseHelper.ValidationError(res, msg);
        return;
      }
      Logger.Error('EnvVarController.Create failed', error as Error);
      ResponseHelper.Error(res, 'Failed to create environment variable');
    }
  };

  public Update = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseProjectId(req, res);
      const id = parseId(req, res);
      if (projectId === null || id === null) return;
      const { value, error } = UpdateSchema.validate(req.body, { stripUnknown: true });
      if (error) {
        ResponseHelper.ValidationError(res, error.message);
        return;
      }
      const row = await this.Service.Update(projectId, id, value);
      if (!row) {
        ResponseHelper.NotFound(res, 'Environment variable not found');
        return;
      }
      ResponseHelper.Success(res, 'Environment variable updated', {
        Id: row.Id,
        KeyName: row.KeyName,
        Value: row.IsSecret ? '***' : (value.Value as string | undefined) ?? '',
        IsSecret: row.IsSecret,
        CreatedAt: row.CreatedAt,
        UpdatedAt: row.UpdatedAt,
      });
    } catch (error) {
      const msg = (error as Error).message ?? '';
      if (msg.includes('already exists')) {
        ResponseHelper.ValidationError(res, msg);
        return;
      }
      Logger.Error('EnvVarController.Update failed', error as Error);
      ResponseHelper.Error(res, 'Failed to update environment variable');
    }
  };

  public Delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseProjectId(req, res);
      const id = parseId(req, res);
      if (projectId === null || id === null) return;
      const ok = await this.Service.Delete(projectId, id);
      if (!ok) {
        ResponseHelper.NotFound(res, 'Environment variable not found');
        return;
      }
      ResponseHelper.Success(res, 'Environment variable deleted', {});
    } catch (error) {
      Logger.Error('EnvVarController.Delete failed', error as Error);
      ResponseHelper.Error(res, 'Failed to delete environment variable');
    }
  };
}

export default EnvironmentVariableController;
