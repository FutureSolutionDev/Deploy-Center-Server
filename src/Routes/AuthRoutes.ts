/**
 * Authentication Routes
 * Defines routes for authentication endpoints
 * Following SOLID principles and PascalCase naming convention
 */

import { Router } from 'express';
import AuthController, { AuthSchemas } from '@Controllers/AuthController';
import AuthMiddleware from '@Middleware/AuthMiddleware';
import RateLimiterMiddleware from '@Middleware/RateLimiterMiddleware';
import ValidationMiddleware from '@Middleware/ValidationMiddleware';

export class AuthRoutes {
  public Router: Router;
  private readonly AuthController: AuthController;
  private readonly AuthMiddleware: AuthMiddleware;
  private readonly RateLimiter: RateLimiterMiddleware;
  private readonly Validation: ValidationMiddleware;

  constructor() {
    this.Router = Router();
    this.AuthController = new AuthController();
    this.AuthMiddleware = new AuthMiddleware();
    this.RateLimiter = new RateLimiterMiddleware();
    this.Validation = new ValidationMiddleware();
    this.InitializeRoutes();
  }

  private InitializeRoutes(): void {
    /**
     * GET /api/auth/registration-status
     * Whether self-registration is open / first-admin setup is pending
     */
    this.Router.get(
      '/registration-status',
      this.RateLimiter.ApiLimiter,
      this.AuthController.GetRegistrationStatus
    );

    /**
     * POST /api/auth/register
     * Register a new user. Closed by default (ALLOW_REGISTRATION=false):
     * only the first account on an empty system can be created, as Admin.
     */
    this.Router.post(
      '/register',
      this.RateLimiter.AuthLimiter,
      this.Validation.ValidateBody(AuthSchemas.Register),
      this.AuthController.Register
    );

    /**
     * POST /api/auth/login
     * Login user
     */
    this.Router.post(
      '/login',
      this.RateLimiter.AuthLimiter,
      this.Validation.ValidateBody(AuthSchemas.Login),
      this.AuthController.Login
    );

    /**
     * POST /api/auth/verify-2fa
     * Complete login with 2FA code
     */
    this.Router.post(
      '/verify-2fa',
      this.RateLimiter.AuthLimiter,
      this.Validation.ValidateBody(AuthSchemas.VerifyTwoFactor),
      this.AuthController.VerifyTwoFactor
    );

    /**
     * POST /api/auth/logout
     * Logout user and clear cookies
     */
    this.Router.post(
      '/logout',
      this.RateLimiter.ApiLimiter,
      this.Validation.ValidateBody(AuthSchemas.Logout),
      this.AuthController.Logout
    );

    /**
     * POST /api/auth/refresh
     * Refresh access token
     */
    this.Router.post(
      '/refresh',
      this.RateLimiter.ApiLimiter,
      this.Validation.ValidateBody(AuthSchemas.Refresh),
      this.AuthController.RefreshToken
    );

    /**
     * GET /api/auth/profile
     * Get current user profile
     */
    this.Router.get(
      '/profile',
      this.AuthMiddleware.Authenticate,
      this.AuthController.GetProfile
    );

    /**
     * POST /api/auth/change-password
     * Change user password
     */
    this.Router.post(
      '/change-password',
      this.AuthMiddleware.Authenticate,
      this.RateLimiter.AuthLimiter,
      this.Validation.ValidateBody(AuthSchemas.ChangePassword),
      this.AuthController.ChangePassword
    );
  }
}

export default AuthRoutes;
