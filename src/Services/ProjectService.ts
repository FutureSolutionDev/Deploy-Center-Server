/**
 * Project Service
 * Handles project CRUD operations and management
 * Following SOLID principles and PascalCase naming convention
 */

import { Project } from '@Models/index';
import Logger from '@Utils/Logger';
import EncryptionHelper from '@Utils/EncryptionHelper';
import { IProjectConfigJson } from '@Types/IDatabase';
import { EProjectType } from '@Types/ICommon';

export interface ICreateProjectData {
  Name: string;
  RepoUrl: string;
  Branch: string;
  ProjectPath: string;
  ProjectType: EProjectType;
  Config: IProjectConfigJson;
}

export interface IUpdateProjectData {
  Name?: string;
  RepoUrl?: string;
  Branch?: string;
  ProjectPath?: string;
  ProjectType?: EProjectType;
  IsActive?: boolean;
  Config?: IProjectConfigJson;
}

export class ProjectService {
  /**
   * Get all projects
   */
  public async GetAllProjects(includeInactive: boolean = false): Promise<Project[]> {
    try {
      const where: any = {};
      if (!includeInactive) {
        where.IsActive = true;
      }

      const projects = await Project.findAll({ where });
      return projects;
    } catch (error) {
      Logger.Error('Failed to get all projects', error as Error);
      throw error;
    }
  }

  /**
   * Get project by ID
   */
  public async GetProjectById(projectId: number): Promise<Project | null> {
    try {
      const project = await Project.findByPk(projectId);
      return project;
    } catch (error) {
      Logger.Error('Failed to get project by ID', error as Error, { projectId });
      throw error;
    }
  }

  /**
   * Get project by name
   */
  public async GetProjectByName(name: string): Promise<Project | null> {
    try {
      const project = await Project.findOne({ where: { Name: name } });
      return project;
    } catch (error) {
      Logger.Error('Failed to get project by name', error as Error, { name });
      throw error;
    }
  }

  /**
   * Create a new project
   */
  public async CreateProject(data: ICreateProjectData): Promise<Project> {
    try {
      // Check if project with same name exists
      const existingProject = await this.GetProjectByName(data.Name);
      if (existingProject) {
        throw new Error('Project with this name already exists');
      }

      // Generate webhook secret
      const webhookSecret = EncryptionHelper.GenerateRandomString(32);

      // Create project
      const project = await Project.create({
        Name: data.Name,
        RepoUrl: data.RepoUrl,
        Branch: data.Branch,
        ProjectPath: data.ProjectPath,
        ProjectType: data.ProjectType,
        WebhookSecret: webhookSecret,
        IsActive: true,
        Config: data.Config,
      } as any);

      Logger.Info(`Project created successfully: ${project.Name}`, { projectId: project.Id });
      return project;
    } catch (error) {
      Logger.Error('Failed to create project', error as Error, { projectName: data.Name });
      throw error;
    }
  }

  /**
   * Update a project
   */
  public async UpdateProject(projectId: number, data: IUpdateProjectData): Promise<Project> {
    try {
      const project = await this.GetProjectById(projectId);

      if (!project) {
        throw new Error('Project not found');
      }

      // Check if name is being changed and if it conflicts
      if (data.Name && data.Name !== project.Name) {
        const existingProject = await this.GetProjectByName(data.Name);
        if (existingProject) {
          throw new Error('Project with this name already exists');
        }
      }

      // Update project
      await project.update(data);

      Logger.Info(`Project updated successfully: ${project.Name}`, { projectId: project.Id });
      return project;
    } catch (error) {
      Logger.Error('Failed to update project', error as Error, { projectId });
      throw error;
    }
  }

  /**
   * Delete a project (soft delete - set inactive)
   */
  public async DeleteProject(projectId: number): Promise<void> {
    try {
      const project = await this.GetProjectById(projectId);

      if (!project) {
        throw new Error('Project not found');
      }

      // Soft delete
      await project.update({ IsActive: false });

      Logger.Info(`Project deleted successfully: ${project.Name}`, { projectId: project.Id });
    } catch (error) {
      Logger.Error('Failed to delete project', error as Error, { projectId });
      throw error;
    }
  }

  /**
   * Regenerate webhook secret
   */
  public async RegenerateWebhookSecret(projectId: number): Promise<string> {
    try {
      const project = await this.GetProjectById(projectId);

      if (!project) {
        throw new Error('Project not found');
      }

      const newSecret = EncryptionHelper.GenerateRandomString(32);
      await project.update({ WebhookSecret: newSecret });

      Logger.Info(`Webhook secret regenerated for project: ${project.Name}`, {
        projectId: project.Id,
      });

      return newSecret;
    } catch (error) {
      Logger.Error('Failed to regenerate webhook secret', error as Error, { projectId });
      throw error;
    }
  }

  /**
   * Get project statistics
   */
  public async GetProjectStatistics(projectId: number): Promise<{
    TotalDeployments: number;
    SuccessfulDeployments: number;
    FailedDeployments: number;
    SuccessRate: number;
    AverageDuration: number;
  }> {
    try {
      const project = await this.GetProjectById(projectId);

      if (!project) {
        throw new Error('Project not found');
      }

      // Get deployments for this project
      const { Deployment } = await import('@Models/index');
      const { EDeploymentStatus } = await import('@Types/ICommon');

      const allDeployments = await Deployment.findAll({
        where: { ProjectId: projectId },
      });

      const totalDeployments = allDeployments.length;
      const successfulDeployments = allDeployments.filter(
        (d) => d.Status === EDeploymentStatus.Success
      ).length;
      const failedDeployments = allDeployments.filter(
        (d) => d.Status === EDeploymentStatus.Failed
      ).length;

      const successRate =
        totalDeployments > 0 ? (successfulDeployments / totalDeployments) * 100 : 0;

      const completedDeployments = allDeployments.filter((d) => d.Duration !== null);
      const averageDuration =
        completedDeployments.length > 0
          ? completedDeployments.reduce((sum, d) => sum + (d.Duration || 0), 0) /
            completedDeployments.length
          : 0;

      return {
        TotalDeployments: totalDeployments,
        SuccessfulDeployments: successfulDeployments,
        FailedDeployments: failedDeployments,
        SuccessRate: Math.round(successRate * 100) / 100,
        AverageDuration: Math.round(averageDuration * 100) / 100,
      };
    } catch (error) {
      Logger.Error('Failed to get project statistics', error as Error, { projectId });
      throw error;
    }
  }
}

export default ProjectService;
