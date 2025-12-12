/**
 * Users Routes
 * Defines user settings, profile, API key, and session endpoints
 */

import { Router } from 'express';
import UsersController from '@Controllers/UsersController';
import AuthMiddleware from '@Middleware/AuthMiddleware';
import RateLimiterMiddleware from '@Middleware/RateLimiterMiddleware';

export class UsersRoutes {
  public Router: Router;
  private readonly UsersController: UsersController;
  private readonly AuthMiddleware: AuthMiddleware;
  private readonly RateLimiter: RateLimiterMiddleware;

  constructor() {
    this.Router = Router();
    this.UsersController = new UsersController();
    this.AuthMiddleware = new AuthMiddleware();
    this.RateLimiter = new RateLimiterMiddleware();
    this.InitializeRoutes();
  }

  private InitializeRoutes(): void {
    // Settings
    this.Router.get(
      '/me/settings',
      this.AuthMiddleware.Authenticate,
      this.UsersController.GetMySettings
    );

    this.Router.put(
      '/me/settings/notifications',
      this.AuthMiddleware.Authenticate,
      this.UsersController.UpdateNotificationSettings
    );

    this.Router.put(
      '/me/settings/preferences',
      this.AuthMiddleware.Authenticate,
      this.UsersController.UpdatePreferences
    );

    this.Router.post(
      '/me/settings/notifications/test',
      this.AuthMiddleware.Authenticate,
      this.RateLimiter.ApiLimiter,
      this.UsersController.TestNotification
    );

    // Profile
    this.Router.get(
      '/me/profile',
      this.AuthMiddleware.Authenticate,
      this.UsersController.GetMyProfile
    );

    this.Router.put(
      '/me/profile',
      this.AuthMiddleware.Authenticate,
      this.UsersController.UpdateProfile
    );

    this.Router.post(
      '/me/profile/avatar',
      this.AuthMiddleware.Authenticate,
      this.UsersController.UploadAvatar
    );

    this.Router.put(
      '/me/password',
      this.AuthMiddleware.Authenticate,
      this.RateLimiter.AuthLimiter,
      this.UsersController.ChangePassword
    );

    // API Keys
    this.Router.get(
      '/me/api-keys',
      this.AuthMiddleware.Authenticate,
      this.UsersController.ListApiKeys
    );

    this.Router.post(
      '/me/api-keys',
      this.AuthMiddleware.Authenticate,
      this.RateLimiter.ApiLimiter,
      this.UsersController.GenerateApiKey
    );

    this.Router.put(
      '/me/api-keys/:id',
      this.AuthMiddleware.Authenticate,
      this.UsersController.UpdateApiKey
    );

    this.Router.delete(
      '/me/api-keys/:id',
      this.AuthMiddleware.Authenticate,
      this.UsersController.RevokeApiKey
    );

    // Sessions
    this.Router.get(
      '/me/sessions',
      this.AuthMiddleware.Authenticate,
      this.UsersController.ListSessions
    );

    this.Router.delete(
      '/me/sessions/:id',
      this.AuthMiddleware.Authenticate,
      this.UsersController.RevokeSession
    );

    this.Router.post(
      '/me/sessions/revoke-all',
      this.AuthMiddleware.Authenticate,
      this.UsersController.RevokeAllSessions
    );

    // Two-Factor Authentication (stubs)
    this.Router.post(
      '/me/2fa/generate',
      this.AuthMiddleware.Authenticate,
      this.UsersController.Generate2FA
    );

    this.Router.post(
      '/me/2fa/enable',
      this.AuthMiddleware.Authenticate,
      this.UsersController.Enable2FA
    );

    this.Router.post(
      '/me/2fa/disable',
      this.AuthMiddleware.Authenticate,
      this.UsersController.Disable2FA
    );

    this.Router.post(
      '/me/2fa/backup-codes/regenerate',
      this.AuthMiddleware.Authenticate,
      this.UsersController.RegenerateBackupCodes
    );

    this.Router.get(
      '/me/2fa/status',
      this.AuthMiddleware.Authenticate,
      this.UsersController.Get2FAStatus
    );

    // Account management (stubs)
    this.Router.get(
      '/me/export',
      this.AuthMiddleware.Authenticate,
      this.UsersController.ExportAccountData
    );

    this.Router.delete(
      '/me/account',
      this.AuthMiddleware.Authenticate,
      this.UsersController.DeleteAccount
    );
  }
}

export default UsersRoutes;
