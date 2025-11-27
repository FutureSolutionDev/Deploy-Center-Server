/**
 * Authentication Middleware
 * Validates JWT tokens and attaches user to request
 * Following SOLID principles and PascalCase naming convention
 */

import { Request, Response, NextFunction } from 'express';
import AuthService from '@Services/AuthService';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import { EUserRole } from '@Types/ICommon';

export class AuthMiddleware {
  private readonly AuthService: AuthService;

  constructor() {
    this.AuthService = new AuthService();
  }

  /**
   * Authenticate request using JWT token from httpOnly cookie
   */
  public Authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Try to get token from cookie first (preferred method)
      let token = req.cookies?.access_token;

      // Fallback to Authorization header for backward compatibility
      if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7); // Remove 'Bearer ' prefix
          Logger.Debug('Using token from Authorization header (deprecated)');
        }
      }

      if (!token) {
        ResponseHelper.Unauthorized(res, 'No token provided');
        return;
      }

      try {
        // Verify token
        const payload = this.AuthService.VerifyAccessToken(token);

        // Get user from database
        const user = await this.AuthService.GetUserById(payload.UserId);

        if (!user) {
          ResponseHelper.Unauthorized(res, 'User not found');
          return;
        }

        if (!user.get('IsActive')) {
          ResponseHelper.Unauthorized(res, 'User account is disabled');
          return;
        }

        // Attach user to request
        (req as any).user = {
          UserId: user.get('Id') as number,
          Username: user.get('Username') as string,
          Email: user.get('Email') as string,
          Role: user.get('Role') as EUserRole,
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
      // Try to get token from cookie first
      let token = req.cookies?.access_token;

      // Fallback to Authorization header
      if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

      if (token) {
        try {
          const payload = this.AuthService.VerifyAccessToken(token);
          const user = await this.AuthService.GetUserById(payload.UserId);

          if (user && user.get('IsActive')) {
            (req as any).user = {
              UserId: user.get('Id') as number,
              Username: user.get('Username') as string,
              Email: user.get('Email') as string,
              Role: user.get('Role') as EUserRole,
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
