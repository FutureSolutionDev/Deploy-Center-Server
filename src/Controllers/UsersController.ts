/**
 * Users Controller
 * Handles user profile, settings, API keys, and session management endpoints
 */

import { Request, Response } from 'express';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import UserSettingsService, {
  INotificationSettingsUpdate,
  IUserPreferencesUpdate,
} from '@Services/UserSettingsService';
import UserProfileService from '@Services/UserProfileService';
import ApiKeysService, { IApiKeyUpdate } from '@Services/ApiKeysService';
import SessionService from '@Services/SessionService';
import TwoFactorAuthService from '@Services/TwoFactorAuthService';
import SocketService from '@Services/SocketService';
import { ApiKey, UserSettings } from '@Models/index';

export class UsersController {
  private readonly UserSettingsService: UserSettingsService;
  private readonly UserProfileService: UserProfileService;
  private readonly ApiKeysService: ApiKeysService;
  private readonly SessionService: SessionService;
  private readonly TwoFactorAuthService: TwoFactorAuthService;

  constructor() {
    this.UserSettingsService = new UserSettingsService();
    this.UserProfileService = new UserProfileService();
    this.ApiKeysService = new ApiKeysService();
    this.SessionService = new SessionService();
    this.TwoFactorAuthService = new TwoFactorAuthService();
  }

  /**
   * Remove sensitive fields from user object before returning to client
   */
  private SerializeUser(user: any): Record<string, any> {
    if (!user) {
      return {};
    }

    const plain = (user.toJSON ? user.toJSON() : user) as Record<string, any>;
    const { PasswordHash, TwoFactorSecret, ...rest } = plain;

    if (rest.Settings) {
      rest.Settings = this.SerializeSettings(rest.Settings);
    }

    return rest;
  }

  /**
   * Clean settings response
   */
  private SerializeSettings(settings: UserSettings): Record<string, any> {
    const plain = (settings.toJSON ? settings.toJSON() : settings) as Record<string, any>;
    return plain;
  }

  /**
   * Strip API key hash before returning to client
   */
  private SerializeApiKey(apiKey: ApiKey): Record<string, any> {
    const plain = (apiKey.toJSON ? apiKey.toJSON() : apiKey) as Record<string, any>;
    delete plain.KeyHash;
    return plain;
  }

  /**
   * Strip sensitive session token before returning to client
   */
  private SerializeSession(session: any): Record<string, any> {
    const plain = (session.toJSON ? session.toJSON() : session) as Record<string, any>;
    delete plain.SessionToken;
    return plain;
  }

