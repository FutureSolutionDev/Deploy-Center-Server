/**
 * Migration: Add FullLog column to Deployments table
 * Date: 2026-01-04
 * Description: Adds a LONGTEXT column to store complete deployment logs
 * This ensures all real-time logs (init, pipeline start/complete, etc.) are persisted
 */

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log('ℹ️  Migration 009: Adding FullLog column to Deployments table...');

    // Check if the table exists
    const tableDescription = await queryInterface.describeTable('Deployments');

    if (!tableDescription) {
      console.log('ℹ️  Migration 009: Deployments table does not exist, skipping');
      await transaction.commit();
      return;
    }

    // Add FullLog column if it doesn't exist
    if (!tableDescription.FullLog) {
      await queryInterface.addColumn(
        'Deployments',
        'FullLog',
        {
          type: DataTypes.TEXT('long'),
          allowNull: true,
          defaultValue: null,
        },
        { transaction }
      );
      console.log('✅ Migration 009: FullLog column added to Deployments table');
    } else {
      console.log('ℹ️  Migration 009: FullLog column already exists, skipping');
    }

    await transaction.commit();
    console.log('✅ Migration 009: Completed successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 009 failed:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log('ℹ️  Migration 009: Rolling back - removing FullLog column...');

    const tableDescription = await queryInterface.describeTable('Deployments');

    if (!tableDescription) {
      console.log('ℹ️  Migration 009: Deployments table does not exist, skipping rollback');
      await transaction.commit();
      return;
    }

    // Remove FullLog column if it exists
    if (tableDescription.FullLog) {
      await queryInterface.removeColumn('Deployments', 'FullLog', { transaction });
      console.log('✅ Migration 009: FullLog column removed');
    }

    await transaction.commit();
    console.log('✅ Migration 009: Rollback completed successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 009 rollback failed:', error);
    throw error;
  }
};
