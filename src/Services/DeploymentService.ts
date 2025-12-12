/**
 * Deployment Service
 * Orchestrates the complete deployment process
 * Combines Queue, Pipeline, and Notification services
 * Following SOLID principles and PascalCase naming convention
 */

import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import Logger from '@Utils/Logger';
import SshKeyManager from '@Utils/SshKeyManager';
import EncryptionHelper from '@Utils/EncryptionHelper';
import { Project, Deployment, DeploymentStep, AuditLog } from '@Models/index';
import {
  EDeploymentStatus,
  ETriggerType,
  EStepStatus,
  IDeploymentContext,
  EAuditAction,
  IEncryptedData,
} from '@Types/ICommon';
import QueueService from './QueueService';
import PipelineService from './PipelineService';
import NotificationService, { INotificationPayload } from './NotificationService';
import { IProcessedWebhookData } from './WebhookService';
import SocketService from './SocketService';

const execAsync = promisify(exec);

export interface ICreateDeploymentParams {
  ProjectId: number;
  TriggeredBy: string;
  Branch?: string;
  CommitHash?: string;
  CommitMessage?: string;
  Author?: string;
  WebhookData?: IProcessedWebhookData;
  ManualTrigger?: boolean;
  UserId?: number;
}

export class DeploymentService {
  private readonly QueueService: QueueService;
  private readonly PipelineService: PipelineService;
  private readonly NotificationService: NotificationService;
  private readonly DeploymentsBasePath: string;

  constructor() {
    this.QueueService = QueueService.GetInstance();
    this.PipelineService = new PipelineService();
    this.NotificationService = new NotificationService();
    this.DeploymentsBasePath =
      process.env.DEPLOYMENTS_PATH || path.join(process.cwd(), 'deployments');

    // Ensure deployments directory exists
    fs.ensureDirSync(this.DeploymentsBasePath);
  }

  /**
   * Create and queue a new deployment
   */
  public async CreateDeployment(params: ICreateDeploymentParams): Promise<Deployment> {
    try {
      // Get project
      const project = await Project.findByPk(params.ProjectId);
      if (!project) {
        throw new Error(`Project with ID ${params.ProjectId} not found`);
      }
    const JsonProject = project.toJSON()

      if (!JsonProject.IsActive) {
        throw new Error('Project is not active');
      }

      // Determine branch and commit info
      const branch = params.Branch || params.WebhookData?.Branch || JsonProject.Config.Branch || 'main';
      const commitHash = params.CommitHash || params.WebhookData?.CommitHash || 'unknown';
      const commitMessage =
        params.CommitMessage || params.WebhookData?.CommitMessage || 'Manual deployment';
      const author = params.Author || params.WebhookData?.Author || params.TriggeredBy;

      const triggerType = params.ManualTrigger ? ETriggerType.Manual : ETriggerType.Webhook;

      // Create deployment record
      const deployment = await Deployment.create({
        ProjectId: params.ProjectId,
        Status: EDeploymentStatus.Queued,
        TriggerType: triggerType,
        Branch: branch,
        CommitHash: commitHash,
        CommitMessage: commitMessage,
        Author: author,
        TriggeredBy: params.UserId,
        StartedAt: new Date(),
      });

      Logger.Info(`Deployment created and queued`, {
        deploymentId: deployment.Id,
        projectId: JsonProject.Id,
        projectName: JsonProject.Name,
        branch,
        commit: commitHash.substring(0, 7),
        triggeredBy: params.TriggeredBy,
        triggerType,
      });

      // Create audit log
      if (params.UserId) {
        await AuditLog.create({
          UserId: params.UserId,
          Action: EAuditAction.DeploymentCreated,
          ResourceType: 'deployment',
          ResourceId: deployment.Id,
          Details: {
            ProjectId: JsonProject.Id,
            ProjectName: JsonProject.Name,
            Branch: branch,
            CommitHash: commitHash,
          },
        });
      }

      // Add to queue
      await this.QueueService.Add(
        deployment.Id,
        JsonProject.Id,
        async () => await this.ExecuteDeployment(deployment.Id),
        params.ManualTrigger ? 10 : 0 // Higher priority for manual deployments
      );

      // Emit socket event
      SocketService.GetInstance().EmitDeploymentUpdate(deployment);

      return deployment;
    } catch (error) {
      Logger.Error('Failed to create deployment', error as Error, {
        projectId: params.ProjectId,
      });
      throw error;
    }
  }

