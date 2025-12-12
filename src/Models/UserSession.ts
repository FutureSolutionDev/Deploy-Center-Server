/**
 * User Session Model
 * Tracks active user sessions for security management
 */

import { DataTypes, Model } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';
import { IUserSessionAttributes } from '@Types/IDatabase';

export class UserSession extends Model<IUserSessionAttributes> {
  declare Id: number;
  declare UserId: number;
  declare SessionToken: string;
  declare DeviceInfo?: Record<string, any> | null;
  declare IpAddress?: string | null;
  declare UserAgent?: string | null;
  declare IsActive: boolean;
  declare ExpiresAt: Date;
  declare readonly CreatedAt: Date;
  declare LastActivityAt: Date;
}

UserSession.init(
  {
    Id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'Id',
    },
    UserId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'UserId',
    },
    SessionToken: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'SessionToken',
    },
    DeviceInfo: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'DeviceInfo',
      get() {
        const rawValue = this.getDataValue('DeviceInfo') as unknown;
        if (!rawValue) {
          return null;
        }

        if (typeof rawValue === 'string') {
          try {
            return JSON.parse(rawValue);
          } catch {
            return null;
          }
        }

        if (typeof rawValue === 'object') {
          return rawValue as Record<string, any>;
        }

        return null;
      },
      set(value: Record<string, any> | null) {
        this.setDataValue('DeviceInfo', value ? (JSON.stringify(value) as any) : (null as any));
      },
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
    IsActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'IsActive',
    },
    ExpiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'ExpiresAt',
    },
    CreatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'CreatedAt',
    },
    LastActivityAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'LastActivityAt',
    },
  },
  {
    sequelize: DatabaseConnection.GetInstance(),
    tableName: 'UserSessions',
    timestamps: false,
    indexes: [
      {
        name: 'idx_sessions_user',
        fields: ['UserId'],
      },
      {
        name: 'idx_sessions_token',
        unique: true,
        fields: ['SessionToken'],
      },
      {
        name: 'idx_sessions_active',
        fields: ['IsActive'],
      },
    ],
  }
);

export default UserSession;
