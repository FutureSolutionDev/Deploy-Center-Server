/**
 * Migration: Add CreatedBy field to Projects table
 * Date: 2025-12-19
 * Description: Adds CreatedBy column to track project ownership for RBAC
 */

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // Check if column already exists
    const tableDescription = await queryInterface.describeTable('Projects');

    if (!tableDescription.CreatedBy) {
      // Add CreatedBy column
      await queryInterface.addColumn(
        'Projects',
        'CreatedBy',
        {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true, // Temporarily allow null for existing rows
        },
        { transaction }
      );

      // Set CreatedBy to the first admin user for existing projects
      await queryInterface.sequelize.query(
        `UPDATE Projects
         SET CreatedBy = (SELECT Id FROM Users WHERE Role = 'admin' ORDER BY Id ASC LIMIT 1)
         WHERE CreatedBy IS NULL`,
        { transaction }
      );

      // Make CreatedBy NOT NULL after updating existing rows
      await queryInterface.changeColumn(
        'Projects',
        'CreatedBy',
        {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        { transaction }
      );

      // Add foreign key constraint
      await queryInterface.addConstraint('Projects', {
        fields: ['CreatedBy'],
        type: 'foreign key',
        name: 'fk_projects_created_by',
        references: {
          table: 'Users',
          field: 'Id',
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
        transaction,
      });

      console.log('✅ Migration 001: CreatedBy column added successfully');
    } else {
      console.log('ℹ️  Migration 001: CreatedBy column already exists, skipping');
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 001 failed:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // Remove foreign key constraint
    await queryInterface.removeConstraint('Projects', 'fk_projects_created_by', { transaction });

    // Remove CreatedBy column
    await queryInterface.removeColumn('Projects', 'CreatedBy', { transaction });

    console.log('✅ Migration 001: CreatedBy column removed successfully');

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 001 rollback failed:', error);
    throw error;
  }
};
