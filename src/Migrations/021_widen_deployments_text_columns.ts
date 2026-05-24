/**
 * Migration 021: widen Deployments.ErrorMessage + Deployments.CommitMessage
 * from TEXT (64KB) to LONGTEXT (4GB).
 *
 * History: an earlier file `007_increase_deployment_steps_errormessage_and_
 * commitmessage_size copy.ts` was intended to do this, but its file body was
 * an exact copy of migration 008 (ProjectAuditLogs.Changes widening) and
 * MigrationRunner.ts imported it under slot 007, so the real widening never
 * ran on any install. The Deployment model (`Models/Deployment.ts`) already
 * declares both columns as `DataTypes.TEXT('long')`, so on FRESH installs
 * via `sync({ alter: true })` the columns are LONGTEXT. On upgrades from
 * v2.1 (where sync was alter:false), the columns stayed at TEXT —
 * deployment logs and long commit messages were silently truncated at 64KB.
 *
 * This migration plugs the gap.
 *
 * Idempotent: `changeColumn` from LONGTEXT to LONGTEXT is a no-op in MySQL
 * (same column definition), and we additionally guard via describeTable
 * to keep the migration safe on fresh DBs where the columns already match.
 */

import { QueryInterface, DataTypes } from 'sequelize';

const TABLE = 'Deployments';

interface IColumnDescription {
  type: string;
}

function isAlreadyLongtext(col: IColumnDescription | undefined): boolean {
  if (!col?.type) return false;
  const t = col.type.toUpperCase();
  return t === 'LONGTEXT' || t.startsWith('LONGTEXT');
}

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    const desc = (await queryInterface.describeTable(TABLE)) as Record<string, IColumnDescription>;

    if (desc.ErrorMessage && !isAlreadyLongtext(desc.ErrorMessage)) {
      await queryInterface.changeColumn(
        TABLE,
        'ErrorMessage',
        { type: DataTypes.TEXT('long'), allowNull: true },
        { transaction }
      );
      console.log(`✅ Migration 021: ${TABLE}.ErrorMessage widened to LONGTEXT`);
    } else {
      console.log(`ℹ️  Migration 021: ${TABLE}.ErrorMessage already LONGTEXT, skipping`);
    }

    if (desc.CommitMessage && !isAlreadyLongtext(desc.CommitMessage)) {
      await queryInterface.changeColumn(
        TABLE,
        'CommitMessage',
        { type: DataTypes.TEXT('long'), allowNull: true },
        { transaction }
      );
      console.log(`✅ Migration 021: ${TABLE}.CommitMessage widened to LONGTEXT`);
    } else {
      console.log(`ℹ️  Migration 021: ${TABLE}.CommitMessage already LONGTEXT, skipping`);
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 021 failed:', error);
    throw error;
  }
};

export const down = async (queryInterface: QueryInterface): Promise<void> => {
  const transaction = await queryInterface.sequelize.transaction();
  try {
    // Down narrows back to TEXT (64KB) — UNSAFE for rows whose value already
    // exceeds 64KB (MySQL will truncate silently). Document this explicitly.
    const desc = (await queryInterface.describeTable(TABLE)) as Record<string, IColumnDescription>;

    if (desc.ErrorMessage && isAlreadyLongtext(desc.ErrorMessage)) {
      await queryInterface.changeColumn(
        TABLE,
        'ErrorMessage',
        { type: DataTypes.TEXT, allowNull: true },
        { transaction }
      );
      console.log(`✅ Migration 021 down: ${TABLE}.ErrorMessage narrowed to TEXT (may truncate!)`);
    }

    if (desc.CommitMessage && isAlreadyLongtext(desc.CommitMessage)) {
      await queryInterface.changeColumn(
        TABLE,
        'CommitMessage',
        { type: DataTypes.TEXT, allowNull: true },
        { transaction }
      );
      console.log(`✅ Migration 021 down: ${TABLE}.CommitMessage narrowed to TEXT (may truncate!)`);
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration 021 rollback failed:', error);
    throw error;
  }
};
