/**
 * Authentication Controller
 * Handles authentication related HTTP requests
 * Following SOLID principles and PascalCase naming convention
 */

import { Request, Response } from 'express';
import Joi from 'joi';
import AuthService, {
  MFA_CHALLENGE_TTL_MS,
  MfaChallengeError,
  RegistrationClosedError,
  TwoFactorLockedError,
} from '@Services/AuthService';
import SessionService from '@Services/SessionService';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import AppConfig from '@Config/AppConfig';
import type { IDeviceInfo } from '@Services/SessionService';

/**
 * Request body schemas for every /api/auth endpoint (SEC-C1).
 * Applied by AuthRoutes through ValidationMiddleware.ValidateBody, which runs
 * with `stripUnknown: true`, so unexpected fields such as `Role` never reach
 * a controller or service.
 */
export const AuthSchemas = {
  Register: Joi.object({
    Username: Joi.string()
      .trim()
      .min(3)
      .max(50)
      .pattern(/^[A-Za-z0-9_.-]+$/)
      .required()
      .messages({
        'string.pattern.base':
          'Username may only contain letters, digits, dot, underscore and hyphen',
      }),
    Email: Joi.string().trim().email({ tlds: { allow: false } }).max(100).required(),
    Password: Joi.string().min(1).max(128).required(),
  }),
  Login: Joi.object({
    Username: Joi.string().trim().min(1).max(255).required(),
    Password: Joi.string().min(1).max(1024).required(),
  }),
  // SEC-C3: the user comes from the mfa_pending cookie only. A legacy
  // `UserId` field is stripped and never used.
  VerifyTwoFactor: Joi.object({
    Code: Joi.string().trim().min(1).max(64).required(),
  }),
  Refresh: Joi.object({
    RefreshToken: Joi.string().max(4096).optional(),
  }),
  Logout: Joi.object({}),
  ChangePassword: Joi.object({
    OldPassword: Joi.string().min(1).max(1024).required(),
    NewPassword: Joi.string().min(1).max(128).required(),
  }),
};

/** httpOnly cookie carrying the password-step proof for /verify-2fa. */
export const MFA_COOKIE_NAME = 'mfa_pending';
const MFA_COOKIE_PATH = '/api/auth';

export class AuthController {
  private readonly AuthService: AuthService;
  private readonly SessionService: SessionService;
  private readonly Config = AppConfig;

  constructor() {
    this.AuthService = new AuthService();
    this.SessionService = new SessionService();
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
   * Set / clear the short-lived mfa_pending cookie (SEC-C3)
   */
  private SetMfaCookie(res: Response, token: string): void {
    const isProduction = this.Config.IsProduction();
    res.cookie(MFA_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: MFA_CHALLENGE_TTL_MS,
      path: MFA_COOKIE_PATH,
    });
  }

  private ClearMfaCookie(res: Response): void {
    res.clearCookie(MFA_COOKIE_NAME, { path: MFA_COOKIE_PATH });
  }

  /**
   * Clear authentication cookies
   */
  private ClearAuthCookies(res: Response): void {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
  }

  /**
   * Extract device info from request
   */
  private ExtractDeviceInfo(req: Request): IDeviceInfo {
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
                      req.socket.remoteAddress ||
                      'unknown';

    return {
      UserAgent: userAgent,
      IpAddress: ipAddress,
    };
  }

