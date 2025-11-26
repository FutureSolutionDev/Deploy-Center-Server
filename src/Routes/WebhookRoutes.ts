/**
 * Webhook Routes
 * Defines routes for webhook endpoints
 * Following SOLID principles and PascalCase naming convention
 */

import { Router } from 'express';
import WebhookController from '@Controllers/WebhookController';
import RateLimiterMiddleware from '@Middleware/RateLimiterMiddleware';

export class WebhookRoutes {
  public Router: Router;
  private readonly WebhookController: WebhookController;
  private readonly RateLimiter: RateLimiterMiddleware;

  constructor() {
    this.Router = Router();
    this.WebhookController = new WebhookController();
    this.RateLimiter = new RateLimiterMiddleware();
    this.InitializeRoutes();
  }

  private InitializeRoutes(): void {
    /**
     * POST /webhook/github/:projectName
     * Handle GitHub webhook
     * No auth required - webhook signature verification is done internally
     */
    this.Router.post(
      '/github/:projectName',
      this.RateLimiter.WebhookLimiter,
      this.WebhookController.HandleGitHubWebhook
    );

    /**
     * POST /webhook/test/:projectName
     * Test webhook endpoint
     * No auth required - for testing webhook connectivity
     */
    this.Router.post(
      '/test/:projectName',
      this.RateLimiter.WebhookLimiter,
      this.WebhookController.TestWebhook
    );

    /**
     * GET /webhook/test/:projectName
     * Test webhook endpoint (GET method for browser testing)
     */
    this.Router.get(
      '/test/:projectName',
      this.RateLimiter.WebhookLimiter,
      this.WebhookController.TestWebhook
    );
  }
}

export default WebhookRoutes;
