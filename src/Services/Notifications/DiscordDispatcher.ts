/**
 * DiscordDispatcher — Deploy Center v3.0 / F-006 (T054).
 * Extracted from the legacy `NotificationService.SendDiscordNotification`.
 * Posts a Discord embed via axios to the channel's webhook URL.
 * Failure-isolated: throws so the parent fan-out logs and skips this channel.
 */

import axios from 'axios';
import Logger from '@Utils/Logger';
import { EDeploymentStatus } from '@Types/ICommon';
import type {
  INotificationDispatcher,
  INotificationPayload,
  IProviderConfig,
  IDeliveryConfig,
  IDiscordProviderConfig,
  IDiscordDeliveryConfig,
} from './INotificationDispatcher';

function pickStatusColor(status: EDeploymentStatus): number {
  switch (status) {
    case EDeploymentStatus.Success: return 0x00ff00;
    case EDeploymentStatus.Failed: return 0xff0000;
    case EDeploymentStatus.InProgress: return 0xffff00;
    case EDeploymentStatus.Queued: return 0x808080;
    case EDeploymentStatus.Cancelled: return 0xffa500;
    case EDeploymentStatus.RolledBack: return 0xa020f0;
    default: return 0x808080;
  }
}

function pickEmoji(status: EDeploymentStatus): string {
  switch (status) {
    case EDeploymentStatus.Success: return '✅';
    case EDeploymentStatus.Failed: return '❌';
    case EDeploymentStatus.InProgress: return '⏳';
    case EDeploymentStatus.Queued: return '⏱️';
    case EDeploymentStatus.Cancelled: return '🚫';
    case EDeploymentStatus.RolledBack: return '↩️';
    default: return 'ℹ️';
  }
}

function resolveUrl(p: IDiscordProviderConfig, d: IDiscordDeliveryConfig): string {
  if (d.overrideWebhook) return d.overrideWebhook;
  if (!p.webhookRoot) throw new Error('Discord provider has no webhookRoot configured');
  // Allow suffix to be a full URL fragment OR just an id+token.
  if (d.webhookSuffix) {
    return d.webhookSuffix.startsWith('http')
      ? d.webhookSuffix
      : `${p.webhookRoot.replace(/\/$/, '')}/${d.webhookSuffix.replace(/^\//, '')}`;
  }
  return p.webhookRoot;
}

export class DiscordDispatcher implements INotificationDispatcher {
  public readonly type = 'discord' as const;

  public async Send(
    providerConfig: IProviderConfig,
    deliveryConfig: IDeliveryConfig,
    payload: INotificationPayload
  ): Promise<void> {
    const p = providerConfig as IDiscordProviderConfig;
    const d = deliveryConfig as IDiscordDeliveryConfig;
    const url = resolveUrl(p, d);

    const embed: Record<string, unknown> = {
      title: `${pickEmoji(payload.Status)} Deployment ${payload.Status}`,
      color: pickStatusColor(payload.Status),
      fields: [
        { name: 'Project', value: payload.ProjectName, inline: true },
        { name: 'Branch', value: payload.Branch, inline: true },
        { name: 'Commit', value: `\`${payload.CommitHash.substring(0, 7)}\``, inline: true },
      ],
      timestamp: new Date().toISOString(),
    };
    const fields = embed.fields as Array<{ name: string; value: string; inline?: boolean }>;
    if (payload.CommitMessage) {
      fields.push({ name: 'Message', value: payload.CommitMessage.substring(0, 200) });
    }
    if (payload.Author) fields.push({ name: 'Author', value: payload.Author, inline: true });
    if (payload.Duration) fields.push({ name: 'Duration', value: `${payload.Duration}s`, inline: true });
    if (payload.Error) {
      fields.push({ name: 'Error', value: `\`\`\`${payload.Error.substring(0, 200)}\`\`\`` });
    }
    if (payload.Url) fields.push({ name: 'URL', value: payload.Url });

    await axios.post(url, { username: 'Deploy Center', embeds: [embed] }, { timeout: 10000 });
    Logger.Info('Discord dispatched', {
      deploymentId: payload.DeploymentId,
      event: payload.Event,
    });
  }
}

export default DiscordDispatcher;
