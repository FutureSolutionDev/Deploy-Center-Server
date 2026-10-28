/**
 * AccessControlService — single source of truth for project / deployment
 * authorization (v3.0.1, SEC-C2 / SEC-H4).
 *
 * Used by ProjectAccessMiddleware, DeploymentAccessMiddleware and the
 * Socket.IO room authorization so HTTP and WebSocket enforce identical rules.
 *
 * RBAC (see CLAUDE.md):
 *   - Admin / Manager: every project.
 *   - Developer: view + modify projects they are a member of.
 *   - Viewer: view-only, projects they are a member of.
 */

import { Deployment, ProjectMember } from '@Models/index';
import { EUserRole } from '@Types/ICommon';

export interface IAccessSubject {
  UserId: number;
  Role: EUserRole;
}

export type TAccessibleProjects = 'all' | number[];

export class AccessControlService {
  /** Admin and Manager see and manage every project. */
  public static IsStaff(subject: IAccessSubject): boolean {
    return subject.Role === EUserRole.Admin || subject.Role === EUserRole.Manager;
  }

  /** Strictly positive integer id, or null. Rejects "1abc", "1.5", "-1". */
  public static ParseId(raw: unknown): number | null {
    if (typeof raw === 'number') {
      return Number.isInteger(raw) && raw > 0 ? raw : null;
    }
    if (typeof raw === 'string' && /^[1-9][0-9]{0,9}$/.test(raw)) {
      return parseInt(raw, 10);
    }
    return null;
  }

  /**
   * Developer / Viewer relationship to a project: a ProjectMember row only.
   * Creators hold an owner membership (migration 023), so removing a member
   * always removes their access.
   */
  public static async IsMember(userId: number, projectId: number): Promise<boolean> {
    const membership = await ProjectMember.findOne({
      where: { ProjectId: projectId, UserId: userId },
      attributes: ['Id'],
    });
    return Boolean(membership);
  }

  public static async CanViewProject(subject: IAccessSubject, projectId: number): Promise<boolean> {
    if (AccessControlService.IsStaff(subject)) return true;
    if (subject.Role !== EUserRole.Developer && subject.Role !== EUserRole.Viewer) return false;
    return AccessControlService.IsMember(subject.UserId, projectId);
  }

  public static async CanModifyProject(
    subject: IAccessSubject,
    projectId: number
  ): Promise<boolean> {
    if (AccessControlService.IsStaff(subject)) return true;
    if (subject.Role !== EUserRole.Developer) return false;
    return AccessControlService.IsMember(subject.UserId, projectId);
  }

  /** Resolve the project a deployment belongs to (null when it does not exist). */
  public static async GetDeploymentProjectId(deploymentId: number): Promise<number | null> {
    const deployment = await Deployment.findByPk(deploymentId, {
      attributes: ['Id', 'ProjectId'],
    });
    return deployment ? deployment.ProjectId : null;
  }

  public static async CanViewDeployment(
    subject: IAccessSubject,
    deploymentId: number
  ): Promise<boolean> {
    const projectId = await AccessControlService.GetDeploymentProjectId(deploymentId);
    if (projectId === null) return false;
    return AccessControlService.CanViewProject(subject, projectId);
  }

  public static async CanModifyDeployment(
    subject: IAccessSubject,
    deploymentId: number
  ): Promise<boolean> {
    const projectId = await AccessControlService.GetDeploymentProjectId(deploymentId);
    if (projectId === null) return false;
    return AccessControlService.CanModifyProject(subject, projectId);
  }

  /** 'all' for staff, otherwise the ids of projects the user may view. */
  public static async GetAccessibleProjectIds(
    subject: IAccessSubject
  ): Promise<TAccessibleProjects> {
    if (AccessControlService.IsStaff(subject)) return 'all';
    if (subject.Role !== EUserRole.Developer && subject.Role !== EUserRole.Viewer) return [];

    const memberships = await ProjectMember.findAll({
      where: { UserId: subject.UserId },
      attributes: ['ProjectId'],
    });
    return Array.from(new Set(memberships.map((m) => m.get('ProjectId'))));
  }
}

export default AccessControlService;