  /**
   * Execute deployment (called by queue service)
   */
  private async ExecuteDeployment(deploymentId: number): Promise<void> {
    let deployment: Deployment | null = null;
    let project: Project | null = null;
    const startTime = Date.now();
    try {
      // Get deployment
      deployment = await Deployment.findByPk(deploymentId, {
        include: [
          {
            model: Project,
            as: 'Project',
          },
        ],
      });

      if (!deployment) {
        throw new Error(`Deployment ${deploymentId} not found`);
      }

      project = deployment.Project as Project;
      if (!project) {
        throw new Error('Project not found for deployment');
      }

      // Update status to in progress
      deployment.Status = EDeploymentStatus.InProgress;
      await deployment.save();

      Logger.Info(`Starting deployment execution`, {
        deploymentId: deployment.Id,
        projectId: project.Id,
        projectName: project.Name,
      });

      // Send in-progress notification
      await this.SendNotification(project, deployment, 'inProgress');

      // Emit socket event
      SocketService.GetInstance().EmitDeploymentUpdate(deployment);

      // Prepare working directory
      const workingDir = await this.PrepareWorkingDirectory(project, deployment);

      // Clone/pull repository
      await this.PrepareRepository(project, deployment, workingDir);

      // Build deployment context
      const context: IDeploymentContext = {
        RepoName: this.GetRepositoryName(project.RepoUrl),
        Branch: deployment.Branch,
        Commit: deployment.CommitHash,
        ProjectPath: workingDir,
        ProjectId: String(project.Id),
        DeploymentId: String(deployment.Id),
        ProjectName: project.Name,
        CommitMessage: deployment.CommitMessage || '',
        Author: deployment.Author || '',
        Environment: project.Config.Environment || 'production',
        WorkingDirectory: workingDir,
        RepoUrl: project.RepoUrl,
        CommitHash: deployment.CommitHash,
      };

      // Execute pipeline
      const pipelineResult = await this.PipelineService.ExecutePipeline(
        deployment.Id,
        project.Config.Pipeline || [],
        context,
        workingDir
      );

      // Calculate duration
      const duration = Math.floor((Date.now() - startTime) / 1000);

      if (pipelineResult.Success) {
        // Deployment succeeded
        deployment.Status = EDeploymentStatus.Success;
        deployment.CompletedAt = new Date();
        deployment.Duration = duration;
        await deployment.save();

        Logger.Info(`Deployment completed successfully`, {
          deploymentId: deployment.Id,
          projectId: project.Id,
          duration,
        });

        // Send success notification
        await this.SendNotification(project, deployment, 'success', duration);

        // Emit socket event
        SocketService.GetInstance().EmitDeploymentCompleted(deployment);
      } else {
        // Deployment failed
        deployment.Status = EDeploymentStatus.Failed;
        deployment.CompletedAt = new Date();
        deployment.Duration = duration;
        deployment.ErrorMessage = pipelineResult.ErrorMessage;
        await deployment.save();

        Logger.Error(
          `Deployment failed`,
          new Error(pipelineResult.ErrorMessage || 'Unknown error'),
          {
            deploymentId: deployment.Id,
            projectId: project.Id,
            duration,
          }
        );

        // Send failure notification
        await this.SendNotification(
          project,
          deployment,
          'failed',
          duration,
          pipelineResult.ErrorMessage
        );

        // Emit socket event
        SocketService.GetInstance().EmitDeploymentCompleted(deployment);
      }
    } catch (error) {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      const errorMessage = (error as Error).message;

      Logger.Error('Deployment execution failed', error as Error, {
        deploymentId,
        duration,
      });

      if (deployment) {
        deployment.Status = EDeploymentStatus.Failed;
        deployment.CompletedAt = new Date();
        deployment.Duration = duration;
        deployment.ErrorMessage = errorMessage;
        await deployment.save();

          if (project) {
            await this.SendNotification(project, deployment, 'failed', duration, errorMessage);
          }
          // Emit socket event
          SocketService.GetInstance().EmitDeploymentCompleted(deployment);
        }


      throw error;
    }
  }

