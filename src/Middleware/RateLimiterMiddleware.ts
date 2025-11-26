/**
 * Rate Limiter Middleware
 * Prevents abuse by limiting request rates
 * Following SOLID principles and PascalCase naming convention
 */

import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';

export class RateLimiterMiddleware {
  /**
   * General API rate limiter
   * 100 requests per 15 minutes
   */
  public ApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      Logger.Warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
      });
      ResponseHelper.Error(res, 'Too many requests, please try again later', undefined, 429);
    },
  });

  /**
   * Authentication rate limiter
   * 5 requests per 15 minutes
   */
  public AuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
    handler: (req: Request, res: Response) => {
      Logger.Warn('Auth rate limit exceeded', {
        ip: req.ip,
        path: req.path,
      });
      ResponseHelper.Error(
        res,
        'Too many authentication attempts, please try again later',
        undefined,
        429
      );
    },
  });

  /**
   * Deployment creation rate limiter
   * 10 deployments per 5 minutes
   */
  public DeploymentLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10,
    message: 'Too many deployment requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      Logger.Warn('Deployment rate limit exceeded', {
        ip: req.ip,
        userId: (req as any).user?.UserId,
        path: req.path,
      });
      ResponseHelper.Error(
        res,
        'Too many deployment requests, please try again later',
        undefined,
        429
      );
    },
  });

  /**
   * Webhook rate limiter
   * 60 requests per minute (generous for CI/CD webhooks)
   */
  public WebhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60,
    message: 'Too many webhook requests',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      Logger.Warn('Webhook rate limit exceeded', {
        ip: req.ip,
        path: req.path,
      });
      ResponseHelper.Error(res, 'Too many webhook requests', undefined, 429);
    },
  });

  /**
   * Create custom rate limiter
   */
  public CreateLimiter(windowMs: number, max: number, message?: string) {
    return rateLimit({
      windowMs,
      max,
      message: message || 'Too many requests',
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        Logger.Warn('Custom rate limit exceeded', {
          ip: req.ip,
          path: req.path,
          windowMs,
          max,
        });
        ResponseHelper.Error(res, message || 'Too many requests', undefined, 429);
      },
    });
  }
}

export default RateLimiterMiddleware;
