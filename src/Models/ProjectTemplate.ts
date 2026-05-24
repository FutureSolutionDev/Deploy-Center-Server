/**
 * ProjectTemplate Model — Deploy Center v3.0 / F-008 (T081).
 *
 * Reusable Create-Project preset (pipeline + variables + ignore patterns).
 * Built-ins (seeded by migration 017) have IsBuiltIn=true and are read-only —
 * ProjectTemplateService.Update/Delete throws 422 for them.
 */

import { DataTypes, Model } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';
import type { IProjectConfigJson } from '@Types/IDatabase';

export type EProjectTemplateCategory = 'backend' | 'frontend' | 'static' | 'other';

export interface IProjectTemplateAttributes {
  Id: number;
  Name: string;
  Description: string | null;
  Icon: string | null;
  Category: EProjectTemplateCategory;
  DefaultConfig: Partial<IProjectConfigJson>;
  IsBuiltIn: boolean;
  CreatedBy: number | null;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export type IProjectTemplateCreationAttributes = Omit<
  IProjectTemplateAttributes,
  'Id' | 'CreatedAt' | 'UpdatedAt'
>;

export class ProjectTemplate
  extends Model<IProjectTemplateAttributes, IProjectTemplateCreationAttributes>
  implements IProjectTemplateAttributes
{
  declare Id: number;
  declare Name: string;
  declare Description: string | null;
  declare Icon: string | null;
  declare Category: EProjectTemplateCategory;
  declare DefaultConfig: Partial<IProjectConfigJson>;
  declare IsBuiltIn: boolean;
  declare CreatedBy: number | null;
  declare readonly CreatedAt: Date;
  declare readonly UpdatedAt: Date;
}

ProjectTemplate.init(
  {
    Id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true, field: 'Id' },
    Name: { type: DataTypes.STRING(100), allowNull: false, field: 'Name' },
    Description: { type: DataTypes.TEXT, allowNull: true, field: 'Description' },
    Icon: { type: DataTypes.STRING(50), allowNull: true, field: 'Icon' },
    Category: {
      type: DataTypes.ENUM('backend', 'frontend', 'static', 'other'),
      allowNull: false,
      field: 'Category',
    },
    DefaultConfig: { type: DataTypes.JSON, allowNull: false, field: 'DefaultConfig' },
    IsBuiltIn: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'IsBuiltIn',
    },
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
    tableName: 'ProjectTemplates',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt',
    indexes: [
      { name: 'uniq_project_templates_name', unique: true, fields: ['Name'] },
      { name: 'idx_project_templates_category', fields: ['Category'] },
    ],
  }
);

export default ProjectTemplate;
