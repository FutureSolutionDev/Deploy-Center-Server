/**
 * Database Types and Interfaces
 * Following PascalCase naming convention
 */

import {
  EAccountStatus,
  EApiKeyScope,
  EDeploymentStatus,
  ENotificationChannel,
  EProjectType,
  EStepStatus,
  ETriggerType,
  EUserRole,
} from './ICommon';

export interface IUserAttributes {
  Id: number;
  Username: string;
  Email: string;
  PasswordHash: string;
  Role: EUserRole;
  IsActive: boolean;
  TwoFactorEnabled: boolean;
  TwoFactorSecret?: string;
  FullName?: string | null;
  AvatarUrl?: string | null;
  LastPasswordChangeAt?: Date | null;
  AccountStatus: EAccountStatus;
  CreatedAt: Date;
  UpdatedAt: Date;
  LastLogin?: Date;
}

export interface IUserSettingsAttributes {
  Id: number;
  UserId: number;
  EmailNotifications: boolean;
  DiscordWebhookUrl?: string | null;
  SlackWebhookUrl?: string | null;
  NotifyOnSuccess: boolean;
  NotifyOnFailure: boolean;
  NotifyOnProjectUpdate: boolean;
  NotifyOnSystemAlert: boolean;
  Timezone: string;
  DateFormat: string;
  TimeFormat: '12h' | '24h';
  Language: string;
  Theme: string;
  ColorTheme: string;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface ITwoFactorAuthAttributes {
  Id: number;
  UserId: number;
  Secret?: string | null;
  SecretIv?: string | null;
  SecretAuthTag?: string | null;
  IsEnabled: boolean;
  BackupCodes?: string | null;
  RecoveryEmail?: string | null;
  EnabledAt?: Date | null;
  LastUsedAt?: Date | null;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface IApiKeyAttributes {
  Id: number;
  UserId: number;
  Name: string;
  Description?: string | null;
  KeyHash: string;
  KeyPrefix: string;
  Scopes: EApiKeyScope[] | string[];
  IsActive: boolean;
  ExpiresAt?: Date | null;
  LastUsedAt?: Date | null;
  UsageCount: number;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface IUserSessionAttributes {
  Id: number;
  UserId: number;
  SessionToken: string;
  DeviceInfo?: Record<string, any> | null;
  IpAddress?: string | null;
  UserAgent?: string | null;
  IsActive: boolean;
  ExpiresAt: Date;
  CreatedAt: Date;
  LastActivityAt: Date;
}

export interface IProjectAttributes {
  Id: number;
  Name: string;
  RepoUrl: string;
  Branch: string;
  ProjectPath: string;
  ProjectType: EProjectType;
  WebhookSecret: string;
  IsActive: boolean;
  Config: IProjectConfigJson;
  CreatedBy: number; // User ID of the creator
  CreatedAt: Date;
  UpdatedAt: Date;

  // SSH Key Management Fields
  UseSshKey: boolean;
  SshKeyEncrypted: string | null;
  SshKeyIv: string | null;
  SshKeyAuthTag: string | null;
  SshPublicKey: string | null;
  SshKeyFingerprint: string | null;
  SshKeyType: 'ed25519' | 'rsa' | null;
  SshKeyCreatedAt: Date | null;
  SshKeyRotatedAt: Date | null;
  GitHubDeployKeyId: number | null;
}

export interface IProjectConfigJson {
  Branch: string;
  AutoDeploy: boolean;
  DeployOnPaths?: string[];
  Environment?: string;
  Variables: Record<string, string>;
  Pipeline: IPipelineStepJson[];
  Notifications?: INotificationConfig;
  HealthCheck?: IHealthCheckConfig;
  Url?: string;
  BuildCommand?: string;
  BuildOutput?: string;
  SyncIgnorePatterns?: string[]; // Custom patterns to ignore during sync (e.g., node_modules, Backup, Logs)
  RsyncOptions?: string; // Custom rsync options (e.g., '--no-perms --no-owner --no-group --omit-dir-times')
}

export interface IPipelineStepJson {
  Name: string;
  RunIf?: string;
  Run: string[];
}

export interface IDiscordConfig {
  WebhookUrl: string;
  Enabled: boolean;
}

export interface ISlackConfig {
  WebhookUrl: string;
  Enabled: boolean;
}

export interface IEmailConfig {
  SmtpHost: string;
  SmtpPort: number;
  SmtpSecure: boolean;
  SmtpUser: string;
  SmtpPassword: string;
  From: string;
  To: string[];
  Enabled: boolean;
}

export interface ITelegramConfig {
  BotToken: string;
  ChatId: string;
  Enabled: boolean;
}

export interface INotificationConfig {
  Channels: ENotificationChannel[];
  OnSuccess: boolean;
  OnFailure: boolean;
  OnStart: boolean;
  Discord?: IDiscordConfig;
  Slack?: ISlackConfig;
  Email?: IEmailConfig;
  Telegram?: ITelegramConfig;
}

export interface IHealthCheckConfig {
  Enabled: boolean;
  Url?: string;
  Interval?: number;
  Timeout?: number;
}

export interface IDeploymentAttributes {
  Id: number;
  ProjectId: number;
  CommitHash: string;
  Branch: string;
  Status: EDeploymentStatus;
  TriggerType: ETriggerType;
  TriggeredBy?: number;
  StartedAt?: Date;
  CompletedAt?: Date;
  Duration?: number;
  LogFile?: string;
  ErrorMessage?: string;
  CommitMessage?: string;
  CommitAuthor?: string;
  Author?: string;
  CreatedAt: Date;
}

export interface IDeploymentStepAttributes {
  Id: number;
  DeploymentId: number;
  StepNumber: number;
  StepName: string;
  Status: EStepStatus;
  StartedAt?: Date;
  CompletedAt?: Date;
  Duration?: number;
  Output?: string;
  Error?: string;
}

export interface INotificationAttributes {
  Id: number;
  DeploymentId: number;
  Channel: ENotificationChannel;
  Status: 'pending' | 'sent' | 'failed';
  SentAt?: Date;
  ErrorMessage?: string;
}

export interface IAuditLogAttributes {
  Id: number;
  UserId?: number;
  Action: string;
  ResourceType: string;
  ResourceId?: number;
  Details?: Record<string, any>;
  IpAddress?: string;
  UserAgent?: string;
  CreatedAt: Date;
}

export interface IEnvironmentVariableAttributes {
  Id: number;
  ProjectId: number;
  KeyName: string;
  ValueEncrypted: string;
  IsSecret: boolean;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface IServerAttributes {
  Id: number;
  Name: string;
  Host: string;
  Port: number;
  Username: string;
  SshKey?: string;
  IsActive: boolean;
  CreatedAt: Date;
}

// Creation Attributes (without Id and timestamps)
export type IUserCreationAttributes = Omit<IUserAttributes, 'Id' | 'CreatedAt' | 'UpdatedAt' | 'LastLogin'>;
export type IProjectCreationAttributes = Omit<IProjectAttributes, 'Id' | 'CreatedAt' | 'UpdatedAt'>;
export type IDeploymentCreationAttributes = Omit<IDeploymentAttributes, 'Id' | 'CreatedAt'>;
export type IDeploymentStepCreationAttributes = Omit<IDeploymentStepAttributes, 'Id'>;
export type INotificationCreationAttributes = Omit<INotificationAttributes, 'Id'>;
export type IAuditLogCreationAttributes = Omit<IAuditLogAttributes, 'Id' | 'CreatedAt'>;
export type IEnvironmentVariableCreationAttributes = Omit<IEnvironmentVariableAttributes, 'Id' | 'CreatedAt' | 'UpdatedAt'>;
export type IServerCreationAttributes = Omit<IServerAttributes, 'Id' | 'CreatedAt'>;
export type IUserSettingsCreationAttributes = Omit<IUserSettingsAttributes, 'Id' | 'CreatedAt' | 'UpdatedAt'>;
export type ITwoFactorAuthCreationAttributes = Omit<
  ITwoFactorAuthAttributes,
  'Id' | 'CreatedAt' | 'UpdatedAt' | 'EnabledAt' | 'LastUsedAt'
>;
export type IApiKeyCreationAttributes = Omit<
  IApiKeyAttributes,
  'Id' | 'CreatedAt' | 'UpdatedAt' | 'LastUsedAt' | 'UsageCount'
>;
export type IUserSessionCreationAttributes = Omit<
  IUserSessionAttributes,
  'Id' | 'CreatedAt' | 'LastActivityAt'
>;
