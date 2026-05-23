/**
 * EnvironmentVariable Model — Deploy Center v3.0 / F-003.
 * Per-project encrypted key/value pair. Each row carries its own IV.
 * Decryption happens in EnvironmentVariableService — values are NEVER
 * serialized in plaintext through this model.
 */

import { DataTypes, Model } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';

export interface IEnvironmentVariableAttributes {
  Id: number;
  ProjectId: number;
  KeyName: string;
  ValueEncrypted: string;
  Iv: string;
  AuthTag: string;
  IsSecret: boolean;
  IsActive: boolean;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export type IEnvironmentVariableCreationAttributes = Omit<
  IEnvironmentVariableAttributes,
  'Id' | 'CreatedAt' | 'UpdatedAt'
>;

export class EnvironmentVariable
  extends Model<IEnvironmentVariableAttributes, IEnvironmentVariableCreationAttributes>
  implements IEnvironmentVariableAttributes
{
  declare Id: number;
  declare ProjectId: number;
  declare KeyName: string;
  declare ValueEncrypted: string;
  declare Iv: string;
  declare AuthTag: string;
  declare IsSecret: boolean;
  declare IsActive: boolean;
  declare readonly CreatedAt: Date;
  declare readonly UpdatedAt: Date;
}

EnvironmentVariable.init(
  {
    Id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'Id',
    },
    ProjectId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'ProjectId',
      references: { model: 'Projects', key: 'Id' },
      onDelete: 'CASCADE',
    },
    KeyName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'KeyName',
    },
    ValueEncrypted: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
      field: 'ValueEncrypted',
    },
    Iv: {
      type: DataTypes.STRING(32),
      allowNull: false,
      field: 'Iv',
    },
    AuthTag: {
      type: DataTypes.STRING(32),
      allowNull: false,
      field: 'AuthTag',
    },
    IsSecret: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'IsSecret',
    },
    IsActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'IsActive',
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
    tableName: 'EnvironmentVariables',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt',
    indexes: [
      { name: 'uniq_env_vars_project_key', unique: true, fields: ['ProjectId', 'KeyName'] },
      { name: 'idx_env_vars_project', fields: ['ProjectId'] },
    ],
  }
);

export default EnvironmentVariable;
