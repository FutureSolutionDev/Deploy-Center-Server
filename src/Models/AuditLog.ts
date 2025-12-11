/**
 * AuditLog Model
 * Following PascalCase naming convention and Sequelize best practices
 */

import { DataTypes, Model } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';

import { IAuditLogAttributes, IAuditLogCreationAttributes } from '@Types/IDatabase';
export class AuditLog
  extends Model<IAuditLogAttributes, IAuditLogCreationAttributes>
  implements IAuditLogAttributes {

  declare Id: number;
  declare UserId?: number;
  declare Action: string;
  declare ResourceType: string;
  declare ResourceId?: number;
  declare Details?: Record<string, any>;
  declare IpAddress?: string;
  declare UserAgent?: string;
  declare readonly CreatedAt: Date;
}

AuditLog.init(
  {
    Id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'Id',
    },
    UserId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'UserId',
      references: {
        model: 'Users',
        key: 'Id',
      },
      onDelete: 'SET NULL',
    },
    Action: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'Action',
    },
    ResourceType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'ResourceType',
    },
    ResourceId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'ResourceId',
    },
    Details: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'Details',
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
    CreatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'CreatedAt',
    },
  },
  {
    sequelize: DatabaseConnection.GetInstance(),
    tableName: 'AuditLogs',
    timestamps: false,
    indexes: [
      {
        name: 'idx_audit_logs_user_id',
        fields: ['UserId'],
      },
      {
        name: 'idx_audit_logs_resource',
        fields: ['ResourceType', 'ResourceId'],
      },
      {
        name: 'idx_audit_logs_created_at',
        fields: ['CreatedAt'],
      },
    ],
  }
);

export default AuditLog;
