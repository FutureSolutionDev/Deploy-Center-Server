/**
 * Migration Runner
 * Handles running database migrations in order
 * Following SOLID principles and PascalCase naming convention
 */

import { QueryInterface } from 'sequelize';
import DatabaseConnection from './DatabaseConnection';
import Logger from '@Utils/Logger';
import * as Migration001 from '@Migrations/001_add_created_by_to_projects';
import * as Migration002 from '@Migrations/002_create_project_members';
import * as Migration003 from '@Migrations/003_create_project_audit_logs';

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
   * Get list of executed migrations
   */
  private static async GetExecutedMigrations(queryInterface: QueryInterface): Promise<string[]> {
    const [results] = await queryInterface.sequelize.query(
      'SELECT Name FROM Migrations ORDER BY Id ASC'
    );

    return (results as any[]).map((row) => row.Name);
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
