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

  declare Id: number;
  declare ProjectId: number;
  declare CommitHash: string;
  declare Branch: string;
  declare Status: EDeploymentStatus;
  declare TriggerType: ETriggerType;
  declare TriggeredBy?: number;
  declare StartedAt?: Date;
  declare CompletedAt?: Date;
  declare Duration?: number;
  declare LogFile?: string;
  declare ErrorMessage?: string;
  declare CommitMessage?: string;
  declare CommitAuthor?: string;
  declare Author?: string;
  declare QueueJobId?: string | null; // v3.0 F-001 — BullMQ job correlation id
  declare readonly CreatedAt: Date;
  declare Project?: Project;
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
      type: DataTypes.TEXT("long"),
      allowNull: true,
      field: 'ErrorMessage',
    },
    CommitMessage: {
      type: DataTypes.TEXT("long"),
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
    QueueJobId: {
      // v3.0 F-001 — BullMQ job id. NULL for pre-v3.0 rows and rows that
      // haven't been enqueued yet (e.g. between row insert and queue.add).
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'QueueJobId',
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
      {
        // v3.0 F-001 — reverse lookup from BullMQ job id back to deployment row.
        name: 'idx_deployments_queue_job_id',
        fields: ['QueueJobId'],
      },
    ],
  }
);

export default Deployment;
