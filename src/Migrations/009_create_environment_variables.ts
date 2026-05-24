/**
 * Migration 009: create EnvironmentVariables table (v3.0 F-003).
 * Per-project encrypted key/value store; values encrypted with AES-256-GCM
 * via Utils/EncryptionHelper (same master ENCRYPTION_KEY as SSH keys).
 * Unique (ProjectId, KeyName); CASCADE on Projects delete (FR-013).
 */

import { QueryInterface, DataTypes } from 'sequelize';

const TABLE = 'EnvironmentVariables';

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    const tables = await queryInterface.showAllTables();
    const exists =
      tables.includes(TABLE) || tables.includes(TABLE.toLowerCase());

    if (exists) {
      console.log(`ℹ️  Migration 009: ${TABLE} already exists, skipping`);
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
        KeyName: {
          type: DataTypes.STRING(100),
          allowNull: false,
          comment: 'POSIX env var name — /^[A-Z_][A-Z0-9_]{0,99}$/',
        },
        ValueEncrypted: {
          type: DataTypes.TEXT('long'),
          allowNull: false,
          comment: 'AES-256-GCM ciphertext (hex)',
        },
        Iv: {
          type: DataTypes.STRING(32),
          allowNull: false,
          comment: '16-byte IV (hex) — unique per row',
        },
        AuthTag: {
          type: DataTypes.STRING(32),
          allowNull: false,
          comment: '16-byte GCM auth tag (hex)',
        },
        IsSecret: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'If true, value redacted to *** in deployment logs (FR-012)',
        },
        IsActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'Soft-delete flag (Constitution Principle IV)',
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
        fields: ['ProjectId', 'KeyName'],
        type: 'unique',
        name: 'uniq_env_vars_project_key',
        transaction,
      });
    } catch (err) {
      if (!(err as Error).message?.includes('Duplicate key name')) throw err;
    }

    try {
      await queryInterface.addIndex(TABLE, ['ProjectId'], {
        name: 'idx_env_vars_project',
        transaction,
      });
    } catch (err) {
      if (!(err as Error).message?.includes('Duplicate key name')) throw err;
    }

    console.log(`✅ Migration 009: ${TABLE} created`);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 009 failed:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    await queryInterface.dropTable(TABLE, { transaction });
    console.log(`✅ Migration 009: ${TABLE} dropped`);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 009 rollback failed:', error);
    throw error;
  }
};
