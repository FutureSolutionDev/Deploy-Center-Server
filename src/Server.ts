/**
 * Server Entry Point
 * Initializes and starts the application server
 * Following SOLID principles and PascalCase naming convention
 */

import http from 'http';
import AppConfig from '@Config/AppConfig';
import Logger from '@Utils/Logger';
import DatabaseInitializer from '@Database/DatabaseInitializer';
import DatabaseConnection from '@Database/DatabaseConnection';
import App from './App';

export class Server {
  private readonly Config: ReturnType<typeof import('@Config/AppConfig').AppConfig.GetInstance>;
  private readonly Port: number;
  private HttpServer?: http.Server;

  constructor() {
    this.Config = AppConfig;
    this.Port = this.Config.Port;
  }

  /**
   * Initialize database connection
   */
  private async InitializeDatabase(): Promise<void> {
    try {
      await DatabaseInitializer.Initialize();
      Logger.Info('Database connection established successfully');
    } catch (error) {
      Logger.Error('Failed to initialize database', error as Error);
      throw error;
    }
  }

  /**
   * Start the server
   */
  public async Start(): Promise<void> {
    try {
      Logger.Info('Starting Deploy Center server...', {
        environment: this.Config.NodeEnv,
        port: this.Port,
      });

      // Initialize database
      await this.InitializeDatabase();

      // Create Express application
      const app = new App();
      const expressApp = app.GetApp();

      // Create HTTP server
      this.HttpServer = http.createServer(expressApp);

      // Start listening
      this.HttpServer.listen(this.Port, () => {
        Logger.Info(`Deploy Center server started successfully`, {
          port: this.Port,
          environment: this.Config.NodeEnv,
          nodeVersion: process.version,
        });

        console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║           🚀 Deploy Center Server Started 🚀          ║
║                                                        ║
║  Port:        ${this.Port.toString().padEnd(41)}║
║  Environment: ${this.Config.NodeEnv.padEnd(41)}║
║  API:         http://localhost:${this.Port}/api${' '.repeat(20)}║
║  Health:      http://localhost:${this.Port}/health${' '.repeat(17)}║
║                                                        ║
╚════════════════════════════════════════════════════════╝
        `);
      });

      // Handle server errors
      this.HttpServer.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          Logger.Error(`Port ${this.Port} is already in use`, error);
        } else {
          Logger.Error('Server error', error);
        }
        process.exit(1);
      });

      // Graceful shutdown handlers
      this.SetupGracefulShutdown();

    } catch (error) {
      Logger.Error('Failed to start server', error as Error);
      process.exit(1);
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private SetupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      Logger.Info(`Received ${signal}, starting graceful shutdown...`);

      if (this.HttpServer) {
        this.HttpServer.close(async () => {
          Logger.Info('HTTP server closed');

          try {
            // Close database connection
            await DatabaseConnection.CloseConnection();
            Logger.Info('Database connection closed');

            Logger.Info('Graceful shutdown completed');
            process.exit(0);
          } catch (error) {
            Logger.Error('Error during graceful shutdown', error as Error);
            process.exit(1);
          }
        });

        // Force close after 10 seconds
        setTimeout(() => {
          Logger.Error('Forcing shutdown after timeout');
          process.exit(1);
        }, 10000);
      } else {
        process.exit(0);
      }
    };

    // Handle different shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      Logger.Error('Uncaught Exception', error);
      shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      Logger.Error('Unhandled Rejection', new Error(reason), {
        promise: promise.toString(),
      });
      shutdown('unhandledRejection');
    });
  }

  /**
   * Stop the server
   */
  public async Stop(): Promise<void> {
    if (this.HttpServer) {
      return new Promise((resolve, reject) => {
        this.HttpServer!.close((error) => {
          if (error) {
            Logger.Error('Error stopping server', error);
            reject(error);
          } else {
            Logger.Info('Server stopped successfully');
            resolve();
          }
        });
      });
    }
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new Server();
  server.Start().catch((error) => {
    Logger.Error('Failed to start server', error);
    process.exit(1);
  });
}

export default Server;
