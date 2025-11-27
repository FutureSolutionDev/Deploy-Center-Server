/**
 * User Model
 * Following PascalCase naming convention and Sequelize best practices
 */

import { DataTypes, Model } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';
import { IUserAttributes } from '@Types/IDatabase';
import { EUserRole } from '@Types/ICommon';

export class User extends Model<IUserAttributes> {
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
      unique: true,
      field: 'Username',
    },
    Email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
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
        fields: ['Username'],
      },
      {
        name: 'idx_users_email',
        fields: ['Email'],
      },
      {
        name: 'idx_users_role',
        fields: ['Role'],
      },
    ],
  }
);

export default User;
