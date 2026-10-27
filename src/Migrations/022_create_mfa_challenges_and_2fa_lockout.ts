/**
 * Migration 022 (v3.0.1 — SEC-C3): bind the 2FA step to the password step.
 *
 *   - MfaChallenges: hashed single-use tokens issued after a correct password
 *     for accounts with 2FA enabled (5-minute lifetime).
 *   - TwoFactorAuth.FailedAttempts / LockedUntil: per-account lockout.
 *
 * Idempotent: every step checks the current schema first, so re-running on a
 * database that already has the objects (e.g. created by the baseline) is a
 * no-op. Numbers 010, 011, 014 and 015 stay reserved for v3.1.
 */

import { DataTypes, QueryInterface, QueryTypes } from 'sequelize';
import Logger from '@Utils/Logger';

const CHALLENGES = 'MfaChallenges';
const TWO_FACTOR = 'TwoFactorAuth';

async function tableExists(queryInterface: QueryInterface, table: string): Promise<boolean> {
  const tables = (await queryInterface.showAllTables()) as unknown[];
  return tables.some((t) => {
    const name = typeof t === 'string' ? t : (t as { tableName?: string }).tableName;
    return typeof name === 'string' && name.toLowerCase() === table.toLowerCase();
  });
}

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  if (!(await tableExists(queryInterface, CHALLENGES))) {
    await queryInterface.createTable(CHALLENGES, {
      Id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      UserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: 'Users', key: 'Id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      TokenHash: { type: DataTypes.STRING(64), allowNull: false },
      ExpiresAt: { type: DataTypes.DATE, allowNull: false },
      ConsumedAt: { type: DataTypes.DATE, allowNull: true },
      Attempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      IpAddress: { type: DataTypes.STRING(64), allowNull: true },
      CreatedAt: { type: DataTypes.DATE, allowNull: false },
      UpdatedAt: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex(CHALLENGES, ['TokenHash'], {
      name: 'idx_mfa_challenges_token_hash',
      unique: true,
    });
    await queryInterface.addIndex(CHALLENGES, ['UserId'], { name: 'idx_mfa_challenges_user_id' });
    await queryInterface.addIndex(CHALLENGES, ['ExpiresAt'], {
      name: 'idx_mfa_challenges_expires_at',
    });
    Logger.Info(`Migration 022: ${CHALLENGES} table created`);
  } else {
    Logger.Info(`Migration 022: ${CHALLENGES} already exists, skipping`);
  }

  if (!(await tableExists(queryInterface, TWO_FACTOR))) {
    // Pre-baseline fresh install: the model-derived table will include the
    // columns when it is created.
    Logger.Info(`Migration 022: ${TWO_FACTOR} not present yet, skipping lockout columns`);
    return;
  }

  const columns = (await queryInterface.describeTable(TWO_FACTOR)) as Record<string, unknown>;
  if (!columns.FailedAttempts) {
    await queryInterface.addColumn(TWO_FACTOR, 'FailedAttempts', {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    });
  }
  if (!columns.LockedUntil) {
    await queryInterface.addColumn(TWO_FACTOR, 'LockedUntil', {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }
  Logger.Info(`Migration 022: ${TWO_FACTOR} lockout columns ensured`);
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  if (await tableExists(queryInterface, TWO_FACTOR)) {
    const columns = (await queryInterface.describeTable(TWO_FACTOR)) as Record<string, unknown>;
    // Raw ALTER TABLE instead of removeColumn: see CLAUDE.md (Sequelize 6.37 +
    // mariadb driver formatResults bug).
    for (const column of ['LockedUntil', 'FailedAttempts']) {
      if (columns[column]) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${TWO_FACTOR}\` DROP COLUMN \`${column}\``,
          { type: QueryTypes.RAW }
        );
      }
    }
  }
  if (await tableExists(queryInterface, CHALLENGES)) {
    await queryInterface.dropTable(CHALLENGES);
  }
  Logger.Info('Migration 022: rolled back');
};
