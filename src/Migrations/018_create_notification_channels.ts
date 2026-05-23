/**
 * Migration 018: create NotificationChannels table — v3.0 F-006 (T049).
 * Delivery targets under a Provider (many channels per provider — e.g.
 * several Slack rooms inside one Slack workspace). Delivery-only config
 * (channel name, recipient list) encrypted per row.
 * FK → NotificationProviders ON DELETE CASCADE.
 */

import { QueryInterface, DataTypes } from 'sequelize';

const TABLE = 'NotificationChannels';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    const tables = await queryInterface.showAllTables();
    const exists = tables.includes(TABLE) || tables.includes(TABLE.toLowerCase());
    if (exists) {
      console.log(`ℹ️  Migration 018: ${TABLE} already exists, skipping`);
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
        ProviderId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: 'NotificationProviders', key: 'Id' },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        Name: {
          type: DataTypes.STRING(100),
          allowNull: false,
          comment: 'Operator label (e.g. "#deploys", "ops-list")',
        },
        DeliveryConfigEncrypted: {
          type: DataTypes.TEXT('long'),
          allowNull: false,
          comment: 'Encrypted delivery-only JSON; shape per provider type',
        },
        Iv: { type: DataTypes.STRING(32), allowNull: false },
        AuthTag: { type: DataTypes.STRING(32), allowNull: false },
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
        fields: ['ProviderId', 'Name'],
        type: 'unique',
        name: 'uniq_notif_channels_provider_name',
        transaction,
      });
    } catch (e) {
      if (!(e as Error).message?.includes('Duplicate key name')) throw e;
    }
    try {
      await queryInterface.addIndex(TABLE, ['ProviderId'], {
        name: 'idx_notif_channels_provider',
        transaction,
      });
    } catch (e) {
      if (!(e as Error).message?.includes('Duplicate key name')) throw e;
    }

    console.log(`✅ Migration 018: ${TABLE} created`);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 018 failed:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    await queryInterface.dropTable(TABLE, { transaction });
    console.log(`✅ Migration 018: ${TABLE} dropped`);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 018 rollback failed:', error);
    throw error;
  }
};
