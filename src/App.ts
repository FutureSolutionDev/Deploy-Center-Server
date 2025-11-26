/**
 * Express Application Setup
 * Configures and initializes Express application
 * Following SOLID principles and PascalCase naming convention
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import AppConfig from '@Config/AppConfig';
import Logger from '@Utils/Logger';
import Routes from '@Routes/index';
import ErrorHandlerMiddleware from '@Middleware/ErrorHandlerMiddleware';
import RequestLoggerMiddleware from '@Middleware/RequestLoggerMiddleware';

export class App {
  public Express: Application;
  private readonly Config: ReturnType<typeof import('@Config/AppConfig').AppConfig.GetInstance>;
  private readonly ErrorHandler: ErrorHandlerMiddleware;
  private readonly RequestLogger: RequestLoggerMiddleware;

  constructor() {
    this.Express = express();
    this.Config = AppConfig;
    this.ErrorHandler = new ErrorHandlerMiddleware();
    this.RequestLogger = new RequestLoggerMiddleware();

    this.InitializeMiddlewares();
    this.InitializeRoutes();
    this.InitializeErrorHandling();
  }

  /**
   * Initialize Express middlewares
   */
  private InitializeMiddlewares(): void {
    // Security middleware
    this.Express.use(helmet({
      contentSecurityPolicy: false, // Disable CSP for API
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    this.Express.use(cors({
      origin: this.Config.Cors.Origins || '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Hub-Signature-256', 'X-GitHub-Event'],
    }));

    // Compression
    this.Express.use(compression());

    // Body parsers
    this.Express.use(express.json({ limit: '10mb' }));
    this.Express.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Cookie parser
    this.Express.use(cookieParser());

    // Request logging
    if (this.Config.NodeEnv === 'development') {
      this.Express.use(morgan('dev'));
    }
    this.Express.use(this.RequestLogger.LogRequest);

    // Trust proxy (for rate limiting and IP detection)
    this.Express.set('trust proxy', 1);

    Logger.Info('Middlewares initialized successfully');
  }

  /**
   * Initialize application routes
   */
  private InitializeRoutes(): void {
    new Routes(this.Express);
    Logger.Info('Routes initialized successfully');
  }

  /**
   * Initialize error handling
   */
  private InitializeErrorHandling(): void {
    // 404 Handler
    this.Express.use(this.ErrorHandler.Handle404);

    // Global error handler
    this.Express.use(this.ErrorHandler.HandleError);

    Logger.Info('Error handling initialized successfully');
  }

  /**
   * Get Express application instance
   */
  public GetApp(): Application {
    return this.Express;
  }
}

export default App;
