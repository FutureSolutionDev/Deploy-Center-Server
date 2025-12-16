/**
 * Webhook Service
 * Handles GitHub webhook verification and processing
 * Following SOLID principles and PascalCase naming convention
 */

import Logger from '@Utils/Logger';
import EncryptionHelper from '@Utils/EncryptionHelper';
import { Project } from '@Models/index';

export interface IGitHubWebhookPayload {
  Ref: string;
  Before: string;
  After: string;
  Repository: {
    Id: number;
    Name: string;
    FullName: string;
    CloneUrl: string;
    SshUrl: string;
  };
  Pusher: {
    Name: string;
    Email: string;
  };
  Commits: Array<{
    Id: string;
    Message: string;
    Timestamp: string;
    Author: {
      Name: string;
      Email: string;
      Username: string;
    };
    Added: string[];
    Modified: string[];
    Removed: string[];
  }>;
  HeadCommit: {
    Id: string;
    Message: string;
    Timestamp: string;
    Author: {
      Name: string;
      Email: string;
      Username: string;
    };
  };
}

export interface IProcessedWebhookData {
  Branch: string;
  CommitHash: string;
  CommitMessage: string;
  Author: string;
  AuthorEmail: string;
  RepositoryName: string;
  RepositoryUrl: string;
  PreviousCommit: string;
  FilesChanged: {
    Added: string[];
    Modified: string[];
    Removed: string[];
  };
}

