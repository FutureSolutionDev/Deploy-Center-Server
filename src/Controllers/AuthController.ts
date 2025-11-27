/**
 * Authentication Controller
 * Handles authentication related HTTP requests
 * Following SOLID principles and PascalCase naming convention
 */

import { Request, Response } from 'express';
import AuthService from '@Services/AuthService';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import { EUserRole } from '@Types/ICommon';

export class AuthController {
  private readonly AuthService: AuthService;

  constructor() {
    this.AuthService = new AuthService();
  }

  /**
   * Register a new user
   * POST /api/auth/register
   */
  public Register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { Username, Email, Password, Role } = req.body;

      // Validate required fields
      if (!Username || !Email || !Password) {
        ResponseHelper.ValidationError(res, 'Missing required fields', {
          Username: !Username ? 'Username is required' : '',
          Email: !Email ? 'Email is required' : '',
          Password: !Password ? 'Password is required' : '',
        });
        return;
      }

      // Register user
      const user = await this.AuthService.Register({
        Username,
        Email,
        Password,
        Role,
      });

      // Generate tokens
      const tokens = this.AuthService.GenerateTokens(user);

      ResponseHelper.Created(res, 'User registered successfully', {
        User: {
          Id: user.get('Id') as number,
          Username: user.get('Username') as string,
          Email: user.get('Email') as string,
          Role: user.get('Role') as EUserRole,
        },
        Tokens: tokens,
      });
    } catch (error) {
      Logger.Error('Registration failed', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * Login user
   * POST /api/auth/login
   */
  public Login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { Username, Password } = req.body;

      // Validate required fields
      if (!Username || !Password) {
        ResponseHelper.ValidationError(res, 'Missing required fields', {
          Username: !Username ? 'Username is required' : '',
          Password: !Password ? 'Password is required' : '',
        });
        return;
      }

      // Login
      const result = await this.AuthService.Login({ Username, Password });

      ResponseHelper.Success(res, 'Login successful', {
        User: {
          Id: result.User.get('Id') as number,
          Username: result.User.get('Username') as string,
          Email: result.User.get('Email') as string,
          Role: result.User.get('Role') as EUserRole,
          LastLogin: result.User.get('LastLogin') as Date,
        },
        Tokens: result.Tokens,
      });
    } catch (error) {
      Logger.Error('Login failed', error as Error);
      ResponseHelper.Unauthorized(res, (error as Error).message);
    }
  };

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  public RefreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { RefreshToken } = req.body;

      if (!RefreshToken) {
        ResponseHelper.ValidationError(res, 'Refresh token is required');
        return;
      }

      const tokens = await this.AuthService.RefreshAccessToken(RefreshToken);

      ResponseHelper.Success(res, 'Token refreshed successfully', { Tokens: tokens });
    } catch (error) {
      Logger.Error('Token refresh failed', error as Error);
      ResponseHelper.Unauthorized(res, (error as Error).message);
    }
  };

  /**
   * Get current user profile
   * GET /api/auth/profile
   */
  public GetProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      // User is attached to request by auth middleware
      const userId = (req as any).user?.UserId;

      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      const user = await this.AuthService.GetUserById(userId);

      if (!user) {
        ResponseHelper.NotFound(res, 'User not found');
        return;
      }

      ResponseHelper.Success(res, 'Profile retrieved successfully', {
        User: {
          Id: user.get('Id') as number,
          Username: user.get('Username') as string,
          Email: user.get('Email') as string,
          Role: user.get('Role') as EUserRole,
          IsActive: user.get('IsActive') as boolean,
          TwoFactorEnabled: user.get('TwoFactorEnabled') as boolean,
          LastLogin: user.get('LastLogin') as Date,
          CreatedAt: user.get('CreatedAt') as Date,
        },
      });
    } catch (error) {
      Logger.Error('Failed to get profile', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve profile');
    }
  };

  /**
   * Change password
   * POST /api/auth/change-password
   */
  public ChangePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      const { OldPassword, NewPassword } = req.body;

      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      if (!OldPassword || !NewPassword) {
        ResponseHelper.ValidationError(res, 'Missing required fields', {
          OldPassword: !OldPassword ? 'Old password is required' : '',
          NewPassword: !NewPassword ? 'New password is required' : '',
        });
        return;
      }

      await this.AuthService.ChangePassword(userId, OldPassword, NewPassword);

      ResponseHelper.Success(res, 'Password changed successfully');
    } catch (error) {
      Logger.Error('Password change failed', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };
}

export default AuthController;
