/**
 * Project Service
 * Handles project CRUD operations and management
 * Following SOLID principles and PascalCase naming convention
 */

import { Project } from '@Models/index';
import Logger from '@Utils/Logger';
import EncryptionHelper from '@Utils/EncryptionHelper';
import { IProjectConfigJson } from '@Types/IDatabase';
import { EProjectType, EDeploymentStatus } from '@Types/ICommon';
import DatabaseConnection from '@Database/DatabaseConnection';
import { QueryTypes } from 'sequelize';
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
  // public async GetProjectStatistics(projectId: number): Promise<{
  //   TotalDeployments: number;
  //   SuccessfulDeployments: number;
  //   FailedDeployments: number;
  //   SuccessRate: number;
  //   AverageDuration: number;
  //   DeploymentsByDay: any;
  // }> {
  //   try {
  //     const project = await this.GetProjectById(projectId);

  //     if (!project) {
  //       throw new Error('Project not found');
  //     }
  //     // Get deployments for this project

  //     const allDeployments = await Deployment.findAll({
  //       where: { ProjectId: projectId },
  //     });

  //     const totalDeployments = allDeployments.length;
  //     const successfulDeployments = allDeployments.filter(
  //       (d) => d.Status === EDeploymentStatus.Success
  //     ).length;
  //     const failedDeployments = allDeployments.filter(
  //       (d) => d.Status === EDeploymentStatus.Failed
  //     ).length;
  //     const successRate =
  //       totalDeployments > 0 ? (successfulDeployments / totalDeployments) * 100 : 0;
  //     const completedDeployments = allDeployments.filter((d) => d.Duration !== null);
  //     const averageDuration =
  //       completedDeployments.length > 0
  //         ? completedDeployments.reduce((sum, d) => sum + (d.Duration || 0), 0) /
  //           completedDeployments.length
  //         : 0;
  //     const DeploymentsByDay = await Deployment.findAll({
  //       where: { ProjectId: projectId },
  //       attributes: ['CreatedAt', 'Status'],
  //       group: ['CreatedAt', 'Status'],
  //     });
  //     return {
  //       TotalDeployments: totalDeployments,
  //       SuccessfulDeployments: successfulDeployments,
  //       FailedDeployments: failedDeployments,
  //       SuccessRate: Math.round(successRate * 100) / 100,
  //       AverageDuration: Math.round(averageDuration * 100) / 100,
  //       DeploymentsByDay: DeploymentsByDay,
  //     };
  //   } catch (error) {
  //     Logger.Error('Failed to get project statistics', error as Error, { projectId });
  //     throw error;
  //   }
  // }
  public async GetProjectStatistics(projectId: number): Promise<{
    TotalDeployments: number;
    SuccessfulDeployments: number;
    FailedDeployments: number;
    SuccessRate: number;
    AverageDuration: number;
    DeploymentsByDay: {
      Date: string;
      Success: number;
      Failed: number;
    }[];
  }> {
    try {
      const project = await this.GetProjectById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      const sequelize = DatabaseConnection.GetInstance();

      // 🔹 1. Global statistics
      const statsResult = await sequelize.query<{
        TotalDeployments: number;
        SuccessfulDeployments: number;
        FailedDeployments: number;
        SuccessRate: number;
        AverageDuration: number;
      }>(
        `
      SELECT
        COUNT(*)                                   AS TotalDeployments,
        SUM(Status = :success)                    AS SuccessfulDeployments,
        SUM(Status = :failed)                     AS FailedDeployments,
        ROUND(
          (SUM(Status = :success) / NULLIF(COUNT(*), 0)) * 100,
          2
        )                                         AS SuccessRate,
        ROUND(AVG(Duration), 2)                   AS AverageDuration
      FROM Deployments
      WHERE ProjectId = :projectId
      `,
        {
          replacements: {
            projectId,
            success: EDeploymentStatus.Success,
            failed: EDeploymentStatus.Failed,
          },
          type: QueryTypes.SELECT,
        }
      );

      const summary = statsResult[0] ?? {
        TotalDeployments: 0,
        SuccessfulDeployments: 0,
        FailedDeployments: 0,
        SuccessRate: 0,
        AverageDuration: 0,
      };

      // 🔹 2. Deployments by day (Chart)
      const deploymentsByDay = await sequelize.query<{
        Date: string;
        Success: number;
        Failed: number;
      }>(
        `
      SELECT
        DATE(CreatedAt)                           AS Date,
        SUM(Status = :success)                    AS Success,
        SUM(Status = :failed)                     AS Failed
      FROM Deployments
      WHERE ProjectId = :projectId
      GROUP BY DATE(CreatedAt)
      ORDER BY Date ASC
      `,
        {
          replacements: {
            projectId,
            success: EDeploymentStatus.Success,
            failed: EDeploymentStatus.Failed,
          },
          type: QueryTypes.SELECT,
        }
      );

      return {
        TotalDeployments: Number(summary.TotalDeployments),
        SuccessfulDeployments: Number(summary.SuccessfulDeployments),
        FailedDeployments: Number(summary.FailedDeployments),
        SuccessRate: Number(summary.SuccessRate),
        AverageDuration: Number(summary.AverageDuration),
        DeploymentsByDay: deploymentsByDay,
      };
    } catch (error) {
      Logger.Error('Failed to get project statistics', error as Error, { projectId });
      throw error;
    }
  }
}

export default ProjectService;
