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
  SSH_KEY_USED = 'ssh_key_used',
  SSH_KEY_GENERATED = 'ssh_key_generated',
  SSH_KEY_REGENERATED = 'ssh_key_regenerated',
  SSH_KEY_DELETED = 'ssh_key_deleted',
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
}
