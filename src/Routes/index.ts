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
import EnvironmentVariableRoutes from './EnvironmentVariableRoutes'; // v3.0 F-003
import NotificationProviderRoutes from './NotificationProviderRoutes'; // v3.0 F-006
import NotificationChannelRoutes from './NotificationChannelRoutes'; // v3.0 F-006
import ProjectNotificationSubscriptionRoutes from './ProjectNotificationSubscriptionRoutes'; // v3.0 F-006
import WorkspaceRoutes from './WorkspaceRoutes'; // v3.0 F-009
import WorkspaceController from '@Controllers/WorkspaceController'; // v3.0 F-009 — PATCH on /projects
import ProjectTemplateRoutes from './ProjectTemplateRoutes'; // v3.0 F-008
import AuthMiddleware from '@Middleware/AuthMiddleware';
import ProjectAccessMiddleware from '@Middleware/ProjectAccessMiddleware';
import RateLimiterMiddleware from '@Middleware/RateLimiterMiddleware';

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

    // v3.0 F-003 — Environment Variables nested under projects.
    // Must be mounted on apiRouter BEFORE projectRoutes catch-alls would shadow
    // the /:projectId/env-vars sub-path. Express routes the longest prefix.
    const envVarRoutes = new EnvironmentVariableRoutes();
    apiRouter.use('/projects/:projectId/env-vars', envVarRoutes.Router);

    // v3.0 F-006 — Notifications (Providers + Channels + per-Project Subscriptions).
    const notifProviderRoutes = new NotificationProviderRoutes();
    apiRouter.use('/notifications/providers', notifProviderRoutes.Router);
    const notifChannelRoutes = new NotificationChannelRoutes();
    apiRouter.use('/notifications/channels', notifChannelRoutes.Router);
    const projectNotifSubRoutes = new ProjectNotificationSubscriptionRoutes();
    apiRouter.use(
      '/projects/:projectId/notification-subscriptions',
      projectNotifSubRoutes.Router
    );

    // v3.0 F-009 — Workspaces CRUD + PATCH /api/projects/:projectId/workspace
    //
    // SECURITY: workspace assignment is a project mutation, so it goes
    // through the same access gate as edit/delete:
    //   - Admin / Manager: allowed
    //   - Developer: allowed only if they're a member of the project
    //   - Viewer: forbidden
    // Without this gate, any authenticated user could move any project
    // into/out of any workspace — including stealing it into a workspace
    // only they control.
    const workspaceRoutes = new WorkspaceRoutes();
    apiRouter.use('/workspaces', workspaceRoutes.Router);
    const wsAuth = new AuthMiddleware();
    const wsAccess = new ProjectAccessMiddleware();
    const wsRateLimit = new RateLimiterMiddleware().ApiLimiter;
    const wsCtrl = new WorkspaceController();
    apiRouter.patch(
      '/projects/:projectId/workspace',
      wsAuth.Authenticate,
      wsAccess.CheckProjectModifyAccess,
      wsRateLimit,
      wsCtrl.AssignProjectWorkspace
    );

    // v3.0 F-008 — Project Templates (reads open to all authed, writes Admin/Manager)
    const templateRoutes = new ProjectTemplateRoutes();
    apiRouter.use('/project-templates', templateRoutes.Router);

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
