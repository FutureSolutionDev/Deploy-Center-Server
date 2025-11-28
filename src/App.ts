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
import CsrfMiddleware from '@Middleware/CsrfMiddleware';
import IdempotencyMiddleware from '@Middleware/IdempotencyMiddleware';
import RequestLoggerMiddleware from '@Middleware/RequestLoggerMiddleware';

import path from 'path';

export class App {
  public Express: Application;
  private readonly Config: ReturnType<typeof import('@Config/AppConfig').AppConfig.GetInstance>;
  private readonly ErrorHandler: ErrorHandlerMiddleware;
  private readonly RequestLogger: RequestLoggerMiddleware;
  private readonly Csrf: CsrfMiddleware;
  private readonly Idempotency: IdempotencyMiddleware;

  constructor() {
    this.Express = express();
    this.Config = AppConfig;
    this.ErrorHandler = new ErrorHandlerMiddleware();
    this.RequestLogger = new RequestLoggerMiddleware();
    this.Csrf = new CsrfMiddleware();
    this.Idempotency = new IdempotencyMiddleware();

    this.InitializeMiddlewares();
    this.InitializeRoutes();
    this.InitializeStaticServing();
    this.InitializeErrorHandling();
  }

  /**
   * Initialize Express middlewares
   */
  private InitializeMiddlewares(): void {
    // ... (existing code)
    // Security middleware
    this.Express.use(
      helmet({
        contentSecurityPolicy: false, // Disable CSP for API
        crossOriginEmbedderPolicy: false,
      })
    );

    // CORS configuration
    this.Express.use(
      cors({
        origin: this.Config.Cors.Origins || '*',
        credentials: this.Config.Cors.Credentials,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'X-Hub-Signature-256',
          'X-GitHub-Event',
          'X-XSRF-TOKEN',
          'Idempotency-Key',
        ],
        exposedHeaders: ['X-Idempotency-Cached'],
      })
    );

    // Compression
    this.Express.use(compression());

    // Body parsers
    this.Express.use(express.json({ limit: '10mb' }));
    this.Express.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Cookie parser
    this.Express.use(cookieParser());

    // CSRF Protection
    // Generate token for all requests (so cookie is set)
    this.Express.use(this.Csrf.GenerateToken);
    // Verify token for state-changing methods
    this.Express.use(this.Csrf.VerifyToken);

    // Idempotency Check
    this.Express.use(this.Idempotency.CheckIdempotency);

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
   * Initialize static file serving for Single Page Application
   */
  private InitializeStaticServing(): void {
    const clientBuildPath = path.join(__dirname, '../../client/dist');

    // Serve static files
    this.Express.use(express.static(clientBuildPath));

    // Handle SPA routing - return index.html for all non-API routes
    this.Express.get(/^(?!\/api|\/webhook|\/health).*/, (req, res, next) => {
      // Skip if request starts with /api or /webhook or /health
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/webhook') ||
        req.path.startsWith('/health')
      ) {
        return next();
      }
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    });

    Logger.Info(`Static serving initialized from ${clientBuildPath}`);
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
