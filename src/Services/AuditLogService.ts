/**
 * Audit Log Service
 * Handles recording of all project modifications with detailed change history
 * Following SOLID principles and PascalCase naming convention
 */

import { Request } from 'express';
import { ProjectAuditLog } from '@Models/index';
import Logger from '@Utils/Logger';

export interface IAuditLogData {
  ProjectId: number;
  UserId: number;
  Action:
    | 'create'
    | 'update'
    | 'delete'
    | 'add_member'
    | 'remove_member'
    | 'regenerate_webhook'
    | 'toggle_ssh_key'
    | 'regenerate_ssh_key';
  EntityType: 'project' | 'config' | 'pipeline' | 'webhook' | 'ssh_key' | 'member';
  Changes: {
    description: string;
    before?: any;
    after?: any;
    metadata?: Record<string, any>;
  };
  IpAddress?: string;
  UserAgent?: string;
}

export class AuditLogService {
  /**
   * Record an audit log entry
   */
  public static async RecordAuditLog(data: IAuditLogData): Promise<void> {
    try {
      await ProjectAuditLog.create({
        ProjectId: data.ProjectId,
        UserId: data.UserId,
        Action: data.Action,
        EntityType: data.EntityType,
        Changes: JSON.stringify(data.Changes),
        IpAddress: data.IpAddress || null,
        UserAgent: data.UserAgent || null,
      });

      Logger.Info('Audit log recorded', {
        projectId: data.ProjectId,
        userId: data.UserId,
        action: data.Action,
        entityType: data.EntityType,
      });
    } catch (error) {
      Logger.Error('Failed to record audit log', error as Error);
      // Don't throw - audit logging should not break the main flow
    }
  }

  /**
   * Record audit log from Express request
   * Extracts user info and request metadata automatically
   */
  public static async RecordFromRequest(
    req: Request,
    projectId: number,
    action: IAuditLogData['Action'],
    entityType: IAuditLogData['EntityType'],
    changes: IAuditLogData['Changes']
  ): Promise<void> {
    const user = (req as any).user;
    if (!user) {
      Logger.Warn('Cannot record audit log: No user in request');
      return;
    }

    await this.RecordAuditLog({
      ProjectId: projectId,
      UserId: user.UserId,
      Action: action,
      EntityType: entityType,
      Changes: changes,
      IpAddress: this.GetIpAddress(req),
      UserAgent: req.headers['user-agent'] || undefined,
    });
  }

  /**
   * Get IP address from request
   */
  private static GetIpAddress(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      if (typeof forwarded === 'string') {
        const firstIp = forwarded.split(',')[0];
        return firstIp ? firstIp.trim() : 'unknown';
      } else if (Array.isArray(forwarded) && forwarded.length > 0 && forwarded[0]) {
        return forwarded[0];
      }
    }
    const remoteAddress = req.socket?.remoteAddress;
    return remoteAddress || 'unknown';
  }

  /**
   * Helper: Record project creation
   */
  public static async RecordProjectCreation(
    req: Request,
    projectId: number,
    projectData: any
  ): Promise<void> {
    await this.RecordFromRequest(req, projectId, 'create', 'project', {
      description: `Project created: ${projectData.Name}`,
      after: {
        name: projectData.Name,
        repository: projectData.Repository,
        branch: projectData.Branch,
      },
    });
  }

  /**
   * Helper: Record project update
   */
  public static async RecordProjectUpdate(
    req: Request,
    projectId: number,
    before: any,
    after: any,
    changedFields: string[]
  ): Promise<void> {
    const beforeData: any = {};
    const afterData: any = {};

    changedFields.forEach((field) => {
      beforeData[field] = before[field];
      afterData[field] = after[field];
    });

    await this.RecordFromRequest(req, projectId, 'update', 'project', {
      description: `Project updated: ${changedFields.join(', ')}`,
      before: beforeData,
      after: afterData,
      metadata: { changedFields },
    });
  }

  /**
   * Helper: Record project deletion
   */
  public static async RecordProjectDeletion(
    req: Request,
    projectId: number,
    projectData: any
  ): Promise<void> {
    await this.RecordFromRequest(req, projectId, 'delete', 'project', {
      description: `Project deleted: ${projectData.Name}`,
      before: {
        name: projectData.Name,
        repository: projectData.Repository,
      },
    });
  }

  /**
   * Helper: Record webhook regeneration
   */
  public static async RecordWebhookRegeneration(
    req: Request,
    projectId: number,
    projectName: string
  ): Promise<void> {
    await this.RecordFromRequest(req, projectId, 'regenerate_webhook', 'webhook', {
      description: `Webhook secret regenerated for project: ${projectName}`,
      metadata: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * Helper: Record SSH key toggle
   */
  public static async RecordSshKeyToggle(
    req: Request,
    projectId: number,
    enabled: boolean,
    projectName: string
  ): Promise<void> {
    await this.RecordFromRequest(req, projectId, 'toggle_ssh_key', 'ssh_key', {
      description: `SSH key ${enabled ? 'enabled' : 'disabled'} for project: ${projectName}`,
      after: { enabled },
    });
  }

  /**
   * Helper: Record SSH key regeneration
   */
  public static async RecordSshKeyRegeneration(
    req: Request,
    projectId: number,
    projectName: string
  ): Promise<void> {
    await this.RecordFromRequest(req, projectId, 'regenerate_ssh_key', 'ssh_key', {
      description: `SSH key regenerated for project: ${projectName}`,
      metadata: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * Helper: Record member addition
   */
  public static async RecordMemberAddition(
    req: Request,
    projectId: number,
    addedUserId: number,
    addedUserEmail: string,
    role: 'owner' | 'member'
  ): Promise<void> {
    await this.RecordFromRequest(req, projectId, 'add_member', 'member', {
      description: `Member added: ${addedUserEmail} as ${role}`,
      after: {
        userId: addedUserId,
        email: addedUserEmail,
        role,
      },
    });
  }

  /**
   * Helper: Record member removal
   */
  public static async RecordMemberRemoval(
    req: Request,
    projectId: number,
    removedUserId: number,
    removedUserEmail: string
  ): Promise<void> {
    await this.RecordFromRequest(req, projectId, 'remove_member', 'member', {
      description: `Member removed: ${removedUserEmail}`,
      before: {
        userId: removedUserId,
        email: removedUserEmail,
      },
    });
  }

  /**
   * Helper: Record configuration update
   */
  public static async RecordConfigUpdate(
    req: Request,
    projectId: number,
    configType: string,
    before: any,
    after: any
  ): Promise<void> {
    await this.RecordFromRequest(req, projectId, 'update', 'config', {
      description: `Configuration updated: ${configType}`,
      before,
      after,
      metadata: { configType },
    });
  }

  /**
   * Helper: Record pipeline update
   */
  public static async RecordPipelineUpdate(
    req: Request,
    projectId: number,
    before: any,
    after: any
  ): Promise<void> {
    await this.RecordFromRequest(req, projectId, 'update', 'pipeline', {
      description: 'Pipeline configuration updated',
      before,
      after,
    });
  }
}

export default AuditLogService;
