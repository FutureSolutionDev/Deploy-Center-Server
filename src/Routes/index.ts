/**
 * Routes Index
 * Exports all route modules
 * Following SOLID principles and PascalCase naming convention
 */

import { Router, Application } from 'express';
import AuthRoutes from './AuthRoutes';
import ProjectRoutes from './ProjectRoutes';
import DeploymentRoutes from './DeploymentRoutes';
import WebhookRoutes from './WebhookRoutes';
import UsersRoutes from './UsersRoutes';
import DashboardRoutes from './DashboardRoutes';

export class Routes {
  private readonly App: Application;

  constructor(app: Application) {
    this.App = app;
    this.InitializeRoutes();
  }

  private InitializeRoutes(): void {
    // API Routes
    const apiRouter = Router();

    // Auth routes - /api/auth/*
    const authRoutes = new AuthRoutes();
    apiRouter.use('/auth', authRoutes.Router);

    // Dashboard routes - /api/dashboard/*
    const dashboardRoutes = new DashboardRoutes();
    apiRouter.use('/dashboard', dashboardRoutes.Router);

    // Project routes - /api/projects/*
    const projectRoutes = new ProjectRoutes();
    apiRouter.use('/projects', projectRoutes.Router);

    // Deployment routes - /api/deployments/*
    const deploymentRoutes = new DeploymentRoutes();
    apiRouter.use('/deployments', deploymentRoutes.Router);

    // User routes - /api/users/*
    const usersRoutes = new UsersRoutes();
    apiRouter.use('/users', usersRoutes.Router);

    // Webhook routes under /api/webhooks/* (for GitHub, GitLab, etc.)
    const webhookRoutes = new WebhookRoutes();
    apiRouter.use('/webhooks', webhookRoutes.Router);

    // Mount API routes under /api prefix
    this.App.use('/api', apiRouter);

    // Legacy webhook routes - /webhook/* (for backwards compatibility)
    this.App.use('/webhook', webhookRoutes.Router);

    // Health check endpoint
    this.App.get('/health', (_, res) => {
      res.status(200).json({
        Success: true,
        Message: 'Deploy Center API is running',
        Timestamp: new Date().toISOString(),
      });
    });

    // Root endpoint
    this.App.get('/server', (_, res) => {
      res.status(200).json({
        Success: true,
        Message: 'Deploy Center API',
        Version: '1.0.0',
        Endpoints: {
          Api: '/api',
          Health: '/health',
          Webhook: '/webhook',
        },
      });
    });
  }
}

export default Routes;
