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
import SocketService from '@Services/SocketService';
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

      // Initialize Socket.IO
      SocketService.GetInstance().Initialize(this.HttpServer);

      // Start listening
      this.HttpServer.listen(this.Port, () => {
        Logger.Info(`Deploy Center server started successfully`, {
          port: this.Port,
          environment: this.Config.NodeEnv,
          nodeVersion: process.version,
        });

        // eslint-disable-next-line no-console
        console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║             📊 Deploy Center Server Info               ║
║                                                        ║
╠════════════════════════════════════════════════════════╣
`);
// eslint-disable-next-line no-console
console.table([
  { Key: 'Port', Value: this.Port },
  { Key: 'Environment', Value: this.Config.NodeEnv },
          { Key: 'API', Value: `http://localhost:${this.Port}/api` },
          { Key: 'Health', Value: `http://localhost:${this.Port}/health` },
        ]);
  // eslint-disable-next-line no-console
        console.log(`
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
  const Shutdown = (signal: string): void => {
    Logger.Info(`Received ${signal}, starting graceful Shutdown...`);

    if (this.HttpServer) {
      this.HttpServer.close(() => {
        Logger.Info('HTTP server closed');
        // Handle database shutdown asynchronously after server close
        DatabaseConnection.CloseConnection()
          .then(() => {
            Logger.Info('Database connection closed');
            Logger.Info('Graceful Shutdown completed');
            process.exit(0);
          })
          .catch((error) => {
            Logger.Error('Error during graceful Shutdown', error as Error);
            process.exit(1);
          });
      });

      // Force close after 10 seconds
      setTimeout(() => {
        Logger.Error('Forcing Shutdown after timeout');
        process.exit(1);
      }, 10000);
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => {
    void Shutdown('SIGTERM');
  });

  process.on('SIGINT', () => {
    void Shutdown('SIGINT');
  });

  process.on('uncaughtException', (error: Error) => {
    Logger.Error('Uncaught Exception', error);
    void Shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason: unknown, _promise: Promise<unknown>) => {
    Logger.Error('Unhandled Rejection', new Error(String(reason)));
    void Shutdown('unhandledRejection');
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
    Logger.Error('Failed to start server', error as Error);
    process.exit(1);
  });
}

export default Server;
