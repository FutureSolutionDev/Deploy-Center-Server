/**
 * Authentication Controller
 * Handles authentication related HTTP requests
 * Following SOLID principles and PascalCase naming convention
 */

import { Request, Response } from 'express';
import AuthService from '@Services/AuthService';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import AppConfig from '@Config/AppConfig';
import { EUserRole } from '@Types/ICommon';

export class AuthController {
  private readonly AuthService: AuthService;
  private readonly Config = AppConfig;

  constructor() {
    this.AuthService = new AuthService();
  }

  /**
   * Set authentication cookies
   */
  private SetAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const isProduction = this.Config.IsProduction();

    // Set Access Token Cookie (15 minutes)
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    // Set Refresh Token Cookie (7 days)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  /**
   * Clear authentication cookies
   */
  private ClearAuthCookies(res: Response): void {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
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

      // Set tokens in httpOnly cookies
      this.SetAuthCookies(res, tokens.AccessToken, tokens.RefreshToken);

      ResponseHelper.Created(res, 'User registered successfully', {
        User: {
          Id: user.get('Id') as number,
          Username: user.get('Username') as string,
          Email: user.get('Email') as string,
          Role: user.get('Role') as EUserRole,
        },
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

      // Login - step 1 (credentials only)
      const result = await this.AuthService.Login({ Username, Password });

      if (result.TwoFactorRequired) {
        ResponseHelper.Success(res, 'Two-factor verification required', {
          TwoFactorRequired: true,
          UserId: result.User.get('Id') as number,
          Username: result.User.get('Username') as string,
        });
        return;
      }

      // Set tokens in httpOnly cookies
      this.SetAuthCookies(res, result.Tokens!.AccessToken, result.Tokens!.RefreshToken);

      ResponseHelper.Success(res, 'Login successful', {
        User: {
          Id: result.User.get('Id') as number,
          Username: result.User.get('Username') as string,
          FullName: result.User.get('FullName') as string,
          Email: result.User.get('Email') as string,
          Role: result.User.get('Role') as EUserRole,
          LastLogin: result.User.get('LastLogin') as Date,
          TwoFactorEnabled: result.User.get('TwoFactorEnabled') as boolean,
        },
      });
    } catch (error) {
      Logger.Error('Login failed', error as Error);
      ResponseHelper.Unauthorized(res, (error as Error).message);
    }
  };

  /**
   * Verify 2FA code and complete login
   * POST /api/auth/verify-2fa
   */
  public VerifyTwoFactor = async (req: Request, res: Response): Promise<void> => {
    try {
      const { UserId, Code } = req.body;

      if (!UserId || !Code) {
        ResponseHelper.ValidationError(res, 'Missing required fields', {
          UserId: !UserId ? 'UserId is required' : '',
          Code: !Code ? 'Two-factor code is required' : '',
        });
        return;
      }

      const result = await this.AuthService.CompleteTwoFactorLogin(UserId, Code);

      this.SetAuthCookies(res, result.Tokens.AccessToken, result.Tokens.RefreshToken);

      ResponseHelper.Success(res, 'Login successful', {
        User: {
          Id: result.User.get('Id') as number,
          Username: result.User.get('Username') as string,
          FullName: result.User.get('FullName') as string,
          Email: result.User.get('Email') as string,
          Role: result.User.get('Role') as EUserRole,
          LastLogin: result.User.get('LastLogin') as Date,
          TwoFactorEnabled: result.User.get('TwoFactorEnabled') as boolean,
        },
      });
    } catch (error) {
      Logger.Error('Two-factor verification failed', error as Error);
      ResponseHelper.Unauthorized(res, (error as Error).message);
    }
  };

  /**
   * Logout user by clearing cookies
   * POST /api/auth/logout
   */
  public Logout = async (_req: Request, res: Response): Promise<void> => {
    try {
      this.ClearAuthCookies(res);
      ResponseHelper.Success(res, 'Logged out successfully');
    } catch (error) {
      Logger.Error('Logout failed', error as Error);
      ResponseHelper.Error(res, 'Logout failed');
    }
  };

  /**
   * Refresh access token using refresh token from cookie
   * POST /api/auth/refresh
   */
  public RefreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      // Get refresh token from cookie (preferred) or body (fallback)
      let refreshToken = req.cookies?.refresh_token;

      if (!refreshToken) {
        // Fallback to body for backward compatibility
        refreshToken = req.body?.RefreshToken;
      }

      if (!refreshToken) {
        ResponseHelper.ValidationError(res, 'Refresh token is required');
        return;
      }

      const tokens = await this.AuthService.RefreshAccessToken(refreshToken);

      // Update cookies with new tokens
      this.SetAuthCookies(res, tokens.AccessToken, tokens.RefreshToken);

      ResponseHelper.Success(res, 'Token refreshed successfully');
    } catch (error) {
      Logger.Error('Token refresh failed', error as Error);
      // Clear invalid cookies
      this.ClearAuthCookies(res);
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
