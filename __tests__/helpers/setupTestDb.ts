/**
 * Test DB setup helper — F-002.
 * Loads .env.test (via jest.env.setup as a belt-and-suspenders fallback;
 * primary load happens before any test module via setupFiles), syncs the
 * v2.1 baseline schema, then runs migrations against the isolated test
 * schema. Exposes truncateAll() for fast between-test cleanup.
 *
 * Why the sync step exists:
 *   The early migrations (001-008) are ALTER-style — they assume the v2.1
 *   baseline tables (Projects, Users, etc.) already exist. In production
 *   those tables exist because the v2.1 deploy created them via sync(). On
 *   a fresh CI database the tables do NOT exist yet, so we call
 *   `sequelize.sync({ alter: false })` first to bootstrap the model-derived
 *   schema, then let migrations adjust on top. Idempotent: re-running is a
 *   no-op once tables exist.
 */

import path from 'path';
import dotenv from 'dotenv';
import { QueryTypes, Sequelize } from 'sequelize';

// Belt-and-suspenders: jest.config.js setupFiles already loaded .env.test
// once before any test module imported. Re-loading here doesn't hurt (the
// values are identical) and protects ad-hoc usages that import this helper
// outside jest (e.g. a node script).
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

import { DatabaseConnection } from '@Database/DatabaseConnection';
import { MigrationRunner } from '@Database/MigrationRunner';
import { InitializeAssociations } from '@Models/index';

let cachedSequelize: Sequelize | null = null;
let associationsInitialized = false;

/**
 * Boot the test DB connection. Idempotent — safe to call from multiple suites.
 */
export async function setupTestDb(): Promise<Sequelize> {
  if (cachedSequelize) return cachedSequelize;

  const sequelize = DatabaseConnection.GetInstance();
  await sequelize.authenticate();

  // Models need their associations wired before sync, otherwise FK columns
  // declared via `references: { model: 'X' }` won't resolve correctly on
  // the first sync. Idempotent — only runs once per process.
  if (!associationsInitialized) {
    InitializeAssociations();
    associationsInitialized = true;
  }

  // Greenfield bootstrap: create the v2.1 baseline tables from Models before
  // the ALTER migrations run. `alter: false` so we never silently mutate
  // existing columns — only create what's missing.
  await sequelize.sync({ alter: false });

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
