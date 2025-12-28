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
      const user = (req as any).user;
      const userId = user?.UserId;

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

      const project = await this.ProjectService.CreateProject(
        {
          Name,
          RepoUrl,
          Branch,
          ProjectPath,
          ProjectType,
          Config: Config || { Branch, AutoDeploy: false, Variables: {}, Pipeline: [] },
          CreatedBy: userId, // Set the creator
        },
        req
      );

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
      const projectIdStr = req.params.id;
      if (!projectIdStr) {
        ResponseHelper.ValidationError(res, 'Project ID is required');
        return;
      }

      const projectId = parseInt(projectIdStr, 10);
      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      const { Name, RepoUrl, Branch, ProjectPath, ProjectType, Config, IsActive } = req.body;

      const project = await this.ProjectService.UpdateProject(
        projectId,
        {
          Name,
          RepoUrl,
          Branch,
          ProjectPath,
          ProjectType,
          Config,
          IsActive,
        },
        req
      );

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
      const projectIdStr = req.params.id;
      if (!projectIdStr) {
        ResponseHelper.ValidationError(res, 'Project ID is required');
        return;
      }

      const projectId = parseInt(projectIdStr, 10);
      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      await this.ProjectService.DeleteProject(projectId, req);

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
      const projectIdStr = req.params.id;
      if (!projectIdStr) {
        ResponseHelper.ValidationError(res, 'Project ID is required');
        return;
      }

      const projectId = parseInt(projectIdStr, 10);
      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      const webhookSecret = await this.ProjectService.RegenerateWebhookSecret(projectId, req);

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

  // ========================================
  // SSH KEY MANAGEMENT ENDPOINTS
  // ========================================

  /**
   * Generate SSH key for project
   * POST /api/projects/:id/ssh-key
   */
  public GenerateSshKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.id!, 10);
      const userRole = (req as any).user?.Role;

      // Only admins and developers can generate SSH keys
      if (userRole !== EUserRole.Admin && userRole !== EUserRole.Developer) {
        ResponseHelper.Forbidden(res, 'Insufficient permissions to generate SSH keys');
        return;
      }

      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      const { keyType } = req.body;

      const result = await this.ProjectService.GenerateSshKey(projectId, {
        keyType: keyType || 'ed25519',
      });

      ResponseHelper.Created(res, 'SSH key generated successfully', {
        PublicKey: result.publicKey,
        Fingerprint: result.fingerprint,
        KeyType: result.keyType,
      });
    } catch (error) {
      Logger.Error('Failed to generate SSH key', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * Regenerate (rotate) SSH key for project
   * PUT /api/projects/:id/ssh-key
   *
   * Request body (optional):
   * {
   *   "keyType": "rsa" | "ed25519"
   * }
   */
  public RegenerateSshKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.id!, 10);
      const userRole = (req as any).user?.Role;
      const { keyType } = req.body;

      // Only admins and developers can regenerate SSH keys
      if (userRole !== EUserRole.Admin && userRole !== EUserRole.Developer) {
        ResponseHelper.Forbidden(res, 'Insufficient permissions to regenerate SSH keys');
        return;
      }

      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      // Validate keyType if provided
      if (keyType && keyType !== 'ed25519' && keyType !== 'rsa') {
        ResponseHelper.ValidationError(res, 'Invalid keyType. Must be "ed25519" or "rsa"');
        return;
      }

      const result = await this.ProjectService.RegenerateSshKey(projectId, {
        keyType: keyType as 'ed25519' | 'rsa' | undefined,
      });

      ResponseHelper.Success(res, 'SSH key regenerated successfully', {
        PublicKey: result.publicKey,
        Fingerprint: result.fingerprint,
        KeyType: result.keyType,
      });
    } catch (error) {
      Logger.Error('Failed to regenerate SSH key', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * Delete SSH key from project
   * DELETE /api/projects/:id/ssh-key
   */
  public DeleteSshKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.id!, 10);
      const userRole = (req as any).user?.Role;

      // Only admins and developers can delete SSH keys
      if (userRole !== EUserRole.Admin && userRole !== EUserRole.Developer) {
        ResponseHelper.Forbidden(res, 'Insufficient permissions to delete SSH keys');
        return;
      }

      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      await this.ProjectService.DeleteSshKey(projectId);

      ResponseHelper.Success(res, 'SSH key deleted successfully');
    } catch (error) {
      Logger.Error('Failed to delete SSH key', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * Get SSH public key info (safe to expose)
   * GET /api/projects/:id/ssh-key
   */
  public GetSshPublicKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.id!, 10);

      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      const keyInfo = await this.ProjectService.GetSshPublicKeyInfo(projectId);

      if (!keyInfo) {
        ResponseHelper.NotFound(res, 'No SSH key configured for this project');
        return;
      }

      ResponseHelper.Success(res, 'SSH public key retrieved successfully', {
        PublicKey: keyInfo.publicKey,
        Fingerprint: keyInfo.fingerprint,
        KeyType: keyInfo.keyType,
        CreatedAt: keyInfo.createdAt,
        RotatedAt: keyInfo.rotatedAt,
      });
    } catch (error) {
      Logger.Error('Failed to get SSH public key', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve SSH key information');
    }
  };

  /**
   * Toggle SSH key usage for project
   * PATCH /api/projects/:id/ssh-key/toggle
   */
  public ToggleSshKeyUsage = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectIdStr = req.params.id;
      if (!projectIdStr) {
        ResponseHelper.ValidationError(res, 'Project ID is required');
        return;
      }

      const projectId = parseInt(projectIdStr, 10);
      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        ResponseHelper.ValidationError(res, 'enabled must be a boolean value');
        return;
      }

      await this.ProjectService.ToggleSshKeyUsage(projectId, enabled, req);

      ResponseHelper.Success(
        res,
        `SSH authentication ${enabled ? 'enabled' : 'disabled'} successfully`
      );
    } catch (error) {
      Logger.Error('Failed to toggle SSH key usage', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  // ========================================
  // PROJECT MEMBER MANAGEMENT
  // ========================================

  /**
   * Get all members of a project
   * GET /api/projects/:id/members
   */
  public GetProjectMembers = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectIdStr = req.params.id;
      if (!projectIdStr) {
        ResponseHelper.ValidationError(res, 'Project ID is required');
        return;
      }

      const projectId = parseInt(projectIdStr, 10);
      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      const members = await this.ProjectService.GetProjectMembers(projectId);

      ResponseHelper.Success(res, 'Project members retrieved successfully', members);
    } catch (error) {
      Logger.Error('Failed to get project members', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * Add a member to a project
   * POST /api/projects/:id/members
   * Body: { userId: number, role?: 'owner' | 'member' }
   */
  public AddProjectMember = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectIdStr = req.params.id;
      if (!projectIdStr) {
        ResponseHelper.ValidationError(res, 'Project ID is required');
        return;
      }

      const projectId = parseInt(projectIdStr, 10);
      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      const { userId, role } = req.body;
      const currentUser = (req as any).user;

      if (!userId || isNaN(parseInt(userId, 10))) {
        ResponseHelper.ValidationError(res, 'Valid userId is required');
        return;
      }

      const memberRole = role || 'member';
      if (memberRole !== 'owner' && memberRole !== 'member') {
        ResponseHelper.ValidationError(res, 'Role must be either "owner" or "member"');
        return;
      }

      const result = await this.ProjectService.AddProjectMember(
        projectId,
        parseInt(userId, 10),
        memberRole,
        currentUser.UserId,
        req
      );

      ResponseHelper.Success(res, 'Member added to project successfully', result);
    } catch (error) {
      Logger.Error('Failed to add project member', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * Remove a member from a project
   * DELETE /api/projects/:id/members/:userId
   */
  public RemoveProjectMember = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectIdStr = req.params.id;
      const userIdStr = req.params.userId;

      if (!projectIdStr) {
        ResponseHelper.ValidationError(res, 'Project ID is required');
        return;
      }

      if (!userIdStr) {
        ResponseHelper.ValidationError(res, 'User ID is required');
        return;
      }

      const projectId = parseInt(projectIdStr, 10);
      const userId = parseInt(userIdStr, 10);

      if (isNaN(projectId)) {
        ResponseHelper.ValidationError(res, 'Invalid project ID');
        return;
      }

      if (isNaN(userId)) {
        ResponseHelper.ValidationError(res, 'Invalid user ID');
        return;
      }

      await this.ProjectService.RemoveProjectMember(projectId, userId, req);

      ResponseHelper.Success(res, 'Member removed from project successfully');
    } catch (error) {
      Logger.Error('Failed to remove project member', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };
}

export default ProjectController;
