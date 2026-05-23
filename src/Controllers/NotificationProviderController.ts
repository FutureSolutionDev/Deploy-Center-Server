/**
 * NotificationProviderController — v3.0 F-006 (T061).
 * Thin REST wrapper. Joi validates per-type Config shape via alternatives.
 * Route layer enforces Admin-only RBAC.
 */

import { Request, Response } from 'express';
import Joi from 'joi';
import NotificationProviderService from '@Services/NotificationProviderService';
import NotificationChannelService from '@Services/NotificationChannelService';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import { ENotificationProviderType } from '@Types/ICommon';

const DiscordConfigSchema = Joi.object({
  webhookRoot: Joi.string().uri().required(),
});
const SlackConfigSchema = Joi.object({
  webhookUrl: Joi.string().uri().optional(),
  botToken: Joi.string().optional(),
}).or('webhookUrl', 'botToken');
const EmailConfigSchema = Joi.object({
  host: Joi.string().required(),
  port: Joi.number().integer().min(1).max(65535).default(587),
  secure: Joi.boolean().default(false),
  user: Joi.string().allow('').default(''),
  password: Joi.string().allow('').default(''),
  from: Joi.string().required(),
  presetName: Joi.string().valid('gmail', 'sendgrid', 'mailgun', 'custom').optional(),
});

function ConfigSchemaFor(type: ENotificationProviderType): Joi.ObjectSchema {
  switch (type) {
    case ENotificationProviderType.Discord: return DiscordConfigSchema;
    case ENotificationProviderType.Slack: return SlackConfigSchema;
    case ENotificationProviderType.Email: return EmailConfigSchema;
  }
}

const CreateSchema = Joi.object({
  Name: Joi.string().min(1).max(100).required(),
  Type: Joi.string().valid(...Object.values(ENotificationProviderType)).required(),
  Config: Joi.object().required(),
});
const UpdateSchema = Joi.object({
  Name: Joi.string().min(1).max(100).optional(),
  Config: Joi.object().optional(),
  IsActive: Joi.boolean().optional(),
}).min(1);

function parseId(req: Request, res: Response): number | null {
  const id = parseInt(req.params.id!, 10);
  if (Number.isNaN(id) || id <= 0) {
    ResponseHelper.ValidationError(res, 'Invalid id');
    return null;
  }
  return id;
}

export class NotificationProviderController {
  private readonly Service = new NotificationProviderService();
  private readonly ChannelService = new NotificationChannelService();

  public List = async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await this.Service.List(true);
      ResponseHelper.Success(res, 'Providers retrieved', { Items: items });
    } catch (err) {
      Logger.Error('ProviderController.List failed', err as Error);
      ResponseHelper.Error(res, 'Failed to list providers');
    }
  };

  public Create = async (req: Request, res: Response): Promise<void> => {
    try {
      const { value, error } = CreateSchema.validate(req.body, { stripUnknown: true });
      if (error) { ResponseHelper.ValidationError(res, error.message); return; }
      const cfgSchema = ConfigSchemaFor(value.Type as ENotificationProviderType);
      const cfgValid = cfgSchema.validate(value.Config, { stripUnknown: true });
      if (cfgValid.error) {
        ResponseHelper.ValidationError(res, `Invalid ${value.Type} config: ${cfgValid.error.message}`);
        return;
      }
      const user = (req as unknown as { user?: { UserId: number } }).user;
      const row = await this.Service.Create({
        Name: value.Name,
        Type: value.Type as ENotificationProviderType,
        Config: cfgValid.value,
        CreatedBy: user?.UserId ?? null,
      });
      ResponseHelper.Success(res, 'Provider created', {
        Id: row.Id, Name: row.Name, Type: row.Type, IsActive: row.IsActive,
        Config: '***', CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
      });
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('already exists')) { ResponseHelper.ValidationError(res, msg); return; }
      Logger.Error('ProviderController.Create failed', err as Error);
      ResponseHelper.Error(res, 'Failed to create provider');
    }
  };

  public Update = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req, res); if (id === null) return;
      const { value, error } = UpdateSchema.validate(req.body, { stripUnknown: true });
      if (error) { ResponseHelper.ValidationError(res, error.message); return; }
      // If updating Config, we need the existing provider's Type to pick the schema.
      const existing = await this.Service.GetById(id);
      if (!existing) { ResponseHelper.NotFound(res, 'Provider not found'); return; }
      if (value.Config) {
        const cfgValid = ConfigSchemaFor(existing.Type).validate(value.Config, { stripUnknown: true });
        if (cfgValid.error) {
          ResponseHelper.ValidationError(res, `Invalid ${existing.Type} config: ${cfgValid.error.message}`);
          return;
        }
        value.Config = cfgValid.value;
      }
      const row = await this.Service.Update(id, value);
      if (!row) { ResponseHelper.NotFound(res, 'Provider not found'); return; }
      ResponseHelper.Success(res, 'Provider updated', {
        Id: row.Id, Name: row.Name, Type: row.Type, IsActive: row.IsActive,
        Config: '***', CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
      });
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('already exists')) { ResponseHelper.ValidationError(res, msg); return; }
      Logger.Error('ProviderController.Update failed', err as Error);
      ResponseHelper.Error(res, 'Failed to update provider');
    }
  };

  public Delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req, res); if (id === null) return;
      const ok = await this.Service.Delete(id);
      if (!ok) { ResponseHelper.NotFound(res, 'Provider not found'); return; }
      ResponseHelper.Success(res, 'Provider deleted (channels and subscriptions cascaded)', {});
    } catch (err) {
      Logger.Error('ProviderController.Delete failed', err as Error);
      ResponseHelper.Error(res, 'Failed to delete provider');
    }
  };

  /**
   * POST /api/notifications/providers/:id/test — sends a test through the
   * FIRST channel under this provider. 422 if no channels yet (operator
   * needs to create one first).
   */
  public Test = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req, res); if (id === null) return;
      const channels = await this.ChannelService.List(id);
      if (channels.length === 0) {
        ResponseHelper.ValidationError(res, 'Provider has no channels to test — create a channel first');
        return;
      }
      await this.ChannelService.SendTest(channels[0]!.Id);
      ResponseHelper.Success(res, `Test sent via channel '${channels[0]!.Name}'`, {});
    } catch (err) {
      Logger.Error('ProviderController.Test failed', err as Error);
      ResponseHelper.Error(res, `Test failed: ${(err as Error).message}`);
    }
  };
}

export default NotificationProviderController;
