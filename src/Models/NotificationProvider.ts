/**
 * NotificationProvider Model — Deploy Center v3.0 / F-006 (T051).
 * Central credential row. ConfigEncrypted decrypted by the dispatcher layer;
 * never serialized in plaintext through this model.
 */

import { DataTypes, Model } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';
import { ENotificationProviderType } from '@Types/ICommon';

export interface INotificationProviderAttributes {
  Id: number;
  Name: string;
  Type: ENotificationProviderType;
  ConfigEncrypted: string;
  Iv: string;
  AuthTag: string;
  IsActive: boolean;
  CreatedBy: number | null;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export type INotificationProviderCreationAttributes = Omit<
  INotificationProviderAttributes,
  'Id' | 'CreatedAt' | 'UpdatedAt'
>;

export class NotificationProvider
  extends Model<INotificationProviderAttributes, INotificationProviderCreationAttributes>
  implements INotificationProviderAttributes
{
  declare Id: number;
  declare Name: string;
  declare Type: ENotificationProviderType;
  declare ConfigEncrypted: string;
  declare Iv: string;
  declare AuthTag: string;
  declare IsActive: boolean;
  declare CreatedBy: number | null;
  declare readonly CreatedAt: Date;
  declare readonly UpdatedAt: Date;
}

NotificationProvider.init(
  {
    Id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true, field: 'Id' },
    Name: { type: DataTypes.STRING(100), allowNull: false, field: 'Name' },
    Type: {
      type: DataTypes.ENUM(...Object.values(ENotificationProviderType)),
      allowNull: false,
      field: 'Type',
    },
    ConfigEncrypted: { type: DataTypes.TEXT('long'), allowNull: false, field: 'ConfigEncrypted' },
    Iv: { type: DataTypes.STRING(32), allowNull: false, field: 'Iv' },
    AuthTag: { type: DataTypes.STRING(32), allowNull: false, field: 'AuthTag' },
    IsActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'IsActive' },
    CreatedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'CreatedBy',
      references: { model: 'Users', key: 'Id' },
      onDelete: 'SET NULL',
    },
    CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'CreatedAt' },
    UpdatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'UpdatedAt' },
  },
  {
    sequelize: DatabaseConnection.GetInstance(),
    tableName: 'NotificationProviders',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt',
    indexes: [
      { name: 'uniq_notif_providers_name', unique: true, fields: ['Name'] },
      { name: 'idx_notif_providers_type', fields: ['Type'] },
    ],
  }
);

export default NotificationProvider;