  /**
   * Public registration policy probe (SEC-C1).
   * GET /api/auth/registration-status
   *
   * Lets the login page decide whether to offer "Create account" and lets a
   * fresh install show the first-admin setup screen.
   */
  public GetRegistrationStatus = async (_req: Request, res: Response): Promise<void> => {
    try {
      const setupRequired = await this.AuthService.IsSetupRequired();
      ResponseHelper.Success(res, 'Registration status retrieved', {
        AllowRegistration: this.Config.AllowRegistration || setupRequired,
        SetupRequired: setupRequired,
      });
    } catch (error) {
      Logger.Error('Failed to get registration status', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve registration status');
    }
  };

  /**
   * Register a new user
   * POST /api/auth/register
   *
   * The body has already been validated and stripped by AuthSchemas.Register,
   * so a client-supplied `Role` is gone by the time we get here (SEC-C1).
   */
  public Register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { Username, Email, Password } = req.body as {
        Username: string;
        Email: string;
        Password: string;
      };

      const user = await this.AuthService.Register({ Username, Email, Password });

      const userData = user.toJSON();

      // Generate tokens
      const tokens = this.AuthService.GenerateTokens(user);

      // Set tokens in httpOnly cookies
      this.SetAuthCookies(res, tokens.AccessToken, tokens.RefreshToken);

      ResponseHelper.Created(res, 'User registered successfully', {
        User: {
          Id: userData.Id,
          Username: userData.Username,
          Email: userData.Email,
          Role: userData.Role,
        },
      });
    } catch (error) {
      if (error instanceof RegistrationClosedError) {
        ResponseHelper.Forbidden(res, error.message);
        return;
      }
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

      // Extract device info
      const deviceInfo = this.ExtractDeviceInfo(req);

      // Login - step 1 (credentials only)
      const result = await this.AuthService.Login({ Username, Password }, deviceInfo);

      const userData = result.User.toJSON();

      if (result.TwoFactorRequired && result.MfaToken) {
        // The second step is bound to this cookie. UserId stays in the body
        // only for compatibility with the bundled v3.0 UI, which refuses to
        // submit a code without it; /verify-2fa never reads it.
        this.SetMfaCookie(res, result.MfaToken);
        ResponseHelper.Success(res, 'Two-factor verification required', {
          TwoFactorRequired: true,
          UserId: userData.Id,
          Username: userData.Username,
          ExpiresInSeconds: Math.floor(MFA_CHALLENGE_TTL_MS / 1000),
        });
        return;
      }

      // Set tokens in httpOnly cookies
      this.SetAuthCookies(res, result.Tokens!.AccessToken, result.Tokens!.RefreshToken);

      ResponseHelper.Success(res, 'Login successful', {
        User: {
          Id: userData.Id,
          Username: userData.Username,
          FullName: userData.FullName,
          Email: userData.Email,
          Role: userData.Role,
          LastLogin: userData.LastLogin,
          TwoFactorEnabled: userData.TwoFactorEnabled,
        },
        SessionId: result.SessionId,
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
      const { Code } = req.body as { Code: string };
      const mfaToken: unknown = (req.cookies as Record<string, unknown> | undefined)?.[MFA_COOKIE_NAME];

      // Extract device info
      const deviceInfo = this.ExtractDeviceInfo(req);

      const result = await this.AuthService.CompleteTwoFactorLogin(mfaToken, Code, deviceInfo);

      const userData = result.User.toJSON();

      this.ClearMfaCookie(res);
      this.SetAuthCookies(res, result.Tokens.AccessToken, result.Tokens.RefreshToken);

      ResponseHelper.Success(res, 'Login successful', {
        User: {
          Id: userData.Id,
          Username: userData.Username,
          FullName: userData.FullName,
          Email: userData.Email,
          Role: userData.Role,
          LastLogin: userData.LastLogin,
          TwoFactorEnabled: userData.TwoFactorEnabled,
        },
        SessionId: result.SessionId,
      });
    } catch (error) {
      if (error instanceof TwoFactorLockedError) {
        this.ClearMfaCookie(res);
        ResponseHelper.Error(res, error.message, undefined, 429);
        return;
      }
      if (error instanceof MfaChallengeError) {
        this.ClearMfaCookie(res);
        ResponseHelper.Unauthorized(res, error.message);
        return;
      }
      ResponseHelper.Unauthorized(res, 'Invalid two-factor code');
    }
  };

  /**
   * Logout user by clearing cookies and deleting session
   * POST /api/auth/logout
   */
  public Logout = async (req: Request, res: Response): Promise<void> => {
    try {
      // Get refresh token from cookie
      const refreshToken = req.cookies?.refresh_token;

      // Delete session from database if token exists
      if (refreshToken) {
        try {
          // Verify and decode token to get user info
          const decoded = this.AuthService.VerifyRefreshToken(refreshToken);
          if (decoded?.UserId) {
            // Delete the user's current session
            await this.SessionService.DeleteCurrentSession(decoded.UserId);
            Logger.Info('Session deleted on logout', { userId: decoded.UserId });
          }
        } catch (sessionError) {
          // Log but don't fail logout if session deletion fails
          Logger.Warn('Failed to delete session on logout', sessionError as Error);
        }
      }

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

      const userData = user.toJSON();

      ResponseHelper.Success(res, 'Profile retrieved successfully', {
        User: {
          Id: userData.Id,
          Username: userData.Username,
          FullName: userData.FullName,
          Email: userData.Email,
          Role: userData.Role,
          IsActive: userData.IsActive,
          TwoFactorEnabled: userData.TwoFactorEnabled,
          LastLogin: userData.LastLogin,
          CreatedAt: userData.CreatedAt,
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
