/**
 * Auto-Recovery Service
 * Automatic healing mechanisms for common deployment failures
 *
 * FEATURES:
 * - Auto-retry on transient failures
 * - Disk space monitoring & cleanup
 * - Process crash recovery
 * - SSH key corruption detection
 * - Git repository repair
 */

import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import Logger from './Logger';
import SshKeyManager from './SshKeyManager';

const execAsync = promisify(exec);

export interface IRecoveryResult {
  Success: boolean;
  Action: string;
  Message: string;
  Details?: any;
}

export class AutoRecovery {
  /**
   * Auto-retry wrapper for deployment operations
   * Retries transient failures automatically
   * Auto-detects and fixes npm cache permission issues
   */
  public static async RetryOperation<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      delayMs?: number;
      exponentialBackoff?: boolean;
      operationName: string;
    }
  ): Promise<T> {
    const {
      maxRetries = 3,
      delayMs = 1000,
      exponentialBackoff = true,
      operationName,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        Logger.Debug(`Attempting ${operationName} (${attempt}/${maxRetries})`);
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          Logger.Error(`${operationName} failed after ${maxRetries} attempts`, lastError);
          break;
        }

        // Check if error is retryable
        if (!this.IsRetryableError(error as Error)) {
          Logger.Warn(`${operationName} failed with non-retryable error`, { error });
          throw error;
        }

        // AUTO-FIX: Detect npm cache permission error and fix it
        const errorMessage = (error as Error).message || '';
        if (errorMessage.includes('EACCES') && errorMessage.includes('npm')) {
          Logger.Warn('Detected npm cache permission error, attempting auto-fix', {
            operationName,
            attempt,
          });

          const fixResult = await this.FixNpmCachePermissions();
          if (fixResult.Success) {
            Logger.Info('npm cache permissions fixed, retrying operation immediately', {
              operationName,
              attempt,
            });
            // Retry immediately after fixing permissions
            continue;
          } else {
            Logger.Error('Failed to auto-fix npm cache permissions', fixResult.Details);
          }
        }

        // Calculate delay with exponential backoff
        const delay = exponentialBackoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;

        Logger.Warn(`${operationName} failed, retrying in ${delay}ms`, {
          attempt,
          maxRetries,
          error: (error as Error).message.substring(0, 200), // Truncate long errors
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Check if error is transient and retryable
   */
  private static IsRetryableError(error: Error): boolean {
    const retryablePatterns = [
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /ENOTFOUND/i,
      /ECONNRESET/i,
      /socket hang up/i,
      /network timeout/i,
      /temporary failure/i,
      /EBUSY/i, // File system busy
      /ENOTEMPTY/i, // Directory not empty (cleanup issue)
      /EACCES/i, // Permission denied (npm cache issue)
    ];

    return retryablePatterns.some((pattern) => pattern.test(error.message));
  }

  /**
   * Fix npm cache permissions automatically
   * Detects and fixes "npm error code EACCES" issues
   */
  public static async FixNpmCachePermissions(): Promise<IRecoveryResult> {
    try {
      Logger.Info('Auto-fixing npm cache permissions');

      // Detect npm cache directory
      let npmCacheDir: string;
      try {
        const { stdout } = await execAsync('npm config get cache', { timeout: 5000 });
        npmCacheDir = stdout.trim();
        Logger.Debug('Detected npm cache directory', { npmCacheDir });
      } catch (error) {
        Logger.Warn('Failed to detect npm cache directory', { error });
        npmCacheDir = '/www/server/nodejs/cache'; // Default for your server
      }

      // Check if cache directory exists
      if (!(await fs.pathExists(npmCacheDir))) {
        Logger.Warn('npm cache directory does not exist', { npmCacheDir });
        return {
          Success: false,
          Action: 'npm_cache_fix',
          Message: 'npm cache directory not found',
          Details: { npmCacheDir },
        };
      }

      // Get current process user ID
      const currentUid = process.getuid ? process.getuid() : null;
      const currentGid = process.getgid ? process.getgid() : null;

      Logger.Debug('Current process identity', {
        uid: currentUid,
        gid: currentGid,
        platform: process.platform
      });

      // Fix permissions based on platform
      if (process.platform !== 'win32') {
        try {
          // Option 1: Try to fix ownership to current user
          if (currentUid !== null && currentGid !== null) {
            const chownCommand = `chown -R ${currentUid}:${currentGid} "${npmCacheDir}"`;
            Logger.Debug('Attempting to fix npm cache ownership', {
              command: chownCommand,
              uid: currentUid,
              gid: currentGid
            });

            try {
              await execAsync(chownCommand, { timeout: 30000 });
              Logger.Info('npm cache ownership fixed successfully');
            } catch (chownError) {
              // If chown fails (no sudo), try with sudo
              Logger.Warn('chown failed, trying with sudo', { error: chownError });
              await execAsync(`sudo ${chownCommand}`, { timeout: 30000 });
              Logger.Info('npm cache ownership fixed with sudo');
            }
          }

          // Option 2: Fix permissions (make cache writable)
          const chmodCommand = `chmod -R 755 "${npmCacheDir}"`;
          Logger.Debug('Fixing npm cache permissions', { command: chmodCommand });

          try {
            await execAsync(chmodCommand, { timeout: 30000 });
            Logger.Info('npm cache permissions fixed successfully');
          } catch (chmodError) {
            Logger.Warn('chmod failed, trying with sudo', { error: chmodError });
            await execAsync(`sudo ${chmodCommand}`, { timeout: 30000 });
            Logger.Info('npm cache permissions fixed with sudo');
          }

          // Option 3: Clear npm cache completely (nuclear option)
          Logger.Info('Clearing npm cache to prevent future issues');
          try {
            await execAsync('npm cache clean --force', { timeout: 60000 });
            Logger.Info('npm cache cleared successfully');
          } catch (cacheCleanError) {
            Logger.Warn('Failed to clean npm cache', { error: cacheCleanError });
          }

          return {
            Success: true,
            Action: 'npm_cache_fix',
            Message: 'npm cache permissions fixed automatically',
            Details: {
              npmCacheDir,
              uid: currentUid,
              gid: currentGid,
              fixed: true,
            },
          };
        } catch (error) {
          Logger.Error('Failed to fix npm cache permissions', error as Error);
          return {
            Success: false,
            Action: 'npm_cache_fix',
            Message: 'Failed to fix npm cache permissions',
            Details: {
              npmCacheDir,
              error: (error as Error).message,
              suggestion: `Run manually: sudo chown -R ${currentUid}:${currentGid} "${npmCacheDir}"`,
            },
          };
        }
      } else {
        // Windows: Clear cache only
        Logger.Info('Windows detected, clearing npm cache');
        try {
          await execAsync('npm cache clean --force', { timeout: 60000 });
          return {
            Success: true,
            Action: 'npm_cache_fix',
            Message: 'npm cache cleared on Windows',
            Details: { npmCacheDir },
          };
        } catch (error) {
          return {
            Success: false,
            Action: 'npm_cache_fix',
            Message: 'Failed to clear npm cache on Windows',
            Details: { error: (error as Error).message },
          };
        }
      }
    } catch (error) {
      Logger.Error('npm cache fix failed', error as Error);
      return {
        Success: false,
        Action: 'npm_cache_fix',
        Message: 'npm cache fix operation failed',
        Details: { error: (error as Error).message },
      };
    }
  }

  /**
   * Monitor disk space and auto-cleanup if needed
   */
  public static async CheckAndCleanupDiskSpace(
    deploymentPath: string,
    minFreeSpaceGB: number = 5
  ): Promise<IRecoveryResult> {
    try {
      // Get disk space info
      const { stdout } = await execAsync(
        process.platform === 'win32'
          ? `wmic logicaldisk get size,freespace,caption | findstr "${path.parse(deploymentPath).root}"`
          : `df -BG "${deploymentPath}"`
      );

      // Parse free space (simplified)
      const freeSpaceGB = this.ParseFreeSpace(stdout);

      Logger.Debug('Disk space check', {
        deploymentPath,
        freeSpaceGB,
        minRequired: minFreeSpaceGB,
      });

      if (freeSpaceGB < minFreeSpaceGB) {
        Logger.Warn('Low disk space detected, triggering cleanup', {
          freeSpaceGB,
          minRequired: minFreeSpaceGB,
        });

        // Auto-cleanup old deployments
        const cleanedMB = await this.CleanupOldDeployments(deploymentPath);

        return {
          Success: true,
          Action: 'disk_cleanup',
          Message: `Cleaned up ${cleanedMB}MB to free disk space`,
          Details: { cleanedMB, freeSpaceGB },
        };
      }

      return {
        Success: true,
        Action: 'disk_check',
        Message: 'Sufficient disk space available',
        Details: { freeSpaceGB },
      };
    } catch (error) {
      Logger.Error('Disk space check failed', error as Error);
      return {
        Success: false,
        Action: 'disk_check',
        Message: 'Failed to check disk space',
        Details: { error: (error as Error).message },
      };
    }
  }

  /**
   * Parse free space from system command output
   */
  private static ParseFreeSpace(output: string): number {
    // Simplified parser - extracts GB number
    const match = output.match(/(\d+)G/i);
    return match && match[1] ? parseInt(match[1]) : 0;
  }

  /**
   * Auto-cleanup old deployments to free space
   */
  private static async CleanupOldDeployments(
    deploymentPath: string,
    keepLastN: number = 5
  ): Promise<number> {
    try {
      const parentDir = path.dirname(deploymentPath);
      const files = await fs.readdir(parentDir);

      // Find deployment directories
      const deploymentDirs = files
        .filter((f) => f.startsWith('deployment-'))
        .map((f) => ({
          path: path.join(parentDir, f),
          name: f,
        }));

      // Sort by modification time
      const sorted = await Promise.all(
        deploymentDirs.map(async (dir) => {
          const stats = await fs.stat(dir.path);
          return { ...dir, mtime: stats.mtimeMs };
        })
      );

      sorted.sort((a, b) => b.mtime - a.mtime);

      // Delete old deployments (keep last N)
      const toDelete = sorted.slice(keepLastN);
      let totalCleaned = 0;

      for (const dir of toDelete) {
        try {
          const stats = await fs.stat(dir.path);
          const sizeMB = Math.floor(stats.size / 1024 / 1024);

          await fs.remove(dir.path);
          totalCleaned += sizeMB;

          Logger.Info('Cleaned up old deployment', {
            path: dir.name,
            sizeMB,
          });
        } catch (error) {
          Logger.Warn('Failed to cleanup deployment', {
            path: dir.name,
            error: (error as Error).message,
          });
        }
      }

      return totalCleaned;
    } catch (error) {
      Logger.Error('Failed to cleanup old deployments', error as Error);
      return 0;
    }
  }

  /**
   * Auto-repair corrupted git repository
   */
  public static async RepairGitRepository(repoPath: string): Promise<IRecoveryResult> {
    try {
      Logger.Info('Attempting to repair git repository', { repoPath });

      // Check if .git exists
      const gitDir = path.join(repoPath, '.git');
      if (!(await fs.pathExists(gitDir))) {
        return {
          Success: false,
          Action: 'git_repair',
          Message: 'Not a git repository',
        };
      }

      // Try git fsck to check corruption
      try {
        await execAsync('git fsck --full', { cwd: repoPath, timeout: 30000 });
        return {
          Success: true,
          Action: 'git_repair',
          Message: 'Repository is healthy',
        };
      } catch (fsckError) {
        // Repository is corrupted, try to repair
        Logger.Warn('Git repository corrupted, attempting auto-repair', {
          error: (fsckError as Error).message,
        });

        // Strategy 1: Clean and reset
        await execAsync('git clean -fdx', { cwd: repoPath, timeout: 30000 });
        await execAsync('git reset --hard HEAD', { cwd: repoPath, timeout: 30000 });

        // Strategy 2: Garbage collection
        await execAsync('git gc --prune=now', { cwd: repoPath, timeout: 60000 });

        // Verify repair
        await execAsync('git fsck --full', { cwd: repoPath, timeout: 30000 });

        Logger.Info('Git repository repaired successfully', { repoPath });

        return {
          Success: true,
          Action: 'git_repair',
          Message: 'Repository repaired successfully',
        };
      }
    } catch (error) {
      Logger.Error('Git repository repair failed', error as Error, { repoPath });

      // Last resort: Delete and re-clone
      return {
        Success: false,
        Action: 'git_repair',
        Message: 'Repair failed - recommend re-clone',
        Details: { error: (error as Error).message },
      };
    }
  }

  /**
   * Auto-detect and fix SSH key issues
   */
  public static async ValidateSshKeyHealth(
    encryptedKey: any,
    projectId: number
  ): Promise<IRecoveryResult> {
    try {
      // Test decryption
      const testContext = await SshKeyManager.CreateTemporaryKeyFile(
        encryptedKey,
        projectId
      );

      // Verify file was created
      const keyExists = await fs.pathExists(testContext.keyPath);

      // Cleanup test key
      await testContext.cleanup();

      if (keyExists) {
        return {
          Success: true,
          Action: 'ssh_key_health',
          Message: 'SSH key is healthy',
        };
      } else {
        return {
          Success: false,
          Action: 'ssh_key_health',
          Message: 'SSH key creation failed',
        };
      }
    } catch (error) {
      Logger.Error('SSH key health check failed', error as Error, { projectId });

      return {
        Success: false,
        Action: 'ssh_key_health',
        Message: 'SSH key is corrupted - regeneration required',
        Details: { error: (error as Error).message },
      };
    }
  }

  /**
   * Auto-kill stuck processes on deployment path
   */
  public static async KillStuckProcesses(
    deploymentPath: string
  ): Promise<IRecoveryResult> {
    try {
      // Find processes using this path
      const command =
        process.platform === 'win32'
          ? `handle.exe "${deploymentPath}" /accepteula`
          : `lsof +D "${deploymentPath}"`;

      const { stdout } = await execAsync(command, { timeout: 10000 });

      if (!stdout || stdout.trim().length === 0) {
        return {
          Success: true,
          Action: 'kill_processes',
          Message: 'No stuck processes found',
        };
      }

      // Parse PIDs and kill them
      const pids = this.ParseProcessIds(stdout);

      for (const pid of pids) {
        try {
          process.kill(pid, 'SIGTERM');
          Logger.Info('Killed stuck process', { pid, deploymentPath });
        } catch (error) {
          Logger.Warn('Failed to kill process', { pid, error });
        }
      }

      return {
        Success: true,
        Action: 'kill_processes',
        Message: `Killed ${pids.length} stuck processes`,
        Details: { pids },
      };
    } catch (error) {
      // Command failed or not available - not critical
      return {
        Success: true,
        Action: 'kill_processes',
        Message: 'Process check not available on this platform',
      };
    }
  }

  /**
   * Parse process IDs from lsof/handle output
   */
  private static ParseProcessIds(output: string): number[] {
    const pids: number[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/\s+(\d+)\s+/);
      if (match && match[1]) {
        pids.push(parseInt(match[1]));
      }
    }

    return [...new Set(pids)]; // Remove duplicates
  }
}

export default AutoRecovery;
