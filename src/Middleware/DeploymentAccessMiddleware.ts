/**
 * Deployment Access Control Middleware
 * Validates user access to specific deployments based on project ownership
 * Following SOLID principles and PascalCase naming convention
 *
 * Access Control:
 * - Admin: Full access to all deployments
 * - Developer: Access to deployments of own projects only
 * - Viewer: Read-only access to all deployments
 */

import { Request, Response, NextFunction } from 'express';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import { EUserRole } from '@Types/ICommon';
import { Deployment, Project } from '@Models/index';

export class DeploymentAccessMiddleware {
  /**
   * Check if user has access to a specific deployment
   * - Admin: Full access to all deployments
   * - Developer: Access to deployments of own projects only
   * - Viewer: Read-only access to all deployments
   */
  public CheckDeploymentAccess = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const deploymentIdParam = req.params.id;

      if (!user) {
        ResponseHelper.Unauthorized(res, 'Authentication required');
        return;
      }

      if (!deploymentIdParam) {
        ResponseHelper.ValidationError(res, 'Deployment ID is required');
        return;
      }

      const deploymentId = parseInt(deploymentIdParam, 10);

      if (isNaN(deploymentId)) {
        ResponseHelper.ValidationError(res, 'Invalid deployment ID');
        return;
      }

      // Admin has full access
      if (user.Role === EUserRole.Admin) {
        next();
        return;
      }

      // Fetch deployment
      const deployment = await Deployment.findByPk(deploymentId);

      if (!deployment) {
        ResponseHelper.NotFound(res, 'Deployment not found');
        return;
      }

      const deploymentData = deployment.toJSON();
      const projectId = deploymentData.ProjectId;

      // Fetch associated project
      const project = await Project.findByPk(projectId);

      if (!project) {
        ResponseHelper.Error(res, 'Project not found for this deployment');
        return;
      }

      const projectData = project.toJSON();

      // Developer: Check project ownership
      if (user.Role === EUserRole.Developer) {
        if (projectData.CreatedBy !== user.UserId) {
          Logger.Warn('Access denied: User does not own the project for this deployment', {
            userId: user.UserId,
            deploymentId,
            projectId: projectData.Id,
            projectOwner: projectData.CreatedBy,
          });
          ResponseHelper.Forbidden(res, 'You do not have access to this deployment');
          return;
        }
        next();
        return;
      }

      // Viewer: Read-only access
      if (user.Role === EUserRole.Viewer) {
        next();
        return;
      }

      // Unknown role
      ResponseHelper.Forbidden(res, 'Insufficient permissions');
    } catch (error) {
      Logger.Error('Deployment access check failed', error as Error);
      ResponseHelper.Error(res, 'Authorization failed');
    }
  };

  /**
   * Check if user can modify/cancel a deployment (Admin or Project Owner only)
   * Viewers cannot modify deployments
   */
  public CheckDeploymentModifyAccess = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const deploymentIdParam = req.params.id;

      if (!user) {
        ResponseHelper.Unauthorized(res, 'Authentication required');
        return;
      }

      if (!deploymentIdParam) {
        ResponseHelper.ValidationError(res, 'Deployment ID is required');
        return;
      }

      const deploymentId = parseInt(deploymentIdParam, 10);

      if (isNaN(deploymentId)) {
        ResponseHelper.ValidationError(res, 'Invalid deployment ID');
        return;
      }

      // Viewer cannot modify deployments
      if (user.Role === EUserRole.Viewer) {
        Logger.Warn('Access denied: Viewers cannot modify deployments', {
          userId: user.UserId,
          deploymentId,
        });
        ResponseHelper.Forbidden(res, 'Viewers cannot modify deployments');
        return;
      }

      // Admin has full access
      if (user.Role === EUserRole.Admin) {
        next();
        return;
      }

      // Fetch deployment
      const deployment = await Deployment.findByPk(deploymentId);

      if (!deployment) {
        ResponseHelper.NotFound(res, 'Deployment not found');
        return;
      }

      const deploymentData = deployment.toJSON();
      const projectId = deploymentData.ProjectId;

      // Fetch associated project
      const project = await Project.findByPk(projectId);

      if (!project) {
        ResponseHelper.Error(res, 'Project not found for this deployment');
        return;
      }

      const projectData = project.toJSON();

      // Developer: Check project ownership
      if (user.Role === EUserRole.Developer) {
        if (projectData.CreatedBy !== user.UserId) {
          Logger.Warn('Access denied: User does not own the project for this deployment', {
            userId: user.UserId,
            deploymentId,
            projectId: projectData.Id,
            projectOwner: projectData.CreatedBy,
          });
          ResponseHelper.Forbidden(res, 'You can only modify deployments for your own projects');
          return;
        }
        next();
        return;
      }

      // Unknown role
      ResponseHelper.Forbidden(res, 'Insufficient permissions');
    } catch (error) {
      Logger.Error('Deployment modify access check failed', error as Error);
      ResponseHelper.Error(res, 'Authorization failed');
    }
  };
}

export default DeploymentAccessMiddleware;
