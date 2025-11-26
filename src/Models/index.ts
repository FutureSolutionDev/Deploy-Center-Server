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
}

/**
 * Export all models
 */
export { User, Project, Deployment, DeploymentStep, AuditLog };

/**
 * Export models as default object
 */
export default {
  User,
  Project,
  Deployment,
  DeploymentStep,
  AuditLog,
  InitializeAssociations,
};
