/**
 * Test DB setup helper — F-002.
 * Loads .env.test, runs all migrations against the isolated test schema,
 * and exposes truncateAll() for fast between-test cleanup (faster than re-migrating).
 */

import path from 'path';
import dotenv from 'dotenv';
import { QueryTypes, Sequelize } from 'sequelize';

// Load .env.test BEFORE importing any module that reads env vars at import time.
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

import { DatabaseConnection } from '@Database/DatabaseConnection';
import { MigrationRunner } from '@Database/MigrationRunner';

let cachedSequelize: Sequelize | null = null;

/**
 * Boot the test DB connection. Idempotent — safe to call from multiple suites.
 */
export async function setupTestDb(): Promise<Sequelize> {
  if (cachedSequelize) return cachedSequelize;

  const sequelize = DatabaseConnection.GetInstance();
  await sequelize.authenticate();
  await MigrationRunner.RunMigrations();
  cachedSequelize = sequelize;
  return sequelize;
}

/**
 * Tear down: close the connection cleanly. Call from afterAll().
 */
export async function teardownTestDb(): Promise<void> {
  if (cachedSequelize) {
    await cachedSequelize.close();
    cachedSequelize = null;
  }
}

/**
 * TRUNCATE every non-system table in the test schema with FK checks off,
 * then re-enable them. Much faster than migrate down + up between tests.
 */
export async function truncateAll(): Promise<void> {
  const sequelize = await setupTestDb();
  const dbName = sequelize.getDatabaseName();

  const rows = (await sequelize.query(
    `SELECT TABLE_NAME AS name FROM information_schema.tables
     WHERE TABLE_SCHEMA = :db AND TABLE_TYPE = 'BASE TABLE'
       AND TABLE_NAME NOT IN ('SequelizeMeta')`,
    { type: QueryTypes.SELECT, replacements: { db: dbName } }
  )) as Array<{ name: string }>;

  if (rows.length === 0) return;

  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
  try {
    for (const { name } of rows) {
      await sequelize.query(`TRUNCATE TABLE \`${name}\`;`);
    }
  } finally {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
  }
}
