/**
 * Authentication Middleware
 * Validates JWT tokens and attaches user to request
 * Following SOLID principles and PascalCase naming convention
 */

import { Request, Response, NextFunction } from 'express';
import AuthService from '@Services/AuthService';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';

export class AuthMiddleware {
  private readonly AuthService: AuthService;

  constructor() {
    this.AuthService = new AuthService();
  }

  /**
   * Authenticate request using JWT token
   */
  public Authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        ResponseHelper.Unauthorized(res, 'No token provided');
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      try {
        // Verify token
        const payload = this.AuthService.VerifyAccessToken(token);

        // Get user from database
        const user = await this.AuthService.GetUserById(payload.UserId);

        if (!user) {
          ResponseHelper.Unauthorized(res, 'User not found');
          return;
        }

        if (!user.IsActive) {
          ResponseHelper.Unauthorized(res, 'User account is disabled');
          return;
        }

        // Attach user to request
        (req as any).user = {
          UserId: user.Id,
          Username: user.Username,
          Email: user.Email,
          Role: user.Role,
        };

        next();
      } catch (error) {
        ResponseHelper.Unauthorized(res, 'Invalid or expired token');
        return;
      }
    } catch (error) {
      Logger.Error('Authentication error', error as Error);
      ResponseHelper.Error(res, 'Authentication failed');
    }
  };

  /**
   * Optional authentication - attaches user if token is valid, but doesn't block request
   */
  public OptionalAuthenticate = async (
    req: Request,
    _: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        try {
          const payload = this.AuthService.VerifyAccessToken(token);
          const user = await this.AuthService.GetUserById(payload.UserId);

          if (user && user.IsActive) {
            (req as any).user = {
              UserId: user.Id,
              Username: user.Username,
              Email: user.Email,
              Role: user.Role,
            };
          }
        } catch (error) {
          // Silently fail - optional auth
        }
      }

      next();
    } catch (error) {
      Logger.Error('Optional authentication error', error as Error);
      next();
    }
  };
}

export default AuthMiddleware;
