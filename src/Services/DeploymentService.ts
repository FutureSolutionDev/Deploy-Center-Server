/**
 * Deployment Service
 * Orchestrates the complete deployment process
 * Combines Queue, Pipeline, and Notification services
 * Following SOLID principles and PascalCase naming convention
 */

import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import os from 'os';
import { promisify } from 'util';
import Logger from '@Utils/Logger';
import SshKeyManager from '@Utils/SshKeyManager';
import AutoRecovery from '@Utils/AutoRecovery';
import type { IEncryptedData } from '@Utils/EncryptionHelper';
import { Project, Deployment, DeploymentStep, AuditLog } from '@Models/index';
import {
  EDeploymentStatus,
  ETriggerType,
  EStepStatus,
  IDeploymentContext,
  EAuditAction,
} from '@Types/ICommon';
import QueueService from './QueueService';
import PipelineService from './PipelineService';
import NotificationService, { INotificationPayload } from './NotificationService';
import { IProcessedWebhookData } from './WebhookService';
import SocketService from './SocketService';
// System files to always preserve (fixed patterns)
const systemPreservePatterns = [
  // Environment and config files
  '.env',
  '.env.*',
  '.deploy-center', // Deployment metadata file
  '.user.ini',
  '.htaccess',
  'web.config',
  'php.ini',
  'php-fpm.conf',

  // SSL/TLS and security
  '.well-known', // ACME challenge, security.txt, etc.
  '.well-known/**',
  'ssl',
  'ssl/**',
  'certs',
  'certs/**',

  // Lock files and dependencies
  'node_modules',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'composer.lock',

  // User data and uploads
  'uploads',
  'uploads/**',
  'storage',
  'storage/**',
  'public/uploads',
  'public/uploads/**',
  'public/storage',
  'public/storage/**',

  // Cache and temporary files
  'Cache',
  'cache',
  'tmp',
  'temp',

  // Logs
  'Logs',
  'logs',
  '*.log',
  'npm-debug.log*',
  'yarn-debug.log*',
  'yarn-error.log*',
  'pnpm-debug.log*',

  // Database files
  '*.sqlite',
  '*.sqlite3',
  '*.db',

  // Session files
  'sessions',
  'sessions/**',

  // Backup files
  'backups',
  'backups/**',
  '*.bak',
  '*.backup',

  // OS and system files
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',

  // Version control (should not be in production but just in case)
  '.git',
  '.svn',
  '.hg',
];
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
      const JsonProject = project.toJSON();

      if (!JsonProject.IsActive) {
        throw new Error('Project is not active');
      }

      console.log({
        project: JsonProject,
        params,
      });
      // Determine branch and commit info
      const branch =
        params.Branch || params.WebhookData?.Branch || JsonProject.Config.Branch || 'main';
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
      this.QueueService.Add(
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
    let workingDir: string | null = null;
    let sshKeyContext: Awaited<ReturnType<typeof SshKeyManager.CreateTemporaryKeyFile>> | null =
      null;
    const startTime = Date.now();
    const osUser = os.userInfo().username;

    Logger.Info(`Deployment execution started as OS user: ${osUser}`, {
      deploymentId,
      osUser,
    });

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

      const projectRecord = deployment.Project as Project;
      if (!projectRecord) {
        throw new Error('Project not found for deployment');
      }
      project = projectRecord; // Assign to variable with proper type

      // Create SSH key context FIRST if needed (required for fetching commit hash)
      if (projectRecord.UseSshKey && projectRecord.SshKeyEncrypted) {
        Logger.Info('Creating SSH key context for deployment', {
          deploymentId: deployment.Id,
          projectId: projectRecord.Id,
          fingerprint: projectRecord.SshKeyFingerprint?.substring(0, 16) + '...',
        });

        const encryptedData: IEncryptedData = {
          Encrypted: projectRecord.SshKeyEncrypted,
          Iv: projectRecord.SshKeyIv!,
          AuthTag: projectRecord.SshKeyAuthTag!,
        };

        // AUTO-RECOVERY: Retry SSH key creation with exponential backoff
        sshKeyContext = await AutoRecovery.RetryOperation(
          async () => await SshKeyManager.CreateTemporaryKeyFile(encryptedData, projectRecord.Id),
          {
            maxRetries: 3,
            delayMs: 500,
            exponentialBackoff: true,
            operationName: 'SSH key creation',
          }
        );

        Logger.Debug('SSH key context created for deployment', {
          deploymentId: deployment.Id,
          keyPath: sshKeyContext.keyPath,
        });
      }

      // If commit hash is unknown (manual deployment), fetch the actual latest commit hash
      if (deployment.CommitHash === 'unknown') {
        try {
          Logger.Info('Fetching latest commit hash for manual deployment', {
            deploymentId: deployment.Id,
            projectId: projectRecord.Id,
            branch: deployment.Branch,
          });

          const actualCommitHash = await this.FetchLatestCommitHash(
            projectRecord,
            deployment.Branch,
            sshKeyContext
          );

          deployment.CommitHash = actualCommitHash;
          await deployment.save();

          Logger.Info('Updated deployment with actual commit hash before starting', {
            deploymentId: deployment.Id,
            commitHash: actualCommitHash,
          });
        } catch (fetchError) {
          Logger.Warn('Failed to fetch commit hash before deployment, will retry after clone', {
            deploymentId: deployment.Id,
            error: (fetchError as Error).message,
          });
          // Continue with deployment - we'll get the commit hash after clone
        }
      }

      // Update status to in progress
      deployment.Status = EDeploymentStatus.InProgress;
      await deployment.save();

      Logger.Info(`Starting deployment execution`, {
        deploymentId: deployment.Id,
        projectId: projectRecord.Id,
        projectName: projectRecord.Name,
      });

      // Send in-progress notification (now with correct commit hash)
      await this.SendNotification(projectRecord, deployment, 'inProgress');

      // Emit socket event
      SocketService.GetInstance().EmitDeploymentUpdate(deployment);

      // AUTO-RECOVERY: Fix npm cache permissions proactively
      Logger.Info('Checking and fixing npm cache permissions before deployment');
      const npmCacheFix = await AutoRecovery.FixNpmCachePermissions();
      if (npmCacheFix.Success) {
        Logger.Info('npm cache permissions verified/fixed', npmCacheFix.Details);
      } else {
        Logger.Warn('npm cache fix failed (continuing anyway)', npmCacheFix.Details);
      }

      // AUTO-RECOVERY: Check disk space before deployment
      const diskCheck = await AutoRecovery.CheckAndCleanupDiskSpace(
        this.DeploymentsBasePath,
        5 // 5GB minimum free space
      );

      if (!diskCheck.Success) {
        throw new Error(`Insufficient disk space: ${diskCheck.Message}`);
      }

      if (diskCheck.Action === 'disk_cleanup') {
        Logger.Info('Auto-cleanup performed before deployment', diskCheck.Details);
      }

      // Prepare working directory
      workingDir = await this.PrepareWorkingDirectory(projectRecord, deployment);

      // AUTO-RECOVERY: Kill any stuck processes on this path
      await AutoRecovery.KillStuckProcesses(workingDir);

      // Capture deployment in non-null variable for retry callback
      const deploymentRecord = deployment;
      const workingDirPath = workingDir;

      // Clone/pull repository with auto-retry
      await AutoRecovery.RetryOperation(
        async () =>
          await this.PrepareRepository(
            projectRecord,
            deploymentRecord,
            workingDirPath,
            sshKeyContext
          ),
        {
          maxRetries: 3,
          delayMs: 2000,
          exponentialBackoff: true,
          operationName: 'Repository preparation',
        }
      );

      // Build deployment context
      // Use first DeploymentPath for backward compatibility, or ProjectPath if DeploymentPaths is empty
      const deploymentPaths = projectRecord.DeploymentPaths || [];
      const targetPath = deploymentPaths.length > 0 ? deploymentPaths[0] : projectRecord.ProjectPath;

      const context: IDeploymentContext = {
        RepoName: this.GetRepositoryName(projectRecord.RepoUrl),
        Branch: deployment.Branch,
        Commit: deployment.CommitHash,
        ProjectPath: workingDir,
        ProjectId: String(projectRecord.Id),
        DeploymentId: String(deployment.Id),
        ProjectName: projectRecord.Name,
        CommitMessage: deployment.CommitMessage || '',
        Author: deployment.Author || '',
        Environment: projectRecord.Config.Environment || 'production',
        WorkingDirectory: workingDir,
        RepoUrl: projectRecord.RepoUrl,
        CommitHash: deployment.CommitHash,
        TargetPath: targetPath,
        BuildCommand: projectRecord.Config?.BuildCommand || 'npm run build',
        BuildOutput: projectRecord.Config?.BuildOutput || 'dist',
      };

      // Execute pipeline (pass SSH key context if available)
      const pipelineResult = await this.PipelineService.ExecutePipeline(
        deployment.Id,
        project.Config.Pipeline || [],
        context,
        workingDir,
        sshKeyContext
      );

      let deploymentSucceeded = pipelineResult.Success;
      let failureReason = pipelineResult.ErrorMessage;

      if (!deploymentSucceeded && !failureReason) {
        failureReason = 'Unknown error';
      }

      // SAFETY: Only use PublishDeploymentToTarget if Pipeline is empty (backward compatibility)
      // If Pipeline exists, it should handle all deployment logic itself
      const hasPipeline = projectRecord.Config.Pipeline && projectRecord.Config.Pipeline.length > 0;

      if (deploymentSucceeded && workingDir && !hasPipeline) {
        // No pipeline mode: Use smart sync to safely update all production paths
        const paths = projectRecord.DeploymentPaths || [projectRecord.ProjectPath];
        Logger.Info('No pipeline defined, using smart sync to production paths', {
          deploymentId: deployment.Id,
          projectId: projectRecord.Id,
          workingDir,
          pathsCount: paths.length,
          paths,
        });

        try {
          // Smart sync to all production paths (preserves important files)
          await this.SmartSyncToAllPaths(projectRecord, deployment, workingDir, paths);

          Logger.Info('Smart sync to all production paths completed successfully (no pipeline)', {
            deploymentId: deployment.Id,
            projectId: projectRecord.Id,
            pathsCount: paths.length,
          });
        } catch (syncError) {
          deploymentSucceeded = false;
          failureReason = `Failed to sync to production: ${(syncError as Error).message}`;

          Logger.Error('Failed to sync deployment to production paths', syncError as Error, {
            deploymentId: deployment.Id,
            projectId: projectRecord.Id,
            paths,
          });
        }

        // Wait a bit before cleanup to ensure shell session is fully disposed
        await new Promise((resolve) => setTimeout(resolve, 500));
        await this.CleanupWorkingDirectory(
          workingDir,
          deployment,
          projectRecord,
          deploymentSucceeded ? 'sync completed (no pipeline)' : 'sync failed (no pipeline)'
        );
      } else if (deploymentSucceeded && workingDir && hasPipeline) {
        // Pipeline mode: Smart sync to all production paths, then cleanup temp directory
        const paths = projectRecord.DeploymentPaths || [projectRecord.ProjectPath];
        Logger.Info('Pipeline-based deployment completed, syncing to production paths', {
          deploymentId: deployment.Id,
          projectId: projectRecord.Id,
          workingDir,
          pathsCount: paths.length,
          paths,
        });

        try {
          // Smart sync to all production paths (preserves important files)
          await this.SmartSyncToAllPaths(projectRecord, deployment, workingDir, paths);

          Logger.Info('Smart sync to all production paths completed successfully', {
            deploymentId: deployment.Id,
            projectId: projectRecord.Id,
            pathsCount: paths.length,
          });
        } catch (syncError) {
          deploymentSucceeded = false;
          failureReason = `Failed to sync to production: ${(syncError as Error).message}`;

          Logger.Error('Failed to sync deployment to production paths', syncError as Error, {
            deploymentId: deployment.Id,
            projectId: projectRecord.Id,
            paths,
          });
        }

        // Wait a bit before cleanup to ensure shell session is fully disposed
        await new Promise((resolve) => setTimeout(resolve, 500));
        await this.CleanupWorkingDirectory(
          workingDir,
          deployment,
          projectRecord,
          deploymentSucceeded ? 'sync completed' : 'sync failed'
        );
      } else if (!deploymentSucceeded && workingDir) {
        // Pipeline failed - cleanup temp directory to avoid leftovers
        // Wait a bit before cleanup to ensure shell session is fully disposed
        await new Promise((resolve) => setTimeout(resolve, 500));
        await this.CleanupWorkingDirectory(
          workingDir,
          deployment,
          projectRecord,
          'pipeline failed'
        );
      }

      // Calculate duration
      const duration = Math.floor((Date.now() - startTime) / 1000);

      if (deploymentSucceeded) {
        // Deployment succeeded
        deployment.Status = EDeploymentStatus.Success;
        deployment.CompletedAt = new Date();
        deployment.Duration = duration;
        await deployment.save();

        Logger.Info(`Deployment completed successfully`, {
          deploymentId: deployment.Id,
          projectId: projectRecord.Id,
          duration,
        });

        // Write deployment metadata file to target path for tracking
        try {
          await this.WriteDeploymentMetadata(projectRecord, deployment, duration);
        } catch (metadataError) {
          Logger.Warn('Failed to write deployment metadata file', {
            deploymentId: deployment.Id,
            projectId: projectRecord.Id,
            error: (metadataError as Error).message,
          });
          // Don't fail deployment if metadata write fails
        }

        // Send success notification
        await this.SendNotification(projectRecord, deployment, 'success', duration);

        // Emit socket event
        SocketService.GetInstance().EmitDeploymentCompleted(deployment);
      } else {
        // Deployment failed
        deployment.Status = EDeploymentStatus.Failed;
        deployment.CompletedAt = new Date();
        deployment.Duration = duration;
        deployment.ErrorMessage = failureReason;
        await deployment.save();

        Logger.Error(`Deployment failed`, new Error(failureReason || 'Unknown error'), {
          deploymentId: deployment.Id,
          projectId: projectRecord.Id,
          duration,
        });

        // Send failure notification
        await this.SendNotification(projectRecord, deployment, 'failed', duration, failureReason);

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

      if (workingDir) {
        await this.CleanupWorkingDirectory(workingDir, deployment, project, 'unexpected failure');
      }

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
    } finally {
      // CRITICAL: Cleanup SSH key context (security)
      if (sshKeyContext) {
        try {
          await sshKeyContext.cleanup();
          Logger.Debug('SSH key context cleaned up', {
            deploymentId,
          });
        } catch (cleanupError) {
          Logger.Error('Failed to cleanup SSH key context', cleanupError as Error, {
            deploymentId,
          });
        }
      }
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

      await fs.emptyDir(projectDir);

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
   * 1. Use provided SSH key context (created by ExecuteDeployment)
   * 2. Execute git clone with GIT_SSH_COMMAND
   * 3. SSH key cleanup handled by ExecuteDeployment (in finally block)
   */
  private async PrepareRepository(
    project: Project,
    deployment: Deployment,
    workingDir: string,
    sshKeyContext: Awaited<ReturnType<typeof SshKeyManager.CreateTemporaryKeyFile>> | null
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

    try {
      const cloneCommand = `git clone --branch ${deployment.Branch} --depth 1 ${project.RepoUrl} .`;

      // Check if project uses SSH key authentication
      if (sshKeyContext) {
        Logger.Info('Using SSH key authentication for repository clone', {
          deploymentId: deployment.Id,
          projectId: project.Id,
          fingerprint: project.SshKeyFingerprint?.substring(0, 16) + '...',
          keyPath: sshKeyContext.keyPath,
        });

        try {
          // Execute git clone with SSH key
          const { stdout, stderr } = await SshKeyManager.ExecuteGitCommandWithKey(
            cloneCommand,
            sshKeyContext.keyPath,
            workingDir,
            { timeout: 300000 } // 5 minutes
          );

          // STEP 3: Checkout specific commit if needed, or get current commit hash
          if (deployment.CommitHash && deployment.CommitHash !== 'unknown') {
            await SshKeyManager.ExecuteGitCommandWithKey(
              `git checkout ${deployment.CommitHash}`,
              sshKeyContext.keyPath,
              workingDir,
              { timeout: 30000 }
            );
          } else if (deployment.CommitHash === 'unknown') {
            // Manual deployment: Get the actual commit hash that was cloned
            const { stdout: commitHash } = await SshKeyManager.ExecuteGitCommandWithKey(
              'git rev-parse HEAD',
              sshKeyContext.keyPath,
              workingDir,
              { timeout: 10000 }
            );

            const actualCommitHash = commitHash.trim();

            // Update deployment with actual commit hash
            deployment.CommitHash = actualCommitHash;
            await deployment.save();

            Logger.Info('Updated manual deployment with actual commit hash', {
              deploymentId: deployment.Id,
              commitHash: actualCommitHash,
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
          step.Output = `[OS User: ${os.userInfo().username}]\n[SSH Authentication] ${stdout}`;
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

        // Checkout specific commit if needed, or get current commit hash
        if (deployment.CommitHash && deployment.CommitHash !== 'unknown') {
          await execAsync(`git checkout ${deployment.CommitHash}`, {
            cwd: workingDir,
            timeout: 30000,
          });
        } else if (deployment.CommitHash === 'unknown') {
          // Manual deployment: Get the actual commit hash that was cloned
          const { stdout: commitHash } = await execAsync('git rev-parse HEAD', {
            cwd: workingDir,
            timeout: 10000,
          });

          const actualCommitHash = commitHash.trim();

          // Update deployment with actual commit hash
          deployment.CommitHash = actualCommitHash;
          await deployment.save();

          Logger.Info('Updated manual deployment with actual commit hash', {
            deploymentId: deployment.Id,
            commitHash: actualCommitHash,
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
        step.Output = `[OS User: ${os.userInfo().username}]\n${stdout}`;
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
    }
    // NOTE: SSH key cleanup is handled by ExecuteDeployment in finally block
  }

  /**
   * Write deployment metadata file to all deployment paths for tracking and verification
   * Creates a .deploy-center file with deployment information in each path
   */
  private async WriteDeploymentMetadata(
    project: Project,
    deployment: Deployment,
    duration: number
  ): Promise<void> {
    const deploymentPaths = project.DeploymentPaths || [project.ProjectPath];

    const metadata = {
      deploymentId: deployment.Id,
      projectId: project.Id,
      projectName: project.Name,
      projectType: project.ProjectType,
      repoUrl: project.RepoUrl,
      branch: deployment.Branch,
      commitHash: deployment.CommitHash,
      commitMessage: deployment.CommitMessage,
      commitAuthor: deployment.CommitAuthor,
      author: deployment.Author,
      triggeredBy: deployment.TriggeredBy,
      triggerType: deployment.TriggerType,
      status: deployment.Status,
      startedAt: deployment.StartedAt,
      completedAt: deployment.CompletedAt,
      duration: duration,
      durationFormatted: `${Math.floor(duration / 60)}m ${duration % 60}s`,
      deployedAt: new Date().toISOString(),
      environment: project.Config.Environment || 'production',
      deployCenterVersion: '2.1.1',
    };

    // Write metadata to all deployment paths
    for (const targetPath of deploymentPaths) {
      const metadataFile = path.join(targetPath, '.deploy-center');

      try {
        await fs.writeJson(metadataFile, metadata, { spaces: 2 });

        Logger.Info('Deployment metadata file written successfully', {
          deploymentId: deployment.Id,
          projectId: project.Id,
          targetPath,
          metadataFile,
        });
      } catch (error) {
        Logger.Error('Failed to write deployment metadata file', error as Error, {
          deploymentId: deployment.Id,
          projectId: project.Id,
          targetPath,
          metadataFile,
        });
        // Don't throw - if metadata write fails for one path, continue with others
      }
    }
  }

  /**
   * DEPRECATED: This method has been replaced by SmartSyncToProduction
   * Old behavior: Removed entire target directory and moved temp directory
   * New behavior: Smart sync that preserves important files/folders
   *
   * Keeping this as a reference for now, will be removed in future cleanup
   */
  // private async PublishDeploymentToTarget(...) { ... }

  /**
   * Cleanup temporary working directory to avoid leaving unused files behind
   */
  private async CleanupWorkingDirectory(
    workingDir: string,
    deployment?: Deployment | null,
    project?: Project | null,
    reason?: string,
    immediateAttempts: number = 3,
    delayMs: number = 500,
    deferredRetriesLeft: number = 2
  ): Promise<void> {
    const isTargetPath = project && path.resolve(workingDir) === path.resolve(project.ProjectPath);
    if (isTargetPath) {
      Logger.Warn('Skipping cleanup because working directory matches target path', {
        deploymentId: deployment?.Id,
        projectId: project?.Id,
        workingDir,
        reason,
      });
      return;
    }

    const maxAttempts = Math.max(1, immediateAttempts);
    let lastErrorCode: string | undefined;

    // On Windows, proactively kill any processes whose command line includes the working directory
    if (process.platform === 'win32') {
      await this.KillProcessesHoldingPath(workingDir, deployment, project);
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (await fs.pathExists(workingDir)) {
          await fs.remove(workingDir);
        }

        const projectDir = path.dirname(workingDir);
        if (await fs.pathExists(projectDir)) {
          const entries = await fs.readdir(projectDir);
          if (entries.length === 0) {
            await fs.remove(projectDir);
          }
        }

        Logger.Info('Temporary deployment workspace cleaned up', {
          deploymentId: deployment?.Id,
          projectId: project?.Id,
          workingDir,
          reason,
          attempt,
        });
        return;
      } catch (cleanupError: any) {
        const code = cleanupError?.code;
        lastErrorCode = code;
        const message = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);

        Logger.Warn('Failed to cleanup temporary deployment workspace', {
          deploymentId: deployment?.Id,
          projectId: project?.Id,
          workingDir,
          reason,
          attempt,
          error: message,
          code,
        });

        if (attempt === maxAttempts || code !== 'EBUSY') {
          break; // Do not retry for non-busy errors
        }

        // On Windows, try killing any remaining processes holding the directory before next attempt
        if (process.platform === 'win32') {
          await this.KillProcessesHoldingPath(workingDir, deployment, project);
        }

        await this.Sleep(delayMs * attempt); // backoff for busy handles
      }
    }

    // If still busy, try to move the directory to a quarantine folder for later cleanup
    if (lastErrorCode === 'EBUSY' && (await fs.pathExists(workingDir))) {
      // Try deleting only the contents first (leave empty folder)
      const cleared = await this.DeleteDirectoryContentsWindows(workingDir, deployment, project);
      if (!cleared) {
        const moved = await this.MoveToQuarantine(workingDir, deployment, project);
        if (moved) {
          return;
        }
      } else {
        return;
      }
    }

    // If still busy, schedule a couple of deferred attempts (longer delays) to avoid manual kill
    if (lastErrorCode === 'EBUSY' && deferredRetriesLeft > 0) {
      const nextDelay = delayMs * 4; // grow delay
      Logger.Warn('Scheduling deferred cleanup retry after EBUSY', {
        deploymentId: deployment?.Id,
        projectId: project?.Id,
        workingDir,
        reason,
        nextDelay,
        deferredRetriesLeft,
      });

      setTimeout(() => {
        this.CleanupWorkingDirectory(
          workingDir,
          deployment,
          project,
          reason,
          1, // single immediate attempt
          nextDelay,
          deferredRetriesLeft - 1
        ).catch((err) =>
          Logger.Warn('Background cleanup after EBUSY failed', {
            deploymentId: deployment?.Id,
            projectId: project?.Id,
            workingDir,
            reason,
            error: (err as Error).message,
          })
        );
      }, nextDelay);
    }

    // Last-resort cleanup on Windows: schedule a detached rmdir after short delay
    if (process.platform === 'win32' && lastErrorCode === 'EBUSY' && deferredRetriesLeft === 0) {
      try {
        const cmd = `cmd /c "timeout /t 5 /nobreak >nul & rmdir /s /q \\"${workingDir}\\""`;
        const child = require('child_process').spawn(cmd, {
          shell: true,
          detached: true,
          windowsHide: true,
        });
        child.unref();
        Logger.Warn('Scheduled background rmdir as last resort (Windows)', {
          deploymentId: deployment?.Id,
          projectId: project?.Id,
          workingDir,
        });
      } catch (err) {
        Logger.Warn('Failed to schedule background rmdir', {
          deploymentId: deployment?.Id,
          projectId: project?.Id,
          workingDir,
          error: (err as Error).message,
        });
      }
    }
  }

  /**
   * Kill any processes whose command line includes the working directory (Windows only)
   */
  private async KillProcessesHoldingPath(
    workingDir: string,
    deployment?: Deployment | null,
    project?: Project | null
  ): Promise<void> {
    if (process.platform !== 'win32') return;

    const sanitizedPath = workingDir.replace(/'/g, "''");
    const psScript = `
      $path = '${sanitizedPath}';
      $procsPath = Get-CimInstance Win32_Process |
        Where-Object { ($_.CommandLine -like "*$path*") -or ($_.ExecutablePath -like "*$path*") };
      $procsPm2 = Get-CimInstance Win32_Process |
        Where-Object { $_.CommandLine -like "*pm2\\lib\\Daemon.js*" };
      $procsYarnDev = Get-CimInstance Win32_Process |
        Where-Object { $_.CommandLine -like "*yarn.js dev*" };
      $procs = @($procsPath + $procsPm2 + $procsYarnDev | Select-Object -Unique);
      $procs | Select-Object ProcessId,Name,CommandLine,ExecutablePath | ConvertTo-Json -Compress;
      $procs | ForEach-Object {
        try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
      }
    `;

    return new Promise((resolve) => {
      const child = require('child_process').spawn(
        'powershell.exe',
        ['-NoProfile', '-Command', psScript],
        { windowsHide: true }
      );

      let stdout = '';
      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      const logProcs = () => {
        const trimmed = stdout.trim();
        if (trimmed) {
          try {
            const parsed = JSON.parse(trimmed);
            const list = Array.isArray(parsed) ? parsed : [parsed];
            Logger.Warn('Processes holding working directory (before kill)', {
              deploymentId: deployment?.Id,
              projectId: project?.Id,
              workingDir,
              processes: list.map((p) => ({
                pid: p.ProcessId,
                name: p.Name,
                command: p.CommandLine,
                exe: p.ExecutablePath,
              })),
            });
          } catch (err) {
            Logger.Warn('Failed to parse processes holding path output', {
              deploymentId: deployment?.Id,
              projectId: project?.Id,
              workingDir,
              output: trimmed,
              error: (err as Error).message,
            });
          }
        }
      };

      child.on('exit', () => {
        logProcs();
        Logger.Warn('Attempted to kill processes holding working directory', {
          deploymentId: deployment?.Id,
          projectId: project?.Id,
          workingDir,
        });
        resolve();
      });
      child.on('error', () => {
        logProcs();
        resolve();
      });
    });
  }

  /**
   * Move a stubborn directory to a quarantine folder for later cleanup.
   * This avoids leaving cloned files in the main deployments path.
   */
  private async MoveToQuarantine(
    workingDir: string,
    deployment?: Deployment | null,
    project?: Project | null
  ): Promise<boolean> {
    try {
      const quarantineDir = path.join(this.DeploymentsBasePath, '_quarantine');
      await fs.ensureDir(quarantineDir);
      const targetName = `${path.basename(workingDir)}-pending-delete-${Date.now()}`;
      const targetPath = path.join(quarantineDir, targetName);

      await fs.move(workingDir, targetPath, { overwrite: true });

      Logger.Warn('Moved stubborn working directory to quarantine for later cleanup', {
        deploymentId: deployment?.Id,
        projectId: project?.Id,
        from: workingDir,
        to: targetPath,
      });

      return true;
    } catch (err) {
      Logger.Warn('Failed to move working directory to quarantine', {
        deploymentId: deployment?.Id,
        projectId: project?.Id,
        workingDir,
        error: (err as Error).message,
      });
      return false;
    }
  }

  /**
   * Windows-only: delete all contents of a directory while keeping the folder itself.
   * Useful when the folder handle is busy but contents can be removed.
   */
  private async DeleteDirectoryContentsWindows(
    workingDir: string,
    deployment?: Deployment | null,
    project?: Project | null
  ): Promise<boolean> {
    if (process.platform !== 'win32') {
      return false;
    }

    try {
      const psScript = `
      $path = '${workingDir.replace(/'/g, "''")}';
      if (Test-Path -LiteralPath $path) {
        Get-ChildItem -LiteralPath $path -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue;
      }
      `;

      await new Promise<void>((resolve, reject) => {
        const child = require('child_process').spawn(
          'powershell.exe',
          ['-NoProfile', '-Command', psScript],
          {
            windowsHide: true,
          }
        );
        child.on('exit', () => resolve());
        child.on('error', (err: Error) => reject(err));
      });

      Logger.Warn('Deleted contents of working directory (folder kept)', {
        deploymentId: deployment?.Id,
        projectId: project?.Id,
        workingDir,
      });
      return true;
    } catch (err) {
      Logger.Warn('Failed to delete contents of working directory', {
        deploymentId: deployment?.Id,
        projectId: project?.Id,
        workingDir,
        error: (err as Error).message,
      });
      return false;
    }
  }

  private async Sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
    status?: string,
    userId?: number,
    userRole?: string
  ): Promise<{ Deployments: Deployment[]; Total: number }> {
    try {
      const where: Record<string, any> = {};
      if (status) {
        where.Status = status;
      }

      // Admin and Manager can see all deployments
      const canSeeAllDeployments = userRole === 'admin' || userRole === 'manager';

      const includeOptions: any[] = [
        {
          model: DeploymentStep,
          as: 'Steps',
          attributes: ['Id', 'StepName', 'Status', 'Duration'],
        },
      ];

      // Add Project include with optional filtering for Developer/Viewer
      if (canSeeAllDeployments || !userId) {
        // Admin/Manager: include all projects
        includeOptions.push({
          model: Project,
          as: 'Project',
          attributes: ['Id', 'Name', 'RepoUrl'],
        });
      } else {
        // Developer/Viewer: only include projects they are members of
        const { ProjectMember } = await import('@Models/index');
        includeOptions.push({
          model: Project,
          as: 'Project',
          attributes: ['Id', 'Name', 'RepoUrl'],
          required: true, // INNER JOIN - only deployments for projects where user is a member
          include: [
            {
              model: ProjectMember,
              as: 'Members',
              where: { UserId: userId },
              required: true,
              attributes: [],
            },
          ],
        });
      }

      const { count, rows } = await Deployment.findAndCountAll({
        where,
        include: includeOptions,
        order: [['CreatedAt', 'DESC']],
        limit,
        offset,
        distinct: true, // Important for correct count with joins
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
            attributes: ['Id', 'Name', 'RepoUrl', 'Config'],
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
   * Smart sync deployment files to all configured deployment paths
   * Iterates over all paths and syncs to each one independently
   */
  private async SmartSyncToAllPaths(
    project: Project,
    deployment: Deployment,
    sourceDir: string,
    deploymentPaths: string[]
  ): Promise<void> {
    const errors: Array<{ path: string; error: string }> = [];

    for (const targetPath of deploymentPaths) {
      try {
        Logger.Info('Syncing to deployment path', {
          deploymentId: deployment.Id,
          projectId: project.Id,
          targetPath,
        });

        await this.SmartSyncToProduction(project, deployment, sourceDir, targetPath);

        Logger.Info('Successfully synced to deployment path', {
          deploymentId: deployment.Id,
          projectId: project.Id,
          targetPath,
        });
      } catch (error) {
        const errorMessage = (error as Error).message;
        errors.push({ path: targetPath, error: errorMessage });

        Logger.Error('Failed to sync to deployment path', error as Error, {
          deploymentId: deployment.Id,
          projectId: project.Id,
          targetPath,
        });
      }
    }

    // If any syncs failed, throw error with details
    if (errors.length > 0) {
      const failedPaths = errors.map((e) => `${e.path}: ${e.error}`).join('; ');
      throw new Error(
        `Failed to sync to ${errors.length} of ${deploymentPaths.length} paths: ${failedPaths}`
      );
    }

    Logger.Info('Successfully synced to all deployment paths', {
      deploymentId: deployment.Id,
      projectId: project.Id,
      pathsCount: deploymentPaths.length,
    });
  }

  /**
   * Smart sync deployment files from temp directory to production path
   * Preserves important files and directories that should not be overwritten:
   * - System files (.env, .htaccess, web.config, .user.ini, php.ini)
   * - Debug logs (npm-debug.log, yarn-debug.log, etc.)
   * - Custom patterns from project config (SyncIgnorePatterns)
   */
  private async SmartSyncToProduction(
    project: Project,
    deployment: Deployment,
    sourceDir: string,
    targetPathOverride?: string
  ): Promise<void> {
    const targetPath = targetPathOverride || project.ProjectPath;
    const projectJson = project.toJSON();

    // Determine the actual source directory to sync from
    // If BuildOutput is specified, use it (e.g., 'build', 'dist' for React/Vue projects)
    // Otherwise, sync the entire sourceDir (for Node.js projects)
    const buildOutput = projectJson.Config.BuildOutput;
    let syncSourceDir = sourceDir;

    if (buildOutput) {
      syncSourceDir = path.join(sourceDir, buildOutput);

      // Verify the build output directory exists
      const buildOutputExists = await fs.pathExists(syncSourceDir);
      if (!buildOutputExists) {
        throw new Error(
          `Build output directory not found: ${syncSourceDir}. ` +
            `Please ensure your build command creates the '${buildOutput}' directory.`
        );
      }

      Logger.Info('Using build output directory for sync', {
        deploymentId: deployment.Id,
        buildOutput,
        syncSourceDir,
      });
    } else {
      Logger.Info('No build output specified, syncing entire source directory', {
        deploymentId: deployment.Id,
        syncSourceDir,
      });
    }

    Logger.Info('Starting smart sync to production', {
      deploymentId: deployment.Id,
      projectId: project.Id,
      sourceDir,
      syncSourceDir,
      targetPath,
    });

    // Ensure target directory exists
    await fs.ensureDir(targetPath);

    // Custom patterns from project config (data directories, etc.)
    const customPreservePatterns = projectJson.Config.SyncIgnorePatterns || [];

    // Combine system and custom patterns
    const preservePatterns = [...systemPreservePatterns, ...customPreservePatterns];

    Logger.Info('Smart sync preserve patterns', {
      deploymentId: deployment.Id,
      systemPatterns: systemPreservePatterns.length,
      customPatterns: customPreservePatterns.length,
      totalPatterns: preservePatterns.length,
      customPatternsList: customPreservePatterns,
    });

    // Check if rsync is available (better for syncing on Linux/Mac)
    const useRsync = process.platform !== 'win32';

    if (useRsync) {
      // Use rsync for efficient syncing with excludes
      try {
        // Build exclude arguments
        const excludeArgs = preservePatterns.map((pattern) => `--exclude='${pattern}'`).join(' ');

        // Get custom rsync options from config or use defaults
        const defaultRsyncOptions = '-av --delete';
        const rsyncOptions = projectJson.Config.RsyncOptions || defaultRsyncOptions;

        // rsync command: sync source to target with custom options
        const rsyncCommand = `rsync ${rsyncOptions} ${excludeArgs} "${syncSourceDir}/" "${targetPath}/"`;

        Logger.Info('Executing rsync for smart sync', {
          deploymentId: deployment.Id,
          command: rsyncCommand,
          customOptions: projectJson.Config.RsyncOptions || 'default',
        });

        const { stdout, stderr } = await execAsync(rsyncCommand, {
          timeout: 300000, // 5 minutes timeout
        });

        if (stderr && !stderr.includes('Warning')) {
          Logger.Warn('rsync reported warnings', {
            deploymentId: deployment.Id,
            warnings: stderr,
          });
        }

        Logger.Info('rsync completed successfully', {
          deploymentId: deployment.Id,
          output: stdout.trim().split('\n').slice(0, 10).join('\n'), // First 10 lines
        });
      } catch (error) {
        Logger.Error('rsync failed, falling back to manual copy', error as Error, {
          deploymentId: deployment.Id,
        });
        // Fall back to manual copy
        await this.ManualSmartSync(syncSourceDir, targetPath, preservePatterns, deployment);
      }
    } else {
      // Windows: Use manual copy logic
      await this.ManualSmartSync(syncSourceDir, targetPath, preservePatterns, deployment);
    }

    Logger.Info('Smart sync to production completed', {
      deploymentId: deployment.Id,
      projectId: project.Id,
      targetPath,
    });
  }

  /**
   * Manual smart sync implementation (used on Windows or as fallback)
   * Copies files from source to target while preserving protected patterns
   */
  private async ManualSmartSync(
    sourceDir: string,
    targetPath: string,
    preservePatterns: string[],
    deployment: Deployment
  ): Promise<void> {
    Logger.Info('Starting manual smart sync', {
      deploymentId: deployment.Id,
      sourceDir,
      targetPath,
    });

    /**
     * Check if a path matches any preserve pattern
     */
    const shouldPreserve = (relativePath: string): boolean => {
      // Normalize path separators for cross-platform compatibility
      const normalizedPath = relativePath.replace(/\\/g, '/');

      // Convert a glob-style pattern (using * as wildcard) into a safe regex source
      const globPatternToRegex = (pattern: string): string => {
        // First, escape all regex metacharacters
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Then, turn escaped '*' (now '\*') back into a wildcard for non-slash characters
        return escaped.replace(/\\\*/g, '[^/]*');
      };

      return preservePatterns.some((pattern) => {
        const normalizedPattern = pattern.replace(/\\/g, '/');

        // Handle globstar pattern (**) - matches any depth
        if (normalizedPattern.includes('/**')) {
          const basePattern = normalizedPattern.replace('/**', '');
          // Match the directory itself or anything inside it
          return (
            normalizedPath === basePattern ||
            normalizedPath.startsWith(basePattern + '/') ||
            normalizedPath.startsWith(basePattern)
          );
        }

        // Handle single wildcard patterns (*)
        if (normalizedPattern.includes('*')) {
          const regexSource = globPatternToRegex(normalizedPattern);
          const regex = new RegExp('^' + regexSource + '$');
          return regex.test(normalizedPath);
        }

        // Exact match or directory match (for directories without **)
        return (
          normalizedPath === normalizedPattern ||
          normalizedPath.startsWith(normalizedPattern + '/')
        );
      });
    };

    /**
     * Recursively sync directory contents
     */
    const syncDirectory = async (srcDir: string, destDir: string, relativeBase: string = '') => {
      const entries = await fs.readdir(srcDir, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);
        const relativePath = relativeBase ? path.join(relativeBase, entry.name) : entry.name;

        // Skip if this path should be preserved
        if (shouldPreserve(relativePath)) {
          Logger.Debug('Skipping preserved path', {
            deploymentId: deployment.Id,
            path: relativePath,
          });
          continue;
        }

        if (entry.isDirectory()) {
          // Ensure destination directory exists
          await fs.ensureDir(destPath);
          // Recursively sync subdirectory
          await syncDirectory(srcPath, destPath, relativePath);
        } else if (entry.isFile()) {
          // Copy file, overwriting if it exists
          await fs.copy(srcPath, destPath, { overwrite: true });
        }
      }
    };

    // Start syncing from root
    await syncDirectory(sourceDir, targetPath);

    // Clean up files in target that no longer exist in source (except preserved)
    const cleanupDeletedFiles = async (
      srcDir: string,
      destDir: string,
      relativeBase: string = ''
    ) => {
      if (!(await fs.pathExists(destDir))) {
        return;
      }

      const destEntries = await fs.readdir(destDir, { withFileTypes: true });

      for (const entry of destEntries) {
        const destPath = path.join(destDir, entry.name);
        const srcPath = path.join(srcDir, entry.name);
        const relativePath = relativeBase ? path.join(relativeBase, entry.name) : entry.name;

        // Skip if this path should be preserved
        if (shouldPreserve(relativePath)) {
          continue;
        }

        const existsInSource = await fs.pathExists(srcPath);

        if (!existsInSource) {
          // File/directory doesn't exist in source, remove it from target
          await fs.remove(destPath);
          Logger.Debug('Removed deleted file/directory from target', {
            deploymentId: deployment.Id,
            path: relativePath,
          });
        } else if (entry.isDirectory()) {
          // Recursively clean subdirectory
          await cleanupDeletedFiles(srcPath, destPath, relativePath);
        }
      }
    };

    await cleanupDeletedFiles(sourceDir, targetPath);

    Logger.Info('Manual smart sync completed', {
      deploymentId: deployment.Id,
    });
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

  /**
   * Fetch latest commit hash from remote repository without cloning
   * Used for manual deployments to get accurate commit info before starting
   */
  private async FetchLatestCommitHash(
    project: Project,
    branch: string,
    sshKeyContext: Awaited<ReturnType<typeof SshKeyManager.CreateTemporaryKeyFile>> | null
  ): Promise<string> {
    try {
      const lsRemoteCommand = `git ls-remote ${project.RepoUrl} ${branch}`;

      let stdout: string;

      if (sshKeyContext) {
        // Use SSH key for authentication
        const result = await SshKeyManager.ExecuteGitCommandWithKey(
          lsRemoteCommand,
          sshKeyContext.keyPath,
          process.cwd(),
          { timeout: 30000 }
        );
        stdout = result.stdout;
      } else {
        // Use HTTPS
        const result = await execAsync(lsRemoteCommand, {
          timeout: 30000,
        });
        stdout = result.stdout;
      }

      // Parse output: "commit_hash\trefs/heads/branch"
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        const parts = line.split('\t');
        const hash = parts[0];
        const ref = parts[1];

        if (hash && ref === `refs/heads/${branch}`) {
          Logger.Info('Successfully fetched latest commit hash from remote', {
            branch,
            commitHash: hash,
          });
          return hash;
        }
      }

      throw new Error(`Branch ${branch} not found in remote repository`);
    } catch (error) {
      Logger.Error('Failed to fetch latest commit hash from remote', error as Error, {
        projectId: project.Id,
        branch,
      });
      throw error;
    }
  }
}

export default DeploymentService;
