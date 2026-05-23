/**
 * Workspace Model — Deploy Center v3.0 / F-009 (T087).
 * Visual grouping of projects. CreatedBy FK → Users ON DELETE SET NULL
 * (workspaces persist when their creator is deleted — Sabry's call per I1
 * clarification: workspaces are a team-shared resource).
 */

import { DataTypes, Model } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';
import type { TWorkspaceIcon } from '@Types/IWorkspaceIcons';
import { DEFAULT_WORKSPACE_ICON } from '@Types/IWorkspaceIcons';

export interface IWorkspaceAttributes {
  Id: number;
  Name: string;
  Description: string | null;
  Color: string;
  Icon: TWorkspaceIcon;
  CreatedBy: number | null;
  IsActive: boolean;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export type IWorkspaceCreationAttributes = Omit<
  IWorkspaceAttributes,
  'Id' | 'CreatedAt' | 'UpdatedAt'
>;

export class Workspace
  extends Model<IWorkspaceAttributes, IWorkspaceCreationAttributes>
  implements IWorkspaceAttributes
{
  declare Id: number;
  declare Name: string;
  declare Description: string | null;
  declare Color: string;
  declare Icon: TWorkspaceIcon;
  declare CreatedBy: number | null;
  declare IsActive: boolean;
  declare readonly CreatedAt: Date;
  declare readonly UpdatedAt: Date;
}

Workspace.init(
  {
    Id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true, field: 'Id' },
    Name: { type: DataTypes.STRING(100), allowNull: false, field: 'Name' },
    Description: { type: DataTypes.TEXT, allowNull: true, field: 'Description' },
    Color: { type: DataTypes.STRING(7), allowNull: false, field: 'Color' },
    Icon: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: DEFAULT_WORKSPACE_ICON,
      field: 'Icon',
    },
    CreatedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'CreatedBy',
      references: { model: 'Users', key: 'Id' },
      onDelete: 'SET NULL',
    },
    IsActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'IsActive' },
    CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'CreatedAt' },
    UpdatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'UpdatedAt' },
  },
  {
    sequelize: DatabaseConnection.GetInstance(),
    tableName: 'Workspaces',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt',
    indexes: [
      { name: 'uniq_workspaces_user_name', unique: true, fields: ['CreatedBy', 'Name'] },
      { name: 'idx_workspaces_created_by', fields: ['CreatedBy'] },
    ],
  }
);

export default Workspace;
