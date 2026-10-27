/**
 * Migration 000 (v3.0.1 — OPS-C2): baseline schema for fresh installs.
 *
 * The ALTER-style migrations 001+ assume the v2.1 tables already exist
 * (historically created by sequelize.sync()), so on an empty database
 * migration 001 failed with `No description found for "Projects" table`
 * and a new install could not start.
 *
 * Behaviour:
 *   - Empty database (none of Users / Projects / Deployments exist): create
 *     the complete current schema from the models (`sync({ alter: false })`).
 *     Every later migration is idempotent and becomes a no-op on it.
 *   - Existing database: no-op. Nothing is created, altered or dropped.
 *
 * Because this baseline is generated from the models, every future migration
 * must keep checking the current schema before changing it (as 001-022 do).
 */

import { QueryInterface } from 'sequelize';
import Logger from '@Utils/Logger';
import { InitializeAssociations } from '@Models/index';

const CORE_TABLES = ['Users', 'Projects', 'Deployments'];

async function existingTables(queryInterface: QueryInterface): Promise<Set<string>> {
  const tables = (await queryInterface.showAllTables()) as unknown[];
  return new Set(
    tables
      .map((t) => (typeof t === 'string' ? t : (t as { tableName?: string }).tableName))
      .filter((name): name is string => typeof name === 'string')
      .map((name) => name.toLowerCase())
  );
}

export const up = async (queryInterface: QueryInterface): Promise<void> => {
  const tables = await existingTables(queryInterface);
  if (CORE_TABLES.some((table) => tables.has(table.toLowerCase()))) {
    Logger.Info('Migration 000: existing schema detected, baseline skipped');
    return;
  }

  InitializeAssociations();
  await queryInterface.sequelize.sync({ alter: false });
  Logger.Info('Migration 000: baseline schema created on empty database');
};

/**
 * Rolling back the baseline drops every model table and therefore all data.
 * It only exists so the runner can undo a fresh install; never run it on a
 * database that holds real data.
 */
export const down = async (queryInterface: QueryInterface): Promise<void> => {
  InitializeAssociations();
  await queryInterface.sequelize.drop();
  Logger.Warn('Migration 000: baseline rolled back (all model tables dropped)');
};
