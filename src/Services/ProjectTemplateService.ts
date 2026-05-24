/**
 * ProjectTemplateService — Deploy Center v3.0 / F-008 (T081).
 *
 * CRUD over ProjectTemplates with one important invariant:
 *   - Built-ins (IsBuiltIn=true) are immutable. Update/Delete throws a
 *     TemplateImmutableError that the controller turns into HTTP 422.
 *   - Create forces IsBuiltIn=false regardless of input — only the migration
 *     seeds true built-ins.
 */

import { Op } from 'sequelize';
import {
  ProjectTemplate,
  type EProjectTemplateCategory,
  type IProjectTemplateAttributes,
} from '@Models/ProjectTemplate';
import Logger from '@Utils/Logger';
import type { IProjectConfigJson } from '@Types/IDatabase';

export class TemplateImmutableError extends Error {
  constructor(templateId: number) {
    super(`Project template ${templateId} is a built-in and cannot be modified or deleted`);
    this.name = 'TemplateImmutableError';
  }
}

export interface ITemplateCreateInput {
  Name: string;
  Description?: string | null;
  Icon?: string | null;
  Category: EProjectTemplateCategory;
  DefaultConfig: Partial<IProjectConfigJson>;
  CreatedBy: number | null;
}

export interface ITemplateUpdateInput {
  Name?: string;
  Description?: string | null;
  Icon?: string | null;
  Category?: EProjectTemplateCategory;
  DefaultConfig?: Partial<IProjectConfigJson>;
}

export class ProjectTemplateService {
  public async List(category?: EProjectTemplateCategory): Promise<IProjectTemplateAttributes[]> {
    const where = category ? { Category: category } : {};
    const rows = await ProjectTemplate.findAll({
      where,
      order: [
        ['IsBuiltIn', 'DESC'], // built-ins first so the wizard shows them up top
        ['Name', 'ASC'],
      ],
    });
    return rows.map((r) => r.toJSON());
  }

  public async GetById(id: number): Promise<IProjectTemplateAttributes | null> {
    const row = await ProjectTemplate.findByPk(id);
    return row ? row.toJSON() : null;
  }

  public async Create(input: ITemplateCreateInput): Promise<IProjectTemplateAttributes> {
    const conflict = await ProjectTemplate.findOne({ where: { Name: input.Name } });
    if (conflict) {
      throw new Error(`A template named "${input.Name}" already exists`);
    }
    const row = await ProjectTemplate.create({
      Name: input.Name,
      Description: input.Description ?? null,
      Icon: input.Icon ?? null,
      Category: input.Category,
      DefaultConfig: input.DefaultConfig,
      IsBuiltIn: false, // forced — only the migration seeds built-ins
      CreatedBy: input.CreatedBy,
    } as never);
    Logger.Info('ProjectTemplate created', { id: row.Id, name: row.Name, createdBy: input.CreatedBy });
    return row.toJSON();
  }

  public async Update(id: number, patch: ITemplateUpdateInput): Promise<IProjectTemplateAttributes | null> {
    const row = await ProjectTemplate.findByPk(id);
    if (!row) return null;
    if (row.IsBuiltIn) throw new TemplateImmutableError(id);

    if (patch.Name && patch.Name !== row.Name) {
      const conflict = await ProjectTemplate.findOne({
        where: { Name: patch.Name, Id: { [Op.ne]: id } },
      });
      if (conflict) throw new Error(`A template named "${patch.Name}" already exists`);
    }

    if (patch.Name !== undefined) row.Name = patch.Name;
    if (patch.Description !== undefined) row.Description = patch.Description;
    if (patch.Icon !== undefined) row.Icon = patch.Icon;
    if (patch.Category !== undefined) row.Category = patch.Category;
    if (patch.DefaultConfig !== undefined) row.DefaultConfig = patch.DefaultConfig;
    await row.save();
    return row.toJSON();
  }

  public async Delete(id: number): Promise<boolean> {
    const row = await ProjectTemplate.findByPk(id);
    if (!row) return false;
    if (row.IsBuiltIn) throw new TemplateImmutableError(id);
    await row.destroy();
    Logger.Info('ProjectTemplate deleted', { id });
    return true;
  }
}

export default ProjectTemplateService;
