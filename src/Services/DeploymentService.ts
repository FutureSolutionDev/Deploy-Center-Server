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

      // Update status to in progress
      deployment.Status = EDeploymentStatus.InProgress;
      await deployment.save();

      Logger.Info(`Starting deployment execution`, {
        deploymentId: deployment.Id,
        projectId: projectRecord.Id,
        projectName: projectRecord.Name,
      });

      // Send in-progress notification
      await this.SendNotification(projectRecord, deployment, 'inProgress');

      // Emit socket event
      SocketService.GetInstance().EmitDeploymentUpdate(deployment);

      // Create SSH key context if needed (used throughout deployment)
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
        TargetPath: projectRecord.ProjectPath,
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
        // Fallback mode: No pipeline defined, use legacy publish method
        Logger.Warn('Using legacy PublishDeploymentToTarget (no pipeline defined)', {
          deploymentId: deployment.Id,
          projectId: projectRecord.Id,
        });

        try {
          await this.PublishDeploymentToTarget(projectRecord, deployment, workingDir);
        } catch (publishError) {
          deploymentSucceeded = false;
          failureReason = `Failed to publish deployment to target path: ${(publishError as Error).message}`;

          Logger.Error('Failed to publish deployment to target path', publishError as Error, {
            deploymentId: deployment.Id,
            projectId: projectRecord.Id,
            targetPath: projectRecord.ProjectPath,
          });

          // Wait a bit before cleanup to ensure shell session is fully disposed
          await new Promise((resolve) => setTimeout(resolve, 500));
          await this.CleanupWorkingDirectory(
            workingDir,
            deployment,
            projectRecord,
            'publish failed'
          );
        }
      } else if (deploymentSucceeded && workingDir && hasPipeline) {
        // Pipeline mode: Pipeline handled everything, just cleanup temp directory
        Logger.Info('Pipeline-based deployment completed, cleaning up temp directory', {
          deploymentId: deployment.Id,
          projectId: projectRecord.Id,
        });

        // Wait a bit before cleanup to ensure shell session is fully disposed
        await new Promise((resolve) => setTimeout(resolve, 500));
        await this.CleanupWorkingDirectory(
          workingDir,
          deployment,
          projectRecord,
          'pipeline completed'
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
    }
    // NOTE: SSH key cleanup is handled by ExecuteDeployment in finally block
  }

  /**
   * Atomically publish a successful deployment to the target path.
   * No backup (per requirement); removes existing target and restores protected files after move.
   */
  private async PublishDeploymentToTarget(
    project: Project,
    deployment: Deployment,
    sourceDir: string
  ): Promise<void> {
    const targetPath = project.ProjectPath;
    const targetParent = path.dirname(targetPath);
    const protectedFiles = ['.user.ini', '.htaccess', 'web.config', 'php.ini', '.env'];
    const protectedTempDir = path.join(
      this.DeploymentsBasePath,
      '_protected',
      `deployment-${deployment.Id}-${Date.now()}`
    );
    let protectedCaptured = false;

    await fs.ensureDir(targetParent);

    if (!(await fs.pathExists(sourceDir))) {
      throw new Error(`Source directory for deployment not found: ${sourceDir}`);
    }

    const targetExisted = await fs.pathExists(targetPath);

    // Snapshot protected files so they can be restored after publish
    if (targetExisted && protectedFiles.length > 0) {
      await fs.ensureDir(protectedTempDir);
      for (const fileName of protectedFiles) {
        const src = path.join(targetPath, fileName);
        if (await fs.pathExists(src)) {
          await fs.copy(src, path.join(protectedTempDir, fileName), { overwrite: true });
          protectedCaptured = true;
        }
      }
    }

    // Remove existing target (no backup)
    if (targetExisted) {
      await fs.remove(targetPath);
    }

    try {
      await fs.move(sourceDir, targetPath, { overwrite: false });

      // Restore protected files without overwriting new build content
      if (protectedCaptured) {
        for (const fileName of protectedFiles) {
          const src = path.join(protectedTempDir, fileName);
          if (await fs.pathExists(src)) {
            await fs.copy(src, path.join(targetPath, fileName), { overwrite: false });
          }
        }
      }

      Logger.Info('Deployment published to target path', {
        deploymentId: deployment.Id,
        projectId: project.Id,
        targetPath,
      });
    } catch (moveError) {
      throw moveError;
    } finally {
      if (protectedCaptured && (await fs.pathExists(protectedTempDir))) {
        await fs.remove(protectedTempDir).catch(() => undefined);
      }
    }
  }

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
