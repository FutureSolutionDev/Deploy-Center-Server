/**
 * Migration: Create ProjectAuditLogs table
 * Date: 2025-12-28
 * Description: Creates ProjectAuditLogs table for comprehensive audit trail
 * Tracks all modifications to projects with detailed change history
 */

import { QueryInterface, DataTypes } from 'sequelize';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // Check if table already exists
    const tables = await queryInterface.showAllTables();
    const tableExists = tables.includes('ProjectAuditLogs') || tables.includes('projectauditlogs');

    if (!tableExists) {
      // Create ProjectAuditLogs table
      await queryInterface.createTable(
        'ProjectAuditLogs',
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
            comment: 'User who made the change',
          },
          Action: {
            type: DataTypes.ENUM(
              'create',
              'update',
              'delete',
              'add_member',
              'remove_member',
              'regenerate_webhook',
              'toggle_ssh_key',
              'regenerate_ssh_key'
            ),
            allowNull: false,
            defaultValue: 'create',
          },
          EntityType: {
            type: DataTypes.ENUM('project', 'config', 'pipeline', 'webhook', 'ssh_key', 'member'),
            allowNull: false,
            defaultValue: 'project',
          },
          Changes: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'JSON string containing before/after values and description',
          },
          IpAddress: {
            type: DataTypes.STRING(45),
            allowNull: true,
          },
          UserAgent: {
            type: DataTypes.TEXT,
            allowNull: true,
          },
          Timestamp: {
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

      // Add index on ProjectId for faster lookups
      try {
        await queryInterface.addIndex('ProjectAuditLogs', ['ProjectId'], {
          name: 'idx_project_audit_project_id',
          transaction,
        });
      } catch (error: any) {
        if (!error.message?.includes('Duplicate key name')) {
          throw error;
        }
      }

      // Add index on UserId for faster lookups
      try {
        await queryInterface.addIndex('ProjectAuditLogs', ['UserId'], {
          name: 'idx_project_audit_user_id',
          transaction,
        });
      } catch (error: any) {
        if (!error.message?.includes('Duplicate key name')) {
          throw error;
        }
      }

      // Add index on Timestamp for chronological queries
      try {
        await queryInterface.addIndex('ProjectAuditLogs', ['Timestamp'], {
          name: 'idx_project_audit_timestamp',
          transaction,
        });
      } catch (error: any) {
        if (!error.message?.includes('Duplicate key name')) {
          throw error;
        }
      }

      // Add index on Action for filtering by action type
      try {
        await queryInterface.addIndex('ProjectAuditLogs', ['Action'], {
          name: 'idx_project_audit_action',
          transaction,
        });
      } catch (error: any) {
        if (!error.message?.includes('Duplicate key name')) {
          throw error;
        }
      }

      console.log('✅ Migration 003: ProjectAuditLogs table created successfully');
    } else {
      console.log('ℹ️  Migration 003: ProjectAuditLogs table already exists, skipping');
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 003 failed:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    // Drop table (cascading foreign keys will handle cleanup)
    await queryInterface.dropTable('ProjectAuditLogs', { transaction });

    console.log('✅ Migration 003: ProjectAuditLogs table dropped successfully');

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 003 rollback failed:', error);
    throw error;
  }
};
