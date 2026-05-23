/**
 * INotificationDispatcher — Strategy interface for notification delivery.
 * v3.0 F-006 (T053). One implementation per provider type.
 *
 * Dispatchers receive ALREADY-DECRYPTED provider config and channel
 * delivery config; the calling NotificationService does the decryption
 * once per fan-out batch.
 */

import type { ENotificationEvent, EDeploymentStatus } from '@Types/ICommon';

/**
 * Event-agnostic payload — same shape passed to every dispatcher regardless
 * of provider type. Dispatchers format their own message.
 */
export interface INotificationPayload {
  Event: ENotificationEvent;
  Status: EDeploymentStatus;
  ProjectId: number;
  ProjectName: string;
  DeploymentId: number;
  Branch: string;
  CommitHash: string;
  CommitMessage?: string;
  Author?: string;
  Duration?: number;
  Error?: string;
  Url?: string;
}

/** Decrypted provider credentials (shape varies by provider Type). */
export type IProviderConfig =
  | IDiscordProviderConfig
  | ISlackProviderConfig
  | IEmailProviderConfig;

export interface IDiscordProviderConfig {
  webhookRoot: string;
}

export interface ISlackProviderConfig {
  /** Bot token (xoxb-…) used by @slack/webhook OR raw webhook URL fallback. */
  webhookUrl?: string;
  botToken?: string;
}

export interface IEmailProviderConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  presetName?: 'gmail' | 'sendgrid' | 'mailgun' | 'custom';
}

/** Decrypted per-channel delivery config (shape varies by provider type). */
export type IDeliveryConfig =
  | IDiscordDeliveryConfig
  | ISlackDeliveryConfig
  | IEmailDeliveryConfig;

export interface IDiscordDeliveryConfig {
  /** Concatenated onto provider.webhookRoot, OR full override URL. */
  webhookSuffix?: string;
  overrideWebhook?: string;
}

export interface ISlackDeliveryConfig {
  /** Channel name, e.g. "#deploys". */
  channel: string;
}

export interface IEmailDeliveryConfig {
  recipients: string[];
}

/**
 * Strategy interface — one implementation per provider type.
 * MUST throw on failure so fan-out can log + continue with other channels.
 */
export interface INotificationDispatcher {
  /** The provider type this dispatcher handles. */
  readonly type: 'discord' | 'slack' | 'email';

  /**
   * Deliver one message. Throws on failure (caller wraps in Promise.allSettled
   * so one failure does not block other channels — FR-025b).
   */
  Send(
    providerConfig: IProviderConfig,
    deliveryConfig: IDeliveryConfig,
    payload: INotificationPayload
  ): Promise<void>;
}
