/**
 * ProjectAuditLog Model
 * Tracks all modifications to projects with detailed change history
 * Following SOLID principles and PascalCase naming convention
 */

import { DataTypes, Model, Optional } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';

const sequelize = DatabaseConnection.GetInstance();

export interface IProjectAuditLogAttributes {
  Id: number;
  ProjectId: number;
  UserId: number; // Who made the change
  Action: 'create' | 'update' | 'delete' | 'add_member' | 'remove_member' | 'regenerate_webhook' | 'toggle_ssh_key' | 'regenerate_ssh_key';
  EntityType: 'project' | 'config' | 'pipeline' | 'webhook' | 'ssh_key' | 'member';
  Changes: string; // JSON string of what changed (before/after)
  IpAddress: string | null;
  UserAgent: string | null;
  Timestamp: Date;
}

export interface IProjectAuditLogCreationAttributes
  extends Optional<IProjectAuditLogAttributes, 'Id' | 'Timestamp' | 'IpAddress' | 'UserAgent'> {}

export class ProjectAuditLog
  extends Model<IProjectAuditLogAttributes, IProjectAuditLogCreationAttributes>
  implements IProjectAuditLogAttributes
{
  public Id!: number;
  public ProjectId!: number;
  public UserId!: number;
  public Action!: 'create' | 'update' | 'delete' | 'add_member' | 'remove_member' | 'regenerate_webhook' | 'toggle_ssh_key' | 'regenerate_ssh_key';
  public EntityType!: 'project' | 'config' | 'pipeline' | 'webhook' | 'ssh_key' | 'member';
  public Changes!: string;
  public IpAddress!: string | null;
  public UserAgent!: string | null;
  public Timestamp!: Date;

  // Timestamps
  public readonly CreatedAt!: Date;
  public readonly UpdatedAt!: Date;
}

ProjectAuditLog.init(
  {
    Id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: 'Id',
    },
    ProjectId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'ProjectId',
      references: {
        model: 'Projects',
        key: 'Id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    UserId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'UserId',
      references: {
        model: 'Users',
        key: 'Id',
      },
      comment: 'User who made the change',
    },
    Action: {
      type: DataTypes.ENUM(
        'create',
        'update',
        'delete',
        'add_member',
        'remove_member',
        'regenerate_webhook',
        'toggle_ssh_key',
        'regenerate_ssh_key'
      ),
      allowNull: false,
      field: 'Action',
    },
    EntityType: {
      type: DataTypes.ENUM('project', 'config', 'pipeline', 'webhook', 'ssh_key', 'member'),
      allowNull: false,
      defaultValue: 'project',
      field: 'EntityType',
    },
    Changes: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      field: 'Changes',
      comment: 'JSON string containing before/after values and description',
    },
    IpAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'IpAddress',
    },
    UserAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'UserAgent',
    },
    Timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'Timestamp',
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'ProjectAuditLogs',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt',
    indexes: [
      {
        fields: ['ProjectId'],
        name: 'idx_project_audit_project_id',
      },
      {
        fields: ['UserId'],
        name: 'idx_project_audit_user_id',
      },
      {
        fields: ['Timestamp'],
        name: 'idx_project_audit_timestamp',
      },
      {
        fields: ['Action'],
        name: 'idx_project_audit_action',
      },
    ],
  }
);

export default ProjectAuditLog;
