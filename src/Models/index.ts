/**
 * Models Index
 * Export all models and define associations
 * Following SOLID principles and PascalCase naming convention
 */

import User from './User';
import Project from './Project';
import Deployment from './Deployment';
import DeploymentStep from './DeploymentStep';
import AuditLog from './AuditLog';
import UserSettings from './UserSettings';
import TwoFactorAuth from './TwoFactorAuth';
import ApiKey from './ApiKey';
import UserSession from './UserSession';
import ProjectMember from './ProjectMember';
import ProjectAuditLog from './ProjectAuditLog';
import EnvironmentVariable from './EnvironmentVariable'; // v3.0 F-003
import NotificationProvider from './NotificationProvider'; // v3.0 F-006
import NotificationChannel from './NotificationChannel'; // v3.0 F-006
import ProjectNotificationSubscription from './ProjectNotificationSubscription'; // v3.0 F-006
import Workspace from './Workspace'; // v3.0 F-009
import ProjectTemplate from './ProjectTemplate'; // v3.0 F-008

/**
 * Define Model Associations
 */
export function InitializeAssociations(): void {
  // User <-> Deployment (One to Many)
  User.hasMany(Deployment, {
    foreignKey: 'TriggeredBy',
    as: 'Deployments',
  });
  Deployment.belongsTo(User, {
    foreignKey: 'TriggeredBy',
    as: 'User',
  });

  // Project <-> Deployment (One to Many)
  Project.hasMany(Deployment, {
    foreignKey: 'ProjectId',
    as: 'Deployments',
  });
  Deployment.belongsTo(Project, {
    foreignKey: 'ProjectId',
    as: 'Project',
  });

  // Deployment <-> DeploymentStep (One to Many)
  Deployment.hasMany(DeploymentStep, {
    foreignKey: 'DeploymentId',
    as: 'Steps',
  });
  DeploymentStep.belongsTo(Deployment, {
    foreignKey: 'DeploymentId',
    as: 'Deployment',
  });

  // User <-> AuditLog (One to Many)
  User.hasMany(AuditLog, {
    foreignKey: 'UserId',
    as: 'AuditLogs',
  });
  AuditLog.belongsTo(User, {
    foreignKey: 'UserId',
    as: 'User',
  });

  // User <-> UserSettings (One to One)
  User.hasOne(UserSettings, {
    foreignKey: 'UserId',
    as: 'Settings',
    onDelete: 'CASCADE',
  });
  UserSettings.belongsTo(User, {
    foreignKey: 'UserId',
    as: 'User',
  });

  // User <-> TwoFactorAuth (One to One)
  User.hasOne(TwoFactorAuth, {
    foreignKey: 'UserId',
    as: 'TwoFactor',
    onDelete: 'CASCADE',
  });
  TwoFactorAuth.belongsTo(User, {
    foreignKey: 'UserId',
    as: 'User',
  });

  // User <-> ApiKeys (One to Many)
  User.hasMany(ApiKey, {
    foreignKey: 'UserId',
    as: 'ApiKeys',
    onDelete: 'CASCADE',
  });
  ApiKey.belongsTo(User, {
    foreignKey: 'UserId',
    as: 'User',
  });

  // User <-> UserSession (One to Many)
  User.hasMany(UserSession, {
    foreignKey: 'UserId',
    as: 'Sessions',
    onDelete: 'CASCADE',
  });
  UserSession.belongsTo(User, {
    foreignKey: 'UserId',
    as: 'User',
  });

  // Project <-> ProjectMember (One to Many) - Many-to-Many through ProjectMember
  Project.hasMany(ProjectMember, {
    foreignKey: 'ProjectId',
    as: 'Members',
    onDelete: 'CASCADE',
  });
  ProjectMember.belongsTo(Project, {
    foreignKey: 'ProjectId',
    as: 'Project',
  });

  // User <-> ProjectMember (One to Many) - Many-to-Many through ProjectMember
  User.hasMany(ProjectMember, {
    foreignKey: 'UserId',
    as: 'ProjectMemberships',
    onDelete: 'CASCADE',
  });
  ProjectMember.belongsTo(User, {
    foreignKey: 'UserId',
    as: 'User',
  });

  // Project <-> ProjectAuditLog (One to Many)
  Project.hasMany(ProjectAuditLog, {
    foreignKey: 'ProjectId',
    as: 'AuditLogs',
    onDelete: 'CASCADE',
  });
  ProjectAuditLog.belongsTo(Project, {
    foreignKey: 'ProjectId',
    as: 'Project',
  });

  // User <-> ProjectAuditLog (One to Many)
  User.hasMany(ProjectAuditLog, {
    foreignKey: 'UserId',
    as: 'ProjectAuditLogs',
  });
  ProjectAuditLog.belongsTo(User, {
    foreignKey: 'UserId',
    as: 'User',
  });

  // Project <-> EnvironmentVariable (One to Many) — v3.0 F-003
  Project.hasMany(EnvironmentVariable, {
    foreignKey: 'ProjectId',
    as: 'EnvironmentVariables',
    onDelete: 'CASCADE',
  });
  EnvironmentVariable.belongsTo(Project, {
    foreignKey: 'ProjectId',
    as: 'Project',
  });

  // v3.0 F-006 — NotificationProvider <-> NotificationChannel (1:N CASCADE)
  NotificationProvider.hasMany(NotificationChannel, {
    foreignKey: 'ProviderId',
    as: 'Channels',
    onDelete: 'CASCADE',
  });
  NotificationChannel.belongsTo(NotificationProvider, {
    foreignKey: 'ProviderId',
    as: 'Provider',
  });

  // v3.0 F-006 — Channel <-> ProjectNotificationSubscription (1:N CASCADE)
  NotificationChannel.hasMany(ProjectNotificationSubscription, {
    foreignKey: 'ChannelId',
    as: 'Subscriptions',
    onDelete: 'CASCADE',
  });
  ProjectNotificationSubscription.belongsTo(NotificationChannel, {
    foreignKey: 'ChannelId',
    as: 'Channel',
  });

  // v3.0 F-006 — Project <-> ProjectNotificationSubscription (1:N CASCADE)
  Project.hasMany(ProjectNotificationSubscription, {
    foreignKey: 'ProjectId',
    as: 'NotificationSubscriptions',
    onDelete: 'CASCADE',
  });
  ProjectNotificationSubscription.belongsTo(Project, {
    foreignKey: 'ProjectId',
    as: 'Project',
  });

  // CreatedBy on NotificationProvider points at Users (SET NULL on delete);
  // no inverse hasMany defined (no use case for User.NotificationProviders).

  // v3.0 F-009 — Workspace <-> Project (1:N, SET NULL on workspace delete)
  Workspace.hasMany(Project, {
    foreignKey: 'WorkspaceId',
    as: 'Projects',
    onDelete: 'SET NULL',
  });
  Project.belongsTo(Workspace, {
    foreignKey: 'WorkspaceId',
    as: 'Workspace',
  });
}

/**
 * Export all models
 */
export {
  User,
  Project,
  Deployment,
  DeploymentStep,
  AuditLog,
  UserSettings,
  TwoFactorAuth,
  ApiKey,
  UserSession,
  ProjectMember,
  ProjectAuditLog,
  EnvironmentVariable, // v3.0 F-003
  NotificationProvider, // v3.0 F-006
  NotificationChannel, // v3.0 F-006
  ProjectNotificationSubscription, // v3.0 F-006
  Workspace, // v3.0 F-009
  ProjectTemplate, // v3.0 F-008
};

/**
 * Export models as default object
 */
export default {
  User,
  Project,
  Deployment,
  DeploymentStep,
  AuditLog,
  UserSettings,
  TwoFactorAuth,
  ApiKey,
  UserSession,
  ProjectMember,
  ProjectAuditLog,
  EnvironmentVariable, // v3.0 F-003
  NotificationProvider, // v3.0 F-006
  NotificationChannel, // v3.0 F-006
  ProjectNotificationSubscription, // v3.0 F-006
  Workspace, // v3.0 F-009
  ProjectTemplate, // v3.0 F-008
  InitializeAssociations,
};
