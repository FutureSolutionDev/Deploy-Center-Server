/**
 * NotificationChannel Model — Deploy Center v3.0 / F-006 (T051).
 * Delivery target under a Provider. Multiple channels MAY share one
 * provider; CASCADE on provider delete cleans them up.
 */

import { DataTypes, Model } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';

export interface INotificationChannelAttributes {
  Id: number;
  ProviderId: number;
  Name: string;
  DeliveryConfigEncrypted: string;
  Iv: string;
  AuthTag: string;
  IsActive: boolean;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export type INotificationChannelCreationAttributes = Omit<
  INotificationChannelAttributes,
  'Id' | 'CreatedAt' | 'UpdatedAt'
>;

export class NotificationChannel
  extends Model<INotificationChannelAttributes, INotificationChannelCreationAttributes>
  implements INotificationChannelAttributes
{
  declare Id: number;
  declare ProviderId: number;
  declare Name: string;
  declare DeliveryConfigEncrypted: string;
  declare Iv: string;
  declare AuthTag: string;
  declare IsActive: boolean;
  declare readonly CreatedAt: Date;
  declare readonly UpdatedAt: Date;
}

NotificationChannel.init(
  {
    Id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true, field: 'Id' },
    ProviderId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'ProviderId',
      references: { model: 'NotificationProviders', key: 'Id' },
      onDelete: 'CASCADE',
    },
    Name: { type: DataTypes.STRING(100), allowNull: false, field: 'Name' },
    DeliveryConfigEncrypted: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
      field: 'DeliveryConfigEncrypted',
    },
    Iv: { type: DataTypes.STRING(32), allowNull: false, field: 'Iv' },
    AuthTag: { type: DataTypes.STRING(32), allowNull: false, field: 'AuthTag' },
    IsActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'IsActive' },
    CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'CreatedAt' },
    UpdatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'UpdatedAt' },
  },
  {
    sequelize: DatabaseConnection.GetInstance(),
    tableName: 'NotificationChannels',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt',
    indexes: [
      { name: 'uniq_notif_channels_provider_name', unique: true, fields: ['ProviderId', 'Name'] },
      { name: 'idx_notif_channels_provider', fields: ['ProviderId'] },
    ],
  }
);

export default NotificationChannel;
