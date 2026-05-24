/**
 * Migration Runner
 * Handles running database migrations in order
 * Following SOLID principles and PascalCase naming convention
 */

import { QueryInterface, QueryTypes } from 'sequelize';
import DatabaseConnection from './DatabaseConnection';
import Logger from '@Utils/Logger';
import * as Migration001 from '@Migrations/001_add_created_by_to_projects';
import * as Migration002 from '@Migrations/002_create_project_members';
import * as Migration003 from '@Migrations/003_create_project_audit_logs';
import * as Migration004 from '@Migrations/004_add_deployment_paths_to_projects';
import * as Migration005 from '@Migrations/005_fix_deployment_paths_constraint';
import * as Migration006 from '@Migrations/006_increase_deployment_steps_output_size';
// v3.0 fix: the old slot 007 incorrectly imported migration 008's body (duplicate
// import bug); the real `Deployments.{ErrorMessage,CommitMessage}` LONGTEXT
// widening lives in migration 021 below. Slot 007 is intentionally absent —
// removing it leaves only an orphan `007_...` row in SequelizeMeta on installs
// that already executed the broken slot. Harmless: not re-running an idempotent
// migration on a fresh install is fine because slot 008 covers the same DDL.
import * as Migration008 from '@Migrations/008_increase_projectauditlogs_changes_size';
import * as Migration009 from '@Migrations/009_create_environment_variables';
import * as Migration012 from '@Migrations/012_add_queue_job_id_to_deployments';
import * as Migration013 from '@Migrations/013_create_notification_providers';
import * as Migration016 from '@Migrations/016_create_workspaces';
import * as Migration017 from '@Migrations/017_create_project_templates';
import * as Migration018 from '@Migrations/018_create_notification_channels';
import * as Migration019 from '@Migrations/019_create_project_notification_subscriptions';
import * as Migration020 from '@Migrations/020_drop_user_notification_columns';
import * as Migration021 from '@Migrations/021_widen_deployments_text_columns';
import * as Migration999 from '@Migrations/999_migrate_pending_deployments';
interface IMigration {
  name: string;
  up: (queryInterface: QueryInterface) => Promise<void>;
  down: (queryInterface: QueryInterface) => Promise<void>;
}

export class MigrationRunner {
  private static readonly Migrations: IMigration[] = [
    {
      name: '001_add_created_by_to_projects',
      up: Migration001.up,
      down: Migration001.down,
    },
    {
      name: '002_create_project_members',
      up: Migration002.up,
      down: Migration002.down,
    },
    {
      name: '003_create_project_audit_logs',
      up: Migration003.up,
      down: Migration003.down,
    },
    {
      name: '004_add_deployment_paths_to_projects',
      up: Migration004.up,
      down: Migration004.down,
    },
    {
      name: '005_fix_deployment_paths_constraint',
      up: Migration005.up,
      down: Migration005.down,
    },
    {
      name: '006_increase_deployment_steps_output_size',
      up: Migration006.up,
      down: Migration006.down,
    },
    {
      name: '008_increase_projectauditlogs_changes_size',
      up: Migration008.up,
      down: Migration008.down,
    },
    {
      // v3.0 F-003 — EnvironmentVariables table (encrypted per-project store).
      name: '009_create_environment_variables',
      up: Migration009.up,
      down: Migration009.down,
    },
    {
      // v3.0 F-001 — Deployment.QueueJobId for BullMQ persistent queue.
      name: '012_add_queue_job_id_to_deployments',
      up: Migration012.up,
      down: Migration012.down,
    },
    {
      // v3.0 F-006 — central NotificationProviders credential store.
      name: '013_create_notification_providers',
      up: Migration013.up,
      down: Migration013.down,
    },
    {
      // v3.0 F-009 — Workspaces table + Project.WorkspaceId FK.
      name: '016_create_workspaces',
      up: Migration016.up,
      down: Migration016.down,
    },
    {
      // v3.0 F-008 — ProjectTemplates table + 5 built-in seeds.
      name: '017_create_project_templates',
      up: Migration017.up,
      down: Migration017.down,
    },
    {
      // v3.0 F-006 — NotificationChannels (FK → Providers CASCADE).
      name: '018_create_notification_channels',
      up: Migration018.up,
      down: Migration018.down,
    },
    {
      // v3.0 F-006 — Project↔Channel M:N + Events filter.
      name: '019_create_project_notification_subscriptions',
      up: Migration019.up,
      down: Migration019.down,
    },
    {
      // v3.0 — drop legacy per-user notification columns from UserSettings.
      // They were never wired into the deployment fan-out path; all notifs
      // now flow through Provider/Channel/Subscription (F-006).
      name: '020_drop_user_notification_columns',
      up: Migration020.up,
      down: Migration020.down,
    },
    {
      // v3.0 fix — widen Deployments.{ErrorMessage,CommitMessage} from TEXT
      // to LONGTEXT. Plugs the gap left by the broken slot 007 (see import
      // header comment above).
      name: '021_widen_deployments_text_columns',
      up: Migration021.up,
      down: Migration021.down,
    },
    {
      // v3.0 F-001 — one-shot: re-enqueue v2.1 pending deployments into BullMQ.
      // Idempotent via QueueJobId IS NULL guard. Runs ONCE per env.
      name: '999_migrate_pending_deployments',
      up: Migration999.up,
      down: Migration999.down,
    },
  ];

