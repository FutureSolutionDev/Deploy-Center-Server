/**
 * Migration: Increase Deployments ErrorMessage and CommitMessage column sizes
 * Date: 2026-01-04
 * Description: Changes ErrorMessage and CommitMessage columns from TEXT to LONGTEXT to accommodate
 * the new formatted logging system with timestamps, levels, and phases.
 * TEXT max: 65,535 bytes, LONGTEXT max: 4GB
 */

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log('ℹ️  Migration 007: Increasing Deployments Output and Error column sizes...');

    // Check if the table exists
    const tableDescription = await queryInterface.describeTable('Deployments');

    if (!tableDescription) {
      console.log('ℹ️  Migration 007: Deployments table does not exist, skipping');
      await transaction.commit();
      return;
    }

    // Modify ErrorMessage column from TEXT to LONGTEXT
    if (tableDescription.ErrorMessage) {
      await queryInterface.changeColumn(
        'Deployments',
        'ErrorMessage',
        {
          type: DataTypes.TEXT('long'),
          allowNull: true,
        },
        { transaction }
      );
      console.log('✅ Migration 007: Output column changed to LONGTEXT');
    } else {
      console.log('ℹ️  Migration 007: Output column does not exist, skipping');
    }

    // Modify CommitMessage column from TEXT to LONGTEXT
    if (tableDescription.CommitMessage) {
      await queryInterface.changeColumn(
        'Deployments',
        'CommitMessage',
        {
          type: DataTypes.TEXT('long'),
          allowNull: true,
        },
        { transaction }
      );
      console.log('✅ Migration 007: CommitMessage column changed to LONGTEXT');
    } else {
      console.log('ℹ️  Migration 007: CommitMessage column does not exist, skipping');
    }

    await transaction.commit();
    console.log('✅ Migration 007: Completed successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 007 failed:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log('ℹ️  Migration 007: Rolling back - changing LONGTEXT back to TEXT...');

    const tableDescription = await queryInterface.describeTable('Deployments');

    if (!tableDescription) {
      console.log('ℹ️  Migration 007: Deployments table does not exist, skipping rollback');
      await transaction.commit();
      return;
    }

    // Revert ErrorMessage column from LONGTEXT to TEXT
    if (tableDescription.ErrorMessage) {
      await queryInterface.changeColumn(
        'Deployments',
        'ErrorMessage',
        {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        { transaction }
      );
      console.log('✅ Migration 007: ErrorMessage column reverted to TEXT');
    }

    // Revert CommitMessage column from LONGTEXT to TEXT
    if (tableDescription.CommitMessage) {
      await queryInterface.changeColumn(
        'Deployments',
        'CommitMessage',
        {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        { transaction }
      );
      console.log('✅ Migration 007: CommitMessage column reverted to TEXT');
    }

    await transaction.commit();
    console.log('✅ Migration 007: Rollback completed successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 007 rollback failed:', error);
    throw error;
  }
};
