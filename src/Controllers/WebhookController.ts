/**
 * Webhook Controller
 * Handles GitHub webhook endpoints
 * Following SOLID principles and PascalCase naming convention
 */

import { Request, Response } from 'express';
import ProjectService from '@Services/ProjectService';
import WebhookService from '@Services/WebhookService';
import DeploymentService from '@Services/DeploymentService';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';

export class WebhookController {
  private readonly ProjectService: ProjectService;
  private readonly WebhookService: WebhookService;
  private readonly DeploymentService: DeploymentService;

  constructor() {
    this.ProjectService = new ProjectService();
    this.WebhookService = new WebhookService();
    this.DeploymentService = new DeploymentService();
  }

  /**
   * Handle GitHub webhook
   * POST /webhook/github/:projectName
   */
  public HandleGitHubWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectName = req.params.projectName!;
      const signature = req.headers['x-hub-signature-256'] as string;
      const eventType = req.headers['x-github-event'] as string;
      const payload = req.body;

      Logger.Info('Received GitHub webhook', {
        projectName,
        eventType,
        hasSignature: !!signature,
      });

      // Get project by name
      const project = await this.ProjectService.GetProjectByName(projectName);

      if (!project) {
        Logger.Warn('Webhook received for unknown project', { projectName });
        ResponseHelper.NotFound(res, 'Project not found');
        return;
      }

      // Verify webhook signature
      const rawBody = JSON.stringify(payload);
      const isValidSignature = this.WebhookService.VerifyGitHubSignature(
        rawBody,
        signature,
        project.WebhookSecret
      );

      if (!isValidSignature) {
        Logger.Warn('Invalid webhook signature', {
          projectName,
          projectId: project.Id,
        });
        ResponseHelper.Unauthorized(res, 'Invalid webhook signature');
        return;
      }

      // Check if event type is processable
      if (!this.WebhookService.IsProcessableEvent(eventType)) {
        Logger.Info('Webhook event type not processable', {
          projectName,
          eventType,
        });
        ResponseHelper.Success(res, `Event type '${eventType}' ignored`, {
          Processed: false,
          Reason: 'Event type not configured for processing',
        });
        return;
      }

      // Validate payload structure
      const validation = this.WebhookService.ValidateGitHubPayload(payload);
      if (!validation.IsValid) {
        Logger.Warn('Invalid webhook payload', {
          projectName,
          errors: validation.Errors,
        });
        ResponseHelper.ValidationError(res, 'Invalid webhook payload', {
          Errors: validation.Errors.join(', '),
        });
        return;
      }

      // Process webhook
      const webhookData = this.WebhookService.ProcessGitHubWebhook(payload);

      Logger.Info('Webhook processed successfully', {
        projectName,
        projectId: project.Id,
        branch: webhookData.Branch,
        commit: webhookData.CommitHash.substring(0, 7),
      });

      // Check if deployment should be triggered
      const shouldDeploy = this.WebhookService.ShouldTriggerDeployment(project, webhookData);

      if (!shouldDeploy.ShouldDeploy) {
        Logger.Info('Deployment not triggered', {
          projectName,
          projectId: project.Id,
          reason: shouldDeploy.Reason,
        });
        ResponseHelper.Success(res, 'Webhook received but deployment not triggered', {
          Processed: true,
          DeploymentTriggered: false,
          Reason: shouldDeploy.Reason,
        });
        return;
      }

      // Create deployment
      const deployment = await this.DeploymentService.CreateDeployment({
        ProjectId: project.Id,
        TriggeredBy: 'github-webhook',
        WebhookData: webhookData,
        ManualTrigger: false,
      });

      Logger.Info('Deployment triggered by webhook', {
        projectName,
        projectId: project.Id,
        deploymentId: deployment.Id,
        branch: webhookData.Branch,
        commit: webhookData.CommitHash.substring(0, 7),
      });

      ResponseHelper.Success(res, 'Webhook processed and deployment triggered', {
        Processed: true,
        DeploymentTriggered: true,
        Deployment: {
          Id: deployment.Id,
          Status: deployment.Status,
          Branch: deployment.Branch,
          CommitHash: deployment.CommitHash,
          CommitMessage: deployment.CommitMessage,
        },
      });
    } catch (error) {
      Logger.Error('Failed to process webhook', error as Error, {
        projectName: req.params.projectName!,
      });
      ResponseHelper.Error(res, 'Failed to process webhook', (error as Error).message, 500);
    }
  };

  /**
   * Test webhook endpoint
   * POST /webhook/test/:projectName
   */
  public TestWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectName = req.params.projectName!;

      // Get project by name
      const project = await this.ProjectService.GetProjectByName(projectName);

      if (!project) {
        ResponseHelper.NotFound(res, 'Project not found');
        return;
      }

      Logger.Info('Webhook test successful', {
        projectName,
        projectId: project.Id,
      });

      ResponseHelper.Success(res, 'Webhook endpoint is working correctly', {
        ProjectId: project.Id,
        ProjectName: project.Name,
        WebhookUrl: `/webhook/github/${projectName}`,
      });
    } catch (error) {
      Logger.Error('Webhook test failed', error as Error);
      ResponseHelper.Error(res, 'Webhook test failed');
    }
  };
}

export default WebhookController;
