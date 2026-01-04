/**
 * Pipeline Service
 * Handles pipeline execution, variable replacement, and command execution
 * Following SOLID principles and PascalCase naming convention
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import os from 'os';
import crypto from 'crypto';
import Logger from '@Utils/Logger';
import LogFormatter, { LogPhase } from '@Utils/LogFormatter';
import { IDeploymentContext, IPipelineStep } from '@Types/ICommon';
import { DeploymentStep } from '@Models/index';
import { EStepStatus } from '@Types/ICommon';
import SocketService from './SocketService';

export interface IPipelineExecutionResult {
  Success: boolean;
  CompletedSteps: number;
  TotalSteps: number;
  Duration: number;
  ErrorMessage?: string;
}

export class PipelineService {
  private shellSession: ShellSession | null = null;

  /**
   * Execute a complete pipeline
   * @param sshKeyContext - Optional SSH key context for git operations
   * @param pipelineName - Name of the pipeline (e.g., "Pre-deployment", "Post-deployment")
   */
  public async ExecutePipeline(
    deploymentId: number,
    pipeline: IPipelineStep[],
    context: IDeploymentContext,
    projectPath: string,
    sshKeyContext?: Awaited<
      ReturnType<typeof import('@Utils/SshKeyManager').SshKeyManager.CreateTemporaryKeyFile>
    > | null,
    pipelineName: string = 'Pre-deployment'
  ): Promise<IPipelineExecutionResult> {
    const startTime = Date.now();
    let completedSteps = 0;
    const totalSteps = pipeline.length;
    this.shellSession = new ShellSession(projectPath, deploymentId, sshKeyContext);

    try {
      // Log pipeline start with new format
      const pipelineStartLog = LogFormatter.FormatPipelineStart(totalSteps, pipelineName);
      Logger.Deployment(pipelineStartLog, {
        deploymentId,
        totalSteps,
      });
      // Emit to real-time logs
      if (deploymentId) {
        SocketService.GetInstance().EmitDeploymentLog(deploymentId, pipelineStartLog);
      }

      for (let i = 0; i < pipeline.length; i++) {
        const step = pipeline[i]!;
        const stepNumber = i + 1;

        // Log step header with new format
        const stepHeaderLog = LogFormatter.FormatStepHeader(stepNumber, totalSteps, step.Name);
        Logger.Deployment(stepHeaderLog, {
          deploymentId,
          stepNumber,
        });
        // Emit to real-time logs
        if (deploymentId) {
          SocketService.GetInstance().EmitDeploymentLog(deploymentId, stepHeaderLog);
        }

        // Create step record
        const stepRecord = await DeploymentStep.create({
          DeploymentId: deploymentId,
          StepNumber: stepNumber,
          StepName: step.Name,
          Status: EStepStatus.Running,
          StartedAt: new Date(),
        });

        try {
          // Check if step should run (conditional execution)
          if (step.RunIf) {
            const shouldRun = this.EvaluateCondition(step.RunIf, context);
            if (!shouldRun) {
              Logger.Deployment(`Step ${stepNumber} skipped (condition not met)`, {
                deploymentId,
                stepNumber,
                condition: step.RunIf,
              });

              await stepRecord.update({
                Status: EStepStatus.Skipped,
                CompletedAt: new Date(),
                Duration: 0,
              });

              continue;
            }
          }

          // Execute step commands
          const stepStartTime = Date.now();
          const outputs: string[] = [];
          const errors: string[] = [];
          const warnings: string[] = [];

          for (const command of step.Run) {
            const replacedCommand = this.ReplaceVariables(command, context);

            // Log command with new format (show command before execution)
            const commandLog = LogFormatter.FormatCommand(replacedCommand, LogPhase.STEP);
            Logger.Debug(`Executing command: ${replacedCommand}`, { deploymentId, stepNumber });
            outputs.push(commandLog);

            // Emit to real-time logs
            if (deploymentId) {
              SocketService.GetInstance().EmitDeploymentLog(deploymentId, commandLog);
            }

            try {
              const { stdout, stderr } = await this.shellSession.RunCommand(
                replacedCommand,
                deploymentId,
                stepNumber,
                step.Name
              );

              if (stdout) {
                // Format command output with new format
                const formattedOutput = LogFormatter.FormatCommandOutput(stdout, LogPhase.STEP);
                outputs.push(formattedOutput);
              }

              // Separate npm warnings from actual errors
              if (stderr) {
                const stderrLines = stderr.split('\n');
                for (const line of stderrLines) {
                  const trimmed = line.trim();
                  if (!trimmed) continue;

                  // npm warnings (not errors)
                  if (
                    trimmed.toLowerCase().includes('npm warn') ||
                    trimmed.toLowerCase().includes('npm notice')
                  ) {
                    warnings.push(trimmed);
                  } else {
                    errors.push(trimmed);
                  }
                }
              }
            } catch (cmdError: any) {
              // Format command error with new format
              const exitCode = cmdError.message.match(/code (\d+)/)?.[1];
              const formattedError = LogFormatter.FormatCommandError(
                cmdError.message,
                exitCode ? parseInt(exitCode) : undefined,
                LogPhase.STEP
              );
              errors.push(formattedError);

              if (cmdError.stdout) {
                const formattedOutput = LogFormatter.FormatCommandOutput(cmdError.stdout, LogPhase.STEP);
                outputs.push(formattedOutput);
              }
              if (cmdError.stderr) {
                const formattedStderr = LogFormatter.FormatCommandError(cmdError.stderr, undefined, LogPhase.STEP);
                errors.push(formattedStderr);
              }
              throw cmdError;
            }
          }

          const stepDuration = Math.round((Date.now() - stepStartTime) / 1000);

          // Update step as success (Output not stored - all logs go to log file)
          await stepRecord.update({
            Status: EStepStatus.Success,
            CompletedAt: new Date(),
            Duration: stepDuration,
          });

          completedSteps++;

          Logger.Deployment(`Step ${stepNumber} completed successfully (${stepDuration}s)`, {
            deploymentId,
            stepNumber,
            duration: stepDuration,
          });
        } catch (stepError: any) {
          const stepDuration = Math.round(
            (Date.now() - (stepRecord.StartedAt?.getTime() || Date.now())) / 1000
          );

          await stepRecord.update({
            Status: EStepStatus.Failed,
            CompletedAt: new Date(),
            Duration: stepDuration,
            Error: stepError.message,
          });

          // Best-effort: kill shell session and any running child processes
          await this.shellSession?.Dispose();

          Logger.Error(`Step ${stepNumber} failed`, stepError as Error, {
            deploymentId,
            stepNumber,
          });

          throw new Error(`Step ${stepNumber} (${step.Name}) failed: ${stepError.message}`);
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      // Log pipeline completion with new format
      const pipelineCompleteLog = LogFormatter.FormatPipelineComplete(pipelineName, duration);
      Logger.Deployment(pipelineCompleteLog, {
        deploymentId,
        completedSteps,
        totalSteps,
        duration,
      });
      // Emit to real-time logs
      if (deploymentId) {
        SocketService.GetInstance().EmitDeploymentLog(deploymentId, pipelineCompleteLog);
      }

      return {
        Success: true,
        CompletedSteps: completedSteps,
        TotalSteps: totalSteps,
        Duration: duration,
      };
    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);

      // Log pipeline failure with new format
      const pipelineFailureLog = LogFormatter.FormatPipelineFailure(
        completedSteps + 1,
        totalSteps,
        pipelineName
      );
      Logger.Error('Pipeline execution failed', error as Error, {
        deploymentId,
        completedSteps,
        totalSteps,
      });
      // Emit to real-time logs
      if (deploymentId) {
        SocketService.GetInstance().EmitDeploymentLog(deploymentId, pipelineFailureLog);
      }

      await this.shellSession?.Dispose();

      return {
        Success: false,
        CompletedSteps: completedSteps,
        TotalSteps: totalSteps,
        Duration: duration,
        ErrorMessage: (error as Error).message,
      };
    } finally {
      await this.shellSession?.Dispose();
      this.shellSession = null;
    }
  }

  /**
   * Replace variables in a string using context
   */
  private ReplaceVariables(str: string, context: IDeploymentContext): string {
    let result = str;

    // Replace all {{variable}} patterns
    const regex = /\{\{(\w+)\}\}/g;
    result = result.replace(regex, (match, key) => {
      return context[key] !== undefined ? String(context[key]) : match;
    });

    return result;
  }

  /**
   * Evaluate conditional expression
   */
  private EvaluateCondition(expression: string, context: IDeploymentContext): boolean {
    try {
      // Create a safe evaluation context
      const hasVar = (key: string): boolean => {
        return context[key] !== undefined && context[key] !== null && context[key] !== '';
      };

      // Replace variables in expression
      let evaluableExpression = expression;

      // Replace hasVar() calls
      evaluableExpression = evaluableExpression.replace(/hasVar\(['"](\w+)['"]\)/g, (_, key) => {
        return String(hasVar(key));
      });

      // Replace variable references
      Object.keys(context).forEach((key) => {
        const value = context[key];
        if (typeof value === 'string') {
          evaluableExpression = evaluableExpression.replace(
            new RegExp(`\\b${key}\\b`, 'g'),
            `"${value}"`
          );
        }
      });

      // Evaluate the expression
      // Note: Using Function constructor for safe evaluation (limited scope)
      const result = new Function(`return ${evaluableExpression}`)();

      return Boolean(result);
    } catch (error) {
      Logger.Warn('Failed to evaluate condition, defaulting to false', {
        expression,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Build deployment context from project config and webhook payload
   */
  public BuildContext(
    projectPath: string,
    branch: string,
    commit: string,
    repoName: string,
    variables: Record<string, string>
  ): IDeploymentContext {
    return {
      ProjectPath: projectPath,
      Branch: branch,
      Commit: commit,
      RepoName: repoName,
      ...variables,
    };
  }

  /**
   * Validate pipeline configuration
   */
  public ValidatePipeline(pipeline: IPipelineStep[]): {
    IsValid: boolean;
    Errors: string[];
  } {
    const errors: string[] = [];

    if (!Array.isArray(pipeline) || pipeline.length === 0) {
      errors.push('Pipeline must contain at least one step');
      return { IsValid: false, Errors: errors };
    }

    pipeline.forEach((step, index) => {
      if (!step.Name || step.Name.trim() === '') {
        errors.push(`Step ${index + 1}: Name is required`);
      }

      if (!Array.isArray(step.Run) || step.Run.length === 0) {
        errors.push(`Step ${index + 1}: Must contain at least one command`);
      }

      step.Run?.forEach((cmd, cmdIndex) => {
        if (!cmd || cmd.trim() === '') {
          errors.push(`Step ${index + 1}, Command ${cmdIndex + 1}: Command cannot be empty`);
        }
      });
    });

    return {
      IsValid: errors.length === 0,
      Errors: errors,
    };
  }
}

/**
 * ShellSession
 * Maintains a single shell process per deployment to execute commands sequentially.
 * Cross-platform:
 * - Windows: PowerShell
 * - POSIX: Bash
 */
class ShellSession {
  private readonly cwd: string;
  private readonly deploymentId?: number;
  private readonly sshKeyContext?: Awaited<
    ReturnType<typeof import('@Utils/SshKeyManager').SshKeyManager.CreateTemporaryKeyFile>
  > | null;
  private shell: ChildProcessWithoutNullStreams;
  private stdoutBuffer = '';
  private stderrBuffer = '';
  private currentCommand: {
    id: string;
    resolve: (value: { stdout: string; stderr: string }) => void;
    reject: (reason?: any) => void;
    stdoutParts: string[];
    stderrParts: string[];
    timeout: NodeJS.Timeout;
  } | null = null;
  private disposed = false;

  constructor(
    cwd: string,
    deploymentId?: number,
    sshKeyContext?: Awaited<
      ReturnType<typeof import('@Utils/SshKeyManager').SshKeyManager.CreateTemporaryKeyFile>
    > | null
  ) {
    this.cwd = cwd;
    this.deploymentId = deploymentId;
    this.sshKeyContext = sshKeyContext;
    this.shell = this.StartShell();
    Logger.Info('Shell session started for deployment', {
      deploymentId,
      pid: this.shell.pid,
      osUser: os.userInfo().username,
      cwd,
      platform: process.platform,
      hasSshKey: !!sshKeyContext,
    });
  }

  /**
   * Run a command in the persistent shell.
   */
  public async RunCommand(
    command: string,
    deploymentId?: number,
    stepNumber?: number,
    stepName?: string,
    timeoutMs: number = 10 * 60 * 1000
  ): Promise<{ stdout: string; stderr: string }> {
    if (this.disposed) {
      throw new Error('Shell session already disposed');
    }
    if (this.currentCommand) {
      // This should not happen because we run sequentially
      throw new Error('Shell session is busy with another command');
    }

    const id = crypto.randomBytes(8).toString('hex');
    const marker = `__CMD_DONE__${id}__`;
    const script = this.BuildScript(command, marker);

    Logger.Info('Running command in shell session', {
      deploymentId,
      stepNumber,
      stepName,
      command,
      marker,
    });

    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ForceKillShell();
        reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
      }, timeoutMs);

      this.currentCommand = {
        id,
        resolve,
        reject,
        stdoutParts: [],
        stderrParts: [],
        timeout,
      };

      this.shell.stdin.write(script + os.EOL);
    });
  }

  private ForceKillShell(): void {
    try {
      if (process.platform === 'win32' && this.shell.pid) {
        spawn('taskkill', ['/PID', String(this.shell.pid), '/T', '/F'], { windowsHide: true });
        Logger.Info('Force killed shell process tree (Windows)', {
          deploymentId: this.deploymentId,
          pid: this.shell.pid,
        });
      } else if (this.shell.pid) {
        // POSIX: Kill the entire process group with SIGKILL
        // Use negative PID to kill all processes in the shell's process group
        try {
          process.kill(-this.shell.pid, 'SIGKILL');
          Logger.Info('Force killed shell process group (POSIX)', {
            deploymentId: this.deploymentId,
            pid: this.shell.pid,
            pgid: this.shell.pid,
          });
        } catch (pgErr) {
          // Fallback: kill just the shell process
          Logger.Warn('Failed to kill process group, killing shell only', {
            deploymentId: this.deploymentId,
            error: (pgErr as Error).message,
          });
          process.kill(this.shell.pid, 'SIGKILL');
        }
      }
    } catch (err) {
      Logger.Warn('Force kill shell failed', {
        deploymentId: this.deploymentId,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Dispose the shell and kill the process tree.
   * CRITICAL: Wait for the kill command to complete before returning
   */
  public async Dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    try {
      // Close stdin to signal shell to exit gracefully
      try {
        this.shell.stdin.end();
      } catch {
        // Ignore if already closed
      }

      if (process.platform === 'win32' && this.shell.pid) {
        // Windows: Use taskkill and WAIT for it to complete
        await new Promise<void>((resolve) => {
          const killer = spawn('taskkill', ['/PID', String(this.shell.pid), '/T', '/F'], {
            windowsHide: true,
          });

          const timeout = setTimeout(() => {
            Logger.Warn('Taskkill timeout, force resolving', {
              deploymentId: this.deploymentId,
              pid: this.shell.pid,
            });
            resolve();
          }, 3000);

          killer.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });

          killer.on('error', (err) => {
            clearTimeout(timeout);
            Logger.Warn('Taskkill error', {
              deploymentId: this.deploymentId,
              error: err.message,
            });
            resolve();
          });
        });

        // Extra wait to ensure filesystem handles are released
        // Windows needs more time to release directory handles
        await new Promise((resolve) => setTimeout(resolve, 1500));

        Logger.Info('Shell session killed successfully (Windows)', {
          deploymentId: this.deploymentId,
          pid: this.shell.pid,
        });
      } else if (this.shell.pid) {
        // POSIX: Since we use detached=true, the shell is a process group leader
        // We need to kill its entire process group (which includes child processes like npm)
        // BUT the process group ID equals the shell PID (because it's the group leader)
        // So killing -PID kills only this shell's process group, not other deployments
        try {
          // Kill the process group (negative PID)
          // This kills the shell AND all its children (npm, git, etc.)
          process.kill(-this.shell.pid, 'SIGTERM');

          Logger.Info('Shell session process group terminated (POSIX)', {
            deploymentId: this.deploymentId,
            pid: this.shell.pid,
            pgid: this.shell.pid, // Process group ID = PID for group leader
          });

          // Wait for graceful shutdown
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Check if process group still exists and force kill if needed
          try {
            // Try to kill the group again - if it throws, the group is gone
            process.kill(-this.shell.pid, 0);

            // If we reach here, process group is still alive - force kill it
            Logger.Warn('Shell process group did not exit gracefully, force killing', {
              deploymentId: this.deploymentId,
              pid: this.shell.pid,
            });

            process.kill(-this.shell.pid, 'SIGKILL');
            await new Promise((resolve) => setTimeout(resolve, 300));
          } catch {
            // Process group is gone - good!
            Logger.Info('Shell process group exited successfully', {
              deploymentId: this.deploymentId,
              pid: this.shell.pid,
            });
          }
        } catch (err) {
          // If killing process group fails, try killing just the shell process
          Logger.Warn('Failed to kill shell process group, trying single process', {
            deploymentId: this.deploymentId,
            pid: this.shell.pid,
            error: (err as Error).message,
          });

          try {
            process.kill(this.shell.pid, 'SIGTERM');
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (killErr) {
            Logger.Error('Failed to kill shell process', killErr as Error, {
              deploymentId: this.deploymentId,
            });
          }
        }
      }
    } catch (err) {
      Logger.Warn('Failed to dispose shell session', {
        deploymentId: this.deploymentId,
        error: (err as Error).message,
      });
    }
  }

  private StartShell(): ChildProcessWithoutNullStreams {
    const isWindows = process.platform === 'win32';
    const shellCmd = isWindows ? 'powershell.exe' : '/bin/bash';
    const args = isWindows
      ? ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-']
      : ['-s'];

    // Build environment with SSH key support
    const env = { ...process.env };

    if (this.sshKeyContext) {
      // Add GIT_SSH_COMMAND for git operations with SSH key
      const sshCommand = [
        'ssh',
        `-i "${this.sshKeyContext.keyPath}"`,
        `-o StrictHostKeyChecking=no`,
        `-o UserKnownHostsFile=/dev/null`,
        `-o IdentitiesOnly=yes`,
        `-o LogLevel=ERROR`,
        `-o BatchMode=yes`,
      ].join(' ');

      env.GIT_SSH_COMMAND = sshCommand;

      Logger.Debug('Shell session configured with SSH key', {
        deploymentId: this.deploymentId,
        keyPath: this.sshKeyContext.keyPath,
      });
    }

    const child = spawn(shellCmd, args, {
      cwd: this.cwd,
      windowsHide: true,
      stdio: 'pipe',
      env,
      // On Linux/Mac: Create new session to isolate from other deployments
      // On Windows: Keep in same process group (detached causes issues)
      // This prevents SIGTERM from one deployment affecting others
      detached: process.platform !== 'win32',
    });

    child.stdout.on('data', (data: Buffer) => this.HandleStdout(data));
    child.stderr.on('data', (data: Buffer) => this.HandleStderr(data));
    child.on('error', (err) => {
      if (this.currentCommand) {
        this.currentCommand.reject(err);
        clearTimeout(this.currentCommand.timeout);
        this.currentCommand = null;
      }
    });
    child.on('exit', (code, signal) => {
      if (this.currentCommand) {
        this.currentCommand.reject(
          new Error(`Shell session exited prematurely code=${code} signal=${signal}`)
        );
        clearTimeout(this.currentCommand.timeout);
        this.currentCommand = null;
      }
    });

    return child;
  }

  private BuildScript(command: string, marker: string): string {
    if (process.platform === 'win32') {
      // PowerShell: run command, capture $LASTEXITCODE
      return `& { ${command} }; $code=$LASTEXITCODE; Write-Output "${marker}$code"`;
    }

    // POSIX bash
    return `{ ${command}; } ; code=$?; echo "${marker}$code"`;
  }

  private HandleStdout(data: Buffer): void {
    const text = data.toString();
    this.stdoutBuffer += text;

    // Emit real-time logs to Socket.IO
    if (this.deploymentId && text.trim()) {
      SocketService.GetInstance().EmitDeploymentLog(this.deploymentId, text.trim());
    }

    if (!this.currentCommand) {
      return;
    }

    const marker = `__CMD_DONE__${this.currentCommand.id}__`;
    const idx = this.stdoutBuffer.indexOf(marker);
    if (idx !== -1) {
      // Split before marker is real stdout
      const before = this.stdoutBuffer.substring(0, idx);
      this.currentCommand.stdoutParts.push(before);

      // Parse exit code immediately after marker
      const afterMarker = this.stdoutBuffer.substring(idx + marker.length);
      const match = afterMarker.match(/^(-?\d+)/);
      const exitCode = match && match[1] ? parseInt(match[1], 10) : 0;

      // Remainder (after exit code) stays in buffer for potential next command
      const restIndex = match ? match[0].length : 0;
      this.stdoutBuffer = afterMarker.substring(restIndex);

      const stdoutResult = this.currentCommand.stdoutParts.join('');
      const stderrResult = this.currentCommand.stderrParts.join('');

      clearTimeout(this.currentCommand.timeout);

      if (exitCode === 0) {
        this.currentCommand.resolve({ stdout: stdoutResult, stderr: stderrResult });
      } else {
        this.currentCommand.reject(
          new Error(
            `Command failed with code ${exitCode}: ${stdoutResult}${
              stderrResult ? `\n${stderrResult}` : ''
            }`
          )
        );
      }

      this.currentCommand = null;
    } else {
      this.currentCommand.stdoutParts.push(text);
    }
  }

  private HandleStderr(data: Buffer): void {
    const text = data.toString();
    this.stderrBuffer += text;

    // Emit real-time error logs to Socket.IO
    if (this.deploymentId && text.trim()) {
      SocketService.GetInstance().EmitDeploymentLog(this.deploymentId, `[ERROR] ${text.trim()}`);
    }

    if (this.currentCommand) {
      this.currentCommand.stderrParts.push(text);
    }
  }
}

export default PipelineService;
