/**
 * NotificationChannelService — Deploy Center v3.0 / F-006 (T058).
 * CRUD + Test message. DeliveryConfig encrypted per row; ProviderId immutable.
 */

import Logger from '@Utils/Logger';
import EncryptionHelper from '@Utils/EncryptionHelper';
import { NotificationProvider, NotificationChannel } from '@Models/index';
import { EDeploymentStatus, ENotificationEvent } from '@Types/ICommon';
import NotificationProviderService from './NotificationProviderService';
import { DiscordDispatcher } from './Notifications/DiscordDispatcher';
import { SlackDispatcher } from './Notifications/SlackDispatcher';
import { EmailDispatcher } from './Notifications/EmailDispatcher';
import type {
  IDeliveryConfig,
  IDiscordDeliveryConfig,
  ISlackDeliveryConfig,
  IEmailDeliveryConfig,
  INotificationDispatcher,
  INotificationPayload,
} from './Notifications/INotificationDispatcher';

export interface IChannelListItem {
  Id: number;
  ProviderId: number;
  ProviderName?: string;
  ProviderType?: string;
  Name: string;
  IsActive: boolean;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface IChannelCreateInput {
  ProviderId: number;
  Name: string;
  DeliveryConfig: IDiscordDeliveryConfig | ISlackDeliveryConfig | IEmailDeliveryConfig;
}

export interface IChannelUpdateInput {
  Name?: string;
  DeliveryConfig?: IDiscordDeliveryConfig | ISlackDeliveryConfig | IEmailDeliveryConfig;
  IsActive?: boolean;
}

export class NotificationChannelService {
  private readonly providerService = new NotificationProviderService();

  public async List(providerId?: number): Promise<IChannelListItem[]> {
    const where = providerId ? { ProviderId: providerId } : {};
    const rows = await NotificationChannel.findAll({
      where,
      include: [{ model: NotificationProvider, as: 'Provider', attributes: ['Name', 'Type'] }],
      order: [['Name', 'ASC']],
    });
    return rows.map((r) => ({
      Id: r.Id,
      ProviderId: r.ProviderId,
      ProviderName: (r as unknown as { Provider?: { Name: string; Type: string } }).Provider?.Name,
      ProviderType: (r as unknown as { Provider?: { Name: string; Type: string } }).Provider?.Type,
      Name: r.Name,
      IsActive: r.IsActive,
      CreatedAt: r.CreatedAt,
      UpdatedAt: r.UpdatedAt,
    }));
  }

  public async GetById(id: number): Promise<NotificationChannel | null> {
    return NotificationChannel.findByPk(id);
  }

  public Decrypt(row: NotificationChannel): IDeliveryConfig {
    const json = EncryptionHelper.Decrypt({
      Encrypted: row.DeliveryConfigEncrypted,
      Iv: row.Iv,
      AuthTag: row.AuthTag,
    });
    return JSON.parse(json) as IDeliveryConfig;
  }

  public async Create(input: IChannelCreateInput): Promise<NotificationChannel> {
    const provider = await NotificationProvider.findByPk(input.ProviderId);
    if (!provider) throw new Error(`Provider ${input.ProviderId} not found`);
    const dupe = await NotificationChannel.findOne({
      where: { ProviderId: input.ProviderId, Name: input.Name },
    });
    if (dupe) {
      throw new Error(`Channel '${input.Name}' already exists for provider ${input.ProviderId}`);
    }
    const enc = EncryptionHelper.Encrypt(JSON.stringify(input.DeliveryConfig));
    const row = await NotificationChannel.create({
      ProviderId: input.ProviderId,
      Name: input.Name,
      DeliveryConfigEncrypted: enc.Encrypted,
      Iv: enc.Iv,
      AuthTag: enc.AuthTag,
      IsActive: true,
    });
    Logger.Info('NotificationChannel created', { id: row.Id, providerId: row.ProviderId });
    return row;
  }

  public async Update(id: number, patch: IChannelUpdateInput): Promise<NotificationChannel | null> {
    const row = await NotificationChannel.findByPk(id);
    if (!row) return null;
    if (patch.Name && patch.Name !== row.Name) {
      const clash = await NotificationChannel.findOne({
        where: { ProviderId: row.ProviderId, Name: patch.Name },
      });
      if (clash && clash.Id !== id) {
        throw new Error(`Channel '${patch.Name}' already exists for provider ${row.ProviderId}`);
      }
      row.Name = patch.Name;
    }
    if (patch.DeliveryConfig) {
      const enc = EncryptionHelper.Encrypt(JSON.stringify(patch.DeliveryConfig));
      row.DeliveryConfigEncrypted = enc.Encrypted;
      row.Iv = enc.Iv;
      row.AuthTag = enc.AuthTag;
    }
    if (patch.IsActive !== undefined) row.IsActive = patch.IsActive;
    await row.save();
    return row;
  }

  public async Delete(id: number): Promise<boolean> {
    const deleted = await NotificationChannel.destroy({ where: { Id: id } });
    if (deleted > 0) Logger.Info('NotificationChannel deleted (cascades to subs)', { id });
    return deleted > 0;
  }

  /**
   * Send a labelled test message through this channel. Reads provider creds
   * + channel delivery config, picks the right dispatcher, fires once.
   * Surfaces dispatcher errors to caller so the UI can show the actual reason.
   */
  public async SendTest(channelId: number): Promise<void> {
    const channel = await NotificationChannel.findByPk(channelId, {
      include: [{ model: NotificationProvider, as: 'Provider' }],
    });
    if (!channel) throw new Error('Channel not found');
    const provider = (channel as unknown as { Provider?: NotificationProvider }).Provider;
    if (!provider) throw new Error('Channel provider not found (referential integrity issue)');

    const dispatcher = pickDispatcher(provider.Type);
    const providerConfig = this.providerService.Decrypt(provider);
    const deliveryConfig = this.Decrypt(channel);
    const payload: INotificationPayload = {
      Event: ENotificationEvent.DeploymentSucceeded,
      Status: EDeploymentStatus.Success,
      ProjectId: 0,
      ProjectName: `Test from Deploy Center — ${channel.Name}`,
      DeploymentId: 0,
      Branch: 'test',
      CommitHash: '0000000000000000000000000000000000000000',
      CommitMessage: 'This is a test message sent from the channel settings UI.',
      Author: 'Deploy Center',
    };
    await dispatcher.Send(providerConfig, deliveryConfig, payload);
  }
}

const discordDispatcher = new DiscordDispatcher();
const slackDispatcher = new SlackDispatcher();
const emailDispatcher = new EmailDispatcher();
function pickDispatcher(type: string): INotificationDispatcher {
  switch (type) {
    case 'discord': return discordDispatcher;
    case 'slack': return slackDispatcher;
    case 'email': return emailDispatcher;
    default: throw new Error(`Unknown provider type: ${type}`);
  }
}

export default NotificationChannelService;
