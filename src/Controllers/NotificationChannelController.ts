/**
 * NotificationChannelController — v3.0 F-006 (T061).
 * CRUD + Test endpoint. ProviderId immutable on update.
 */

import { Request, Response } from 'express';
import Joi from 'joi';
import NotificationChannelService from '@Services/NotificationChannelService';
import NotificationProviderService from '@Services/NotificationProviderService';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import { ENotificationProviderType } from '@Types/ICommon';

const DiscordDeliverySchema = Joi.object({
  webhookSuffix: Joi.string().optional(),
  overrideWebhook: Joi.string().uri().optional(),
}).or('webhookSuffix', 'overrideWebhook');
const SlackDeliverySchema = Joi.object({
  channel: Joi.string().min(1).required(),
});
const EmailDeliverySchema = Joi.object({
  recipients: Joi.array().items(Joi.string().email()).min(1).required(),
});

function DeliverySchemaFor(type: ENotificationProviderType): Joi.ObjectSchema {
  switch (type) {
    case ENotificationProviderType.Discord: return DiscordDeliverySchema;
    case ENotificationProviderType.Slack: return SlackDeliverySchema;
    case ENotificationProviderType.Email: return EmailDeliverySchema;
  }
}

const CreateSchema = Joi.object({
  ProviderId: Joi.number().integer().positive().required(),
  Name: Joi.string().min(1).max(100).required(),
  DeliveryConfig: Joi.object().required(),
});
const UpdateSchema = Joi.object({
  Name: Joi.string().min(1).max(100).optional(),
  DeliveryConfig: Joi.object().optional(),
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

export class NotificationChannelController {
  private readonly Service = new NotificationChannelService();
  private readonly ProviderService = new NotificationProviderService();

  public List = async (req: Request, res: Response): Promise<void> => {
    try {
      const providerId = req.query.providerId
        ? parseInt(String(req.query.providerId), 10)
        : undefined;
      const items = await this.Service.List(providerId);
      ResponseHelper.Success(res, 'Channels retrieved', { Items: items });
    } catch (err) {
      Logger.Error('ChannelController.List failed', err as Error);
      ResponseHelper.Error(res, 'Failed to list channels');
    }
  };

  public Create = async (req: Request, res: Response): Promise<void> => {
    try {
      const { value, error } = CreateSchema.validate(req.body, { stripUnknown: true });
      if (error) { ResponseHelper.ValidationError(res, error.message); return; }
      const provider = await this.ProviderService.GetById(value.ProviderId);
      if (!provider) { ResponseHelper.NotFound(res, 'Provider not found'); return; }
      const dValid = DeliverySchemaFor(provider.Type).validate(value.DeliveryConfig, { stripUnknown: true });
      if (dValid.error) {
        ResponseHelper.ValidationError(res, `Invalid ${provider.Type} delivery config: ${dValid.error.message}`);
        return;
      }
      const row = await this.Service.Create({
        ProviderId: value.ProviderId,
        Name: value.Name,
        DeliveryConfig: dValid.value,
      });
      ResponseHelper.Success(res, 'Channel created', {
        Id: row.Id, ProviderId: row.ProviderId, Name: row.Name,
        DeliveryConfig: '***', IsActive: row.IsActive,
        CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
      });
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('already exists') || msg.includes('not found')) {
        ResponseHelper.ValidationError(res, msg);
        return;
      }
      Logger.Error('ChannelController.Create failed', err as Error);
      ResponseHelper.Error(res, 'Failed to create channel');
    }
  };

  public Update = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req, res); if (id === null) return;
      const { value, error } = UpdateSchema.validate(req.body, { stripUnknown: true });
      if (error) { ResponseHelper.ValidationError(res, error.message); return; }
      const existing = await this.Service.GetById(id);
      if (!existing) { ResponseHelper.NotFound(res, 'Channel not found'); return; }
      if (value.DeliveryConfig) {
        const provider = await this.ProviderService.GetById(existing.ProviderId);
        if (!provider) { ResponseHelper.Error(res, 'Provider referential integrity error'); return; }
        const dValid = DeliverySchemaFor(provider.Type).validate(value.DeliveryConfig, { stripUnknown: true });
        if (dValid.error) {
          ResponseHelper.ValidationError(res, `Invalid ${provider.Type} delivery config: ${dValid.error.message}`);
          return;
        }
        value.DeliveryConfig = dValid.value;
      }
      const row = await this.Service.Update(id, value);
      if (!row) { ResponseHelper.NotFound(res, 'Channel not found'); return; }
      ResponseHelper.Success(res, 'Channel updated', {
        Id: row.Id, ProviderId: row.ProviderId, Name: row.Name,
        DeliveryConfig: '***', IsActive: row.IsActive,
        CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
      });
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('already exists')) { ResponseHelper.ValidationError(res, msg); return; }
      Logger.Error('ChannelController.Update failed', err as Error);
      ResponseHelper.Error(res, 'Failed to update channel');
    }
  };

  public Delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req, res); if (id === null) return;
      const ok = await this.Service.Delete(id);
      if (!ok) { ResponseHelper.NotFound(res, 'Channel not found'); return; }
      ResponseHelper.Success(res, 'Channel deleted (subscriptions cascaded)', {});
    } catch (err) {
      Logger.Error('ChannelController.Delete failed', err as Error);
      ResponseHelper.Error(res, 'Failed to delete channel');
    }
  };

  public Test = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseId(req, res); if (id === null) return;
      await this.Service.SendTest(id);
      ResponseHelper.Success(res, 'Test message sent', { Delivered: true });
    } catch (err) {
      Logger.Error('ChannelController.Test failed', err as Error);
      ResponseHelper.Error(res, `Test failed: ${(err as Error).message}`);
    }
  };
}

export default NotificationChannelController;
