/**
 * Project Access Control Middleware
 * Validates user access to specific projects based on roles and ownership
 * Following SOLID principles and PascalCase naming convention
 *
 * Access Control:
 * - Admin: Full access to all projects
 * - Developer: Full access to own projects only (ownership based on CreatedBy)
 * - Viewer: Read-only access to all projects
 */

import { Request, Response, NextFunction } from 'express';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import { EUserRole } from '@Types/ICommon';
import { Project } from '@Models/index';

export class ProjectAccessMiddleware {
  /**
   * Check if user has access to a specific project
   * - Admin: Full access to all projects
   * - Developer: Access to own projects only
   * - Viewer: Read-only access to all projects
   */
  public CheckProjectAccess = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const projectIdParam = req.params.projectId || req.params.id;

      if (!user) {
        ResponseHelper.Unauthorized(res, 'Authentication required');
        return;
      }

      if (!projectIdParam) {
        ResponseHelper.ValidationError(res, 'Project ID is required');
        return;
      }

      const projectId = parseInt(projectIdParam, 10);

      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      // Admin has full access
      if (user.Role === EUserRole.Admin) {
        next();
        return;
      }

      // Verify project exists
      const project = await Project.findByPk(projectId);

      if (!project) {
        ResponseHelper.NotFound(res, 'Project not found');
        return;
      }

      const projectData = project.toJSON();

      // Developer: Check ownership
      if (user.Role === EUserRole.Developer) {
        if (projectData.CreatedBy !== user.UserId) {
          Logger.Warn('Access denied: User does not own this project', {
            userId: user.UserId,
            projectId,
            projectOwner: projectData.CreatedBy,
          });
          ResponseHelper.Forbidden(res, 'You do not have access to this project');
          return;
        }
        next();
        return;
      }

      // Viewer: Read-only access to all projects
      if (user.Role === EUserRole.Viewer) {
        next();
        return;
      }

      // Unknown role
      ResponseHelper.Forbidden(res, 'Insufficient permissions');
    } catch (error) {
      Logger.Error('Project access check failed', error as Error);
      ResponseHelper.Error(res, 'Authorization failed');
    }
  };

  /**
   * Check if user can modify a project (Admin or Owner only)
   * Viewers and non-owners cannot modify
   */
  public CheckProjectModifyAccess = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const projectIdParam = req.params.projectId || req.params.id;

      if (!user) {
        ResponseHelper.Unauthorized(res, 'Authentication required');
        return;
      }

      if (!projectIdParam) {
        ResponseHelper.ValidationError(res, 'Project ID is required');
        return;
      }

      const projectId = parseInt(projectIdParam, 10);

      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      // Viewer cannot modify projects
      if (user.Role === EUserRole.Viewer) {
        Logger.Warn('Access denied: Viewers have read-only access', {
          userId: user.UserId,
          projectId,
        });
        ResponseHelper.Forbidden(res, 'Viewers cannot modify projects');
        return;
      }

      // Admin has full access
      if (user.Role === EUserRole.Admin) {
        next();
        return;
      }

      // Verify project exists
      const project = await Project.findByPk(projectId);

      if (!project) {
        ResponseHelper.NotFound(res, 'Project not found');
        return;
      }

      const projectData = project.toJSON();

      // Developer: Check ownership
      if (user.Role === EUserRole.Developer) {
        if (projectData.CreatedBy !== user.UserId) {
          Logger.Warn('Access denied: User does not own this project', {
            userId: user.UserId,
            projectId,
            projectOwner: projectData.CreatedBy,
          });
          ResponseHelper.Forbidden(res, 'You can only modify your own projects');
          return;
        }
        next();
        return;
      }

      // Unknown role
      ResponseHelper.Forbidden(res, 'Insufficient permissions');
    } catch (error) {
      Logger.Error('Project modify access check failed', error as Error);
      ResponseHelper.Error(res, 'Authorization failed');
    }
  };
}

export default ProjectAccessMiddleware;
