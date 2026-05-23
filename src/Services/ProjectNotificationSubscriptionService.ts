/**
 * ProjectNotificationSubscriptionService — Deploy Center v3.0 / F-006 (T059).
 * CRUD scoped to a project + GetSubscriptionsForEvent fan-out query.
 * Events array validated against ENotificationEvent allow-list.
 */

import Logger from '@Utils/Logger';
import {
  ProjectNotificationSubscription,
  NotificationChannel,
  NotificationProvider,
  Project,
} from '@Models/index';
import { ENotificationEvent } from '@Types/ICommon';

export interface ISubscriptionListItem {
  Id: number;
  ProjectId: number;
  ChannelId: number;
  ChannelName?: string;
  ProviderName?: string;
  ProviderType?: string;
  Events: ENotificationEvent[];
  IsActive: boolean;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface ISubscriptionCreateInput {
  ProjectId: number;
  ChannelId: number;
  Events: ENotificationEvent[];
}

export interface ISubscriptionUpdateInput {
  Events?: ENotificationEvent[];
  IsActive?: boolean;
}

/**
 * Resolved active subscription joined to its channel + provider,
 * ready for the fan-out dispatcher path (T060).
 */
export interface IResolvedSubscription {
  subscription: ProjectNotificationSubscription;
  channel: NotificationChannel;
  provider: NotificationProvider;
}

const VALID_EVENTS = new Set<string>(Object.values(ENotificationEvent));

function validateEvents(events: unknown): ENotificationEvent[] {
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error('Events must be a non-empty array');
  }
  const cleaned: ENotificationEvent[] = [];
  for (const e of events) {
    if (typeof e !== 'string') throw new Error('Event must be a string');
    if (!VALID_EVENTS.has(e)) throw new Error(`Unknown event: ${e}`);
    if (cleaned.includes(e as ENotificationEvent)) {
      throw new Error(`Duplicate event in Events: ${e}`);
    }
    cleaned.push(e as ENotificationEvent);
  }
  return cleaned;
}

export class ProjectNotificationSubscriptionService {
  public async ListByProject(projectId: number): Promise<ISubscriptionListItem[]> {
    const rows = await ProjectNotificationSubscription.findAll({
      where: { ProjectId: projectId },
      include: [
        {
          model: NotificationChannel,
          as: 'Channel',
          attributes: ['Name', 'ProviderId'],
          include: [{ model: NotificationProvider, as: 'Provider', attributes: ['Name', 'Type'] }],
        },
      ],
      order: [['CreatedAt', 'ASC']],
    });
    return rows.map((r) => {
      const ch = (r as unknown as { Channel?: NotificationChannel & { Provider?: NotificationProvider } }).Channel;
      const prov = (ch as unknown as { Provider?: NotificationProvider } | undefined)?.Provider;
      return {
        Id: r.Id,
        ProjectId: r.ProjectId,
        ChannelId: r.ChannelId,
        ChannelName: ch?.Name,
        ProviderName: prov?.Name,
        ProviderType: prov?.Type,
        Events: r.Events,
        IsActive: r.IsActive,
        CreatedAt: r.CreatedAt,
        UpdatedAt: r.UpdatedAt,
      };
    });
  }

  public async Create(input: ISubscriptionCreateInput): Promise<ProjectNotificationSubscription> {
    const events = validateEvents(input.Events);
    const project = await Project.findByPk(input.ProjectId);
    if (!project) throw new Error('Project not found');
    const channel = await NotificationChannel.findByPk(input.ChannelId);
    if (!channel) throw new Error('Channel not found');
    const dupe = await ProjectNotificationSubscription.findOne({
      where: { ProjectId: input.ProjectId, ChannelId: input.ChannelId },
    });
    if (dupe) throw new Error('Project is already subscribed to this channel');

    const row = await ProjectNotificationSubscription.create({
      ProjectId: input.ProjectId,
      ChannelId: input.ChannelId,
      Events: events,
      IsActive: true,
    });
    Logger.Info('ProjectNotificationSubscription created', {
      id: row.Id,
      projectId: row.ProjectId,
      channelId: row.ChannelId,
    });
    return row;
  }

  public async Update(
    projectId: number,
    id: number,
    patch: ISubscriptionUpdateInput
  ): Promise<ProjectNotificationSubscription | null> {
    const row = await ProjectNotificationSubscription.findOne({
      where: { Id: id, ProjectId: projectId },
    });
    if (!row) return null;
    if (patch.Events !== undefined) row.Events = validateEvents(patch.Events);
    if (patch.IsActive !== undefined) row.IsActive = patch.IsActive;
    await row.save();
    return row;
  }

  public async Delete(projectId: number, id: number): Promise<boolean> {
    const deleted = await ProjectNotificationSubscription.destroy({
      where: { Id: id, ProjectId: projectId },
    });
    return deleted > 0;
  }

  /**
   * Resolve every active subscription for (projectId, event) joined to its
   * active channel + active provider. Used by NotificationService fan-out (T060).
   * Filters at the JS layer (rather than JSON_CONTAINS) so the implementation
   * works on both MySQL 8 and MariaDB without dialect divergence.
   */
  public async GetSubscriptionsForEvent(
    projectId: number,
    event: ENotificationEvent
  ): Promise<IResolvedSubscription[]> {
    const rows = await ProjectNotificationSubscription.findAll({
      where: { ProjectId: projectId, IsActive: true },
      include: [
        {
          model: NotificationChannel,
          as: 'Channel',
          where: { IsActive: true },
          required: true,
          include: [
            {
              model: NotificationProvider,
              as: 'Provider',
              where: { IsActive: true },
              required: true,
            },
          ],
        },
      ],
    });

    const resolved: IResolvedSubscription[] = [];
    for (const r of rows) {
      if (!Array.isArray(r.Events) || !r.Events.includes(event)) continue;
      const ch = (r as unknown as { Channel?: NotificationChannel }).Channel;
      const prov = (ch as unknown as { Provider?: NotificationProvider } | undefined)?.Provider;
      if (!ch || !prov) continue;
      resolved.push({ subscription: r, channel: ch, provider: prov });
    }
    return resolved;
  }
}

export default ProjectNotificationSubscriptionService;
