/**
 * Notification Service
 * Handles sending notifications to various platforms (Discord, Slack, Email, Telegram)
 * Following SOLID principles and PascalCase naming convention
 */

import axios from 'axios';
import nodemailer from 'nodemailer';
import Logger from '@Utils/Logger';
import { Project, Deployment } from '@Models/index';
import { EDeploymentStatus } from '@Types/ICommon';

export interface INotificationPayload {
  ProjectName: string;
  DeploymentId: number;
  Status: EDeploymentStatus;
  Branch: string;
  CommitHash: string;
  CommitMessage?: string;
  Author?: string;
  Duration?: number;
  Error?: string;
  Url?: string;
}

export interface IDiscordConfig {
  Enabled: boolean;
  WebhookUrl?: string;
}

export interface ISlackConfig {
  Enabled: boolean;
  WebhookUrl?: string;
}

export interface IEmailConfig {
  Enabled: boolean;
  Host?: string;
  Port?: number;
  Secure?: boolean;
  User?: string;
  Password?: string;
  From?: string;
  To?: string[];
}

export interface ITelegramConfig {
  Enabled: boolean;
  BotToken?: string;
  ChatId?: string;
}

export class NotificationService {
  /**
   * Send notifications for deployment status
   */
  public async SendDeploymentNotification(
    project: Project,
    deployment: Deployment,
    payload: INotificationPayload
  ): Promise<void> {
    try {
      const notifications: Promise<void>[] = [];

      // Discord notification
      if (project.Config.Notifications?.Discord?.Enabled) {
        notifications.push(this.SendDiscordNotification(project.Config.Notifications.Discord, payload));
      }

      // Slack notification
      if (project.Config.Notifications?.Slack?.Enabled) {
        notifications.push(this.SendSlackNotification(project.Config.Notifications.Slack, payload));
      }

      // Email notification
      if (project.Config.Notifications?.Email?.Enabled) {
        notifications.push(this.SendEmailNotification(project.Config.Notifications.Email, payload));
      }

      // Telegram notification
      if (project.Config.Notifications?.Telegram?.Enabled) {
        notifications.push(this.SendTelegramNotification(project.Config.Notifications.Telegram, payload));
      }

      // Send all notifications in parallel
      await Promise.allSettled(notifications);

      Logger.Info('Deployment notifications sent', {
        projectId: project.Id,
        deploymentId: deployment.Id,
        status: payload.Status,
      });
    } catch (error) {
      Logger.Error('Failed to send deployment notifications', error as Error, {
        projectId: project.Id,
        deploymentId: deployment.Id,
      });
    }
  }

