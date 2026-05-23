/**
 * NotificationProviderService — Deploy Center v3.0 / F-006 (T057).
 * CRUD over the central credential store. Always returns config as `***`
 * to controllers; only the dispatcher layer ever sees plaintext.
 */

import Logger from '@Utils/Logger';
import EncryptionHelper from '@Utils/EncryptionHelper';
import { NotificationProvider, NotificationChannel } from '@Models/index';
import { ENotificationProviderType } from '@Types/ICommon';
import type {
  IDiscordProviderConfig,
  ISlackProviderConfig,
  IEmailProviderConfig,
  IProviderConfig,
} from './Notifications/INotificationDispatcher';

export interface IProviderListItem {
  Id: number;
  Name: string;
  Type: ENotificationProviderType;
  IsActive: boolean;
  ChannelCount?: number;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface IProviderCreateInput {
  Name: string;
  Type: ENotificationProviderType;
  Config: IDiscordProviderConfig | ISlackProviderConfig | IEmailProviderConfig;
  CreatedBy?: number | null;
}

export interface IProviderUpdateInput {
  Name?: string;
  Config?: IDiscordProviderConfig | ISlackProviderConfig | IEmailProviderConfig;
  IsActive?: boolean;
}

export class NotificationProviderService {
  /** List all providers; channel counts joined when requested. */
  public async List(includeCounts: boolean = true): Promise<IProviderListItem[]> {
    const rows = await NotificationProvider.findAll({ order: [['Name', 'ASC']] });
    if (!includeCounts) {
      return rows.map((r) => this.toListItem(r, undefined));
    }
    const items: IProviderListItem[] = [];
    for (const r of rows) {
      const channelCount = await NotificationChannel.count({ where: { ProviderId: r.Id } });
      items.push(this.toListItem(r, channelCount));
    }
    return items;
  }

  public async GetById(id: number): Promise<NotificationProvider | null> {
    return NotificationProvider.findByPk(id);
  }

  /** Decrypt the stored config — internal use only (called by dispatchers). */
  public Decrypt(row: NotificationProvider): IProviderConfig {
    const json = EncryptionHelper.Decrypt({
      Encrypted: row.ConfigEncrypted,
      Iv: row.Iv,
      AuthTag: row.AuthTag,
    });
    return JSON.parse(json) as IProviderConfig;
  }

  public async Create(input: IProviderCreateInput): Promise<NotificationProvider> {
    try {
      const dupe = await NotificationProvider.findOne({ where: { Name: input.Name } });
      if (dupe) throw new Error(`NotificationProvider with name '${input.Name}' already exists`);
      const enc = EncryptionHelper.Encrypt(JSON.stringify(input.Config));
      const row = await NotificationProvider.create({
        Name: input.Name,
        Type: input.Type,
        ConfigEncrypted: enc.Encrypted,
        Iv: enc.Iv,
        AuthTag: enc.AuthTag,
        IsActive: true,
        CreatedBy: input.CreatedBy ?? null,
      });
      Logger.Info('NotificationProvider created', { id: row.Id, type: row.Type });
      return row;
    } catch (error) {
      Logger.Error('NotificationProviderService.Create failed', error as Error);
      throw error;
    }
  }

  public async Update(id: number, patch: IProviderUpdateInput): Promise<NotificationProvider | null> {
    const row = await NotificationProvider.findByPk(id);
    if (!row) return null;
    if (patch.Name && patch.Name !== row.Name) {
      const clash = await NotificationProvider.findOne({ where: { Name: patch.Name } });
      if (clash && clash.Id !== id) {
        throw new Error(`NotificationProvider with name '${patch.Name}' already exists`);
      }
      row.Name = patch.Name;
    }
    if (patch.Config) {
      const enc = EncryptionHelper.Encrypt(JSON.stringify(patch.Config));
      row.ConfigEncrypted = enc.Encrypted;
      row.Iv = enc.Iv;
      row.AuthTag = enc.AuthTag;
    }
    if (patch.IsActive !== undefined) row.IsActive = patch.IsActive;
    await row.save();
    Logger.Info('NotificationProvider updated', { id: row.Id });
    return row;
  }

  public async Delete(id: number): Promise<boolean> {
    const deleted = await NotificationProvider.destroy({ where: { Id: id } });
    if (deleted > 0) Logger.Info('NotificationProvider deleted (cascades to channels + subs)', { id });
    return deleted > 0;
  }

  private toListItem(r: NotificationProvider, channelCount: number | undefined): IProviderListItem {
    return {
      Id: r.Id,
      Name: r.Name,
      Type: r.Type,
      IsActive: r.IsActive,
      ChannelCount: channelCount,
      CreatedAt: r.CreatedAt,
      UpdatedAt: r.UpdatedAt,
    };
  }
}

export default NotificationProviderService;
