/**
 * Database Initializer
 * Ensures the database connection, schema synchronization, and associations
 */

import { QueryInterface, Sequelize } from 'sequelize';
import DatabaseConnection from './DatabaseConnection';
import Logger from '@Utils/Logger';
import AppConfig from '@Config/AppConfig';
import { InitializeAssociations, User } from '@Models/index';
import { EUserRole } from '@Types/ICommon';
import PasswordHelper from '@Utils/PasswordHelper';

export class DatabaseInitializer {
  /**
   * Initialize database connection and schema
   */
  public static async Initialize(): Promise<void> {
    try {
      const sequelize = DatabaseConnection.GetInstance();

      await DatabaseConnection.TestConnection();
      InitializeAssociations();

      await DatabaseInitializer.EnsureSchema(sequelize);
      await DatabaseInitializer.EnsureAdminAccess();

      Logger.Info('Database initialization completed successfully');
    } catch (error) {
      Logger.Error('Database initialization failed', error as Error);
      throw error;
    }
  }

  /**
   * Ensure database schema exists and is in sync
   */
  private static async EnsureSchema(sequelize: Sequelize): Promise<void> {
    const shouldAutoMigrate =
      typeof AppConfig.Database.AutoMigrate === 'boolean'
        ? AppConfig.Database.AutoMigrate
        : AppConfig.IsDevelopment();

    const missingTables = await DatabaseInitializer.FindMissingTables(sequelize);

    if (missingTables.length === 0 && !shouldAutoMigrate) {
      Logger.Info('Database schema verified - all tables exist');
      return;
    }

    if (!shouldAutoMigrate && missingTables.length > 0) {
      const message = `Database tables missing: ${missingTables.join(
        ', '
      )}. Enable DB_AUTO_MIGRATE or run migrations manually.`;
      Logger.Error(message);
      throw new Error(message);
    }

    if (missingTables.length > 0) {
      Logger.Warn('Missing database tables detected, synchronizing models', {
        missingTables,
      });
    } else {
      Logger.Info('Synchronizing database schema to ensure it is up to date');
    }

    await DatabaseConnection.SyncModels(false);
    Logger.Info('Database schema synchronized successfully');
  }

  /**
   * Find missing tables by inspecting registered Sequelize models
   */
  private static async FindMissingTables(sequelize: Sequelize): Promise<string[]> {
    const queryInterface = sequelize.getQueryInterface();
    const tables = Array.from(
      new Set(
        sequelize.modelManager.models
          .map((model) => DatabaseInitializer.NormalizeTableName(model.getTableName()))
          .filter((name): name is string => Boolean(name))
      )
    );

    const missingTables: string[] = [];

    for (const table of tables) {
      const exists = await DatabaseInitializer.TableExists(queryInterface, table);
      if (!exists) {
        missingTables.push(table);
      }
    }

    return missingTables;
  }

  /**
   * Normalize table names returned by Sequelize
   */
  private static NormalizeTableName(
    tableName: string | { schema?: string; tableName?: string }
  ): string | undefined {
    if (!tableName) {
      return undefined;
    }

    if (typeof tableName === 'string') {
      return tableName;
    }

    return tableName.tableName || tableName.schema;
  }

  /**
   * Check if a given table exists
   */
  private static async TableExists(
    queryInterface: QueryInterface,
    tableName: string
  ): Promise<boolean> {
    try {
      await queryInterface.describeTable(tableName);
      return true;
    } catch (error) {
      const err = error as any;
      const code = err?.original?.code || err?.parent?.code || err?.original?.errno;
      const message = (err?.original?.sqlMessage || err?.message || '').toString();

      if (
        code === 'ER_NO_SUCH_TABLE' ||
        code === 'ER_BAD_TABLE_ERROR' ||
        code === 1146 ||
        /doesn't exist/i.test(message) ||
        /does not exist/i.test(message) ||
        /no description found/i.test(message)
      ) {
        return false;
      }

      throw error;
    }
  }

  /**
   * Ensure there is at least one active administrator
   */
  private static async EnsureAdminAccess(): Promise<void> {
    const activeAdmins = await User.count({
      where: { Role: EUserRole.Admin, IsActive: true },
    });

    if (activeAdmins > 0) {
      return;
    }

    Logger.Warn('No active administrator accounts detected. Attempting recovery...');

    const existingAdmin = await User.findOne({
      where: { Role: EUserRole.Admin },
      order: [['CreatedAt', 'ASC']],
    });

    if (existingAdmin) {
      existingAdmin.IsActive = true;
      await existingAdmin.save();
      Logger.Warn(
        `Administrator account "${existingAdmin.Username}" was inactive and has been reactivated automatically`
      );
      return;
    }

    const adminConfig = AppConfig.DefaultAdmin;

    if (!adminConfig.Username || !adminConfig.Email || !adminConfig.Password) {
      const message =
        'No administrator accounts exist and DEFAULT_ADMIN_* environment variables are not set.';
      Logger.Error(message, undefined, {
        requiredEnv: ['DEFAULT_ADMIN_USERNAME', 'DEFAULT_ADMIN_EMAIL', 'DEFAULT_ADMIN_PASSWORD'],
      });
      throw new Error(`${message} Please configure them to bootstrap an admin user.`);
    }

    const passwordHash = await PasswordHelper.Hash(adminConfig.Password);
    await User.create({
      Username: adminConfig.Username,
      Email: adminConfig.Email,
      PasswordHash: passwordHash,
      Role: EUserRole.Admin,
      IsActive: true,
      TwoFactorEnabled: false,
    } as any);

    Logger.Info(
      `Default administrator account "${adminConfig.Username}" has been created automatically`
    );
  }
}

export default DatabaseInitializer;
