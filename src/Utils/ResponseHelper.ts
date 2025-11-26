/**
 * Response Helper Utility
 * Standardized API response format
 * Following SOLID principles and PascalCase naming convention
 */

import { Response } from 'express';
import { IApiResponse } from '@Types/ICommon';
import Logger from './Logger';

export class ResponseHelper {
  /**
   * Send success response
   */
  public static Success<T>(
    res: Response,
    message: string = 'Success',
    data?: T,
    code: number = 200
  ): void {
    const response: IApiResponse<T> = {
      Success: true,
      Message: message,
      Data: data,
      Code: code,
    };

    res.status(code).json(response);
  }

  /**
   * Send error response
   */
  public static Error(
    res: Response,
    message: string = 'An error occurred',
    error?: string,
    code: number = 500
  ): void {
    const response: IApiResponse = {
      Success: false,
      Message: message,
      Error: error,
      Code: code,
    };

    Logger.Error(`API Error [${code}]: ${message}`, undefined, { error });
    res.status(code).json(response);
  }

  /**
   * Send validation error response
   */
  public static ValidationError(
    res: Response,
    message: string = 'Validation failed',
    errors?: Record<string, string>
  ): void {
    const response: IApiResponse = {
      Success: false,
      Message: message,
      Data: errors,
      Code: 400,
    };

    res.status(400).json(response);
  }

  /**
   * Send unauthorized response
   */
  public static Unauthorized(res: Response, message: string = 'Unauthorized'): void {
    const response: IApiResponse = {
      Success: false,
      Message: message,
      Code: 401,
    };

    res.status(401).json(response);
  }

  /**
   * Send forbidden response
   */
  public static Forbidden(res: Response, message: string = 'Forbidden'): void {
    const response: IApiResponse = {
      Success: false,
      Message: message,
      Code: 403,
    };

    res.status(403).json(response);
  }

  /**
   * Send not found response
   */
  public static NotFound(res: Response, message: string = 'Resource not found'): void {
    const response: IApiResponse = {
      Success: false,
      Message: message,
      Code: 404,
    };

    res.status(404).json(response);
  }

  /**
   * Send created response
   */
  public static Created<T>(res: Response, message: string = 'Resource created', data?: T): void {
    const response: IApiResponse<T> = {
      Success: true,
      Message: message,
      Data: data,
      Code: 201,
    };

    res.status(201).json(response);
  }

  /**
   * Send no content response
   */
  public static NoContent(res: Response): void {
    res.status(204).send();
  }
}

export default ResponseHelper;
