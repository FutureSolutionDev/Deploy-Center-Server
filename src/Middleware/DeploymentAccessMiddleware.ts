/**
 * Deployment Access Control Middleware
 * Validates user access to specific deployments through their project.
 *
 * v3.0.1 (SEC-H4): decisions come from AccessControlService, i.e. project
 * membership (or legacy CreatedBy) — the same rules as ProjectAccess and the
 * Socket.IO deployment rooms.
 *
 * Access Control:
 * - Admin / Manager: full access to all deployments
 * - Developer: deployments of projects they are a member of (view + modify)
 * - Viewer: read-only, deployments of projects they are a member of
 */

import { Request, Response, NextFunction } from 'express';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import { EUserRole } from '@Types/ICommon';
import AccessControlService, { IAccessSubject } from '@Services/AccessControlService';

interface IRequestWithUser extends Request {
  user?: IAccessSubject;
}

export class DeploymentAccessMiddleware {
  private Guard(modify: boolean) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const user = (req as IRequestWithUser).user;
        const deploymentIdParam = req.params.id;

        if (!user) {
          ResponseHelper.Unauthorized(res, 'Authentication required');
          return;
        }

        if (!deploymentIdParam) {
          ResponseHelper.ValidationError(res, 'Deployment ID is required');
          return;
        }

        const deploymentId = AccessControlService.ParseId(deploymentIdParam);
        if (deploymentId === null) {
          ResponseHelper.ValidationError(res, 'Invalid deployment ID');
          return;
        }

        if (modify && user.Role === EUserRole.Viewer) {
          Logger.Warn('Access denied: Viewers cannot modify deployments', {
            userId: user.UserId,
            deploymentId,
          });
          ResponseHelper.Forbidden(res, 'Viewers cannot modify deployments');
          return;
        }

        if (AccessControlService.IsStaff(user)) {
          next();
          return;
        }

        const projectId = await AccessControlService.GetDeploymentProjectId(deploymentId);
        if (projectId === null) {
          ResponseHelper.NotFound(res, 'Deployment not found');
          return;
        }

        const allowed = modify
          ? await AccessControlService.CanModifyProject(user, projectId)
          : await AccessControlService.CanViewProject(user, projectId);

        if (!allowed) {
          Logger.Warn('Access denied: user is not a member of the deployment project', {
            userId: user.UserId,
            deploymentId,
            projectId,
          });
          ResponseHelper.Forbidden(
            res,
            modify
              ? 'You can only modify deployments for your own projects'
              : 'You do not have access to this deployment'
          );
          return;
        }

        next();
      } catch (error) {
        Logger.Error('Deployment access check failed', error as Error);
        ResponseHelper.Error(res, 'Authorization failed');
      }
    };
  }

  /** View a deployment (details, logs, log download). */
  public CheckDeploymentAccess = this.Guard(false);

  /** Cancel / retry / rollback a deployment. */
  public CheckDeploymentModifyAccess = this.Guard(true);
}

export default DeploymentAccessMiddleware;
