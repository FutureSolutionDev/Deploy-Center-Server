/**
 * Role Middleware
 * Validates user roles for authorization
 * Following SOLID principles and PascalCase naming convention
 */

import { Request, Response, NextFunction } from 'express';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import { EUserRole } from '@Types/ICommon';

export class RoleMiddleware {
  /**
   * Require specific role(s) to access endpoint
   */
  public RequireRole = (allowedRoles: EUserRole[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const user = (req as any).user;

        if (!user) {
          ResponseHelper.Unauthorized(res, 'Authentication required');
          return;
        }

        if (!allowedRoles.includes(user.Role)) {
          Logger.Warn('Access denied - insufficient role', {
            userId: user.UserId,
            userRole: user.Role,
            requiredRoles: allowedRoles,
          });
          ResponseHelper.Forbidden(res, 'Insufficient permissions');
          return;
        }

        next();
      } catch (error) {
        Logger.Error('Role validation error', error as Error);
        ResponseHelper.Error(res, 'Authorization failed');
      }
    };
  };

  /**
   * Require admin role
   */
  public RequireAdmin = this.RequireRole([EUserRole.Admin]);

  /**
   * Require admin or developer role
   */
  public RequireAdminOrDeveloper = this.RequireRole([EUserRole.Admin, EUserRole.Developer]);

  /**
   * Check if user is admin
   */
  public IsAdmin = (req: Request): boolean => {
    const user = (req as any).user;
    return user?.Role === EUserRole.Admin;
  };

  /**
   * Check if user is developer or admin
   */
  public IsDeveloperOrAdmin = (req: Request): boolean => {
    const user = (req as any).user;
    return user?.Role === EUserRole.Admin || user?.Role === EUserRole.Developer;
  };
}

export default RoleMiddleware;