  /**
   * Prepare working directory for deployment
   */
  private async PrepareWorkingDirectory(project: Project, deployment: Deployment): Promise<string> {
    try {
      const projectDir = path.join(
        this.DeploymentsBasePath,
        `project-${project.Id}`,
        `deployment-${deployment.Id}`
      );

      await fs.ensureDir(projectDir);

      Logger.Info('Working directory prepared', {
        deploymentId: deployment.Id,
        workingDir: projectDir,
      });

      return projectDir;
    } catch (error) {
      Logger.Error('Failed to prepare working directory', error as Error, {
        deploymentId: deployment.Id,
      });
      throw error;
    }
  }

  /**
   * Clone or pull repository
   *
   * SECURITY FLOW (SSH Keys):
   * 1. Check if project uses SSH authentication
   * 2. If yes: Create temporary SSH key file
   * 3. Execute git clone with GIT_SSH_COMMAND
   * 4. IMMEDIATELY delete temporary key file
   * 5. If no: Use HTTPS (existing behavior)
   */
  private async PrepareRepository(
    project: Project,
    deployment: Deployment,
    workingDir: string
  ): Promise<void> {
    // Create deployment step
    const step = await DeploymentStep.create({
      DeploymentId: deployment.Id,
      StepNumber: 0,
      StepName: 'Clone Repository',
      Status: EStepStatus.Running,
      StartedAt: new Date(),
    });

    const stepStartTime = Date.now();
    let sshKeyContext: Awaited<ReturnType<typeof SshKeyManager.CreateTemporaryKeyFile>> | null = null;

    try {
      const cloneCommand = `git clone --branch ${deployment.Branch} --depth 1 ${project.RepoUrl} .`;

      // Check if project uses SSH key authentication
      if (project.UseSshKey && project.SshKeyEncrypted) {
        Logger.Info('Using SSH key authentication for repository clone', {
          deploymentId: deployment.Id,
          projectId: project.Id,
          fingerprint: project.SshKeyFingerprint?.substring(0, 16) + '...',
        });

        try {
          // STEP 1: Decrypt and create temporary SSH key file
          const encryptedData: IEncryptedData = {
            Encrypted: project.SshKeyEncrypted,
            Iv: project.SshKeyIv!,
            AuthTag: project.SshKeyAuthTag!,
          };

          sshKeyContext = await SshKeyManager.CreateTemporaryKeyFile(
            encryptedData,
            project.Id
          );

          Logger.Debug('Temporary SSH key created for deployment', {
            deploymentId: deployment.Id,
            keyPath: sshKeyContext.keyPath,
          });

          // STEP 2: Execute git clone with SSH key
          const { stdout, stderr } = await SshKeyManager.ExecuteGitCommandWithKey(
            cloneCommand,
            sshKeyContext.keyPath,
            workingDir,
            { timeout: 300000 } // 5 minutes
          );

          // STEP 3: Checkout specific commit if needed
          if (deployment.CommitHash && deployment.CommitHash !== 'unknown') {
            await SshKeyManager.ExecuteGitCommandWithKey(
              `git checkout ${deployment.CommitHash}`,
              sshKeyContext.keyPath,
              workingDir,
              { timeout: 30000 }
            );
          }

          const duration = Math.floor((Date.now() - stepStartTime) / 1000);

          if (stderr) {
            Logger.Warn('Git clone reported warnings', {
              deploymentId: deployment.Id,
              warnings: stderr,
            });
          }

          step.Status = EStepStatus.Success;
          step.CompletedAt = new Date();
          step.Duration = duration;
          step.Output = `[SSH Authentication] ${stdout}`;
          await step.save();

          Logger.Info('Repository cloned successfully with SSH key', {
            deploymentId: deployment.Id,
            duration,
          });

          // Log SSH key usage in audit trail
          await AuditLog.create({
            Action: EAuditAction.SSH_KEY_USED,
            ResourceType: 'deployment',
            ResourceId: deployment.Id,
            Details: {
              projectId: project.Id,
              projectName: project.Name,
              success: true,
              keyFingerprint: project.SshKeyFingerprint,
              deploymentId: deployment.Id,
            },
          });
        } catch (sshError) {
          Logger.Error('SSH key authentication failed', sshError as Error, {
            deploymentId: deployment.Id,
            projectId: project.Id,
          });

          // Log failed SSH key usage
          await AuditLog.create({
            Action: EAuditAction.SSH_KEY_USED,
            ResourceType: 'deployment',
            ResourceId: deployment.Id,
            Details: {
              projectId: project.Id,
              projectName: project.Name,
              success: false,
              error: (sshError as Error).message,
              deploymentId: deployment.Id,
            },
          });

          throw sshError;
        }
      } else {
        // Fallback: Use traditional HTTPS clone
        Logger.Info('Using HTTPS authentication for repository clone', {
          deploymentId: deployment.Id,
          command: cloneCommand.replace(project.RepoUrl, '[REDACTED]'),
          workingDir,
        });

        const { stdout, stderr } = await execAsync(cloneCommand, {
          cwd: workingDir,
          timeout: 300000, // 5 minutes timeout
        });

        // Checkout specific commit if needed
        if (deployment.CommitHash && deployment.CommitHash !== 'unknown') {
          await execAsync(`git checkout ${deployment.CommitHash}`, {
            cwd: workingDir,
            timeout: 30000,
          });
        }

        const duration = Math.floor((Date.now() - stepStartTime) / 1000);

        if (stderr) {
          Logger.Warn('Git clone reported warnings', {
            deploymentId: deployment.Id,
            warnings: stderr,
          });
        }

        step.Status = EStepStatus.Success;
        step.CompletedAt = new Date();
        step.Duration = duration;
        step.Output = stdout;
        await step.save();

        Logger.Info('Repository cloned successfully with HTTPS', {
          deploymentId: deployment.Id,
          duration,
        });
      }
    } catch (error) {
      const duration = Math.floor((Date.now() - stepStartTime) / 1000);

      step.Status = EStepStatus.Failed;
      step.CompletedAt = new Date();
      step.Duration = duration;
      step.Error = (error as Error).message;
      await step.save();

      Logger.Error('Failed to prepare repository', error as Error, {
        deploymentId: deployment.Id,
      });

      throw error;
    } finally {
      // CRITICAL: ALWAYS cleanup SSH key file (even on error)
      if (sshKeyContext) {
        try {
          await sshKeyContext.cleanup();
          Logger.Debug('SSH key cleaned up after deployment', {
            deploymentId: deployment.Id,
          });
        } catch (cleanupError) {
          Logger.Error('Failed to cleanup SSH key', cleanupError as Error, {
            deploymentId: deployment.Id,
          });
          // Don't throw - cleanup failure shouldn't fail deployment
        }
      }
    }
  }