  /**
   * Run all pending migrations
   */
  public static async RunMigrations(): Promise<void> {
    try {
      const sequelize = DatabaseConnection.GetInstance();
      const queryInterface = sequelize.getQueryInterface();

      Logger.Info('Starting database migrations...');

      // Create migrations table if it doesn't exist
      await this.EnsureMigrationsTable(queryInterface);

      // Get executed migrations
      const executedMigrations = await this.GetExecutedMigrations(queryInterface);

      // Run pending migrations
      for (const migration of this.Migrations) {
        if (!executedMigrations.includes(migration.name)) {
          Logger.Info(`Running migration: ${migration.name}`);
          await migration.up(queryInterface);
          await this.RecordMigration(queryInterface, migration.name);
          Logger.Info(`✅ Migration ${migration.name} completed successfully`);
        } else {
          Logger.Info(`⏭️  Migration ${migration.name} already executed, skipping`);
        }
      }

      Logger.Info('All migrations completed successfully');
    } catch (error) {
      Logger.Error('Migration failed', error as Error);
      throw error;
    }
  }

  /**
   * Rollback the last migration
   */
  public static async RollbackLastMigration(): Promise<void> {
    try {
      const sequelize = DatabaseConnection.GetInstance();
      const queryInterface = sequelize.getQueryInterface();

      const executedMigrations = await this.GetExecutedMigrations(queryInterface);

      if (executedMigrations.length === 0) {
        Logger.Info('No migrations to rollback');
        return;
      }

      const lastMigration = executedMigrations[executedMigrations.length - 1];
      const migration = this.Migrations.find((m) => m.name === lastMigration);

      if (!migration) {
        throw new Error(`Migration ${lastMigration} not found`);
      }

      Logger.Info(`Rolling back migration: ${migration.name}`);
      await migration.down(queryInterface);
      await this.RemoveMigrationRecord(queryInterface, migration.name);
      Logger.Info(`✅ Migration ${migration.name} rolled back successfully`);
    } catch (error) {
      Logger.Error('Rollback failed', error as Error);
      throw error;
    }
  }

  /**
   * v3.0 — list every registered migration with its executed/pending state.
   * Used by the standalone `npm run migrate:status` CLI.
   */
  public static async GetStatus(): Promise<
    Array<{ name: string; executed: boolean; executedAt: Date | null }>
  > {
    const sequelize = DatabaseConnection.GetInstance();
    const queryInterface = sequelize.getQueryInterface();
    await this.EnsureMigrationsTable(queryInterface);

    const rows = (await queryInterface.sequelize.query(
      'SELECT Name, ExecutedAt FROM Migrations',
      { type: QueryTypes.SELECT }
    )) as Array<{ Name: string; ExecutedAt: string | Date }>;
    const executedMap = new Map<string, Date>();
    for (const r of rows) {
      executedMap.set(r.Name, new Date(r.ExecutedAt));
    }

    return this.Migrations.map((m) => ({
      name: m.name,
      executed: executedMap.has(m.name),
      executedAt: executedMap.get(m.name) ?? null,
    }));
  }

  /**
   * Ensure migrations table exists
   */
  private static async EnsureMigrationsTable(queryInterface: QueryInterface): Promise<void> {
    const tableExists = await queryInterface.showAllTables().then((tables) => {
      return tables.includes('Migrations') || tables.includes('migrations');
    });

    if (!tableExists) {
      await queryInterface.createTable('Migrations', {
        Id: {
          type: 'INTEGER',
          primaryKey: true,
          autoIncrement: true,
        },
        Name: {
          type: 'VARCHAR(255)',
          allowNull: false,
          unique: true,
        },
        ExecutedAt: {
          type: 'DATETIME',
          allowNull: false,
          defaultValue: queryInterface.sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
      Logger.Info('✅ Migrations table created');
    }
  }

  /**
   * Get list of executed migrations.
   * Uses QueryTypes.SELECT to dodge the MariaDB-driver "Cannot delete
   * property 'meta' of [object Array]" quirk that bites bare query() calls.
   */
  private static async GetExecutedMigrations(queryInterface: QueryInterface): Promise<string[]> {
    const results = (await queryInterface.sequelize.query(
      'SELECT Name FROM Migrations ORDER BY Id ASC',
      { type: QueryTypes.SELECT }
    )) as Array<{ Name: string }>;
    return results.map((row) => row.Name);
  }

  /**
   * Record a migration as executed
   */
  private static async RecordMigration(
    queryInterface: QueryInterface,
    migrationName: string
  ): Promise<void> {
    await queryInterface.sequelize.query(
      'INSERT INTO Migrations (Name, ExecutedAt) VALUES (?, NOW())',
      {
        replacements: [migrationName],
      }
    );
  }

  /**
   * Remove migration record
   */
  private static async RemoveMigrationRecord(
    queryInterface: QueryInterface,
    migrationName: string
  ): Promise<void> {
    await queryInterface.sequelize.query('DELETE FROM Migrations WHERE Name = ?', {
      replacements: [migrationName],
    });
  }
}

export default MigrationRunner;
