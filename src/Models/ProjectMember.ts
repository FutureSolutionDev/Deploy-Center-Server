/**
 * ProjectMember Model
 * Represents project ownership/membership - allows multiple users to own/access a project
 * Following SOLID principles and PascalCase naming convention
 */

import { DataTypes, Model, Optional } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';

const sequelize = DatabaseConnection.GetInstance();

export interface IProjectMemberAttributes {
  Id: number;
  ProjectId: number;
  UserId: number;
  Role: 'owner' | 'member'; // owner = created the project, member = assigned by admin/manager
  AddedBy: number; // UserId who added this member
  AddedAt: Date;
}

export interface IProjectMemberCreationAttributes
  extends Optional<IProjectMemberAttributes, 'Id' | 'AddedAt'> {}

export class ProjectMember
  extends Model<IProjectMemberAttributes, IProjectMemberCreationAttributes>
  implements IProjectMemberAttributes
{
  public Id!: number;
  public ProjectId!: number;
  public UserId!: number;
  public Role!: 'owner' | 'member';
  public AddedBy!: number;
  public AddedAt!: Date;

  // Timestamps
  public readonly CreatedAt!: Date;
  public readonly UpdatedAt!: Date;
}

ProjectMember.init(
  {
    Id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: 'Id',
    },
    ProjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'ProjectId',
      references: {
        model: 'Projects',
        key: 'Id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    UserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'UserId',
      references: {
        model: 'Users',
        key: 'UserId',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    Role: {
      type: DataTypes.ENUM('owner', 'member'),
      allowNull: false,
      field: 'Role',
      defaultValue: 'member',
      comment: 'owner = project creator, member = assigned developer',
    },
    AddedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'AddedBy',
      references: {
        model: 'Users',
        key: 'UserId',
      },
      comment: 'UserId who added this member (Admin/Manager)',
    },
    AddedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'AddedAt',
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'ProjectMembers',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt',
    indexes: [
      {
        unique: true,
        fields: ['ProjectId', 'UserId'],
        name: 'unique_project_user',
      },
      {
        fields: ['ProjectId'],
        name: 'idx_project_members_project_id',
      },
      {
        fields: ['UserId'],
        name: 'idx_project_members_user_id',
      },
    ],
  }
);

export default ProjectMember;