  /**
   * Extract repository name from URL
   */
  private GetRepositoryName(repoUrl: string): string {
    try {
      const cleanedUrl = repoUrl.replace(/\/$/, '').replace(/\.git$/, '');
      const segments = cleanedUrl.split('/');
      return segments[segments.length - 1] || 'repository';
    } catch {
      return 'repository';
    }
  }

  /**
   * Send deployment notification
   */
  private async SendNotification(
    project: Project,
    deployment: Deployment,
    status: 'queued' | 'inProgress' | 'success' | 'failed',
    duration?: number,
    error?: string
  ): Promise<void> {
    try {
      const statusMap = {
        queued: EDeploymentStatus.Queued,
        inProgress: EDeploymentStatus.InProgress,
        success: EDeploymentStatus.Success,
        failed: EDeploymentStatus.Failed,
      };

      const payload: INotificationPayload = {
        ProjectName: project.Name,
        DeploymentId: deployment.Id,
        Status: statusMap[status],
        Branch: deployment.Branch,
        CommitHash: deployment.CommitHash,
        CommitMessage: deployment.CommitMessage,
        Author: deployment.Author,
        Duration: duration,
        Error: error,
        Url: project.Config.Url,
      };

      await this.NotificationService.SendDeploymentNotification(project, deployment, payload);
    } catch (error) {
      // Don't fail deployment if notification fails
      Logger.Error('Failed to send notification', error as Error, {
        deploymentId: deployment.Id,
      });
    }
  }

