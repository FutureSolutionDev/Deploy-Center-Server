/**
 * User Settings Model
 * Stores notification and preference settings for each user
 */

import { DataTypes, Model } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';
import { IUserSettingsAttributes } from '@Types/IDatabase';

export class UserSettings extends Model<IUserSettingsAttributes> {
  declare Id: number;
  declare UserId: number;
  declare EmailNotifications: boolean;
  declare DiscordWebhookUrl?: string | null;
  declare SlackWebhookUrl?: string | null;
  declare NotifyOnSuccess: boolean;
  declare NotifyOnFailure: boolean;
  declare NotifyOnProjectUpdate: boolean;
  declare NotifyOnSystemAlert: boolean;
  declare Timezone: string;
  declare DateFormat: string;
  declare TimeFormat: '12h' | '24h';
  declare Language: string;
  declare Theme: string;
  declare ColorTheme: string;
  declare readonly CreatedAt: Date;
  declare readonly UpdatedAt: Date;
}

UserSettings.init(
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
    EmailNotifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'EmailNotifications',
    },
    DiscordWebhookUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'DiscordWebhookUrl',
    },
    SlackWebhookUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'SlackWebhookUrl',
    },
    NotifyOnSuccess: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'NotifyOnSuccess',
    },
    NotifyOnFailure: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'NotifyOnFailure',
    },
    NotifyOnProjectUpdate: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'NotifyOnProjectUpdate',
    },
    NotifyOnSystemAlert: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'NotifyOnSystemAlert',
    },
    Timezone: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'UTC',
      field: 'Timezone',
    },
    DateFormat: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'YYYY-MM-DD',
      field: 'DateFormat',
    },
    TimeFormat: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: '24h',
      field: 'TimeFormat',
    },
    Language: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: 'en',
      field: 'Language',
    },
    Theme: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'light',
      field: 'Theme',
    },
    ColorTheme: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'blue',
      field: 'ColorTheme',
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
    tableName: 'UserSettings',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt',
    indexes: [
      {
        name: 'idx_user_settings_user_id',
        unique: true,
        fields: ['UserId'],
      },
    ],
  }
);

export default UserSettings;
