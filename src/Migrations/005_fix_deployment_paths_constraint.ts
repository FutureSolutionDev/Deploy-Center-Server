/**
 * Migration: Fix DeploymentPaths constraint issue
 * Date: 2025-12-28
 * Description: Removes and re-adds DeploymentPaths column to fix MariaDB constraint issues
 * This migration is specifically for production servers that have the old JSON constraint
 */

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // Check if the column exists
    const tableDescription = await queryInterface.describeTable('Projects');

    if (tableDescription.DeploymentPaths) {
      // Fresh-install short-circuit: if the column is already LONGTEXT we
      // have nothing to fix — this migration only matters for the
      // problematic v2.1 → v3.0 upgrade path where the column was created
      // with the old JSON constraint. Without this check, fresh installs
      // (CI, greenfield) hit the sequelize+mariadb `removeColumn`
      // formatResults bug (same one migration 020 documents in detail).
      const colType = String(
        (tableDescription.DeploymentPaths as { type?: string }).type ?? ''
      ).toUpperCase();
      if (colType.startsWith('LONGTEXT') || colType === 'LONGTEXT') {
        console.log(
          'ℹ️  Migration 005: DeploymentPaths is already LONGTEXT, skipping (nothing to fix)'
        );
        await transaction.commit();
        return;
      }

      console.log('ℹ️  Migration 005: DeploymentPaths column exists with constraint, fixing...');

      // First, backup the data
      const [projects] = await queryInterface.sequelize.query(
        'SELECT Id, DeploymentPaths FROM Projects WHERE DeploymentPaths IS NOT NULL',
        { transaction }
      );

      console.log(`ℹ️  Migration 005: Found ${(projects as any[]).length} projects with DeploymentPaths data`);

      // Drop the problematic column entirely (this removes all constraints).
      // Uses raw ALTER TABLE to bypass the sequelize+mariadb formatResults
      // bug that fires on `queryInterface.removeColumn` (same workaround
      // as migration 020/021).
      await queryInterface.sequelize.query(
        'ALTER TABLE `Projects` DROP COLUMN `DeploymentPaths`',
        { transaction, raw: true }
      );
      console.log('✅ Migration 005: Removed DeploymentPaths column with constraints');

      // Re-add the column as LONGTEXT without any constraints
      await queryInterface.addColumn(
        'Projects',
        'DeploymentPaths',
        {
          type: DataTypes.TEXT('long'),
          allowNull: true,
          defaultValue: null,
        },
        { transaction }
      );
      console.log('✅ Migration 005: Re-added DeploymentPaths column as LONGTEXT');

      // Restore the backed up data
      for (const project of projects as any[]) {
        if (project.DeploymentPaths) {
          await queryInterface.sequelize.query(
            'UPDATE Projects SET DeploymentPaths = ? WHERE Id = ?',
            {
              replacements: [project.DeploymentPaths, project.Id],
              transaction,
            }
          );
        }
      }

      console.log(`✅ Migration 005: Restored ${(projects as any[]).length} projects' DeploymentPaths data`);

      // Migrate any remaining projects from ProjectPath to DeploymentPaths
      const result = await queryInterface.sequelize.query(
        `UPDATE Projects
         SET DeploymentPaths = JSON_ARRAY(ProjectPath)
         WHERE (DeploymentPaths IS NULL OR DeploymentPaths = '')
           AND ProjectPath IS NOT NULL
           AND ProjectPath != ''`,
        { transaction }
      );

      const affectedRows = result[0] as any;
      const migratedCount = affectedRows?.affectedRows || affectedRows || 0;
      console.log(`✅ Migration 005: Migrated ${migratedCount} additional projects from ProjectPath`);
    } else {
      console.log('ℹ️  Migration 005: DeploymentPaths column does not exist, skipping');
    }

    await transaction.commit();
    console.log('✅ Migration 005: Completed successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 005 failed:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // This rollback just removes the column
    const tableDescription = await queryInterface.describeTable('Projects');

    if (tableDescription.DeploymentPaths) {
      await queryInterface.removeColumn('Projects', 'DeploymentPaths', { transaction });
      console.log('✅ Migration 005: DeploymentPaths column removed');
    }

    await transaction.commit();
    console.log('✅ Migration 005: Rollback completed successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 005 rollback failed:', error);
    throw error;
  }
};
