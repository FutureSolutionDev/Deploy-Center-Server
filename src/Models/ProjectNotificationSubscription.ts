/**
 * ProjectNotificationSubscription Model — Deploy Center v3.0 / F-006 (T051).
 * M:N opt-in row between Project and NotificationChannel + per-row Events filter.
 */

import { DataTypes, Model } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';
import { ENotificationEvent } from '@Types/ICommon';

export interface IProjectNotificationSubscriptionAttributes {
  Id: number;
  ProjectId: number;
  ChannelId: number;
  Events: ENotificationEvent[];
  IsActive: boolean;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export type IProjectNotificationSubscriptionCreationAttributes = Omit<
  IProjectNotificationSubscriptionAttributes,
  'Id' | 'CreatedAt' | 'UpdatedAt'
>;

export class ProjectNotificationSubscription
  extends Model<
    IProjectNotificationSubscriptionAttributes,
    IProjectNotificationSubscriptionCreationAttributes
  >
  implements IProjectNotificationSubscriptionAttributes
{
  declare Id: number;
  declare ProjectId: number;
  declare ChannelId: number;
  declare Events: ENotificationEvent[];
  declare IsActive: boolean;
  declare readonly CreatedAt: Date;
  declare readonly UpdatedAt: Date;
}

ProjectNotificationSubscription.init(
  {
    Id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true, field: 'Id' },
    ProjectId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'ProjectId',
      references: { model: 'Projects', key: 'Id' },
      onDelete: 'CASCADE',
    },
    ChannelId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'ChannelId',
      references: { model: 'NotificationChannels', key: 'Id' },
      onDelete: 'CASCADE',
    },
    Events: { type: DataTypes.JSON, allowNull: false, field: 'Events' },
    IsActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'IsActive' },
    CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'CreatedAt' },
    UpdatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'UpdatedAt' },
  },
  {
    sequelize: DatabaseConnection.GetInstance(),
    tableName: 'ProjectNotificationSubscriptions',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt',
    indexes: [
      { name: 'uniq_subs_project_channel', unique: true, fields: ['ProjectId', 'ChannelId'] },
      { name: 'idx_subs_project', fields: ['ProjectId'] },
      { name: 'idx_subs_channel', fields: ['ChannelId'] },
    ],
  }
);

export default ProjectNotificationSubscription;
