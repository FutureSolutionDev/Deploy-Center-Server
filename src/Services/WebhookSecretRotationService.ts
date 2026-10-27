/**
 * WebhookSecretRotationService — v3.0.1 operational helper.
 *
 * Before v3.0.1 every project's webhook secret was broadcast over an
 * unauthenticated Socket.IO connection (SEC-C2), so operators must assume
 * they leaked and rotate them. Used by `npm run rotate:webhook-secrets`.
 */

import crypto from 'crypto';
import { Op, WhereOptions } from 'sequelize';
import { AuditLog, Project } from '@Models/index';
import Logger from '@Utils/Logger';

/** AuditLog action recorded for every CLI rotation. */
export const WEBHOOK_SECRET_ROTATED = 'webhook_secret_rotated';

export interface IRotationTarget {
  All?: boolean;
  /** Project id or exact name. */
  Project?: string;
  DryRun?: boolean;
}

export interface IRotatedSecret {
  ProjectId: number;
  Name: string;
  WebhookPath: string;
  WebhookSecret: string | null;
}

export class WebhookSecretRotationService {
  public static NewSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  public static async Rotate(target: IRotationTarget): Promise<IRotatedSecret[]> {
    if (!target.All && !target.Project) {
      throw new Error('Choose --all or --only <id|name>');
    }

    let where: WhereOptions = {};
    if (!target.All && target.Project) {
      const asId = /^[1-9][0-9]*$/.test(target.Project) ? Number(target.Project) : null;
      where = asId !== null
        ? { [Op.or]: [{ Id: asId }, { Name: target.Project }] }
        : { Name: target.Project };
    }

    const projects = await Project.findAll({ where, order: [['Id', 'ASC']] });
    if (projects.length === 0) {
      throw new Error('No matching projects');
    }

    const rotated: IRotatedSecret[] = [];
    for (const project of projects) {
      const secret = target.DryRun ? null : WebhookSecretRotationService.NewSecret();
      if (secret) {
        await project.update({ WebhookSecret: secret });
        await AuditLog.create({
          Action: WEBHOOK_SECRET_ROTATED,
          ResourceType: 'project',
          ResourceId: project.Id,
          Details: { source: 'cli', projectName: project.Name },
        });
      }
      rotated.push({
        ProjectId: project.Id,
        Name: project.Name,
        WebhookPath: `/api/webhooks/github/${project.Name}`,
        WebhookSecret: secret,
      });
    }

    Logger.Info(`Webhook secrets ${target.DryRun ? 'selected (dry run)' : 'rotated'}`, {
      projectIds: rotated.map((r) => r.ProjectId),
    });
    return rotated;
  }
}

export default WebhookSecretRotationService;
