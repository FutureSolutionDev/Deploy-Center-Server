/**
 * Migration: Increase DeploymentSteps Output and Error column sizes
 * Date: 2026-01-04
 * Description: Changes Output and Error columns from TEXT to LONGTEXT to accommodate
 * the new formatted logging system with timestamps, levels, and phases.
 * TEXT max: 65,535 bytes, LONGTEXT max: 4GB
 */

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log('ℹ️  Migration 006: Increasing DeploymentSteps Output and Error column sizes...');

    // Check if the table exists
    const tableDescription = await queryInterface.describeTable('DeploymentSteps');

    if (!tableDescription) {
      console.log('ℹ️  Migration 006: DeploymentSteps table does not exist, skipping');
      await transaction.commit();
      return;
    }

    // Modify Output column from TEXT to LONGTEXT
    if (tableDescription.Output) {
      await queryInterface.changeColumn(
        'DeploymentSteps',
        'Output',
        {
          type: DataTypes.TEXT('long'),
          allowNull: true,
        },
        { transaction }
      );
      console.log('✅ Migration 006: Output column changed to LONGTEXT');
    } else {
      console.log('ℹ️  Migration 006: Output column does not exist, skipping');
    }

    // Modify Error column from TEXT to LONGTEXT
    if (tableDescription.Error) {
      await queryInterface.changeColumn(
        'DeploymentSteps',
        'Error',
        {
          type: DataTypes.TEXT('long'),
          allowNull: true,
        },
        { transaction }
      );
      console.log('✅ Migration 006: Error column changed to LONGTEXT');
    } else {
      console.log('ℹ️  Migration 006: Error column does not exist, skipping');
    }

    await transaction.commit();
    console.log('✅ Migration 006: Completed successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 006 failed:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    console.log('ℹ️  Migration 006: Rolling back - changing LONGTEXT back to TEXT...');

    const tableDescription = await queryInterface.describeTable('DeploymentSteps');

    if (!tableDescription) {
      console.log('ℹ️  Migration 006: DeploymentSteps table does not exist, skipping rollback');
      await transaction.commit();
      return;
    }

    // Revert Output column from LONGTEXT to TEXT
    if (tableDescription.Output) {
      await queryInterface.changeColumn(
        'DeploymentSteps',
        'Output',
        {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        { transaction }
      );
      console.log('✅ Migration 006: Output column reverted to TEXT');
    }

    // Revert Error column from LONGTEXT to TEXT
    if (tableDescription.Error) {
      await queryInterface.changeColumn(
        'DeploymentSteps',
        'Error',
        {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        { transaction }
      );
      console.log('✅ Migration 006: Error column reverted to TEXT');
    }

    await transaction.commit();
    console.log('✅ Migration 006: Rollback completed successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 006 rollback failed:', error);
    throw error;
  }
};
