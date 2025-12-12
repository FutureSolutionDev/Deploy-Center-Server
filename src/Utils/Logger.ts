/**
 * Logger Utility using Winston
 * Singleton pattern with multiple transports
 * Following SOLID principles and PascalCase naming convention
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import AppConfig from '@Config/AppConfig';

export class Logger {
  private static Instance: winston.Logger;

  private constructor() {}

  /**
   * Get Winston logger instance (Singleton)
   */
  public static GetInstance(): winston.Logger {
    if (!Logger.Instance) {
      Logger.Instance = Logger.CreateLogger();
    }
    return Logger.Instance;
  }

  /**
   * Create Winston logger with configured transports
   */
  private static CreateLogger(): winston.Logger {
    const config = AppConfig;

    // Ensure log directory exists
    if (!fs.existsSync(config.Logging.Directory)) {
      fs.mkdirSync(config.Logging.Directory, { recursive: true });
    }

    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
        let msg = `[${timestamp}] [${level.toUpperCase()}]: ${message}`;

        // Add metadata if present
        if (Object.keys(metadata).length > 0) {
          msg += ` ${JSON.stringify(metadata)}`;
        }

        // Add stack trace for errors
        if (stack) {
          msg += `\n${stack}`;
        }

        return msg;
      })
    );

    // Create transports
    const transports: winston.transport[] = [
      // Console transport (colored for development)
      new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), logFormat),
      }),

      // All logs file (rotating daily)
      new DailyRotateFile({
        filename: path.join(config.Logging.Directory, 'combined/%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxFiles: config.Logging.MaxFiles,
        maxSize: config.Logging.MaxSize,
        format: logFormat,
      }),

      // Error logs file (rotating daily)
      new DailyRotateFile({
        level: 'error',
        filename: path.join(config.Logging.Directory, 'error/%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxFiles: config.Logging.MaxFiles,
        maxSize: config.Logging.MaxSize,
        format: logFormat,
      }),

      // Deployment logs file (custom level, rotating daily)
      new DailyRotateFile({
        level: 'info',
        filename: path.join(config.Logging.Directory, 'deployment/%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxFiles: config.Logging.MaxFiles,
        maxSize: config.Logging.MaxSize,
        format: logFormat,
      }),
    ];

    // Create and return logger
    return winston.createLogger({
      level: config.Logging.Level,
      transports,
      exitOnError: false,
    });
  }

  /**
   * Log info message
   */
  public static Info(message: string, metadata?: Record<string, any>): void {
    Logger.GetInstance().info(message, metadata);
  }

  /**
   * Log error message
   */
  public static Error(message: string, error?: Error, metadata?: Record<string, any>): void {
    if (error) {
      Logger.GetInstance().error(message, { ...metadata, error: error.message, stack: error.stack });
    } else {
      Logger.GetInstance().error(message, metadata);
    }
  }

  /**
   * Log warning message
   */
  public static Warn(message: string, metadata?: Record<string, any>): void {
    Logger.GetInstance().warn(message, metadata);
  }

  /**
   * Log debug message
   */
  public static Debug(message: string, metadata?: Record<string, any>): void {
    Logger.GetInstance().debug(message, metadata);
  }

  /**
   * Log deployment-specific message
   */
  public static Deployment(message: string, metadata?: Record<string, any>): void {
    Logger.GetInstance().info(`[DEPLOYMENT] ${message}`, metadata);
  }

  /**
   * Create child logger with default metadata
   */
  public static CreateChildLogger(defaultMeta: Record<string, any>): winston.Logger {
    return Logger.GetInstance().child(defaultMeta);
  }
}

// Export default instance methods for convenience
export default {
  Info: Logger.Info.bind(Logger),
  Error: Logger.Error.bind(Logger),
  Warn: Logger.Warn.bind(Logger),
  Debug: Logger.Debug.bind(Logger),
  Deployment: Logger.Deployment.bind(Logger),
  CreateChildLogger: Logger.CreateChildLogger.bind(Logger),
};
