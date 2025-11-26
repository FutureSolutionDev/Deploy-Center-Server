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

export enum EDeploymentStatus {
  Queued = 'queued',
  Pending = 'pending',
  InProgress = 'in_progress',
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
  Static = 'static',
  Docker = 'docker',
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

export enum EAuditAction {
  DeploymentCreated = 'deployment_created',
  DeploymentCancelled = 'deployment_cancelled',
  DeploymentRetried = 'deployment_retried',
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
