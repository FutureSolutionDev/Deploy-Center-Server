/**
 * Log Formatter Utility
 * Provides standardized deployment log formatting with timestamps, levels, and phases
 * Format: [YYYY-MM-DD HH:mm:ss] [LEVEL] [PHASE] Message
 */

import os from 'os';

/**
 * Log levels with colors (ANSI codes for terminal output)
 */
export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

/**
 * Deployment phases
 */
export enum LogPhase {
  INIT = 'INIT',
  CLONE = 'CLONE',
  PIPELINE = 'PIPELINE',
  STEP = 'STEP',
  SYNC = 'SYNC',
  POST_PIPELINE = 'POST-PIPELINE',
  CLEANUP = 'CLEANUP',
  COMPLETE = 'COMPLETE',
}

/**
 * Color codes for different log levels
 */
const COLORS = {
  INFO: '\x1b[34m',     // Blue
  SUCCESS: '\x1b[32m',  // Green
  WARN: '\x1b[33m',     // Yellow
  ERROR: '\x1b[31m',    // Red
  DEBUG: '\x1b[90m',    // Gray
  RESET: '\x1b[0m',
};

export class LogFormatter {
  /**
   * Format timestamp as [YYYY-MM-DD HH:mm:ss]
   */
  private static FormatTimestamp(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Format a log message with timestamp, level, and phase
   * @param level Log level (INFO, SUCCESS, WARN, ERROR, DEBUG)
   * @param phase Deployment phase (INIT, CLONE, PIPELINE, etc.)
   * @param message The log message
   * @param useColors Whether to include ANSI color codes (default: false for database storage)
   */
  public static Format(
    level: LogLevel,
    phase: LogPhase,
    message: string,
    useColors: boolean = false
  ): string {
    const timestamp = this.FormatTimestamp();

    if (useColors) {
      const color = COLORS[level];
      const reset = COLORS.RESET;
      return `[${timestamp}] ${color}[${level}]${reset} [${phase}] ${message}`;
    }

    return `[${timestamp}] [${level}] [${phase}] ${message}`;
  }

  /**
   * Log INFO message
   */
  public static Info(phase: LogPhase, message: string, useColors: boolean = false): string {
    return this.Format(LogLevel.INFO, phase, message, useColors);
  }

  /**
   * Log SUCCESS message
   */
  public static Success(phase: LogPhase, message: string, useColors: boolean = false): string {
    return this.Format(LogLevel.SUCCESS, phase, message, useColors);
  }

  /**
   * Log WARN message
   */
  public static Warn(phase: LogPhase, message: string, useColors: boolean = false): string {
    return this.Format(LogLevel.WARN, phase, message, useColors);
  }

  /**
   * Log ERROR message
   */
  public static Error(phase: LogPhase, message: string, useColors: boolean = false): string {
    return this.Format(LogLevel.ERROR, phase, message, useColors);
  }

  /**
   * Log DEBUG message
   */
  public static Debug(phase: LogPhase, message: string, useColors: boolean = false): string {
    return this.Format(LogLevel.DEBUG, phase, message, useColors);
  }

  /**
   * Format deployment initialization header with project information
   */
  public static FormatInitHeader(params: {
    projectName: string;
    projectId: number;
    branch: string;
    commitHash: string;
    environment?: string;
    deploymentPaths: string[];
    triggeredBy: string;
    osUser: string;
  }): string {
    const lines: string[] = [];

    lines.push(this.Info(LogPhase.INIT, `Deployment started for project: ${params.projectName}`));
    lines.push(this.Info(LogPhase.INIT, `Project ID: ${params.projectId}`));
    lines.push(this.Info(LogPhase.INIT, `Branch: ${params.branch}`));
    lines.push(this.Info(LogPhase.INIT, `Commit: ${params.commitHash}`));

    if (params.environment) {
      lines.push(this.Info(LogPhase.INIT, `Environment: ${params.environment}`));
    }

    lines.push(this.Info(LogPhase.INIT, `Triggered by: ${params.triggeredBy}`));
    lines.push(this.Info(LogPhase.INIT, `OS User: ${params.osUser}`));
    lines.push(this.Info(LogPhase.INIT, `Deployment paths (${params.deploymentPaths.length}):`));

    params.deploymentPaths.forEach((path, index) => {
      lines.push(this.Info(LogPhase.INIT, `  ${index + 1}. ${path}`));
    });

    return lines.join('\n');
  }

  /**
   * Format command execution (show command before executing)
   */
  public static FormatCommand(command: string, phase: LogPhase = LogPhase.STEP): string {
    return this.Info(phase, `$ ${command}`);
  }

  /**
   * Format command output
   */
  public static FormatCommandOutput(output: string, phase: LogPhase = LogPhase.STEP): string {
    // Split output by lines and prefix each line
    const lines = output.trim().split('\n');
    return lines.map(line => this.Info(phase, line)).join('\n');
  }

  /**
   * Format command error
   */
  public static FormatCommandError(error: string, exitCode?: number, phase: LogPhase = LogPhase.STEP): string {
    const lines: string[] = [];

    // Split error by lines and format each
    const errorLines = error.trim().split('\n');
    errorLines.forEach(line => {
      lines.push(this.Error(phase, line));
    });

    if (exitCode !== undefined) {
      lines.push(this.Error(phase, `Exit code: ${exitCode}`));
    }

    return lines.join('\n');
  }

  /**
   * Format step header (e.g., "Step 1/5: Install Dependencies")
   */
  public static FormatStepHeader(stepNumber: number, totalSteps: number, stepName: string): string {
    return this.Info(LogPhase.STEP, `Step ${stepNumber}/${totalSteps}: ${stepName}`);
  }

  /**
   * Format pipeline start
   */
  public static FormatPipelineStart(stepCount: number, pipelineName: string = 'Pre-deployment'): string {
    return this.Info(LogPhase.PIPELINE, `Starting ${pipelineName} pipeline (${stepCount} steps)`);
  }

  /**
   * Format pipeline complete
   */
  public static FormatPipelineComplete(pipelineName: string = 'Pre-deployment', duration?: number): string {
    const durationStr = duration ? ` (${duration}s)` : '';
    return this.Success(LogPhase.PIPELINE, `${pipelineName} pipeline completed successfully${durationStr}`);
  }

  /**
   * Format pipeline failure
   */
  public static FormatPipelineFailure(stepNumber: number, totalSteps: number, pipelineName: string = 'Pipeline'): string {
    return this.Error(LogPhase.PIPELINE, `${pipelineName} failed at step ${stepNumber}/${totalSteps}`);
  }

  /**
   * Format deployment complete
   */
  public static FormatDeploymentComplete(duration: number, success: boolean): string {
    if (success) {
      return this.Success(LogPhase.COMPLETE, `Deployment completed successfully (${duration}s)`);
    } else {
      return this.Error(LogPhase.COMPLETE, `Deployment failed (${duration}s)`);
    }
  }

  /**
   * Format SSH authentication info
   */
  public static FormatSSHAuth(fingerprint: string): string {
    return this.Info(LogPhase.CLONE, `Using SSH key authentication (fingerprint: ${fingerprint.substring(0, 16)}...)`);
  }

  /**
   * Format OS user info
   */
  public static FormatOSUser(): string {
    const osUser = os.userInfo().username;
    const platform = os.platform();
    const hostname = os.hostname();

    return this.Info(
      LogPhase.INIT,
      `Running as: ${osUser}@${hostname} (${platform})`
    );
  }

  /**
   * Format duration
   */
  public static FormatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Format warning section
   */
  public static FormatWarnings(warnings: string[]): string {
    if (warnings.length === 0) {
      return '';
    }

    const lines: string[] = [];
    lines.push(this.Warn(LogPhase.COMPLETE, '=== Warnings ==='));

    warnings.forEach((warning, index) => {
      lines.push(this.Warn(LogPhase.COMPLETE, `${index + 1}. ${warning}`));
    });

    return lines.join('\n');
  }

  /**
   * Format separator line
   */
  public static Separator(phase: LogPhase = LogPhase.INIT): string {
    return this.Info(phase, '========================================');
  }
}

export default LogFormatter;
