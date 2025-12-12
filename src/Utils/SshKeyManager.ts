/**
 * SSH Key Manager - Zero-Trust Temporary Key Management
 *
 * SECURITY ARCHITECTURE:
 * =====================
 * This manager implements a zero-trust approach to SSH key handling:
 *
 * 1. Private keys are NEVER stored permanently on the filesystem
 * 2. Keys are decrypted from database IN MEMORY only
 * 3. Written to temp files with 0o600 permissions (owner read/write only)
 * 4. Used for git operations (<1 second lifetime)
 * 5. Immediately deleted with 3-pass secure overwrite
 * 6. Failsafe: Auto-cleanup of keys older than 5 minutes
 * 7. Periodic orphan cleanup every 60 seconds
 *
 * THREAT MODEL:
 * =============
 * Protects against:
 * - Filesystem exposure (keys exist <1 second)
 * - Unauthorized access (0o600 permissions)
 * - Key leakage (secure deletion)
 * - Process crashes (periodic cleanup)
 * - Forensic recovery (3-pass overwrite)
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import Logger from './Logger';
import EncryptionHelper, { type IEncryptedData } from './EncryptionHelper';

const execAsync = promisify(exec);

export interface ISshKeyContext {
  keyPath: string;
  cleanup: () => Promise<void>;
}

export class SshKeyManager {
  // Temp directory for SSH keys (platform-specific)
  private static readonly TempKeyDir = path.join(
    os.tmpdir(),
    'deploy-center-ssh-runtime'
  );

  // Maximum lifetime of a temporary key file (5 minutes failsafe)
  private static readonly KeyTimeout = 5 * 60 * 1000; // 5 minutes

  // How often to check for orphaned keys (1 minute)
  private static readonly CleanupInterval = 60 * 1000; // 1 minute

  // Track initialization state
  private static initialized = false;

  /**
   * Initialize the SSH Key Manager
   *
   * Creates temp directory and starts periodic cleanup scheduler
   * Called automatically on first use
   */
  public static Initialize(): void {
    if (this.initialized) {
      return;
    }

    try {
      // Create temp directory with restricted permissions
      fs.ensureDirSync(this.TempKeyDir, { mode: 0o700 }); // rwx------

      Logger.Info('SSH Key Manager initialized', {
        tempDir: this.TempKeyDir,
        keyTimeout: `${this.KeyTimeout / 1000}s`,
        cleanupInterval: `${this.CleanupInterval / 1000}s`,
      });

      // Start periodic cleanup
      this.StartPeriodicCleanup();

      this.initialized = true;
    } catch (error) {
      Logger.Error('Failed to initialize SSH Key Manager', error as Error);
      throw new Error('SSH Key Manager initialization failed');
    }
  }

  /**
   * Create temporary SSH key file from encrypted database data
   *
   * SECURITY FLOW:
   * 1. Decrypt private key IN MEMORY (using AES-256-GCM)
   * 2. Validate key format
   * 3. Generate unique temp file path with random suffix
   * 4. Write key with 0o600 permissions (owner only)
   * 5. Schedule automatic cleanup after timeout
   * 6. Return context with manual cleanup function
   *
   * USAGE:
   * const ctx = await SshKeyManager.CreateTemporaryKeyFile(encryptedKey, projectId);
   * try {
   *   // Use ctx.keyPath for git operations
   * } finally {
   *   await ctx.cleanup(); // CRITICAL: Always cleanup
   * }
   *
   * @param encryptedKey - Encrypted SSH private key from database
   * @param projectId - Project ID for logging
   * @returns Promise<ISshKeyContext> - Context with keyPath and cleanup function
   */
  public static async CreateTemporaryKeyFile(
    encryptedKey: IEncryptedData,
    projectId: number
  ): Promise<ISshKeyContext> {
    // Ensure manager is initialized
    this.Initialize();

    try {
      // STEP 1: Decrypt private key IN MEMORY
      Logger.Debug('Decrypting SSH private key', { projectId });
      const privateKeyContent = EncryptionHelper.Decrypt(encryptedKey);

      // STEP 2: Validate key format
      if (!this.ValidateKeyFormat(privateKeyContent)) {
        throw new Error('Invalid SSH private key format after decryption');
      }

      // STEP 3: Generate unique temp file path
      const randomSuffix = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now();
      const keyFileName = `key-p${projectId}-${timestamp}-${randomSuffix}`;
      const keyPath = path.join(this.TempKeyDir, keyFileName);

      Logger.Debug('Creating temporary SSH key file', {
        projectId,
        keyPath: path.basename(keyPath),
      });

      // STEP 4: Write key with restrictive permissions (best effort on Windows)
      // 0o600 = -rw------- (owner read/write only, no group, no others)
      await fs.writeFile(keyPath, privateKeyContent, {
        mode: 0o600,
        encoding: 'utf-8',
      });

      // Enforce chmod on platforms that support POSIX perms
      if (process.platform !== 'win32') {
        await fs.chmod(keyPath, 0o600);
      }

      // Verify file was created with correct permissions
      const stats = await fs.stat(keyPath);
      const permissions = (stats.mode & parseInt('777', 8)).toString(8);
      if (process.platform !== 'win32' && permissions !== '600') {
        Logger.Warn('SSH key file permissions incorrect', {
          expected: '600',
          actual: permissions,
          keyPath,
        });
      } else if (process.platform === 'win32') {
        // Windows ACLs are used instead of POSIX perms; log once for awareness
        Logger.Warn('SSH key file permissions are governed by Windows ACLs (POSIX 600 not enforced)', {
          keyPath,
          permissions,
        });
      }

      Logger.Info('Temporary SSH key created', {
        projectId,
        keyPath: path.basename(keyPath),
        permissions,
        size: stats.size,
      });

      // STEP 5: Schedule automatic cleanup (failsafe)
      const cleanupTimer = setTimeout(async () => {
        await this.SecureDeleteKeyFile(keyPath);
        Logger.Warn('SSH key auto-deleted (timeout)', {
          projectId,
          keyPath: path.basename(keyPath),
          timeout: `${this.KeyTimeout / 1000}s`,
        });
      }, this.KeyTimeout);

      // STEP 6: Return context with manual cleanup function
      return {
        keyPath,
        cleanup: async () => {
          clearTimeout(cleanupTimer); // Cancel auto-cleanup
          await this.SecureDeleteKeyFile(keyPath);
          Logger.Debug('SSH key manually cleaned up', {
            projectId,
            keyPath: path.basename(keyPath),
          });
        },
      };
    } catch (error) {
      Logger.Error('Failed to create temporary SSH key', error as Error, {
        projectId,
      });
      throw error;
    }
  }

  /**
   * Execute git command with SSH key authentication
   *
   * Sets GIT_SSH_COMMAND environment variable to use custom SSH key
   *
   * SECURITY OPTIONS:
   * - IdentitiesOnly=yes: Only use provided key, ignore ssh-agent
   * - StrictHostKeyChecking: Configurable (default: no for automation)
   * - UserKnownHostsFile=/dev/null: Don't use known_hosts
   * - LogLevel=ERROR: Minimize output for security
   *
   * @param command - Git command to execute (e.g., "git clone ...")
   * @param keyPath - Path to temporary SSH key file
   * @param workingDir - Working directory for command execution
   * @param options - Additional options
   * @returns Promise<{stdout, stderr}> - Command output
   */
  public static async ExecuteGitCommandWithKey(
    command: string,
    keyPath: string,
    workingDir: string,
    options: {
      strictHostKeyChecking?: boolean;
      timeout?: number;
    } = {}
  ): Promise<{ stdout: string; stderr: string }> {
    const {
      strictHostKeyChecking = false, // Allow automation
      timeout = 300000, // 5 minutes default
    } = options;

    // Build GIT_SSH_COMMAND with security options
    const sshCommand = [
      'ssh',
      `-i "${keyPath}"`, // Use our temporary key
      `-o StrictHostKeyChecking=${strictHostKeyChecking ? 'yes' : 'no'}`,
      `-o UserKnownHostsFile=/dev/null`, // Don't use known_hosts
      `-o IdentitiesOnly=yes`, // Only use our key, ignore ssh-agent
      `-o LogLevel=ERROR`, // Minimize logging
      `-o BatchMode=yes`, // Non-interactive
    ].join(' ');

    Logger.Debug('Executing git command with SSH key', {
      command: command.substring(0, 100) + '...',
      workingDir,
      strictHostKeyChecking,
    });

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout,
        env: {
          ...process.env,
          GIT_SSH_COMMAND: sshCommand,
        },
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      Logger.Debug('Git command executed successfully', {
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
      });

      return { stdout, stderr };
    } catch (error) {
      Logger.Error('Git command execution failed', error as Error, {
        command: command.substring(0, 100),
        workingDir,
      });
      throw error;
    }
  }

  /**
   * Secure delete SSH key file with 3-pass overwrite
   *
   * Implements DoD 5220.22-M standard:
   * Pass 1: Random data
   * Pass 2: Zeros
   * Pass 3: Ones
   * Final: Unlink file
   *
   * Prevents forensic recovery of key material
   *
   * @param keyPath - Path to key file to delete
   */
  private static async SecureDeleteKeyFile(keyPath: string): Promise<void> {
    try {
      if (!(await fs.pathExists(keyPath))) {
        return; // Already deleted
      }

      const stats = await fs.stat(keyPath);
      const fileSize = stats.size;

      Logger.Debug('Starting secure deletion', {
        keyPath: path.basename(keyPath),
        size: fileSize,
      });

      // Pass 1: Overwrite with random data
      const randomData = crypto.randomBytes(fileSize);
      await fs.writeFile(keyPath, randomData);

      // Pass 2: Overwrite with zeros
      const zerosData = Buffer.alloc(fileSize, 0);
      await fs.writeFile(keyPath, zerosData);

      // Pass 3: Overwrite with ones
      const onesData = Buffer.alloc(fileSize, 0xff);
      await fs.writeFile(keyPath, onesData);

      // Final: Delete file
      await fs.remove(keyPath);

      Logger.Debug('Secure deletion completed', {
        keyPath: path.basename(keyPath),
      });
    } catch (error) {
      Logger.Error('Failed to securely delete SSH key', error as Error, {
        keyPath,
      });
      // Don't throw - deletion is cleanup, not critical operation
    }
  }

  /**
   * Start periodic cleanup of orphaned keys
   *
   * Runs every CleanupInterval (60 seconds) to check for:
   * - Keys older than KeyTimeout (5 minutes)
   * - Orphaned keys from crashed processes
   *
   * This is a failsafe mechanism in case manual cleanup fails
   */
  private static StartPeriodicCleanup(): void {
    setInterval(() => {
      this.CleanupOrphanedKeys().catch((error) => {
        Logger.Error('Periodic SSH key cleanup failed', error as Error);
      });
    }, this.CleanupInterval);

    Logger.Debug('Periodic SSH key cleanup started', {
      interval: `${this.CleanupInterval / 1000}s`,
    });
  }

  /**
   * Cleanup orphaned SSH key files
   *
   * Removes any key files older than KeyTimeout
   */
  private static async CleanupOrphanedKeys(): Promise<void> {
    try {
      if (!(await fs.pathExists(this.TempKeyDir))) {
        return; // Directory doesn't exist yet
      }

      const files = await fs.readdir(this.TempKeyDir);
      const now = Date.now();
      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.TempKeyDir, file);

        try {
          const stats = await fs.stat(filePath);
          const age = now - stats.mtimeMs;

          // Delete if older than timeout
          if (age > this.KeyTimeout) {
            await this.SecureDeleteKeyFile(filePath);
            cleanedCount++;
            Logger.Debug('Cleaned up orphaned SSH key', {
              file,
              age: `${Math.floor(age / 1000)}s`,
            });
          }
        } catch (error) {
          // File might have been deleted between readdir and stat
          Logger.Debug('Failed to check file age', { file });
        }
      }

      if (cleanedCount > 0) {
        Logger.Info('Cleaned up orphaned SSH keys', { count: cleanedCount });
      }
    } catch (error) {
      Logger.Error('Orphaned key cleanup error', error as Error);
    }
  }

  /**
   * Validate SSH private key format
   *
   * @param privateKey - Private key content
   * @returns true if valid format
   */
  private static ValidateKeyFormat(privateKey: string): boolean {
    const patterns = [
      /-----BEGIN OPENSSH PRIVATE KEY-----/,
      /-----BEGIN RSA PRIVATE KEY-----/,
      /-----BEGIN EC PRIVATE KEY-----/,
    ];
    return patterns.some((pattern) => pattern.test(privateKey));
  }

  /**
   * Get temp directory path (for debugging)
   */
  public static GetTempDirectory(): string {
    return this.TempKeyDir;
  }

  /**
   * Manually cleanup all keys (for testing/maintenance)
   */
  public static async CleanupAllKeys(): Promise<number> {
    try {
      if (!(await fs.pathExists(this.TempKeyDir))) {
        return 0;
      }

      const files = await fs.readdir(this.TempKeyDir);
      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.TempKeyDir, file);
        await this.SecureDeleteKeyFile(filePath);
        cleanedCount++;
      }

      Logger.Info('Manually cleaned up all SSH keys', { count: cleanedCount });
      return cleanedCount;
    } catch (error) {
      Logger.Error('Failed to cleanup all keys', error as Error);
      throw error;
    }
  }
}

export default SshKeyManager;
