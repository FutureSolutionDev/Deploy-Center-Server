/**
 * SlackDispatcher — Deploy Center v3.0 / F-006 (T055).
 * Sends via @slack/webhook (IncomingWebhook) when the provider supplies a
 * webhook URL. Bot-token API path is reserved for future epics — v3.0
 * ships webhook-only since that's what 99% of self-hosters configure.
 */

import { IncomingWebhook } from '@slack/webhook';
import Logger from '@Utils/Logger';
import { EDeploymentStatus } from '@Types/ICommon';
import type {
  INotificationDispatcher,
  INotificationPayload,
  IProviderConfig,
  IDeliveryConfig,
  ISlackProviderConfig,
  ISlackDeliveryConfig,
} from './INotificationDispatcher';

function pickColor(status: EDeploymentStatus): string {
  switch (status) {
    case EDeploymentStatus.Success: return 'good';
    case EDeploymentStatus.Failed: return 'danger';
    case EDeploymentStatus.InProgress: return 'warning';
    case EDeploymentStatus.RolledBack: return '#a020f0';
    default: return '#808080';
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

export class SlackDispatcher implements INotificationDispatcher {
  public readonly type = 'slack' as const;

  public async Send(
    providerConfig: IProviderConfig,
    deliveryConfig: IDeliveryConfig,
    payload: INotificationPayload
  ): Promise<void> {
    const p = providerConfig as ISlackProviderConfig;
    const d = deliveryConfig as ISlackDeliveryConfig;

    if (!p.webhookUrl) {
      throw new Error(
        'Slack provider has no webhookUrl configured — bot-token-only providers are not yet supported in v3.0'
      );
    }

    const webhook = new IncomingWebhook(p.webhookUrl);
    const fields = [
      { title: 'Project', value: payload.ProjectName, short: true },
      { title: 'Branch', value: payload.Branch, short: true },
      { title: 'Commit', value: `\`${payload.CommitHash.substring(0, 7)}\``, short: true },
    ];
    if (payload.Author) fields.push({ title: 'Author', value: payload.Author, short: true });
    if (payload.Duration) fields.push({ title: 'Duration', value: `${payload.Duration}s`, short: true });
    if (payload.Error) fields.push({ title: 'Error', value: `\`\`\`${payload.Error.substring(0, 200)}\`\`\``, short: false });
    if (payload.CommitMessage) fields.push({ title: 'Message', value: payload.CommitMessage.substring(0, 200), short: false });
    if (payload.Url) fields.push({ title: 'URL', value: payload.Url, short: false });

    await webhook.send({
      // d.channel is informational — the webhook URL is bound to one channel
      // server-side, but include for the Slack UI when shown.
      channel: d.channel,
      username: 'Deploy Center',
      attachments: [
        {
          fallback: `Deployment ${payload.Status}: ${payload.ProjectName}`,
          color: pickColor(payload.Status),
          title: `${pickEmoji(payload.Status)} Deployment ${payload.Status}`,
          fields,
          footer: 'Deploy Center',
          ts: String(Math.floor(Date.now() / 1000)),
        },
      ],
    });

    Logger.Info('Slack dispatched', {
      deploymentId: payload.DeploymentId,
      event: payload.Event,
      channel: d.channel,
    });
  }
}

export default SlackDispatcher;
