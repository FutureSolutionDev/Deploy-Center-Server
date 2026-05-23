/**
 * Migration 019: ProjectNotificationSubscriptions — v3.0 F-006 (T050).
 * M:N between Projects and NotificationChannels with per-row Events filter.
 * A project receives a notification on a channel for an event iff a matching
 * active subscription row exists.
 * FK → Projects + NotificationChannels, both ON DELETE CASCADE.
 */

import { QueryInterface, DataTypes } from 'sequelize';

const TABLE = 'ProjectNotificationSubscriptions';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    const tables = await queryInterface.showAllTables();
    const exists = tables.includes(TABLE) || tables.includes(TABLE.toLowerCase());
    if (exists) {
      console.log(`ℹ️  Migration 019: ${TABLE} already exists, skipping`);
      await transaction.commit();
      return;
    }

    await queryInterface.createTable(
      TABLE,
      {
        Id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        ProjectId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: 'Projects', key: 'Id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        ChannelId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: 'NotificationChannels', key: 'Id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        Events: {
          type: DataTypes.JSON,
          allowNull: false,
          comment:
            'JSON array of ENotificationEvent values (DeploymentStarted, Succeeded, Failed, RolledBack, Cancelled)',
        },
        IsActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
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

    try {
      await queryInterface.addConstraint(TABLE, {
        fields: ['ProjectId', 'ChannelId'],
        type: 'unique',
        name: 'uniq_subs_project_channel',
        transaction,
      });
    } catch (e) {
      if (!(e as Error).message?.includes('Duplicate key name')) throw e;
    }
    try {
      await queryInterface.addIndex(TABLE, ['ProjectId'], {
        name: 'idx_subs_project',
        transaction,
      });
      await queryInterface.addIndex(TABLE, ['ChannelId'], {
        name: 'idx_subs_channel',
        transaction,
      });
    } catch (e) {
      if (!(e as Error).message?.includes('Duplicate key name')) throw e;
    }

    console.log(`✅ Migration 019: ${TABLE} created`);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 019 failed:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    await queryInterface.dropTable(TABLE, { transaction });
    console.log(`✅ Migration 019: ${TABLE} dropped`);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 019 rollback failed:', error);
    throw error;
  }
};
