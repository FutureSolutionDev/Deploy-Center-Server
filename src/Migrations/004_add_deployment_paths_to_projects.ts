/**
 * Migration: Add DeploymentPaths to Projects table
 * Date: 2025-12-28
 * Description: Adds DeploymentPaths JSON column to support multiple deployment locations
 * Migrates existing ProjectPath values to DeploymentPaths array for backward compatibility
 */

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // Check if column already exists
    const tableDescription = await queryInterface.describeTable('Projects');

    if (!tableDescription.DeploymentPaths) {
      // Add DeploymentPaths column
      await queryInterface.addColumn(
        'Projects',
        'DeploymentPaths',
        {
          type: DataTypes.JSON,
          allowNull: false,
          defaultValue: '[]',
        },
        { transaction }
      );

      console.log('✅ Migration 004: DeploymentPaths column added');
    } else {
      console.log('ℹ️  Migration 004: DeploymentPaths column already exists');
    }

    // Migrate existing ProjectPath values to DeploymentPaths for ALL projects
    // Use simple UPDATE query to avoid JSON parsing issues during migration
    const result = await queryInterface.sequelize.query(
      `UPDATE Projects
       SET DeploymentPaths = JSON_ARRAY(ProjectPath)
       WHERE (DeploymentPaths IS NULL
              OR DeploymentPaths = '[]'
              OR DeploymentPaths = ''
              OR JSON_LENGTH(DeploymentPaths) = 0)
         AND ProjectPath IS NOT NULL
         AND ProjectPath != ''`,
      { transaction }
    );

    const affectedRows = result[0] as any;
    const migratedCount = affectedRows?.affectedRows || affectedRows || 0;

    console.log(`✅ Migration 004: Migrated ${migratedCount} projects from ProjectPath to DeploymentPaths`);

    await transaction.commit();
    console.log('✅ Migration 004: Completed successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 004 failed:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // Check if column exists before dropping
    const tableDescription = await queryInterface.describeTable('Projects');

    if (tableDescription.DeploymentPaths) {
      // Remove DeploymentPaths column (rollback)
      await queryInterface.removeColumn('Projects', 'DeploymentPaths', { transaction });

      console.log('✅ Migration 004: DeploymentPaths column removed');
    }

    await transaction.commit();
    console.log('✅ Migration 004: Rollback completed successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 004 rollback failed:', error);
    throw error;
  }
};
