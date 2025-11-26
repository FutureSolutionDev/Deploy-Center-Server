/**
 * Request Logger Middleware
 * Logs HTTP requests for monitoring and debugging
 * Following SOLID principles and PascalCase naming convention
 */

import { Request, Response, NextFunction } from 'express';
import Logger from '@Utils/Logger';

export class RequestLoggerMiddleware {
  /**
   * Log incoming HTTP requests
   */
  public LogRequest = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // Log request
    Logger.Info('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: (req as any).user?.UserId,
    });

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;

      const logData = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userId: (req as any).user?.UserId,
      };

      if (res.statusCode >= 500) {
        Logger.Error('Request completed with server error', undefined, logData);
      } else if (res.statusCode >= 400) {
        Logger.Warn('Request completed with client error', logData);
      } else {
        Logger.Info('Request completed', logData);
      }
    });

    next();
  };

  /**
   * Log only errors
   */
  public LogErrorsOnly = (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        const duration = Date.now() - (req as any).startTime;

        Logger.Warn('Request failed', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userId: (req as any).user?.UserId,
        });
      }
    });

    (req as any).startTime = Date.now();
    next();
  };
}

export default RequestLoggerMiddleware;
