/**
 * Deployment Model
 * Following PascalCase naming convention and Sequelize best practices
 */

import { DataTypes, Model } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';
import { EDeploymentStatus, ETriggerType } from '@Types/ICommon';
import { IDeploymentAttributes, IDeploymentCreationAttributes } from '@Types/IDatabase';
import type { Project } from './Project';

export class Deployment
  extends Model<IDeploymentAttributes, IDeploymentCreationAttributes>
  implements IDeploymentAttributes {

  public Id!: number;
  public ProjectId!: number;
  public CommitHash!: string;
  public Branch!: string;
  public Status!: EDeploymentStatus;
  public TriggerType!: ETriggerType;
  public TriggeredBy?: number;
  public StartedAt?: Date;
  public CompletedAt?: Date;
  public Duration?: number;
  public LogFile?: string;
  public ErrorMessage?: string;
  public CommitMessage?: string;
  public CommitAuthor?: string;
  public Author?: string;
  public readonly CreatedAt!: Date;
  public Project?: Project;
}

Deployment.init(
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
      references: {
        model: 'Projects',
        key: 'Id',
      },
      onDelete: 'CASCADE',
    },
    CommitHash: {
      type: DataTypes.STRING(40),
      allowNull: false,
      field: 'CommitHash',
    },
    Branch: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'Branch',
    },
    Status: {
      type: DataTypes.ENUM(...Object.values(EDeploymentStatus)),
      allowNull: false,
      field: 'Status',
    },
    TriggerType: {
      type: DataTypes.ENUM(...Object.values(ETriggerType)),
      allowNull: false,
      field: 'TriggerType',
    },
    TriggeredBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'TriggeredBy',
      references: {
        model: 'Users',
        key: 'Id',
      },
      onDelete: 'SET NULL',
    },
    StartedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'StartedAt',
    },
    CompletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'CompletedAt',
    },
    Duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'Duration',
      comment: 'Duration in seconds',
    },
    LogFile: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'LogFile',
    },
    ErrorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'ErrorMessage',
    },
    CommitMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'CommitMessage',
    },
    CommitAuthor: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'CommitAuthor',
    },
    Author: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'Author',
    },
    CreatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'CreatedAt',
    },
  },
  {
    sequelize: DatabaseConnection.GetInstance(),
    tableName: 'Deployments',
    timestamps: false,
    indexes: [
      {
        name: 'idx_deployments_project_id',
        fields: ['ProjectId'],
      },
      {
        name: 'idx_deployments_status',
        fields: ['Status'],
      },
      {
        name: 'idx_deployments_created_at',
        fields: ['CreatedAt'],
      },
      {
        name: 'idx_deployments_trigger_type',
        fields: ['TriggerType'],
      },
    ],
  }
);

export default Deployment;
