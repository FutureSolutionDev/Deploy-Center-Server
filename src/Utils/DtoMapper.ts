/**
 * DtoMapper — explicit allow-list projections for data that leaves the
 * server (Socket.IO events, REST responses). v3.0.1, SEC-C2 / SEC-H3.
 *
 * Never send Sequelize instances or raw rows to clients: a model's toJSON()
 * includes every column, which is how webhook secrets and encrypted SSH keys
 * leaked. Every field that goes out must be named here.
 */

import type { Model } from 'sequelize';

type TRow = Record<string, unknown>;

function ToPlain(value: unknown): TRow | null {
  if (!value || typeof value !== 'object') return null;
  const maybeModel = value as Partial<Model> & { toJSON?: () => unknown };
  if (typeof maybeModel.toJSON === 'function') {
    const json = maybeModel.toJSON();
    return json && typeof json === 'object' ? (json as TRow) : null;
  }
  return value as TRow;
}

function Pick(row: TRow, keys: readonly string[]): TRow {
  const out: TRow = {};
  for (const key of keys) {
    if (row[key] !== undefined) out[key] = row[key];
  }
  return out;
}

/**
 * Strip `user:password@` credentials from a repository URL so tokens embedded
 * in https clone URLs are never echoed back. scp-style `git@host:path` URLs
 * have no secret component and pass through unchanged.
 */
export function SanitizeRepoUrl(repoUrl: unknown): unknown {
  if (typeof repoUrl !== 'string') return repoUrl;
  try {
    const parsed = new URL(repoUrl);
    if (parsed.password || (parsed.username && parsed.protocol.startsWith('http'))) {
      parsed.username = '';
      parsed.password = '';
      return parsed.toString();
    }
    return repoUrl;
  } catch {
    return repoUrl;
  }
}

export const PROJECT_SUMMARY_FIELDS = [
  'Id',
  'Name',
  'Description',
  'RepoUrl',
  'Branch',
  'ProjectType',
  'IsActive',
  'WorkspaceId',
] as const;

/** Minimal project shape embedded in deployment events and lists. */
export function ToProjectSummaryDto(project: unknown): TRow | null {
  const row = ToPlain(project);
  if (!row) return null;
  const dto = Pick(row, PROJECT_SUMMARY_FIELDS);
  if ('RepoUrl' in dto) dto.RepoUrl = SanitizeRepoUrl(dto.RepoUrl);
  return dto;
}

export const DEPLOYMENT_FIELDS = [
  'Id',
  'ProjectId',
  'CommitHash',
  'Branch',
  'Status',
  'TriggerType',
  'TriggeredBy',
  'StartedAt',
  'CompletedAt',
  'Duration',
  'ErrorMessage',
  'CommitMessage',
  'CommitAuthor',
  'Author',
  'QueueJobId',
  'CreatedAt',
  'UpdatedAt',
] as const;

/** Deployment as sent over Socket.IO: no log paths, no full project row. */
export function ToDeploymentDto(deployment: unknown): TRow | null {
  const row = ToPlain(deployment);
  if (!row) return null;
  const dto = Pick(row, DEPLOYMENT_FIELDS);
  if (row.Project) {
    dto.Project = ToProjectSummaryDto(row.Project);
  }
  return dto;
}

/**
 * Placeholder sent instead of a secret value. When a client sends it back
 * unchanged (e.g. a full-project PUT from an older UI), the stored value is
 * kept: see MergeMaskedProjectConfig.
 */
export const SECRET_MASK = '********';

/**
 * Legacy Config.Variables keys the platform itself defines (they mirror the
 * named fields of IDeploymentContext). They are build settings, not secrets,
 * and stay readable; every other variable value is write-only.
 */
const NON_SECRET_VARIABLES = new Set([
  'BuildCommand',
  'BuildCmd',
  'BuildOutput',
  'TargetPath',
  'Target',
  'Pm2Name',
  'Type',
]);

/** Secret leaves inside Config.Notifications: [channel, field]. */
const NOTIFICATION_SECRET_FIELDS: Array<[string, string]> = [
  ['Discord', 'WebhookUrl'],
  ['Slack', 'WebhookUrl'],
  ['Email', 'SmtpPassword'],
  ['Email', 'Password'],
  ['Telegram', 'BotToken'],
];

const VARIABLE_BAGS = ['Variables', 'envVars'] as const;

export interface ISecretState {
  HasValue: boolean;
}

