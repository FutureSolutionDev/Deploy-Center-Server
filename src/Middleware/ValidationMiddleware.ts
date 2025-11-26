/**
 * Validation Middleware
 * Validates request data using Joi schemas
 * Following SOLID principles and PascalCase naming convention
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';

export class ValidationMiddleware {
  /**
   * Validate request body against Joi schema
   */
  public ValidateBody = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errors: Record<string, string> = {};
        error.details.forEach((detail) => {
          const key = detail.path.join('.');
          errors[key] = detail.message;
        });

        Logger.Warn('Request validation failed', { errors });
        ResponseHelper.ValidationError(res, 'Validation failed', errors);
        return;
      }

      // Replace body with validated/sanitized value
      req.body = value;
      next();
    };
  };

  /**
   * Validate request query parameters against Joi schema
   */
  public ValidateQuery = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errors: Record<string, string> = {};
        error.details.forEach((detail) => {
          const key = detail.path.join('.');
          errors[key] = detail.message;
        });

        Logger.Warn('Query validation failed', { errors });
        ResponseHelper.ValidationError(res, 'Validation failed', errors);
        return;
      }

      req.query = value;
      next();
    };
  };

  /**
   * Validate request params against Joi schema
   */
  public ValidateParams = (schema: Joi.ObjectSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const { error, value } = schema.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errors: Record<string, string> = {};
        error.details.forEach((detail) => {
          const key = detail.path.join('.');
          errors[key] = detail.message;
        });

        Logger.Warn('Params validation failed', { errors });
        ResponseHelper.ValidationError(res, 'Validation failed', errors);
        return;
      }

      req.params = value;
      next();
    };
  };
}

export default ValidationMiddleware;