  /**
   * Send Discord notification
   */
  private async SendDiscordNotification(
    config: IDiscordConfig,
    payload: INotificationPayload
  ): Promise<void> {
    try {
      if (!config.WebhookUrl) {
        throw new Error('Discord webhook URL not configured');
      }

      const color = this.GetStatusColor(payload.Status);
      const emoji = this.GetStatusEmoji(payload.Status);

      const embed = {
        title: `${emoji} Deployment ${payload.Status}`,
        color: color,
        fields: [
          {
            name: 'Project',
            value: payload.ProjectName,
            inline: true,
          },
          {
            name: 'Branch',
            value: payload.Branch,
            inline: true,
          },
          {
            name: 'Commit',
            value: `\`${payload.CommitHash.substring(0, 7)}\``,
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      };

      if (payload.CommitMessage) {
        embed.fields.push({
          name: 'Message',
          value: payload.CommitMessage.substring(0, 100),
          inline: false,
        });
      }

      if (payload.Author) {
        embed.fields.push({
          name: 'Author',
          value: payload.Author,
          inline: true,
        });
      }

      if (payload.Duration) {
        embed.fields.push({
          name: 'Duration',
          value: `${payload.Duration}s`,
          inline: true,
        });
      }

      if (payload.Error) {
        embed.fields.push({
          name: 'Error',
          value: `\`\`\`${payload.Error.substring(0, 200)}\`\`\``,
          inline: false,
        });
      }

      if (payload.Url) {
        embed.fields.push({
          name: 'Deployment URL',
          value: payload.Url,
          inline: false,
        });
      }

      await axios.post(config.WebhookUrl, {
        embeds: [embed],
      });

      Logger.Info('Discord notification sent successfully', {
        deploymentId: payload.DeploymentId,
      });
    } catch (error) {
      Logger.Error('Failed to send Discord notification', error as Error, {
        deploymentId: payload.DeploymentId,
      });
      throw error;
    }
  }

  /**
   * Send Slack notification
   */
  private async SendSlackNotification(
    config: ISlackConfig,
    payload: INotificationPayload
  ): Promise<void> {
    try {
      if (!config.WebhookUrl) {
        throw new Error('Slack webhook URL not configured');
      }

      const color = this.GetSlackColor(payload.Status);
      const emoji = this.GetStatusEmoji(payload.Status);

      const fields = [
        {
          title: 'Project',
          value: payload.ProjectName,
          short: true,
        },
        {
          title: 'Branch',
          value: payload.Branch,
          short: true,
        },
        {
          title: 'Commit',
          value: `\`${payload.CommitHash.substring(0, 7)}\``,
          short: true,
        },
      ];

      if (payload.Author) {
        fields.push({
          title: 'Author',
          value: payload.Author,
          short: true,
        });
      }

      if (payload.Duration) {
        fields.push({
          title: 'Duration',
          value: `${payload.Duration}s`,
          short: true,
        });
      }

      if (payload.Error) {
        fields.push({
          title: 'Error',
          value: `\`\`\`${payload.Error.substring(0, 200)}\`\`\``,
          short: false,
        });
      }

      await axios.post(config.WebhookUrl, {
        attachments: [
          {
            fallback: `Deployment ${payload.Status}: ${payload.ProjectName}`,
            color: color,
            title: `${emoji} Deployment ${payload.Status}`,
            fields: fields,
            footer: 'Deploy Center',
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      });

      Logger.Info('Slack notification sent successfully', {
        deploymentId: payload.DeploymentId,
      });
    } catch (error) {
      Logger.Error('Failed to send Slack notification', error as Error, {
        deploymentId: payload.DeploymentId,
      });
      throw error;
    }
  }

  /**
   * Send Email notification
   */
  private async SendEmailNotification(
    config: IEmailConfig,
    payload: INotificationPayload
  ): Promise<void> {
    try {
      if (!config.Host || !config.User || !config.Password || !config.From || !config.To) {
        throw new Error('Email configuration incomplete');
      }

      const transporter = nodemailer.createTransport({
        host: config.Host,
        port: config.Port || 587,
        secure: config.Secure || false,
        auth: {
          user: config.User,
          pass: config.Password,
        },
      });

      const statusColor = this.GetEmailColor(payload.Status);
      const emoji = this.GetStatusEmoji(payload.Status);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: ${statusColor}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
            .field { margin-bottom: 15px; }
            .field-label { font-weight: bold; color: #555; }
            .field-value { margin-top: 5px; }
            .error-box { background-color: #ffebee; border-left: 4px solid #f44336; padding: 10px; margin-top: 10px; }
            code { background-color: #e0e0e0; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>${emoji} Deployment ${payload.Status}</h2>
            </div>
            <div class="content">
              <div class="field">
                <div class="field-label">Project:</div>
                <div class="field-value">${payload.ProjectName}</div>
              </div>
              <div class="field">
                <div class="field-label">Branch:</div>
                <div class="field-value">${payload.Branch}</div>
              </div>
              <div class="field">
                <div class="field-label">Commit:</div>
                <div class="field-value"><code>${payload.CommitHash}</code></div>
              </div>
              ${payload.CommitMessage ? `
              <div class="field">
                <div class="field-label">Commit Message:</div>
                <div class="field-value">${payload.CommitMessage}</div>
              </div>
              ` : ''}
              ${payload.Author ? `
              <div class="field">
                <div class="field-label">Author:</div>
                <div class="field-value">${payload.Author}</div>
              </div>
              ` : ''}
              ${payload.Duration ? `
              <div class="field">
                <div class="field-label">Duration:</div>
                <div class="field-value">${payload.Duration} seconds</div>
              </div>
              ` : ''}
              ${payload.Error ? `
              <div class="error-box">
                <div class="field-label">Error:</div>
                <div class="field-value"><code>${payload.Error}</code></div>
              </div>
              ` : ''}
              ${payload.Url ? `
              <div class="field">
                <div class="field-label">Deployment URL:</div>
                <div class="field-value"><a href="${payload.Url}">${payload.Url}</a></div>
              </div>
              ` : ''}
            </div>
          </div>
        </body>
        </html>
      `;

      await transporter.sendMail({
        from: config.From,
        to: config.To.join(', '),
        subject: `[Deploy Center] ${payload.ProjectName} - Deployment ${payload.Status}`,
        html: htmlContent,
      });

      Logger.Info('Email notification sent successfully', {
        deploymentId: payload.DeploymentId,
      });
    } catch (error) {
      Logger.Error('Failed to send Email notification', error as Error, {
        deploymentId: payload.DeploymentId,
      });
      throw error;
    }
  }

  /**
   * Send Telegram notification
   */
  private async SendTelegramNotification(
    config: ITelegramConfig,
    payload: INotificationPayload
  ): Promise<void> {
    try {
      if (!config.BotToken || !config.ChatId) {
        throw new Error('Telegram configuration incomplete');
      }

      const emoji = this.GetStatusEmoji(payload.Status);

      let message = `${emoji} *Deployment ${payload.Status}*\n\n`;
      message += `*Project:* ${payload.ProjectName}\n`;
      message += `*Branch:* ${payload.Branch}\n`;
      message += `*Commit:* \`${payload.CommitHash.substring(0, 7)}\`\n`;

      if (payload.CommitMessage) {
        message += `*Message:* ${payload.CommitMessage.substring(0, 100)}\n`;
      }

      if (payload.Author) {
        message += `*Author:* ${payload.Author}\n`;
      }

      if (payload.Duration) {
        message += `*Duration:* ${payload.Duration}s\n`;
      }

      if (payload.Error) {
        message += `\n*Error:*\n\`\`\`\n${payload.Error.substring(0, 200)}\n\`\`\`\n`;
      }

      if (payload.Url) {
        message += `\n*URL:* ${payload.Url}\n`;
      }

      const url = `https://api.telegram.org/bot${config.BotToken}/sendMessage`;
      await axios.post(url, {
        chat_id: config.ChatId,
        text: message,
        parse_mode: 'Markdown',
      });

      Logger.Info('Telegram notification sent successfully', {
        deploymentId: payload.DeploymentId,
      });
    } catch (error) {
      Logger.Error('Failed to send Telegram notification', error as Error, {
        deploymentId: payload.DeploymentId,
      });
      throw error;
    }
  }

  /**
   * Get color code for Discord based on status
   */
  private GetStatusColor(status: EDeploymentStatus): number {
    switch (status) {
      case EDeploymentStatus.Success:
        return 0x00ff00; // Green
      case EDeploymentStatus.Failed:
        return 0xff0000; // Red
      case EDeploymentStatus.InProgress:
        return 0xffff00; // Yellow
      case EDeploymentStatus.Queued:
        return 0x808080; // Gray
      case EDeploymentStatus.Cancelled:
        return 0xffa500; // Orange
      default:
        return 0x808080; // Gray
    }
  }

  /**
   * Get color code for Slack based on status
   */
  private GetSlackColor(status: EDeploymentStatus): string {
    switch (status) {
      case EDeploymentStatus.Success:
        return 'good'; // Green
      case EDeploymentStatus.Failed:
        return 'danger'; // Red
      case EDeploymentStatus.InProgress:
        return 'warning'; // Yellow
      default:
        return '#808080'; // Gray
    }
  }

  /**
   * Get color code for Email based on status
   */
  private GetEmailColor(status: EDeploymentStatus): string {
    switch (status) {
      case EDeploymentStatus.Success:
        return '#4caf50'; // Green
      case EDeploymentStatus.Failed:
        return '#f44336'; // Red
      case EDeploymentStatus.InProgress:
        return '#ff9800'; // Orange
      case EDeploymentStatus.Queued:
        return '#9e9e9e'; // Gray
      case EDeploymentStatus.Cancelled:
        return '#ff5722'; // Deep Orange
      default:
        return '#9e9e9e'; // Gray
    }
  }

  /**
   * Get emoji based on status
   */
  private GetStatusEmoji(status: EDeploymentStatus): string {
    switch (status) {
      case EDeploymentStatus.Success:
        return '✅';
      case EDeploymentStatus.Failed:
        return '❌';
      case EDeploymentStatus.InProgress:
        return '⏳';
      case EDeploymentStatus.Queued:
        return '⏱️';
      case EDeploymentStatus.Cancelled:
        return '🚫';
      default:
        return 'ℹ️';
    }
  }
}

export default NotificationService;
