/**
 * API Key Model
 * Stores hashed API keys and metadata
 */

import { DataTypes, Model } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';
import { IApiKeyAttributes } from '@Types/IDatabase';
import { EApiKeyScope } from '@Types/ICommon';

export class ApiKey extends Model<IApiKeyAttributes> {
  declare Id: number;
  declare UserId: number;
  declare Name: string;
  declare Description?: string | null;
  declare KeyHash: string;
  declare KeyPrefix: string;
  declare Scopes: EApiKeyScope[] | string[];
  declare IsActive: boolean;
  declare ExpiresAt?: Date | null;
  declare LastUsedAt?: Date | null;
  declare UsageCount: number;
  declare readonly CreatedAt: Date;
  declare readonly UpdatedAt: Date;
}

ApiKey.init(
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
    Name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'Name',
    },
    Description: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'Description',
    },
    KeyHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'KeyHash',
    },
    KeyPrefix: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'KeyPrefix',
    },
    Scopes: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '[]',
      field: 'Scopes',
      get() {
        const rawValue = this.getDataValue('Scopes') as unknown;
        if (!rawValue) {
          return [];
        }

        if (typeof rawValue === 'string') {
          try {
            return JSON.parse(rawValue);
          } catch {
            return [];
          }
        }

        if (Array.isArray(rawValue)) {
          return rawValue;
        }

        return [];
      },
      set(value: EApiKeyScope[] | string[]) {
        this.setDataValue('Scopes', JSON.stringify(value || []) as any);
      },
    },
    IsActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'IsActive',
    },
    ExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'ExpiresAt',
    },
    LastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'LastUsedAt',
    },
    UsageCount: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'UsageCount',
    },
    CreatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'CreatedAt',
    },
    UpdatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'UpdatedAt',
    },
  },
  {
    sequelize: DatabaseConnection.GetInstance(),
    tableName: 'ApiKeys',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt',
    indexes: [
      {
        name: 'idx_api_keys_user',
        fields: ['UserId'],
      },
      {
        name: 'idx_api_keys_hash',
        unique: true,
        fields: ['KeyHash'],
      },
      {
        name: 'idx_api_keys_active',
        fields: ['IsActive'],
      },
    ],
  }
);

export default ApiKey;
