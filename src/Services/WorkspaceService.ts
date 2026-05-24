/**
 * WorkspaceService — Deploy Center v3.0 / F-009 (T088).
 * CRUD + project-count aggregation + assign-project helper.
 * RBAC enforced at the route layer (any authenticated user; FR-035).
 */

import Logger from '@Utils/Logger';
import { Workspace, Project } from '@Models/index';
import { isWorkspaceIcon, DEFAULT_WORKSPACE_ICON } from '@Types/IWorkspaceIcons';
import type { TWorkspaceIcon } from '@Types/IWorkspaceIcons';

export interface IWorkspaceListItem {
  Id: number;
  Name: string;
  Description: string | null;
  Color: string;
  Icon: TWorkspaceIcon;
  CreatedBy: number | null;
  ProjectCount: number;
  IsActive: boolean;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface IWorkspaceCreateInput {
  Name: string;
  Description?: string | null;
  Color: string;
  Icon?: TWorkspaceIcon;
  CreatedBy: number;
}

export interface IWorkspaceUpdateInput {
  Name?: string;
  Description?: string | null;
  Color?: string;
  Icon?: TWorkspaceIcon;
  IsActive?: boolean;
}

const COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export class WorkspaceService {
  /**
   * List all active workspaces with project counts. The pseudo-row
   * "Unassigned" is computed client-side from `Project.WorkspaceId IS NULL`
   * — server returns only real rows.
   */
  public async List(): Promise<IWorkspaceListItem[]> {
    try {
      const rows = await Workspace.findAll({
        where: { IsActive: true },
        order: [['Name', 'ASC']],
      });
      const items: IWorkspaceListItem[] = [];
      for (const r of rows) {
        const count = await Project.count({
          where: { WorkspaceId: r.Id, IsActive: true },
        });
        items.push(this.toListItem(r, count));
      }
      return items;
    } catch (error) {
      Logger.Error('WorkspaceService.List failed', error as Error);
      throw error;
    }
  }

  /** Count of unassigned (WorkspaceId IS NULL) active projects. */
  public async UnassignedProjectCount(): Promise<number> {
    return Project.count({ where: { WorkspaceId: null, IsActive: true } });
  }

  public async GetById(id: number): Promise<Workspace | null> {
    return Workspace.findByPk(id);
  }

  public async Create(input: IWorkspaceCreateInput): Promise<Workspace> {
    if (!COLOR_RE.test(input.Color)) {
      throw new Error('Color must be a hex #RRGGBB string');
    }
    if (input.Icon && !isWorkspaceIcon(input.Icon)) {
      throw new Error(`Unknown workspace icon: ${input.Icon}`);
    }
    const dupe = await Workspace.findOne({
      where: { CreatedBy: input.CreatedBy, Name: input.Name },
    });
    if (dupe) {
      throw new Error(`Workspace '${input.Name}' already exists for this user`);
    }
    const row = await Workspace.create({
      Name: input.Name,
      Description: input.Description ?? null,
      Color: input.Color,
      Icon: input.Icon ?? DEFAULT_WORKSPACE_ICON,
      CreatedBy: input.CreatedBy,
      IsActive: true,
    });
    Logger.Info('Workspace created', { id: row.Id, createdBy: input.CreatedBy });
    return row;
  }

  public async Update(id: number, patch: IWorkspaceUpdateInput): Promise<Workspace | null> {
    const row = await Workspace.findByPk(id);
    if (!row) return null;
    if (patch.Color !== undefined && !COLOR_RE.test(patch.Color)) {
      throw new Error('Color must be a hex #RRGGBB string');
    }
    if (patch.Icon !== undefined && !isWorkspaceIcon(patch.Icon)) {
      throw new Error(`Unknown workspace icon: ${patch.Icon}`);
    }
    if (patch.Name && patch.Name !== row.Name) {
      const clash = await Workspace.findOne({
        where: { CreatedBy: row.CreatedBy, Name: patch.Name },
      });
      if (clash && clash.Id !== id) {
        throw new Error(`Workspace '${patch.Name}' already exists for this user`);
      }
      row.Name = patch.Name;
    }
    if (patch.Description !== undefined) row.Description = patch.Description;
    if (patch.Color !== undefined) row.Color = patch.Color;
    if (patch.Icon !== undefined) row.Icon = patch.Icon;
    if (patch.IsActive !== undefined) row.IsActive = patch.IsActive;
    await row.save();
    return row;
  }

  public async Delete(id: number): Promise<boolean> {
    const deleted = await Workspace.destroy({ where: { Id: id } });
    if (deleted > 0) {
      Logger.Info('Workspace deleted; projects moved to Unassigned (FK SET NULL)', { id });
    }
    return deleted > 0;
  }

  /**
   * Move a project to a workspace (or to Unassigned with null).
   * Throws if the workspace doesn't exist.
   */
  public async AssignProject(projectId: number, workspaceId: number | null): Promise<Project | null> {
    const project = await Project.findByPk(projectId);
    if (!project) return null;
    if (workspaceId !== null) {
      const ws = await Workspace.findByPk(workspaceId);
      if (!ws) throw new Error(`Workspace ${workspaceId} not found`);
    }
    project.WorkspaceId = workspaceId;
    await project.save();
    Logger.Info('Project workspace assignment changed', { projectId, workspaceId });
    return project;
  }

  private toListItem(r: Workspace, projectCount: number): IWorkspaceListItem {
    return {
      Id: r.Id,
      Name: r.Name,
      Description: r.Description,
      Color: r.Color,
      Icon: r.Icon,
      CreatedBy: r.CreatedBy,
      ProjectCount: projectCount,
      IsActive: r.IsActive,
      CreatedAt: r.CreatedAt,
      UpdatedAt: r.UpdatedAt,
    };
  }
}

export default WorkspaceService;
