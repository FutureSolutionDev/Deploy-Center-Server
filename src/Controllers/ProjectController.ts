/**
 * Project Controller
 * Handles project management HTTP requests
 * Following SOLID principles and PascalCase naming convention
 */

import { Request, Response } from 'express';
import ProjectService from '@Services/ProjectService';
import DeploymentService from '@Services/DeploymentService';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import { EUserRole } from '@Types/ICommon';

export class ProjectController {
  private readonly ProjectService: ProjectService;
  private readonly DeploymentService: DeploymentService;

  constructor() {
    this.ProjectService = new ProjectService();
    this.DeploymentService = new DeploymentService();
  }

  /**
   * Get all projects
   * GET /api/projects
   */
  public GetAllProjects = async (req: Request, res: Response): Promise<void> => {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const projects = await this.ProjectService.GetAllProjects(includeInactive);

      ResponseHelper.Success(res, 'Projects retrieved successfully', { Projects: projects });
    } catch (error) {
      Logger.Error('Failed to get projects', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve projects');
    }
  };

  /**
   * Get project by ID
   * GET /api/projects/:id
   */
  public GetProjectById = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.id!, 10);

      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      const project = await this.ProjectService.GetProjectById(projectId);

      if (!project) {
        ResponseHelper.NotFound(res, 'Project not found');
        return;
      }

      ResponseHelper.Success(res, 'Project retrieved successfully', { Project: project });
    } catch (error) {
      Logger.Error('Failed to get project', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve project');
    }
  };

  /**
   * Create new project
   * POST /api/projects
   */
  public CreateProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const userRole = (req as any).user?.Role;

      // Only admins can create projects
      if (userRole !== EUserRole.Admin) {
        ResponseHelper.Forbidden(res, 'Only administrators can create projects');
        return;
      }

      const { Name, RepoUrl, Branch, ProjectPath, ProjectType, Config } = req.body;

      // Validate required fields
      if (!Name || !RepoUrl || !Branch || !ProjectPath || !ProjectType) {
        ResponseHelper.ValidationError(res, 'Missing required fields', {
          Name: !Name ? 'Project name is required' : '',
          RepoUrl: !RepoUrl ? 'Repository URL is required' : '',
          Branch: !Branch ? 'Branch is required' : '',
          ProjectPath: !ProjectPath ? 'Project path is required' : '',
          ProjectType: !ProjectType ? 'Project type is required' : '',
        });
        return;
      }

      const project = await this.ProjectService.CreateProject({
        Name,
        RepoUrl,
        Branch,
        ProjectPath,
        ProjectType,
        Config: Config || { Branch, AutoDeploy: false, Variables: {}, Pipeline: [] },
      });

      ResponseHelper.Created(res, 'Project created successfully', { Project: project });
    } catch (error) {
      Logger.Error('Failed to create project', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * Update project
   * PUT /api/projects/:id
   */
  public UpdateProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.id!, 10);
      const userRole = (req as any).user?.Role;

      // Only admins can update projects
      if (userRole !== EUserRole.Admin) {
        ResponseHelper.Forbidden(res, 'Only administrators can update projects');
        return;
      }

      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      const { Name, RepoUrl, Branch, ProjectPath, ProjectType, Config, IsActive } = req.body;

      const project = await this.ProjectService.UpdateProject(projectId, {
        Name,
        RepoUrl,
        Branch,
        ProjectPath,
        ProjectType,
        Config,
        IsActive,
      });

      ResponseHelper.Success(res, 'Project updated successfully', { Project: project });
    } catch (error) {
      Logger.Error('Failed to update project', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * Delete project (soft delete)
   * DELETE /api/projects/:id
   */
  public DeleteProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.id!, 10);
      const userRole = (req as any).user?.Role;

      // Only admins can delete projects
      if (userRole !== EUserRole.Admin) {
        ResponseHelper.Forbidden(res, 'Only administrators can delete projects');
        return;
      }

      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      await this.ProjectService.DeleteProject(projectId);

      ResponseHelper.Success(res, 'Project deleted successfully');
    } catch (error) {
      Logger.Error('Failed to delete project', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * Regenerate webhook secret
   * POST /api/projects/:id/regenerate-webhook
   */
  public RegenerateWebhookSecret = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.id!, 10);
      const userRole = (req as any).user?.Role;

      // Only admins can regenerate webhook secrets
      if (userRole !== EUserRole.Admin) {
        ResponseHelper.Forbidden(res, 'Only administrators can regenerate webhook secrets');
        return;
      }

      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      const webhookSecret = await this.ProjectService.RegenerateWebhookSecret(projectId);

      ResponseHelper.Success(res, 'Webhook secret regenerated successfully', {
        WebhookSecret: webhookSecret,
      });
    } catch (error) {
      Logger.Error('Failed to regenerate webhook secret', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * Get project statistics
   * GET /api/projects/:id/statistics
   */
  public GetProjectStatistics = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.id!, 10);

      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }
      const statistics = await this.ProjectService.GetProjectStatistics(projectId);
      ResponseHelper.Success(res, 'Statistics retrieved successfully', { Statistics: statistics });
    } catch (error) {
      Logger.Error('Failed to get project statistics', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve statistics');
    }
  };

  /**
   * Get project by name
   * GET /api/projects/name/:name
   */
  public GetProjectByName = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectName = req.params.name!;

      if (!projectName) {
        ResponseHelper.ValidationError(res, 'Project name is required');
        return;
      }

      const project = await this.ProjectService.GetProjectByName(projectName);

      if (!project) {
        ResponseHelper.NotFound(res, 'Project not found');
        return;
      }

      ResponseHelper.Success(res, 'Project retrieved successfully', { Project: project });
    } catch (error) {
      Logger.Error('Failed to get project by name', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve project');
    }
  };

  /**
   * Trigger manual deployment for a project
   * POST /api/projects/:id/deploy
   */
  public DeployProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.id!, 10);
      const userId = (req as any).user?.UserId;
      const username = (req as any).user?.Username;
      const userRole = (req as any).user?.Role;

      // Only admins and developers can trigger deployments
      if (userRole !== EUserRole.Admin && userRole !== EUserRole.Developer) {
        ResponseHelper.Forbidden(res, 'Insufficient permissions to trigger deployment');
        return;
      }

      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      const { branch } = req.body;

      const deployment = await this.DeploymentService.CreateDeployment({
        ProjectId: projectId,
        TriggeredBy: username || 'manual',
        Branch: branch,
        ManualTrigger: true,
        UserId: userId,
      });

      ResponseHelper.Created(res, 'Deployment created successfully', { Deployment: deployment });
    } catch (error) {
      Logger.Error('Failed to create deployment', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * Get deployments for a project
   * GET /api/projects/:id/deployments
   */
  public GetProjectDeployments = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.id!, 10);
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const offset = parseInt(req.query.offset as string, 10) || 0;

      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      const result = await this.DeploymentService.GetProjectDeployments(projectId, limit, offset);

      ResponseHelper.Success(res, 'Deployments retrieved successfully', {
        Deployments: result.Deployments,
        Total: result.Total,
        Limit: limit,
        Offset: offset,
      });
    } catch (error) {
      Logger.Error('Failed to get project deployments', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve deployments');
    }
  };
}

export default ProjectController;