  /**
   * GET /api/users/me/settings
   */
  public GetMySettings = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      const settings = await this.UserSettingsService.GetUserSettings(userId);
      ResponseHelper.Success(res, 'User settings retrieved successfully', {
        Settings: this.SerializeSettings(settings),
      });
    } catch (error) {
      Logger.Error('Failed to get user settings', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve user settings');
    }
  };

  /**
   * PUT /api/users/me/settings/notifications
   */
  public UpdateNotificationSettings = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      const payload = req.body as INotificationSettingsUpdate;
      const settings = await this.UserSettingsService.UpdateNotificationSettings(userId, payload);

      ResponseHelper.Success(res, 'Notification settings updated successfully', {
        Settings: this.SerializeSettings(settings),
      });
    } catch (error) {
      Logger.Error('Failed to update notification settings', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * PUT /api/users/me/settings/preferences
   */
  public UpdatePreferences = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      const payload = req.body as IUserPreferencesUpdate;
      const settings = await this.UserSettingsService.UpdatePreferences(userId, payload);

      ResponseHelper.Success(res, 'Preferences updated successfully', {
        Settings: this.SerializeSettings(settings),
      });
    } catch (error) {
      Logger.Error('Failed to update preferences', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * POST /api/users/me/settings/notifications/test
   */
  public TestNotification = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      const type = (req.body?.Type || req.body?.type) as 'discord' | 'slack';

      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      if (!type || (type !== 'discord' && type !== 'slack')) {
        ResponseHelper.ValidationError(res, 'Invalid notification type', {
          Type: 'Type must be either discord or slack',
        });
        return;
      }

      await this.UserSettingsService.TestNotification(userId, type);
      ResponseHelper.Success(res, 'Test notification sent successfully');
    } catch (error) {
      Logger.Error('Failed to send test notification', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * GET /api/users/me/profile
   */
  public GetMyProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      const user = await this.UserProfileService.GetFullProfile(userId);
      if (!user) {
        ResponseHelper.NotFound(res, 'User not found');
        return;
      }

      ResponseHelper.Success(res, 'User profile retrieved successfully', {
        User: this.SerializeUser(user),
      });
    } catch (error) {
      Logger.Error('Failed to get user profile', error as Error);
      ResponseHelper.Error(res, 'Failed to retrieve profile');
    }
  };

  /**
   * PUT /api/users/me/profile
   */
  public UpdateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      const updatedUser = await this.UserProfileService.UpdateProfile(userId, req.body);
      ResponseHelper.Success(res, 'Profile updated successfully', {
        User: this.SerializeUser(updatedUser),
      });
    } catch (error) {
      Logger.Error('Failed to update profile', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * POST /api/users/me/profile/avatar
   */
  public UploadAvatar = async (_req: Request, res: Response): Promise<void> => {
    ResponseHelper.Error(res, 'Avatar upload is not implemented yet', undefined, 501);
  };

  /**
   * PUT /api/users/me/password
   */
  public ChangePassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      const { CurrentPassword, NewPassword } = req.body;

      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      if (!CurrentPassword || !NewPassword) {
        ResponseHelper.ValidationError(res, 'Current and new password are required');
        return;
      }

      await this.UserProfileService.ChangePassword(userId, CurrentPassword, NewPassword);
      ResponseHelper.Success(res, 'Password changed successfully');
    } catch (error) {
      Logger.Error('Failed to change password', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * GET /api/users/me/api-keys
   */
  public ListApiKeys = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      const apiKeys = await this.ApiKeysService.ListApiKeys(userId);
      ResponseHelper.Success(res, 'API keys retrieved successfully', {
        ApiKeys: apiKeys.map((key) => this.SerializeApiKey(key)),
      });
    } catch (error) {
      Logger.Error('Failed to list API keys', error as Error);
      ResponseHelper.Error(res, 'Failed to list API keys');
    }
  };

  /**
   * POST /api/users/me/api-keys
   */
  public GenerateApiKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      const { Name, Scopes, ExpiresAt } = req.body;

      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      if (!Name) {
        ResponseHelper.ValidationError(res, 'Name is required for API key');
        return;
      }

      const expiresDate = ExpiresAt ? new Date(ExpiresAt) : undefined;

      const result = await this.ApiKeysService.GenerateApiKey(
        userId,
        Name,
        Array.isArray(Scopes) ? Scopes : [],
        expiresDate
      );

      ResponseHelper.Success(res, 'API key generated successfully', result, 201);
    } catch (error) {
      Logger.Error('Failed to generate API key', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * PUT /api/users/me/api-keys/:id
   */
  public UpdateApiKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      const keyId = Number(req.params?.id);
      const updates = req.body as IApiKeyUpdate;

      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      if (Number.isNaN(keyId)) {
        ResponseHelper.ValidationError(res, 'Invalid API key id');
        return;
      }

      await this.ApiKeysService.UpdateApiKey(userId, keyId, updates);
      ResponseHelper.Success(res, 'API key updated successfully');
    } catch (error) {
      Logger.Error('Failed to update API key', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * DELETE /api/users/me/api-keys/:id
   */
  public RevokeApiKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      const keyId = Number(req.params?.id);

      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      if (Number.isNaN(keyId)) {
        ResponseHelper.ValidationError(res, 'Invalid API key id');
        return;
      }

      await this.ApiKeysService.RevokeApiKey(userId, keyId);
      ResponseHelper.Success(res, 'API key revoked successfully');
    } catch (error) {
      Logger.Error('Failed to revoke API key', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * POST /api/users/me/api-keys/:id/reactivate
   */
  public ReactivateApiKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      const keyId = Number(req.params?.id);

      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      if (Number.isNaN(keyId)) {
        ResponseHelper.ValidationError(res, 'Invalid API key id');
        return;
      }

      await this.ApiKeysService.ReactivateApiKey(userId, keyId);
      ResponseHelper.Success(res, 'API key reactivated successfully');
    } catch (error) {
      Logger.Error('Failed to reactivate API key', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * POST /api/users/me/api-keys/:id/regenerate
   */
  public RegenerateApiKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      const keyId = Number(req.params?.id);

      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      if (Number.isNaN(keyId)) {
        ResponseHelper.ValidationError(res, 'Invalid API key id');
        return;
      }

      const result = await this.ApiKeysService.RegenerateApiKey(userId, keyId);
      ResponseHelper.Success(res, 'API key regenerated successfully', {
        Key: result.key,
        Prefix: result.prefix,
      });
    } catch (error) {
      Logger.Error('Failed to regenerate API key', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * GET /api/users/me/sessions
   */
  public ListSessions = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      const sessions = await this.SessionService.ListActiveSessions(userId);
      ResponseHelper.Success(res, 'Active sessions retrieved successfully', {
        Sessions: sessions.map((session) => this.SerializeSession(session)),
      });
    } catch (error) {
      Logger.Error('Failed to list sessions', error as Error);
      ResponseHelper.Error(res, 'Failed to list sessions');
    }
  };

  /**
   * DELETE /api/users/me/sessions/:id
   */
  public RevokeSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      const sessionId = Number(req.params?.id);

      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      if (Number.isNaN(sessionId)) {
        ResponseHelper.ValidationError(res, 'Invalid session id');
        return;
      }

      // Delete the session permanently (not just revoke)
      await this.SessionService.DeleteSession(userId, sessionId);

      // Emit Socket.IO event to force logout on client
      SocketService.GetInstance().EmitSessionRevoked(userId, sessionId);

      Logger.Info('Session revoked and deleted', { userId, sessionId });
      ResponseHelper.Success(res, 'Session revoked successfully');
    } catch (error) {
      Logger.Error('Failed to revoke session', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * POST /api/users/me/sessions/revoke-all
   */
  public RevokeAllSessions = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      const currentSessionId = req.body?.CurrentSessionId;

      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      if (currentSessionId === undefined) {
        ResponseHelper.ValidationError(res, 'CurrentSessionId is required to keep current session active');
        return;
      }

      const currentIdNumber = Number(currentSessionId);
      if (Number.isNaN(currentIdNumber)) {
        ResponseHelper.ValidationError(res, 'CurrentSessionId must be a number');
        return;
      }

      await this.SessionService.RevokeAllOtherSessions(userId, currentIdNumber);
      ResponseHelper.Success(res, 'All other sessions revoked successfully');
    } catch (error) {
      Logger.Error('Failed to revoke all sessions', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * 2FA endpoints - currently not implemented
   */
  public Generate2FA = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      const result = await this.TwoFactorAuthService.GenerateTOTP(userId);
      ResponseHelper.Success(res, '2FA secret generated', result);
    } catch (error) {
      Logger.Error('Generate 2FA failed', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  public Enable2FA = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      const { code } = req.body;

      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      if (!code) {
        ResponseHelper.ValidationError(res, 'Verification code is required');
        return;
      }

      const result = await this.TwoFactorAuthService.Enable2FA(userId, code);
      ResponseHelper.Success(res, '2FA enabled successfully', result);
    } catch (error) {
      Logger.Error('Enable 2FA failed', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  public Disable2FA = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;
      const { code } = req.body;

      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      if (!code) {
        ResponseHelper.ValidationError(res, 'Verification code is required');
        return;
      }

      await this.TwoFactorAuthService.Disable2FA(userId, code);
      ResponseHelper.Success(res, '2FA disabled successfully');
    } catch (error) {
      Logger.Error('Disable 2FA failed', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  public RegenerateBackupCodes = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;

      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      const backupCodes = await this.TwoFactorAuthService.RegenerateBackupCodes(userId);
      ResponseHelper.Success(res, 'Backup codes regenerated successfully', { backupCodes });
    } catch (error) {
      Logger.Error('Regenerate backup codes failed', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  public Get2FAStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.UserId;

      if (!userId) {
        ResponseHelper.Unauthorized(res, 'User not authenticated');
        return;
      }

      const status = await this.TwoFactorAuthService.GetStatus(userId);
      ResponseHelper.Success(res, '2FA status retrieved', status);
    } catch (error) {
      Logger.Error('Get 2FA status failed', error as Error);
      ResponseHelper.Error(res, (error as Error).message, undefined, 400);
    }
  };

  /**
   * Account management endpoints - TODO
   */
  public ExportAccountData = async (_req: Request, res: Response): Promise<void> => {
    ResponseHelper.Error(res, 'Account export is not implemented yet', undefined, 501);
  };

  public DeleteAccount = async (_req: Request, res: Response): Promise<void> => {
    ResponseHelper.Error(res, 'Account deletion is not implemented yet', undefined, 501);
  };
}

export default UsersController;