  /**
   * Get deployment by ID
   */
  /**
   * Get all deployments
   */
  public async GetAllDeployments(
    limit: number = 50,
    offset: number = 0,
    status?: string
  ): Promise<{ Deployments: Deployment[]; Total: number }> {
    try {
      const where: Record<string, any> = {};
      if (status) {
        where.Status = status;
      }

      const { count, rows } = await Deployment.findAndCountAll({
        where,
        include: [
          {
            model: Project,
            as: 'Project',
            attributes: ['Id', 'Name', 'RepoUrl'],
          },
          {
            model: DeploymentStep,
            as: 'Steps',
            attributes: ['Id', 'StepName', 'Status', 'Duration'],
          },
        ],
        order: [['CreatedAt', 'DESC']],
        limit,
        offset,
      });

      return {
        Deployments: rows,
        Total: count,
      };
    } catch (error) {
      Logger.Error('Failed to get all deployments', error as Error);
      throw error;
    }
  }

  public async GetDeploymentById(deploymentId: number): Promise<Deployment | null> {
    try {
      const deployment = await Deployment.findByPk(deploymentId, {
        include: [
          {
            model: Project,
            as: 'Project',
            attributes: ['Id', 'Name', 'RepoUrl'],
          },
          {
            model: DeploymentStep,
            as: 'Steps',
            order: [['CreatedAt', 'ASC']],
          },
        ],
      });

      return deployment;
    } catch (error) {
      Logger.Error('Failed to get deployment', error as Error, { deploymentId });
      throw error;
    }
  }

  /**
   * Get deployment logs
   */
  public async GetDeploymentLogs(deploymentId: number): Promise<string | null> {
    try {
      const deployment = await Deployment.findByPk(deploymentId, {
        include: [
          {
            model: DeploymentStep,
            as: 'Steps',
          },
        ],
        order: [[{ model: DeploymentStep, as: 'Steps' }, 'StepNumber', 'ASC']],
      });

      if (!deployment) {
        return null;
      }

      // If LogFile exists, read it
      if (deployment.LogFile && (await fs.pathExists(deployment.LogFile))) {
        const logs = await fs.readFile(deployment.LogFile, 'utf-8');
        return logs;
      }

      // Otherwise, build logs from deployment steps
      const logs: string[] = [];

      logs.push('========================================');
      logs.push(`Deployment #${deployment.Id}`);
      logs.push(`Status: ${deployment.Status}`);
      logs.push(`Branch: ${deployment.Branch}`);
      logs.push(`Commit: ${deployment.CommitHash}`);
      logs.push(`Started: ${deployment.StartedAt}`);
      if (deployment.CompletedAt) {
        logs.push(`Completed: ${deployment.CompletedAt}`);
      }
      if (deployment.Duration) {
        logs.push(`Duration: ${deployment.Duration}s`);
      }
      logs.push('========================================\n');

      const steps = (deployment as any).Steps || [];

      if (steps.length === 0) {
        logs.push('\nNo pipeline steps found.\n');
      } else {
        for (const step of steps) {
          logs.push(`\n--- Step ${step.StepNumber}: ${step.StepName} ---`);
          logs.push(`Status: ${step.Status}`);
          if (step.StartedAt) {
            logs.push(`Started: ${step.StartedAt}`);
          }
          if (step.CompletedAt) {
            logs.push(`Completed: ${step.CompletedAt}`);
          }
          if (step.Duration !== null && step.Duration !== undefined) {
            logs.push(`Duration: ${step.Duration}s`);
          }

          if (step.Output) {
            logs.push('\nOutput:');
            logs.push(step.Output);
          }

          if (step.Error) {
            logs.push('\nError:');
            logs.push(step.Error);
          }

          logs.push('');
        }
      }

      // Add error message if deployment failed
      if (deployment.ErrorMessage) {
        logs.push('\n========================================');
        logs.push('DEPLOYMENT FAILED');
        logs.push('========================================');
        logs.push(deployment.ErrorMessage);
        logs.push('');
      }

      return logs.join('\n');
    } catch (error) {
      Logger.Error('Failed to get deployment logs', error as Error, { deploymentId });
      throw error;
    }
  }

  /**
   * Get deployments for a project
   */
  public async GetProjectDeployments(
    projectId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ Deployments: Deployment[]; Total: number }> {
    try {
      const { count, rows } = await Deployment.findAndCountAll({
        where: { ProjectId: projectId },
        include: [
          {
            model: DeploymentStep,
            as: 'Steps',
            attributes: ['Id', 'StepName', 'Status', 'Duration'],
          },
        ],
        order: [['CreatedAt', 'DESC']],
        limit,
        offset,
      });

      return {
        Deployments: rows,
        Total: count,
      };
    } catch (error) {
      Logger.Error('Failed to get project deployments', error as Error, { projectId });
      throw error;
    }
  }

