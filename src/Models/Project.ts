/**
 * Project Model
 * Following PascalCase naming convention and Sequelize best practices
 */

import { DataTypes, Model } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';
import { IProjectAttributes, IProjectConfigJson } from '@Types/IDatabase';
import { EProjectType } from '@Types/ICommon';

export class Project extends Model<IProjectAttributes> {
  declare Id: number;
  declare Name: string;
  declare RepoUrl: string;
  declare Branch: string;
  declare ProjectPath: string;
  declare ProjectType: EProjectType;
  declare WebhookSecret: string;
  declare IsActive: boolean;
  declare Config: IProjectConfigJson;
  declare readonly CreatedAt: Date;
  declare readonly UpdatedAt: Date;
}

Project.init(
  {
    Id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'Id',
    },
    Name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'Name',
    },
    RepoUrl: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'RepoUrl',
      validate: {
        isUrl: true,
      },
    },
    Branch: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'master',
      field: 'Branch',
    },
    ProjectPath: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'ProjectPath',
    },
    ProjectType: {
      type: DataTypes.ENUM(...Object.values(EProjectType)),
      allowNull: false,
      field: 'ProjectType',
    },
    WebhookSecret: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'WebhookSecret',
    },
    IsActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'IsActive',
    },
    Config: {
      type: DataTypes.JSON,
      allowNull: false,
      field: 'Config',
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
    tableName: 'Projects',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt',
    indexes: [
      {
        name: 'idx_projects_name',
        fields: ['Name'],
      },
      {
        name: 'idx_projects_is_active',
        fields: ['IsActive'],
      },
    ],
  }
);

export default Project;
