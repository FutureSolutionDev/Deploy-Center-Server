/**
 * Pipeline Service
 * Handles pipeline execution, variable replacement, and command execution
 * Following SOLID principles and PascalCase naming convention
 */

import { spawn } from 'child_process';
import Logger from '@Utils/Logger';
import { IDeploymentContext, IPipelineStep } from '@Types/ICommon';
import { DeploymentStep } from '@Models/index';
import { EStepStatus } from '@Types/ICommon';

export interface IPipelineExecutionResult {
  Success: boolean;
  CompletedSteps: number;
  TotalSteps: number;
  Duration: number;
  ErrorMessage?: string;
}

export class PipelineService {
  private readonly RunningPids: Set<number> = new Set();

  /**
   * Execute a complete pipeline
   */
  public async ExecutePipeline(
    deploymentId: number,
    pipeline: IPipelineStep[],
    context: IDeploymentContext,
    projectPath: string
  ): Promise<IPipelineExecutionResult> {
    const startTime = Date.now();
    let completedSteps = 0;
    const totalSteps = pipeline.length;

    try {
      Logger.Deployment(`Starting pipeline execution for deployment ${deploymentId}`, {
        deploymentId,
        totalSteps,
      });

      for (let i = 0; i < pipeline.length; i++) {
        const step = pipeline[i]!;
        const stepNumber = i + 1;

        Logger.Deployment(`Executing step ${stepNumber}/${totalSteps}: ${step.Name}`, {
          deploymentId,
          stepNumber,
        });

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

          for (const command of step.Run) {
            const replacedCommand = this.ReplaceVariables(command, context);
            Logger.Debug(`Executing command: ${replacedCommand}`, { deploymentId, stepNumber });

            try {
              const { stdout, stderr } = await this.RunCommandWithTracking(
                replacedCommand,
                projectPath
              );

              if (stdout) outputs.push(stdout);
              if (stderr) errors.push(stderr);
            } catch (cmdError: any) {
              errors.push(cmdError.message);
              if (cmdError.stdout) outputs.push(cmdError.stdout);
              if (cmdError.stderr) errors.push(cmdError.stderr);
              throw cmdError;
            }
          }

          const stepDuration = Math.round((Date.now() - stepStartTime) / 1000);

          // Update step as success
          await stepRecord.update({
            Status: EStepStatus.Success,
            CompletedAt: new Date(),
            Duration: stepDuration,
            Output: outputs.join('\n'),
            Error: errors.length > 0 ? errors.join('\n') : undefined,
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

        // Best-effort: kill any running child processes spawned by this pipeline
        await this.KillAllRunningProcesses();

        Logger.Error(`Step ${stepNumber} failed`, stepError as Error, {
          deploymentId,
          stepNumber,
        });

          throw new Error(`Step ${stepNumber} (${step.Name}) failed: ${stepError.message}`);
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      Logger.Deployment(`Pipeline execution completed successfully`, {
        deploymentId,
        completedSteps,
        totalSteps,
        duration,
      });

      return {
        Success: true,
        CompletedSteps: completedSteps,
        TotalSteps: totalSteps,
        Duration: duration,
      };
    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000);

      Logger.Error('Pipeline execution failed', error as Error, {
        deploymentId,
        completedSteps,
        totalSteps,
      });

      return {
        Success: false,
        CompletedSteps: completedSteps,
        TotalSteps: totalSteps,
        Duration: duration,
        ErrorMessage: (error as Error).message,
      };
    }
  }

  /**
   * Execute command with process tracking to allow cleanup on failure.
   */
  private async RunCommandWithTracking(
    command: string,
    cwd: string,
    timeoutMs: number = 10 * 60 * 1000 // 10 minutes
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, {
        cwd,
        shell: true,
        windowsHide: true,
      });

      if (child.pid) {
        this.RunningPids.add(child.pid);
      }

      let stdout = '';
      let stderr = '';
      let finished = false;

      const timer = setTimeout(() => {
        if (!finished) {
          this.KillProcessTree(child.pid);
          finished = true;
          reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
        }
      }, timeoutMs);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        this.RunningPids.delete(child.pid as number);
        reject(err);
      });

      child.on('close', (code, signal) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        this.RunningPids.delete(child.pid as number);

        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(
            new Error(
              `Command failed with code ${code}${signal ? ` (signal ${signal})` : ''}: ${command}\n${stderr}`
            )
          );
        }
      });
    });
  }

  /**
   * Kill a single process tree by PID (best effort, platform-aware)
   */
  private KillProcessTree(pid?: number): void {
    if (!pid) return;

    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true });
      } else {
        // Send SIGTERM to the group, fallback to direct kill
        try {
          process.kill(-pid, 'SIGTERM');
        } catch {
          process.kill(pid, 'SIGTERM');
        }
      }
    } catch (err) {
      Logger.Warn('Failed to kill process tree', { pid, error: (err as Error).message });
    }
  }

  /**
   * Kill all tracked running processes (best effort)
   */
  private async KillAllRunningProcesses(): Promise<void> {
    if (this.RunningPids.size === 0) return;

    for (const pid of Array.from(this.RunningPids)) {
      this.KillProcessTree(pid);
      this.RunningPids.delete(pid);
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

export default PipelineService;