export class WebhookService {
  /**
   * Verify GitHub webhook signature
   */
  public VerifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
    try {
      if (!signature || !signature.startsWith('sha256=')) {
        Logger.Warn('Invalid signature format', { signature });
        return false;
      }

      const receivedSignature = signature.substring(7); // Remove 'sha256=' prefix

      // Calculate expected signature for debugging
      const expectedSignature = EncryptionHelper.CreateHmacSignature(payload, secret);

      Logger.Debug('HMAC Signature Comparison', {
        receivedSignature: receivedSignature.substring(0, 20) + '...',
        expectedSignature: expectedSignature.substring(0, 20) + '...',
        payloadPreview: payload.substring(0, 100) + '...',
        secretPreview: secret.substring(0, 10) + '...',
        signaturesMatch: receivedSignature === expectedSignature,
      });

      const isValid = EncryptionHelper.VerifyHmacSignature(payload, secret, receivedSignature);

      if (!isValid) {
        Logger.Warn('Webhook signature verification failed', {
          receivedLength: receivedSignature.length,
          expectedLength: expectedSignature.length,
        });
      }

      return isValid;
    } catch (error) {
      Logger.Error('Error verifying webhook signature', error as Error);
      return false;
    }
  }

  /**
   * Process GitHub webhook payload
   */
  public ProcessGitHubWebhook(rawPayload: any): IProcessedWebhookData {
    try {
      const payload = this.NormalizeGitHubPayload(rawPayload);

      // Extract branch name from ref (refs/heads/main -> main)
      const ref = payload?.ref || payload?.Ref || '';
      const branch = typeof ref === 'string' ? ref.replace('refs/heads/', '') : 'unknown';

      // Get commit information
      const headCommit =
        payload?.head_commit ||
        payload?.headCommit ||
        payload?.HeadCommit || { Author: {}, author: {}, Id: '', id: '' };
      const commits = Array.isArray(payload?.commits)
        ? payload.commits
        : Array.isArray(payload?.Commits)
          ? payload.Commits
          : [];

      // Aggregate all file changes
      const allAdded: string[] = [];
      const allModified: string[] = [];
      const allRemoved: string[] = [];

      commits.forEach((commit: any) => {
        if (Array.isArray(commit.added)) allAdded.push(...commit.added);
        if (Array.isArray(commit.modified)) allModified.push(...commit.modified);
        if (Array.isArray(commit.removed)) allRemoved.push(...commit.removed);
      });

      const processedData: IProcessedWebhookData = {
        Branch: branch,
        CommitHash: payload?.after || payload?.After || headCommit.id || headCommit.Id || 'unknown',
        CommitMessage: headCommit.message || 'No commit message',
        Author:
          headCommit.author?.name ||
          headCommit.author?.username ||
          headCommit.Author?.Name ||
          headCommit.Author?.Username ||
          'Unknown',
        AuthorEmail: headCommit.author?.email || headCommit.Author?.Email || '',
        RepositoryName:
          payload?.repository?.name ||
          payload?.repository?.Name ||
          payload?.Repository?.name ||
          payload?.Repository?.Name ||
          payload?.repositoryname ||
          payload?.RepositoryName ||
          'unknown',
        RepositoryUrl:
          payload?.repository?.clone_url ||
          payload?.repository?.ssh_url ||
          payload?.repository?.CloneUrl ||
          payload?.repository?.SshUrl ||
          payload?.Repository?.clone_url ||
          payload?.Repository?.ssh_url ||
          payload?.Repository?.CloneUrl ||
          payload?.Repository?.SshUrl ||
          payload?.repositoryurl ||
          payload?.RepositoryUrl ||
          '',
        PreviousCommit: payload?.before || payload?.Before || '',
        FilesChanged: {
          Added: [...new Set(allAdded)], // Remove duplicates
          Modified: [...new Set(allModified)],
          Removed: [...new Set(allRemoved)],
        },
      };

      Logger.Info('GitHub webhook processed successfully', {
        branch: processedData.Branch,
        commit: processedData.CommitHash.substring(0, 7),
        repository: processedData.RepositoryName,
      });

      return processedData;
    } catch (error) {
      Logger.Error('Error processing GitHub webhook', error as Error, { rawPayload });
      throw new Error('Failed to process webhook payload');
    }
  }

  /**
   * Check if webhook should trigger deployment based on project configuration
   */
  public ShouldTriggerDeployment(
    project: Project,
    webhookData: IProcessedWebhookData
  ): { ShouldDeploy: boolean; Reason?: string } {
    try {
      // Check if auto deploy is enabled
      if (!project.Config.AutoDeploy) {
        return {
          ShouldDeploy: false,
          Reason: 'Auto-deploy is disabled for this project',
        };
      }

      // Check if branch matches
      const targetBranch = project.Config.Branch || 'main';
      if (webhookData.Branch !== targetBranch) {
        return {
          ShouldDeploy: false,
          Reason: `Branch '${webhookData.Branch}' does not match target branch '${targetBranch}'`,
        };
      }

      // Check if repository URL matches
      const normalizedProjectUrl = this.NormalizeGitUrl(project.RepoUrl);
      const normalizedWebhookUrl = this.NormalizeGitUrl(webhookData.RepositoryUrl);

      if (normalizedProjectUrl !== normalizedWebhookUrl) {
        return {
          ShouldDeploy: false,
          Reason: 'Repository URL does not match',
        };
      }

      // Check if specific paths should trigger deployment (if configured)
      if (project.Config.DeployOnPaths && project.Config.DeployOnPaths.length > 0) {
        const changedFiles = [
          ...webhookData.FilesChanged.Added,
          ...webhookData.FilesChanged.Modified,
        ];

        const matchesPath = changedFiles.some((file) =>
          project.Config.DeployOnPaths!.some((pattern) => this.MatchesPattern(file, pattern))
        );

        if (!matchesPath) {
          return {
            ShouldDeploy: false,
            Reason: 'No changes in watched paths',
          };
        }
      }

      // All checks passed
      return { ShouldDeploy: true };
    } catch (error) {
      Logger.Error('Error checking deployment trigger conditions', error as Error, {
        projectId: project.Id,
      });
      return {
        ShouldDeploy: false,
        Reason: 'Error evaluating deployment conditions',
      };
    }
  }

  /**
   * Normalize Git URL for comparison (remove .git suffix, protocol differences)
   */
  private NormalizeGitUrl(url: string): string {
    try {
      let normalized = url.toLowerCase().trim();

      // Remove .git suffix
      if (normalized.endsWith('.git')) {
        normalized = normalized.substring(0, normalized.length - 4);
      }

      // Convert SSH URLs to HTTPS format for comparison
      // git@github.com:user/repo -> github.com/user/repo
      if (normalized.startsWith('git@')) {
        normalized = normalized.replace('git@', '').replace(':', '/');
      }

      // Remove protocol
      normalized = normalized.replace('https://', '').replace('http://', '').replace('ssh://', '');

      // Remove trailing slash
      if (normalized.endsWith('/')) {
        normalized = normalized.substring(0, normalized.length - 1);
      }

      return normalized;
    } catch (error) {
      Logger.Error('Error normalizing Git URL', error as Error, { url });
      return url;
    }
  }

  /**
   * Normalize GitHub webhook payload regardless of content type
   * Supports application/json and application/x-www-form-urlencoded (payload=...)
   */
  public NormalizeGitHubPayload(payload: any): any {
    try {
      if (!payload) {
        return payload;
      }

      let normalizedPayload = payload;

      // If payload is a JSON string, parse it
      if (typeof normalizedPayload === 'string') {
        try {
          normalizedPayload = JSON.parse(normalizedPayload);
        } catch (parseError) {
          Logger.Warn('Failed to parse string webhook payload', {
            message: (parseError as Error).message,
          });
          return normalizedPayload;
        }
      }

      // Handle x-www-form-urlencoded where GitHub sends payload in "payload" field
      if ((normalizedPayload as any).payload) {
        const nestedPayload = (normalizedPayload as any).payload;
        if (typeof nestedPayload === 'string') {
          try {
            normalizedPayload = JSON.parse(nestedPayload);
          } catch (parseError) {
            Logger.Warn('Failed to parse nested webhook payload', {
              message: (parseError as Error).message,
            });
            normalizedPayload = nestedPayload;
          }
        } else if (typeof nestedPayload === 'object') {
          normalizedPayload = nestedPayload;
        }
      }

      return normalizedPayload;
    } catch (error) {
      Logger.Error('Error normalizing GitHub payload', error as Error);
      return payload;
    }
  }

  /**
   * Match file path against pattern (simple glob-like matching)
   */
  private MatchesPattern(filePath: string, pattern: string): boolean {
    try {
      // Convert glob pattern to regex
      // * matches anything except /
      // ** matches anything including /
      const regexPattern = pattern
        .replace(/\*\*/g, '<!DOUBLE_STAR!>')
        .replace(/\*/g, '[^/]*')
        .replace(/<!DOUBLE_STAR!>/g, '.*')
        .replace(/\?/g, '[^/]')
        .replace(/\./g, '\\.');

      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(filePath);
    } catch (error) {
      Logger.Error('Error matching file pattern', error as Error, { filePath, pattern });
      return false;
    }
  }

  /**
   * Validate webhook payload structure
   */
  public ValidateGitHubPayload(payload: any): { IsValid: boolean; Errors: string[] } {
    const errors: string[] = [];
    const normalizedPayload = this.NormalizeGitHubPayload(payload);

    if (!normalizedPayload) {
      errors.push('Payload is empty');
      return { IsValid: false, Errors: errors };
    }

    const hasRef = normalizedPayload.ref || normalizedPayload.Ref;
    if (!hasRef) {
      errors.push('Missing ref field');
    }

    const commitHash =
      normalizedPayload.after ||
      normalizedPayload.After ||
      normalizedPayload.head_commit?.id ||
      normalizedPayload.head_commit?.Id ||
      normalizedPayload.HeadCommit?.Id ||
      normalizedPayload.HeadCommit?.id;
    if (!commitHash) {
      errors.push('Missing commit hash');
    }

    const repository =
      normalizedPayload.repository || normalizedPayload.Repository || normalizedPayload.repository;

    const repositoryName =
      repository?.name ||
      repository?.Name ||
      normalizedPayload.repositoryname ||
      normalizedPayload.RepositoryName;

    const repositoryUrl =
      repository?.clone_url ||
      repository?.ssh_url ||
      repository?.CloneUrl ||
      repository?.SshUrl ||
      normalizedPayload.repositoryurl ||
      normalizedPayload.RepositoryUrl;

    if (!repository && !repositoryName && !repositoryUrl) {
      errors.push('Missing repository information');
    } else {
      if (!repositoryName) {
        errors.push('Missing repository name');
      }
      if (!repositoryUrl) {
        errors.push('Missing repository URL');
      }
    }

    const commits = normalizedPayload.commits || normalizedPayload.Commits;
    const headCommit =
      normalizedPayload.head_commit || normalizedPayload.HeadCommit || normalizedPayload.headCommit;

    if (!headCommit && (!Array.isArray(commits) || commits.length === 0)) {
      errors.push('Missing commit information');
    }

    return {
      IsValid: errors.length === 0,
      Errors: errors,
    };
  }

  /**
   * Extract event type from GitHub webhook headers
   */
  public GetEventType(eventHeader: string | undefined): string {
    return eventHeader || 'unknown';
  }

  /**
   * Check if event type should be processed
   */
  public IsProcessableEvent(eventType: string): boolean {
    const processableEvents = ['push', 'workflow_run', 'release'];
    return processableEvents.includes(eventType.toLowerCase());
  }
}

export default WebhookService;
