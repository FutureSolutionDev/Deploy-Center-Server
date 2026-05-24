/**
 * Migration 013: create NotificationProviders table — v3.0 F-006 (T048).
 * Central per-integration credential store. Credentials encrypted with the
 * master ENCRYPTION_KEY (AES-256-GCM via Utils/EncryptionHelper, fresh IV
 * per row). One row per Slack workspace / Discord webhook root / SMTP host.
 */

import { QueryInterface, DataTypes } from 'sequelize';

const TABLE = 'NotificationProviders';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    const tables = await queryInterface.showAllTables();
    const exists = tables.includes(TABLE) || tables.includes(TABLE.toLowerCase());
    if (exists) {
      console.log(`ℹ️  Migration 013: ${TABLE} already exists, skipping`);
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
        Name: {
          type: DataTypes.STRING(100),
          allowNull: false,
          comment: 'Operator-facing label, e.g. "Production Slack Workspace"',
        },
        Type: {
          type: DataTypes.ENUM('discord', 'slack', 'email'),
          allowNull: false,
        },
        ConfigEncrypted: {
          type: DataTypes.TEXT('long'),
          allowNull: false,
          comment: 'AES-256-GCM encrypted JSON; shape varies per Type',
        },
        Iv: { type: DataTypes.STRING(32), allowNull: false },
        AuthTag: { type: DataTypes.STRING(32), allowNull: false },
        IsActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        CreatedBy: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: { model: 'Users', key: 'Id' },
          onDelete: 'SET NULL',
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
        fields: ['Name'],
        type: 'unique',
        name: 'uniq_notif_providers_name',
        transaction,
      });
    } catch (e) {
      if (!(e as Error).message?.includes('Duplicate key name')) throw e;
    }
    try {
      await queryInterface.addIndex(TABLE, ['Type'], {
        name: 'idx_notif_providers_type',
        transaction,
      });
    } catch (e) {
      if (!(e as Error).message?.includes('Duplicate key name')) throw e;
    }

    console.log(`✅ Migration 013: ${TABLE} created`);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 013 failed:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    await queryInterface.dropTable(TABLE, { transaction });
    console.log(`✅ Migration 013: ${TABLE} dropped`);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 013 rollback failed:', error);
    throw error;
  }
};
