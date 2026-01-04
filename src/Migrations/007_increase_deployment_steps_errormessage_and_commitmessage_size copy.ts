/**
 * Migration: Increase ProjectAuditLogs Changes column sizes
 * Date: 2026-01-04
 * Description: Changes Changes column from TEXT to LONGTEXT to accommodate
 * the new formatted logging system with timestamps, levels, and phases.
 * TEXT max: 65,535 bytes, LONGTEXT max: 4GB
 */

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log('ℹ️  Migration 008: Increasing ProjectAuditLogs Changes column sizes...');

    // Check if the table exists
    const tableDescription = await queryInterface.describeTable('ProjectAuditLogs');

    if (!tableDescription) {
      console.log('ℹ️  Migration 008: ProjectAuditLogs table does not exist, skipping');
      await transaction.commit();
      return;
    }

    // Modify Changes column from TEXT to LONGTEXT
    if (tableDescription.Changes) {
      await queryInterface.changeColumn(
        'ProjectAuditLogs',
        'Changes',
        {
          type: DataTypes.TEXT('long'),
          allowNull: true,
        },
        { transaction }
      );
      console.log('✅ Migration 008: Changes column changed to LONGTEXT');
    } else {
      console.log('ℹ️  Migration 008: Changes column does not exist, skipping');
    }
    await transaction.commit();
    console.log('✅ Migration 008: Completed successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 008 failed:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log('ℹ️  Migration 008: Rolling back - changing LONGTEXT back to TEXT...');

    const tableDescription = await queryInterface.describeTable('ProjectAuditLogs');

    if (!tableDescription) {
      console.log('ℹ️  Migration 008: ProjectAuditLogs table does not exist, skipping rollback');
      await transaction.commit();
      return;
    }

    // Revert Changes column from LONGTEXT to TEXT
    if (tableDescription.Changes) {
      await queryInterface.changeColumn(
        'ProjectAuditLogs',
        'Changes',
        {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        { transaction }
      );
      console.log('✅ Migration 008: Changes column reverted to TEXT');
    }

    await transaction.commit();
    console.log('✅ Migration 008: Rollback completed successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 008 rollback failed:', error);
    throw error;
  }
};