  /**
   * Cancel a pending deployment
   */
  public async CancelDeployment(deploymentId: number, userId?: number): Promise<void> {
    try {
      const deployment = await Deployment.findByPk(deploymentId);

      if (!deployment) {
        throw new Error('Deployment not found');
      }

      if (deployment.Status !== EDeploymentStatus.Queued) {
        throw new Error('Can only cancel queued deployments');
      }

      deployment.Status = EDeploymentStatus.Cancelled;
      deployment.CompletedAt = new Date();
      await deployment.save();

      Logger.Info('Deployment cancelled', {
        userId,
      });

      // Emit socket event
      SocketService.GetInstance().EmitDeploymentUpdate(deployment);

      // Create audit log
      if (userId) {
        await AuditLog.create({
          UserId: userId,
          Action: EAuditAction.DeploymentCancelled,
          ResourceType: 'deployment',
          ResourceId: deploymentId,
          Details: {
            DeploymentId: deploymentId,
          },
        });
      }
    } catch (error) {
      Logger.Error('Failed to cancel deployment', error as Error, { deploymentId });
      throw error;
    }
  }

  /**
   * Retry a failed deployment
   */
  public async RetryDeployment(deploymentId: number, userId?: number): Promise<Deployment> {
    try {
      const originalDeployment = await Deployment.findByPk(deploymentId, {
        include: [
          {
            model: Project,
            as: 'Project',
          },
        ],
      });

      if (!originalDeployment) {
        throw new Error('Deployment not found');
      }

      if (originalDeployment.Status !== EDeploymentStatus.Failed) {
        throw new Error('Can only retry failed deployments');
      }

      // Create new deployment with same parameters
      const newDeployment = await this.CreateDeployment({
        ProjectId: originalDeployment.ProjectId,
        TriggeredBy: `Retry of deployment #${deploymentId}`,
        Branch: originalDeployment.Branch,
        CommitHash: originalDeployment.CommitHash,
        CommitMessage: originalDeployment.CommitMessage,
        Author: originalDeployment.Author,
        ManualTrigger: true,
        UserId: userId,
      });

      Logger.Info('Deployment retry initiated', {
        originalDeploymentId: deploymentId,
        newDeploymentId: newDeployment.Id,
        userId,
      });

      // Emit socket event
      SocketService.GetInstance().EmitDeploymentUpdate(newDeployment);

      return newDeployment;
    } catch (error) {
      Logger.Error('Failed to retry deployment', error as Error, { deploymentId });
      throw error;
    }
  }

  /**
   * Get deployment statistics
   */
  public async GetDeploymentStatistics(projectId?: number): Promise<{
    Total: number;
    Success: number;
    Failed: number;
    InProgress: number;
    Queued: number;
    AverageDuration: number;
    SuccessRate: number;
  }> {
    try {
      const where = projectId ? { ProjectId: projectId } : {};

      const deployments = await Deployment.findAll({ where });

      const stats = {
        Total: deployments.length,
        Success: deployments.filter((d) => d.Status === EDeploymentStatus.Success).length,
        Failed: deployments.filter((d) => d.Status === EDeploymentStatus.Failed).length,
        InProgress: deployments.filter((d) => d.Status === EDeploymentStatus.InProgress).length,
        Queued: deployments.filter((d) => d.Status === EDeploymentStatus.Queued).length,
        AverageDuration: 0,
        SuccessRate: 0,
      };

      // Calculate average duration
      const completedDeployments = deployments.filter((d) => d.Duration !== null);
      if (completedDeployments.length > 0) {
        const totalDuration = completedDeployments.reduce((sum, d) => sum + (d.Duration || 0), 0);
        stats.AverageDuration = Math.floor(totalDuration / completedDeployments.length);
      }

      // Calculate success rate
      const finishedDeployments = stats.Success + stats.Failed;
      if (finishedDeployments > 0) {
        stats.SuccessRate = Math.floor((stats.Success / finishedDeployments) * 100);
      }

      return stats;
    } catch (error) {
      Logger.Error('Failed to get deployment statistics', error as Error, { projectId });
      throw error;
    }
  }
}

export default DeploymentService;
