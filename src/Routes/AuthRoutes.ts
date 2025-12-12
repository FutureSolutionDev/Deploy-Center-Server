/**
 * Authentication Routes
 * Defines routes for authentication endpoints
 * Following SOLID principles and PascalCase naming convention
 */

import { Router } from 'express';
import AuthController from '@Controllers/AuthController';
import AuthMiddleware from '@Middleware/AuthMiddleware';
import RateLimiterMiddleware from '@Middleware/RateLimiterMiddleware';

export class AuthRoutes {
  public Router: Router;
  private readonly AuthController: AuthController;
  private readonly AuthMiddleware: AuthMiddleware;
  private readonly RateLimiter: RateLimiterMiddleware;

  constructor() {
    this.Router = Router();
    this.AuthController = new AuthController();
    this.AuthMiddleware = new AuthMiddleware();
    this.RateLimiter = new RateLimiterMiddleware();
    this.InitializeRoutes();
  }

  private InitializeRoutes(): void {
    /**
     * POST /api/auth/register
     * Register a new user
     */
    this.Router.post(
      '/register',
      this.RateLimiter.AuthLimiter,
      this.AuthController.Register
    );

    /**
     * POST /api/auth/login
     * Login user
     */
    this.Router.post(
      '/login',
      this.RateLimiter.AuthLimiter,
      this.AuthController.Login
    );

    /**
     * POST /api/auth/verify-2fa
     * Complete login with 2FA code
     */
    this.Router.post(
      '/verify-2fa',
      this.RateLimiter.AuthLimiter,
      this.AuthController.VerifyTwoFactor
    );

    /**
     * POST /api/auth/logout
     * Logout user and clear cookies
     */
    this.Router.post(
      '/logout',
      this.RateLimiter.ApiLimiter,
      this.AuthController.Logout
    );

    /**
     * POST /api/auth/refresh
     * Refresh access token
     */
    this.Router.post(
      '/refresh',
      this.RateLimiter.ApiLimiter,
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
      this.AuthController.ChangePassword
    );
  }
}

export default AuthRoutes;
