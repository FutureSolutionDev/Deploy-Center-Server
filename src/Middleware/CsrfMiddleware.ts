/**
 * CSRF Protection Middleware
 * Implements Double Submit Cookie pattern with CSRF tokens
 * Following SOLID principles and PascalCase naming convention
 */

import { Request, Response, NextFunction } from 'express';
import csrf from 'csrf';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';
import AppConfig from '@Config/AppConfig';

export class CsrfMiddleware {
  private readonly Tokens: csrf;
  private readonly CookieName: string = 'XSRF-TOKEN';
  private readonly HeaderName: string = 'X-XSRF-TOKEN';
  private readonly Config = AppConfig;

  /**
   * Exact webhook routes exempt from CSRF (OPS-H2). Webhook deliveries are
   * authenticated by their HMAC signature, not by cookies. Route-based (not
   * path-prefix) so `/api/webhooks/github-anything` or deeper paths are not
   * accidentally exempt. Covers the v3.0 `/api/webhooks/...` mount and the
   * v2.1 legacy `/webhook/...` mount, which existing GitHub hooks still use.
   */
  private readonly ExcludedWebhookRoutes: RegExp[] = [
    /^\/(?:api\/webhooks|webhook)\/(?:github|gitlab|bitbucket)(?:\/[^/]+)?\/?$/,
  ];

  // v3.0 F-001 — Bull Board UI issues its own XHRs without our XSRF cookie;
  // CSRF is unnecessary here because the sub-tree is gated by AuthMiddleware
  // + RoleMiddleware(Admin) (see App.InitializeRoutes).
  private readonly ExcludedPrefixes: string[] = ['/admin/queues'];

  constructor() {
    this.Tokens = new csrf();
  }

  /**
   * Check if the current request should be excluded from CSRF protection
   */
  private IsPathExcluded(path: string, method: string = 'POST'): boolean {
    if (this.ExcludedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      return true;
    }
    return method === 'POST' && this.ExcludedWebhookRoutes.some((route) => route.test(path));
  }

  /**
   * Generate CSRF token and set it in cookie
   */
  public GenerateToken = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Skip CSRF token generation for excluded paths (webhooks)
      if (this.IsPathExcluded(req.path, req.method)) {
        return next();
      }

      // Get secret from cookie or generate new one
      let secret = req.cookies['XSRF-SECRET'];
      if (!secret) {
        secret = this.Tokens.secretSync();
        // Store secret in httpOnly cookie (server-side only)
        res.cookie('XSRF-SECRET', secret, {
          httpOnly: true, // Server-side only
          secure: this.Config.IsProduction(),
          sameSite: this.Config.IsProduction() ? 'strict' : 'lax',
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });
      }

      // Attach secret to request for this request cycle
      (req as any).csrfSecret = secret;

      // Generate token from secret
      const token = this.Tokens.create(secret);

      // Set token in cookie for client to read and include in requests
      res.cookie(this.CookieName, token, {
        httpOnly: false, // Client needs to read this
        secure: this.Config.IsProduction(),
        sameSite: this.Config.IsProduction() ? 'strict' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      // Also attach to request for immediate use
      (req as any).csrfToken = token;

      next();
    } catch (error) {
      Logger.Error('Failed to generate CSRF token', error as Error);
      next(error);
    }
  };

  /**
   * Verify CSRF token from request header
   */
  public VerifyToken = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Skip CSRF check for excluded paths (webhooks with HMAC signatures)
      if (this.IsPathExcluded(req.path, req.method)) {
        Logger.Debug('Skipping CSRF verification for webhook endpoint', { path: req.path });
        return next();
      }

      // Skip CSRF check for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      // Get secret from cookie or request (if GenerateToken was called first)
      const secret = (req as any).csrfSecret || req.cookies['XSRF-SECRET'];
      if (!secret) {
        Logger.Warn('CSRF verification failed: No secret in cookie');
        ResponseHelper.Forbidden(res, 'CSRF token validation failed');
        return;
      }

      // Get token from header
      const token = req.headers[this.HeaderName.toLowerCase()] as string;
      if (!token) {
        Logger.Warn('CSRF verification failed: No token in header', {
          method: req.method,
          path: req.path,
        });
        ResponseHelper.Forbidden(res, 'CSRF token missing');
        return;
      }

      // Verify token
      const isValid = this.Tokens.verify(secret, token);
      if (!isValid) {
        Logger.Warn('CSRF verification failed: Invalid token', {
          method: req.method,
          path: req.path,
        });
        ResponseHelper.Forbidden(res, 'Invalid CSRF token');
        return;
      }

      next();
    } catch (error) {
      Logger.Error('CSRF verification error', error as Error);
      ResponseHelper.Forbidden(res, 'CSRF token validation failed');
    }
  };

  /**
   * Combined middleware to generate and verify CSRF tokens
   */
  public Protect = (req: Request, res: Response, next: NextFunction): void => {
    // First generate/refresh token
    this.GenerateToken(req, res, (error?: any) => {
      if (error) {
        return next(error);
      }
      // Then verify for non-safe methods
      this.VerifyToken(req, res, next);
    });
  };

  /**
   * Get current CSRF token from request
   */
  public GetToken = (req: Request): string | null => {
    return (req as any).csrfToken || null;
  };
}

export default CsrfMiddleware;
