/**
 * Project Access Control Middleware
 * Validates user access to specific projects based on roles and membership
 * Following SOLID principles and PascalCase naming convention
 *
 * Access Control (STRICT ENFORCEMENT):
 * - Admin: Full access to all projects
 * - Manager: Full access to all projects (can assign members)
 * - Developer:
 *   - Can create new projects (becomes owner)
 *   - Can delete ONLY projects they own (Role='owner' in ProjectMember)
 *   - Can modify projects they own OR are members of (Role='owner' or 'member')
 *   - Cannot delete projects they're only members of
 * - Viewer: Read-only access to all projects
 */

import { Request, Response, NextFunction } from 'express';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import { EUserRole } from '@Types/ICommon';
import { Project, ProjectMember } from '@Models/index';

export class ProjectAccessMiddleware {
  /**
   * Check if user has access to view a specific project
   * - Admin/Manager: Full access to all projects
   * - Developer: Access to projects they own or are members of
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

      // Admin and Manager have full access
      if (user.Role === EUserRole.Admin || user.Role === EUserRole.Manager) {
        next();
        return;
      }

      // Verify project exists
      const project = await Project.findByPk(projectId);

      if (!project) {
        ResponseHelper.NotFound(res, 'Project not found');
        return;
      }

      // Viewer: Read-only access to all projects
      if (user.Role === EUserRole.Viewer) {
        next();
        return;
      }

      // Developer: Check if they are owner or member
      if (user.Role === EUserRole.Developer) {
        const membership = await ProjectMember.findOne({
          where: {
            ProjectId: projectId,
            UserId: user.UserId,
          },
        });

        if (!membership) {
          Logger.Warn('Access denied: User is not a member of this project', {
            userId: user.UserId,
            projectId,
          });
          ResponseHelper.Forbidden(res, 'You do not have access to this project');
          return;
        }

        // Store membership info for later use in controllers
        (req as any).projectMembership = membership.toJSON();
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
   * Check if user can modify a project
   * - Admin/Manager: Can modify all projects
   * - Developer: Can modify projects they own OR are members of
   * - Viewer: Cannot modify projects
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

      // Admin and Manager have full access
      if (user.Role === EUserRole.Admin || user.Role === EUserRole.Manager) {
        next();
        return;
      }

      // Verify project exists
      const project = await Project.findByPk(projectId);

      if (!project) {
        ResponseHelper.NotFound(res, 'Project not found');
        return;
      }

      // Developer: Check if they are owner or member
      if (user.Role === EUserRole.Developer) {
        const membership = await ProjectMember.findOne({
          where: {
            ProjectId: projectId,
            UserId: user.UserId,
          },
        });

        if (!membership) {
          Logger.Warn('Access denied: User is not a member of this project', {
            userId: user.UserId,
            projectId,
          });
          ResponseHelper.Forbidden(res, 'You can only modify projects you own or are a member of');
          return;
        }

        // Store membership info for later use in controllers
        (req as any).projectMembership = membership.toJSON();
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

  /**
   * Check if user can delete a project (STRICT)
   * - Admin/Manager: Can delete all projects
   * - Developer: Can ONLY delete projects they OWN (Role='owner' in ProjectMember)
   * - Members (Role='member') CANNOT delete projects
   * - Viewer: Cannot delete projects
   */
  public CheckProjectDeleteAccess = async (
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

      // Viewer cannot delete projects
      if (user.Role === EUserRole.Viewer) {
        Logger.Warn('Access denied: Viewers cannot delete projects', {
          userId: user.UserId,
          projectId,
        });
        ResponseHelper.Forbidden(res, 'Viewers cannot delete projects');
        return;
      }

      // Admin and Manager have full access
      if (user.Role === EUserRole.Admin || user.Role === EUserRole.Manager) {
        next();
        return;
      }

      // Verify project exists
      const project = await Project.findByPk(projectId);

      if (!project) {
        ResponseHelper.NotFound(res, 'Project not found');
        return;
      }

      // Developer: STRICT - Can ONLY delete if they are the OWNER
      if (user.Role === EUserRole.Developer) {
        const membership = await ProjectMember.findOne({
          where: {
            ProjectId: projectId,
            UserId: user.UserId,
          },
        });

        if (!membership) {
          Logger.Warn('Access denied: User is not a member of this project', {
            userId: user.UserId,
            projectId,
          });
          ResponseHelper.Forbidden(res, 'You do not have access to this project');
          return;
        }

        const membershipData = membership.toJSON();

        // STRICT: Only owners can delete
        if (membershipData.Role !== 'owner') {
          Logger.Warn('Access denied: Only project owners can delete projects', {
            userId: user.UserId,
            projectId,
            memberRole: membershipData.Role,
          });
          ResponseHelper.Forbidden(
            res,
            'You can only delete projects you own. Members cannot delete projects.'
          );
          return;
        }

        // Store membership info for later use in controllers
        (req as any).projectMembership = membershipData;
        next();
        return;
      }

      // Unknown role
      ResponseHelper.Forbidden(res, 'Insufficient permissions');
    } catch (error) {
      Logger.Error('Project delete access check failed', error as Error);
      ResponseHelper.Error(res, 'Authorization failed');
    }
  };
}

export default ProjectAccessMiddleware;
