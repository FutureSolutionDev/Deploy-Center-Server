/**
 * Database Connection Manager using Sequelize
 * Singleton pattern for database connection
 * Following SOLID principles and PascalCase naming convention
 */

import { Sequelize, Options } from 'sequelize';
import AppConfig from '@Config/AppConfig';
import Logger from '@Utils/Logger';

export class DatabaseConnection {
  private static Instance: Sequelize;
  private static IsConnected: boolean = false;

  private constructor() {}

  /**
   * Get Sequelize instance (Singleton)
   */
  public static GetInstance(): Sequelize {
    if (!DatabaseConnection.Instance) {
      DatabaseConnection.Instance = DatabaseConnection.CreateConnection();
    }
    return DatabaseConnection.Instance;
  }

  /**
   * Create Sequelize connection
   */
  private static CreateConnection(): Sequelize {
    const config = AppConfig;

    const options: Options = {
      host: config.Database.Host,
      port: config.Database.Port,
      dialect: config.Database.Dialect as any,
      logging: (msg: string) => Logger.Debug(msg),
      pool: {
        max: config.Database.Pool.Max,
        min: config.Database.Pool.Min,
        acquire: config.Database.Pool.Acquire,
        idle: config.Database.Pool.Idle,
      },
      define: {
        timestamps: true,
        underscored: false,
        freezeTableName: true,
      },
    };

    const sequelize = new Sequelize(
      config.Database.Name,
      config.Database.Username,
      config.Database.Password,
      options
    );

    Logger.Info('Database connection created', {
      host: config.Database.Host,
      database: config.Database.Name,
    });

    return sequelize;
  }

  /**
   * Test database connection
   */
  public static async TestConnection(): Promise<boolean> {
    try {
      const sequelize = DatabaseConnection.GetInstance();
      await sequelize.authenticate();
      DatabaseConnection.IsConnected = true;
      Logger.Info('Database connection established successfully');
      return true;
    } catch (error) {
      DatabaseConnection.IsConnected = false;
      Logger.Error('Unable to connect to database', error as Error);
      return false;
    }
  }

  /**
   * Sync database models (create tables)
   */
  public static async SyncModels(force: boolean = false): Promise<void> {
    try {
      const sequelize = DatabaseConnection.GetInstance();
      await sequelize.sync({ force });
      Logger.Info(`Database models synchronized (force: ${force})`);
    } catch (error) {
      Logger.Error('Failed to sync database models', error as Error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  public static async CloseConnection(): Promise<void> {
    try {
      const sequelize = DatabaseConnection.GetInstance();
      await sequelize.close();
      DatabaseConnection.IsConnected = false;
      Logger.Info('Database connection closed');
    } catch (error) {
      Logger.Error('Failed to close database connection', error as Error);
      throw error;
    }
  }

  /**
   * Check if database is connected
   */
  public static IsDbConnected(): boolean {
    return DatabaseConnection.IsConnected;
  }

  /**
   * Execute raw SQL query
   */
  public static async ExecuteQuery(sql: string, replacements?: Record<string, any>): Promise<any> {
    try {
      const sequelize = DatabaseConnection.GetInstance();
      const [results] = await sequelize.query(sql, {
        replacements,
        raw: true,
      });
      return results;
    } catch (error) {
      Logger.Error('Failed to execute query', error as Error, { sql });
      throw error;
    }
  }

  /**
   * Begin transaction
   */
  public static async BeginTransaction(): Promise<any> {
    const sequelize = DatabaseConnection.GetInstance();
    return await sequelize.transaction();
  }
}

// Export singleton instance
export default DatabaseConnection;