function IsRecord(value: unknown): value is TRow {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function HasSecretValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

/**
 * Mask secrets inside a project Config. Returns the masked copy plus a flat
 * map of secret paths → { HasValue } for clients that render "set / not set".
 */
export function MaskProjectConfig(config: unknown): {
  Config: unknown;
  Secrets: Record<string, ISecretState>;
} {
  const secrets: Record<string, ISecretState> = {};
  let parsed: unknown = config;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return { Config: {}, Secrets: secrets };
    }
  }
  if (!IsRecord(parsed)) return { Config: parsed ?? null, Secrets: secrets };

  const masked: TRow = JSON.parse(JSON.stringify(parsed)) as TRow;

  for (const bag of VARIABLE_BAGS) {
    const vars = masked[bag];
    if (!IsRecord(vars)) continue;
    for (const key of Object.keys(vars)) {
      if (NON_SECRET_VARIABLES.has(key)) continue;
      const hasValue = HasSecretValue(vars[key]);
      secrets[`Config.${bag}.${key}`] = { HasValue: hasValue };
      vars[key] = hasValue ? SECRET_MASK : '';
    }
  }

  const notifications = masked.Notifications;
  if (IsRecord(notifications)) {
    for (const [channel, field] of NOTIFICATION_SECRET_FIELDS) {
      const target = notifications[channel];
      if (!IsRecord(target) || !(field in target)) continue;
      const hasValue = HasSecretValue(target[field]);
      secrets[`Config.Notifications.${channel}.${field}`] = { HasValue: hasValue };
      target[field] = hasValue ? SECRET_MASK : '';
    }
  }

  return { Config: masked, Secrets: secrets };
}

/**
 * Restore stored secrets wherever an incoming Config carries SECRET_MASK, so
 * clients never need to know a secret to save the rest of a project.
 */
export function MergeMaskedProjectConfig<T>(incoming: T, stored: unknown): T {
  if (!IsRecord(incoming)) return incoming;
  let current: unknown = stored;
  if (typeof current === 'string') {
    try {
      current = JSON.parse(current);
    } catch {
      current = {};
    }
  }
  const previous = IsRecord(current) ? current : {};
  const merged: TRow = JSON.parse(JSON.stringify(incoming)) as TRow;

  for (const bag of VARIABLE_BAGS) {
    const vars = merged[bag];
    const before = previous[bag];
    if (!IsRecord(vars)) continue;
    for (const key of Object.keys(vars)) {
      if (vars[key] === SECRET_MASK) {
        if (IsRecord(before) && before[key] !== undefined) {
          vars[key] = before[key];
        } else {
          delete vars[key];
        }
      }
    }
  }

  const notifications = merged.Notifications;
  const previousNotifications = previous.Notifications;
  if (IsRecord(notifications)) {
    for (const [channel, field] of NOTIFICATION_SECRET_FIELDS) {
      const target = notifications[channel];
      if (!IsRecord(target) || target[field] !== SECRET_MASK) continue;
      const before = IsRecord(previousNotifications) ? previousNotifications[channel] : undefined;
      target[field] = IsRecord(before) && before[field] !== undefined ? before[field] : '';
    }
  }

  return merged as T;
}

/** Columns that must never leave the server, whatever the endpoint. */
const PROJECT_HIDDEN_FIELDS = ['WebhookSecret', 'SshKeyEncrypted', 'SshKeyIv', 'SshKeyAuthTag'];

/**
 * Full project as returned by the REST API (SEC-H3): webhook secret and the
 * encrypted SSH private key are removed, Config secrets are masked, and a
 * `Secrets` map reports which write-only values are set.
 */
export function ToProjectDto(project: unknown): TRow | null {
  const row = ToPlain(project);
  if (!row) return null;
  const dto: TRow = { ...row };

  const hasWebhookSecret = HasSecretValue(row.WebhookSecret);
  const hasSshKey = HasSecretValue(row.SshKeyEncrypted);
  for (const field of PROJECT_HIDDEN_FIELDS) delete dto[field];

  if ('RepoUrl' in dto) dto.RepoUrl = SanitizeRepoUrl(dto.RepoUrl);

  // Only report state for columns that were actually loaded.
  const secrets: Record<string, ISecretState> = {};
  if ('WebhookSecret' in row) secrets.WebhookSecret = { HasValue: hasWebhookSecret };
  if ('SshKeyEncrypted' in row) secrets.SshPrivateKey = { HasValue: hasSshKey };
  if ('Config' in row) {
    const masked = MaskProjectConfig(row.Config);
    dto.Config = masked.Config;
    Object.assign(secrets, masked.Secrets);
  }
  dto.Secrets = secrets;

  if (Array.isArray(row.Members)) {
    dto.Members = row.Members.map((m) => ToPlain(m));
  }
  return dto;
}

/**
 * Deployment as returned by the REST API: every column, steps as stored, and
 * the embedded project passed through ToProjectDto.
 */
export function ToDeploymentResponseDto(deployment: unknown): TRow | null {
  const row = ToPlain(deployment);
  if (!row) return null;
  const dto: TRow = { ...row };
  if (row.Project) dto.Project = ToProjectDto(row.Project);
  return dto;
}

/** User row without credential material (PasswordHash, legacy TOTP secret). */
export function ToUserDto(user: unknown): TRow | null {
  const row = ToPlain(user);
  if (!row) return null;
  const dto: TRow = { ...row };
  delete dto.PasswordHash;
  delete dto.TwoFactorSecret;
  return dto;
}

export default {
  ToUserDto,
  ToDeploymentDto,
  ToDeploymentResponseDto,
  ToProjectDto,
  ToProjectSummaryDto,
  SanitizeRepoUrl,
  MaskProjectConfig,
  MergeMaskedProjectConfig,
};
