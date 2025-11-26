/**
 * Error Handler Middleware
 * Global error handling for Express application
 * Following SOLID principles and PascalCase naming convention
 */

import { Request, Response, NextFunction } from 'express';
import Logger from '@Utils/Logger';
import ResponseHelper from '@Utils/ResponseHelper';

export class ErrorHandlerMiddleware {
  /**
   * Global error handler
   */
  public HandleError = (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    Logger.Error('Unhandled error', error, {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: (req as any).user?.UserId,
    });

    // Check if response already sent
    if (res.headersSent) {
      return next(error);
    }

    // Handle specific error types
    if (error.name === 'ValidationError') {
      ResponseHelper.ValidationError(res, error.message);
      return;
    }

    if (error.name === 'UnauthorizedError') {
      ResponseHelper.Unauthorized(res, 'Invalid or expired token');
      return;
    }

    if (error.name === 'ForbiddenError') {
      ResponseHelper.Forbidden(res, 'Access denied');
      return;
    }

    if (error.name === 'NotFoundError') {
      ResponseHelper.NotFound(res, error.message);
      return;
    }

    // Default to 500 Internal Server Error
    ResponseHelper.Error(res, 'An unexpected error occurred', error.message, 500);
  };

  /**
   * Handle 404 Not Found
   */
  public Handle404 = (req: Request, res: Response): void => {
    Logger.Warn('Route not found', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    ResponseHelper.NotFound(res, `Route ${req.method} ${req.path} not found`);
  };

  /**
   * Async error wrapper
   * Wraps async route handlers to catch errors
   */
  public AsyncWrapper = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };
}

export default ErrorHandlerMiddleware;
