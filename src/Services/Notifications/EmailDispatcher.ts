/**
 * EmailDispatcher — Deploy Center v3.0 / F-006 (T056).
 * Sends HTML + plaintext email via nodemailer. Uses the provider's SMTP
 * connection details; recipient list comes from the channel's delivery config.
 * Recipients chunked to ≤ 50 per send to avoid SMTP "too many recipients".
 */

import nodemailer from 'nodemailer';
import Logger from '@Utils/Logger';
import { EDeploymentStatus } from '@Types/ICommon';
import type {
  INotificationDispatcher,
  INotificationPayload,
  IProviderConfig,
  IDeliveryConfig,
  IEmailProviderConfig,
  IEmailDeliveryConfig,
} from './INotificationDispatcher';

const MAX_RECIPIENTS_PER_SEND = 50;

function pickColor(status: EDeploymentStatus): string {
  switch (status) {
    case EDeploymentStatus.Success: return '#4caf50';
    case EDeploymentStatus.Failed: return '#f44336';
    case EDeploymentStatus.InProgress: return '#ff9800';
    case EDeploymentStatus.RolledBack: return '#9c27b0';
    case EDeploymentStatus.Cancelled: return '#ff5722';
    default: return '#9e9e9e';
  }
}

function pickEmoji(status: EDeploymentStatus): string {
  switch (status) {
    case EDeploymentStatus.Success: return '✅';
    case EDeploymentStatus.Failed: return '❌';
    case EDeploymentStatus.InProgress: return '⏳';
    case EDeploymentStatus.RolledBack: return '↩️';
    case EDeploymentStatus.Cancelled: return '🚫';
    default: return 'ℹ️';
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export class EmailDispatcher implements INotificationDispatcher {
  public readonly type = 'email' as const;

  public async Send(
    providerConfig: IProviderConfig,
    deliveryConfig: IDeliveryConfig,
    payload: INotificationPayload
  ): Promise<void> {
    const p = providerConfig as IEmailProviderConfig;
    const d = deliveryConfig as IEmailDeliveryConfig;

    if (!p.host || !p.from) {
      throw new Error('Email provider config missing host or from');
    }
    if (!d.recipients || d.recipients.length === 0) {
      throw new Error('Email channel has no recipients');
    }

    const transporter = nodemailer.createTransport({
      host: p.host,
      port: p.port || 587,
      secure: !!p.secure,
      auth:
        p.user || p.password
          ? { user: p.user, pass: p.password }
          : undefined,
    });

    const color = pickColor(payload.Status);
    const emoji = pickEmoji(payload.Status);
    const subject = `[Deploy Center] ${payload.ProjectName} — Deployment ${payload.Status}`;

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333">
<div style="max-width:600px;margin:0 auto;padding:20px">
  <div style="background-color:${color};color:white;padding:20px;border-radius:5px 5px 0 0">
    <h2>${emoji} Deployment ${escapeHtml(payload.Status)}</h2>
  </div>
  <div style="background-color:#f9f9f9;padding:20px;border-radius:0 0 5px 5px">
    <p><strong>Project:</strong> ${escapeHtml(payload.ProjectName)}</p>
    <p><strong>Branch:</strong> ${escapeHtml(payload.Branch)}</p>
    <p><strong>Commit:</strong> <code>${escapeHtml(payload.CommitHash)}</code></p>
    ${payload.CommitMessage ? `<p><strong>Message:</strong> ${escapeHtml(payload.CommitMessage)}</p>` : ''}
    ${payload.Author ? `<p><strong>Author:</strong> ${escapeHtml(payload.Author)}</p>` : ''}
    ${payload.Duration ? `<p><strong>Duration:</strong> ${payload.Duration}s</p>` : ''}
    ${payload.Error ? `<div style="background-color:#ffebee;border-left:4px solid #f44336;padding:10px"><strong>Error:</strong><pre>${escapeHtml(payload.Error)}</pre></div>` : ''}
    ${payload.Url ? `<p><strong>URL:</strong> <a href="${escapeHtml(payload.Url)}">${escapeHtml(payload.Url)}</a></p>` : ''}
  </div>
</div></body></html>`;

    const text = [
      `${emoji} Deployment ${payload.Status}`,
      `Project: ${payload.ProjectName}`,
      `Branch: ${payload.Branch}`,
      `Commit: ${payload.CommitHash}`,
      payload.CommitMessage ? `Message: ${payload.CommitMessage}` : '',
      payload.Author ? `Author: ${payload.Author}` : '',
      payload.Duration ? `Duration: ${payload.Duration}s` : '',
      payload.Error ? `Error: ${payload.Error}` : '',
      payload.Url ? `URL: ${payload.Url}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const batches = chunk(d.recipients, MAX_RECIPIENTS_PER_SEND);
    for (const recipients of batches) {
      await transporter.sendMail({
        from: p.from,
        to: recipients.join(', '),
        subject,
        html,
        text,
      });
    }

    Logger.Info('Email dispatched', {
      deploymentId: payload.DeploymentId,
      event: payload.Event,
      recipientCount: d.recipients.length,
      batches: batches.length,
    });
  }
}

export default EmailDispatcher;
