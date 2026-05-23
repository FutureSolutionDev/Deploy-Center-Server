/**
 * Common Types and Interfaces
 * Following PascalCase naming convention
 */

export interface IApiResponse<T = any> {
  Success: boolean;
  Message: string;
  Data?: T;
  Error?: string;
  Code: number;
}

export interface IPaginationParams {
  Page: number;
  Limit: number;
  SortBy?: string;
  SortOrder?: 'ASC' | 'DESC';
}

export interface IPaginatedResponse<T> {
  Items: T[];
  Total: number;
  Page: number;
  Limit: number;
  TotalPages: number;
}

export enum EUserRole {
  Admin = 'admin',
  Manager = 'manager',
  Developer = 'developer',
  Viewer = 'viewer',
}

export enum EAccountStatus {
  Active = 'active',
  Suspended = 'suspended',
  Deleted = 'deleted',
}

export enum EDeploymentStatus {
  Queued = 'queued',
  Pending = 'pending',
  InProgress = 'inProgress',
  Success = 'success',
  Failed = 'failed',
  Cancelled = 'cancelled',
  RolledBack = 'rolled_back',
}

export enum ETriggerType {
  Webhook = 'webhook',
  Manual = 'manual',
  Scheduled = 'scheduled',
  Rollback = 'rollback', // v3.0 F-007 — extends the existing trigger enum
}

export enum EProjectType {
  Node = 'node',
  React = 'react',
  Static = 'static',
  Docker = 'docker',
  NextJS = 'nextjs',
  Other = 'other',
}

export enum ENotificationChannel {
  Discord = 'discord',
  Slack = 'slack',
  Email = 'email',
  Telegram = 'telegram',
}

export enum EStepStatus {
  Pending = 'pending',
  Running = 'running',
  Success = 'success',
  Failed = 'failed',
  Skipped = 'skipped',
}

export enum EApiKeyScope {
  DeploymentsRead = 'deployments:read',
  DeploymentsWrite = 'deployments:write',
  ProjectsRead = 'projects:read',
  ProjectsWrite = 'projects:write',
  AdminAll = 'admin:*',
}

export enum EAuditAction {
  DeploymentCreated = 'deployment_created',
  DeploymentCancelled = 'deployment_cancelled',
  DeploymentRetried = 'deployment_retried',
  DeploymentRolledBack = 'deployment_rolled_back', // v3.0 F-007
  SSH_KEY_USED = 'ssh_key_used',
  SSH_KEY_GENERATED = 'ssh_key_generated',
  SSH_KEY_REGENERATED = 'ssh_key_regenerated',
  SSH_KEY_DELETED = 'ssh_key_deleted',
}

/**
 * v3.0 F-006 — provider integration types. Telegram intentionally NOT
 * included here (it's preserved on the legacy NotificationService path for
 * v2.1 compat; v3.0 first-class set per spec is discord/slack/email).
 */
export enum ENotificationProviderType {
  Discord = 'discord',
  Slack = 'slack',
  Email = 'email',
}

/**
 * v3.0 F-006 — events that ProjectNotificationSubscriptions can subscribe to.
 */
export enum ENotificationEvent {
  DeploymentStarted = 'DeploymentStarted',
  DeploymentSucceeded = 'DeploymentSucceeded',
  DeploymentFailed = 'DeploymentFailed',
  DeploymentRolledBack = 'DeploymentRolledBack',
  DeploymentCancelled = 'DeploymentCancelled',
}

export interface IDeploymentContext {
  RepoName: string;
  Branch: string;
  Commit: string;
  ProjectPath: string;
  Type?: string;
  Pm2Name?: string;
  BuildCmd?: string;
  BuildOutput?: string;
  BuildCommand?: string;
  Target?: string;
  [key: string]: string | undefined;
}

export interface IPipelineStep {
  Name: string;
  RunIf?: string;
  Run: string[];
}

export interface IProjectConfig {
  ProjectPath: string;
  Branch: string;
  Variables: Record<string, string>;
  Pipeline: IPipelineStep[];
  BuildOutput?: string; // Build output directory to sync (e.g., 'build', 'dist' for React/Vue projects)
  SyncIgnorePatterns?: string[]; // Custom patterns to ignore during sync (e.g., node_modules, Backup, Logs)
  RsyncOptions?: string; // Custom rsync options (e.g., '--no-perms --no-owner --no-group --omit-dir-times')
}
