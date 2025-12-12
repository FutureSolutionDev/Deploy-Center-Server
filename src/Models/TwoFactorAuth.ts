/**
 * Two-Factor Authentication Model
 * Stores TOTP secrets and backup codes for users
 */

import { DataTypes, Model } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';
import { ITwoFactorAuthAttributes } from '@Types/IDatabase';

export class TwoFactorAuth extends Model<ITwoFactorAuthAttributes> {
  declare Id: number;
  declare UserId: number;
  declare Secret?: string | null;
  declare SecretIv?: string | null;
  declare SecretAuthTag?: string | null;
  declare IsEnabled: boolean;
  declare BackupCodes?: string | null;
  declare RecoveryEmail?: string | null;
  declare EnabledAt?: Date | null;
  declare LastUsedAt?: Date | null;
  declare readonly CreatedAt: Date;
  declare readonly UpdatedAt: Date;
}

TwoFactorAuth.init(
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
      unique: true,
      field: 'UserId',
    },
    Secret: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'Secret',
    },
    SecretIv: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'SecretIv',
    },
    SecretAuthTag: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'SecretAuthTag',
    },
    IsEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'IsEnabled',
    },
    BackupCodes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'BackupCodes',
    },
    RecoveryEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'RecoveryEmail',
      validate: {
        isEmail: true,
      },
    },
    EnabledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'EnabledAt',
    },
    LastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'LastUsedAt',
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
    tableName: 'TwoFactorAuth',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt',
    indexes: [
      {
        name: 'idx_2fa_user_id',
        unique: true,
        fields: ['UserId'],
      },
      {
        name: 'idx_2fa_enabled',
        fields: ['IsEnabled'],
      },
    ],
  }
);

export default TwoFactorAuth;
