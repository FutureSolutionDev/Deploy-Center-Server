/**
 * Migration: Create ProjectMembers table
 * Date: 2025-12-28
 * Description: Creates ProjectMembers table for many-to-many relationship between Projects and Users
 * Enables multi-owner support for projects (one project can have multiple developers)
 */

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // Check if table already exists
    const tables = await queryInterface.showAllTables();
    const tableExists = tables.includes('ProjectMembers') || tables.includes('projectmembers');

    if (!tableExists) {
      // Create ProjectMembers table
      await queryInterface.createTable(
        'ProjectMembers',
        {
          Id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false,
          },
          ProjectId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            references: {
              model: 'Projects',
              key: 'Id',
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          UserId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            references: {
              model: 'Users',
              key: 'Id',
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          Role: {
            type: DataTypes.ENUM('owner', 'member'),
            allowNull: false,
            defaultValue: 'member',
            comment: 'owner = project creator, member = assigned developer',
          },
          AddedBy: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            references: {
              model: 'Users',
              key: 'Id',
            },
            comment: 'UserId who added this member (Admin/Manager)',
          },
          AddedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          CreatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          UpdatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
        },
        { transaction }
      );

      // Add unique constraint on ProjectId + UserId (check if not exists)
      try {
        await queryInterface.addConstraint('ProjectMembers', {
          fields: ['ProjectId', 'UserId'],
          type: 'unique',
          name: 'unique_project_user',
          transaction,
        });
      } catch (error: any) {
        if (!error.message?.includes('Duplicate key name')) {
          throw error;
        }
      }

      // Add index on ProjectId for faster lookups
      try {
        await queryInterface.addIndex('ProjectMembers', ['ProjectId'], {
          name: 'idx_project_members_project_id',
          transaction,
        });
      } catch (error: any) {
        if (!error.message?.includes('Duplicate key name')) {
          throw error;
        }
      }

      // Add index on UserId for faster lookups
      try {
        await queryInterface.addIndex('ProjectMembers', ['UserId'], {
          name: 'idx_project_members_user_id',
          transaction,
        });
      } catch (error: any) {
        if (!error.message?.includes('Duplicate key name')) {
          throw error;
        }
      }

      // Migrate existing projects to ProjectMembers
      // For each existing project, add the creator as an 'owner'
      await queryInterface.sequelize.query(
        `INSERT INTO ProjectMembers (ProjectId, UserId, Role, AddedBy, AddedAt, CreatedAt, UpdatedAt)
         SELECT Id, CreatedBy, 'owner', CreatedBy, NOW(), NOW(), NOW()
         FROM Projects
         WHERE CreatedBy IS NOT NULL`,
        { transaction }
      );

      console.log('✅ Migration 002: ProjectMembers table created successfully');
      console.log('✅ Migration 002: Existing projects migrated to ProjectMembers');
    } else {
      console.log('ℹ️  Migration 002: ProjectMembers table already exists, skipping');
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 002 failed:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // Drop table (cascading foreign keys will handle cleanup)
    await queryInterface.dropTable('ProjectMembers', { transaction });

    console.log('✅ Migration 002: ProjectMembers table dropped successfully');

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 002 rollback failed:', error);
    throw error;
  }
};
