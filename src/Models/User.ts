/**
 * User Model
 * Following PascalCase naming convention and Sequelize best practices
 */

import { DataTypes, Model } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';
import { IUserAttributes } from '@Types/IDatabase';
import { EAccountStatus, EUserRole } from '@Types/ICommon';

export class User extends Model<IUserAttributes> {
  declare Id: number;
  declare Username: string;
  declare Email: string;
  declare PasswordHash: string;
  declare Role: EUserRole;
  declare IsActive: boolean;
  declare TwoFactorEnabled: boolean;
  declare TwoFactorSecret?: string | null;
  declare LastLogin?: Date | null;
  declare FullName?: string | null;
  declare AvatarUrl?: string | null;
  declare LastPasswordChangeAt?: Date | null;
  declare AccountStatus: EAccountStatus;
  declare readonly CreatedAt: Date;
  declare readonly UpdatedAt: Date;
}

User.init(
  {
    Id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'Id',
    },
    Username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'Username',
    },
    Email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'Email',
      validate: {
        isEmail: true,
      },
    },
    PasswordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'PasswordHash',
    },
    Role: {
      type: DataTypes.ENUM(...Object.values(EUserRole)),
      allowNull: false,
      defaultValue: EUserRole.Viewer,
      field: 'Role',
    },
    IsActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'IsActive',
    },
    TwoFactorEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'TwoFactorEnabled',
    },
    TwoFactorSecret: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'TwoFactorSecret',
    },
    FullName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'FullName',
    },
    AvatarUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'AvatarUrl',
    },
    LastPasswordChangeAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'LastPasswordChangeAt',
    },
    AccountStatus: {
      type: DataTypes.ENUM(...Object.values(EAccountStatus)),
      allowNull: false,
      defaultValue: EAccountStatus.Active,
      field: 'AccountStatus',
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
    LastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'LastLogin',
    },
  },
  {
    sequelize: DatabaseConnection.GetInstance(),
    tableName: 'Users',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt',
    indexes: [
      {
        name: 'idx_users_username',
        unique: true,
        fields: ['Username'],
      },
      {
        name: 'idx_users_email',
        unique: true,
        fields: ['Email'],
      },
      {
        name: 'idx_users_role',
        fields: ['Role'],
      },
      {
        name: 'idx_users_account_status',
        fields: ['AccountStatus'],
      },
    ],
  }
);

export default User;
