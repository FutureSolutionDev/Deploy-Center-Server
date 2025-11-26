/**
 * DeploymentStep Model
 * Following PascalCase naming convention and Sequelize best practices
 */

import { DataTypes, Model } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';
import { EStepStatus } from '@Types/ICommon';
import {
  IDeploymentStepAttributes,
  IDeploymentStepCreationAttributes,
} from '@Types/IDatabase';

export class DeploymentStep
  extends Model<IDeploymentStepAttributes, IDeploymentStepCreationAttributes>
  implements IDeploymentStepAttributes {

  public Id!: number;
  public DeploymentId!: number;
  public StepNumber!: number;
  public StepName!: string;
  public Status!: EStepStatus;
  public StartedAt?: Date;
  public CompletedAt?: Date;
  public Duration?: number;
  public Output?: string;
  public Error?: string;
}

DeploymentStep.init(
  {
    Id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'Id',
    },
    DeploymentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'DeploymentId',
      references: {
        model: 'Deployments',
        key: 'Id',
      },
      onDelete: 'CASCADE',
    },
    StepNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'StepNumber',
    },
    StepName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'StepName',
    },
    Status: {
      type: DataTypes.ENUM(...Object.values(EStepStatus)),
      allowNull: false,
      field: 'Status',
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
    Output: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'Output',
    },
    Error: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'Error',
    },
  },
  {
    sequelize: DatabaseConnection.GetInstance(),
    tableName: 'DeploymentSteps',
    timestamps: false,
    indexes: [
      {
        name: 'idx_deployment_steps_deployment_id',
        fields: ['DeploymentId'],
      },
      {
        name: 'idx_deployment_steps_status',
        fields: ['Status'],
      },
    ],
  }
);

export default DeploymentStep;
