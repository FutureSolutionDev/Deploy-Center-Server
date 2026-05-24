/**
 * Migration 016: create Workspaces table + add Project.WorkspaceId — v3.0 F-009.
 *
 * - Workspaces.CreatedBy FK → Users **ON DELETE SET NULL** (orphan, NOT delete).
 * - Project.WorkspaceId   FK → Workspaces **ON DELETE SET NULL** (un-group, NOT delete).
 *
 * Both nullable on purpose — workspaces are optional throughout v3.0.
 */

import { QueryInterface, DataTypes } from 'sequelize';

const TABLE = 'Workspaces';
const FK_COL = 'WorkspaceId';
const FK_INDEX = 'idx_projects_workspace';
// (FK_CONSTRAINT removed — we don't pin the FK name in up(), so we don't
// need it in down(); see comment in down() about removeColumn cascading.)

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    // ---- Workspaces table -------------------------------------------------
    const tables = await queryInterface.showAllTables();
    const exists = tables.includes(TABLE) || tables.includes(TABLE.toLowerCase());

    if (!exists) {
      await queryInterface.createTable(
        TABLE,
        {
          Id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
          },
          Name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            comment: 'Operator-facing label; unique per CreatedBy user',
          },
          Description: { type: DataTypes.TEXT, allowNull: true },
          Color: {
            type: DataTypes.STRING(7),
            allowNull: false,
            comment: 'Hex color #RRGGBB',
          },
          Icon: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'folder',
            comment: 'Key from WORKSPACE_ICON_KEYS allow-list',
          },
          CreatedBy: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            references: { model: 'Users', key: 'Id' },
            onDelete: 'SET NULL',
            comment:
              'NULL = orphan (creator was deleted; workspace persists for the team)',
          },
          IsActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
          },
          CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
          UpdatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        },
        { transaction }
      );

      try {
        await queryInterface.addConstraint(TABLE, {
          fields: ['CreatedBy', 'Name'],
          type: 'unique',
          name: 'uniq_workspaces_user_name',
          transaction,
        });
      } catch (e) {
        if (!(e as Error).message?.includes('Duplicate key name')) throw e;
      }
      try {
        await queryInterface.addIndex(TABLE, ['CreatedBy'], {
          name: 'idx_workspaces_created_by',
          transaction,
        });
      } catch (e) {
        if (!(e as Error).message?.includes('Duplicate key name')) throw e;
      }

      console.log(`✅ Migration 016: ${TABLE} created`);
    } else {
      console.log(`ℹ️  Migration 016: ${TABLE} already exists, skipping`);
    }

    // ---- Project.WorkspaceId column --------------------------------------
    const projectColumns = (await queryInterface.describeTable('Projects')) as Record<
      string,
      unknown
    >;
    if (!projectColumns[FK_COL]) {
      await queryInterface.addColumn(
        'Projects',
        FK_COL,
        {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: { model: TABLE, key: 'Id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
        },
        { transaction }
      );
      console.log(`✅ Migration 016: Projects.${FK_COL} added`);
    } else {
      console.log(`ℹ️  Migration 016: Projects.${FK_COL} already exists, skipping`);
    }

    try {
      await queryInterface.addIndex('Projects', [FK_COL], {
        name: FK_INDEX,
        transaction,
      });
      console.log(`✅ Migration 016: index ${FK_INDEX} added`);
    } catch (e) {
      if (!(e as Error).message?.includes('Duplicate key name')) throw e;
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 016 failed:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    // Reverse order: drop the index, then drop the column (which cascades
    // the auto-named FK), then drop the table. We don't call
    // removeConstraint by name here — Sequelize auto-named the FK in up()
    // (we didn't pin its name), so removeColumn is the reliable way to
    // drop the FK+column together.
    try {
      await queryInterface.removeIndex('Projects', FK_INDEX, { transaction });
    } catch {
      // ignore
    }
    const projectColumns = (await queryInterface.describeTable('Projects')) as Record<
      string,
      unknown
    >;
    if (projectColumns[FK_COL]) {
      await queryInterface.removeColumn('Projects', FK_COL, { transaction });
    }
    await queryInterface.dropTable(TABLE, { transaction });
    console.log(`✅ Migration 016: ${TABLE} + Projects.${FK_COL} dropped`);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 016 rollback failed:', error);
    throw error;
  }
};
