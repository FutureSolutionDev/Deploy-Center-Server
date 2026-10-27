/**
 * Project Access Control Middleware
 * Validates user access to specific projects based on roles and membership.
 *
 * v3.0.1 (SEC-H4): every decision is delegated to AccessControlService so the
 * HTTP layer and Socket.IO share one implementation.
 *
 * Access Control (STRICT ENFORCEMENT):
 * - Admin / Manager: full access to all projects
 * - Developer: view + modify projects they are a member of (or created);
 *   delete only projects they own (ProjectMember.Role = 'owner')
 * - Viewer: read-only access to projects they are a member of
 */

import { Request, Response, NextFunction } from 'express';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import { EUserRole } from '@Types/ICommon';
import { Project, ProjectMember } from '@Models/index';
import AccessControlService, { IAccessSubject } from '@Services/AccessControlService';

type TProjectCheck = (subject: IAccessSubject, projectId: number) => Promise<boolean>;

interface IRequestWithUser extends Request {
  user?: IAccessSubject;
  projectMembership?: unknown;
}

export class ProjectAccessMiddleware {
  /**
   * Shared flow: authenticate, parse the id, 404 for unknown projects
   * (non-staff only, so ids cannot be probed), then apply `check`.
   */
  private Guard(check: TProjectCheck, deniedMessage: string, action: string) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const user = (req as IRequestWithUser).user;
        const projectIdParam = req.params.projectId || req.params.id;

        if (!user) {
          ResponseHelper.Unauthorized(res, 'Authentication required');
          return;
        }

        if (!projectIdParam) {
          ResponseHelper.ValidationError(res, 'Project ID is required');
          return;
        }

        const projectId = AccessControlService.ParseId(projectIdParam);
        if (projectId === null) {
          ResponseHelper.ValidationError(res, 'Invalid project ID');
          return;
        }

        if (AccessControlService.IsStaff(user)) {
          next();
          return;
        }

        if (user.Role === EUserRole.Viewer && action !== 'view') {
          Logger.Warn(`Access denied: Viewers cannot ${action} projects`, {
            userId: user.UserId,
            projectId,
          });
          ResponseHelper.Forbidden(res, `Viewers cannot ${action} projects`);
          return;
        }

        const project = await Project.findByPk(projectId, { attributes: ['Id'] });
        if (!project) {
          ResponseHelper.NotFound(res, 'Project not found');
          return;
        }

        if (!(await check(user, projectId))) {
          Logger.Warn(`Access denied: user may not ${action} this project`, {
            userId: user.UserId,
            projectId,
          });
          ResponseHelper.Forbidden(res, deniedMessage);
          return;
        }

        const membership = await ProjectMember.findOne({
          where: { ProjectId: projectId, UserId: user.UserId },
        });
        if (membership) {
          (req as IRequestWithUser).projectMembership = membership.toJSON();
        }
        next();
      } catch (error) {
        Logger.Error(`Project ${action} access check failed`, error as Error);
        ResponseHelper.Error(res, 'Authorization failed');
      }
    };
  }

  /**
   * Check if user may view a project (Viewer: membership required).
   */
  public CheckProjectAccess = this.Guard(
    (subject, projectId) => AccessControlService.CanViewProject(subject, projectId),
    'You do not have access to this project',
    'view'
  );

  /**
   * Check if user can modify a project (never Viewer).
   */
  public CheckProjectModifyAccess = this.Guard(
    (subject, projectId) => AccessControlService.CanModifyProject(subject, projectId),
    'You can only modify projects you own or are a member of',
    'modify'
  );

  /**
   * Check if user can delete a project (STRICT): Developers must be owners.
   */
  public CheckProjectDeleteAccess = this.Guard(
    async (subject, projectId) => {
      if (subject.Role !== EUserRole.Developer) return false;
      const membership = await ProjectMember.findOne({
        where: { ProjectId: projectId, UserId: subject.UserId },
      });
      if (membership) return membership.get('Role') === 'owner';
      const project = await Project.findByPk(projectId, { attributes: ['Id', 'CreatedBy'] });
      return Boolean(project && project.CreatedBy === subject.UserId);
    },
    'You can only delete projects you own. Members cannot delete projects.',
    'delete'
  );
}

export default ProjectAccessMiddleware;
