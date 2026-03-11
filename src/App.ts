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
import SecurityMiddleware from '@Middleware/SecurityMiddleware';

import path from 'path';
const ExApp = express();
ExApp.set('trust proxy', true);
export class App {
  public Express: Application;
  private readonly Config: ReturnType<typeof import('@Config/AppConfig').AppConfig.GetInstance>;
  private readonly ErrorHandler: ErrorHandlerMiddleware;
  private readonly RequestLogger: RequestLoggerMiddleware;
  private readonly Csrf: CsrfMiddleware;
  private readonly Idempotency: IdempotencyMiddleware;
  private readonly Security: SecurityMiddleware;

  constructor() {
    this.Express = ExApp;
    this.Config = AppConfig;
    this.ErrorHandler = new ErrorHandlerMiddleware();
    this.RequestLogger = new RequestLoggerMiddleware();
    this.Csrf = new CsrfMiddleware();
    this.Idempotency = new IdempotencyMiddleware();
    this.Security = new SecurityMiddleware();

    this.InitializeMiddlewares();
    this.InitializeRoutes();
    this.InitializeStaticServing();
    this.InitializeErrorHandling();
  }

  /**
   * Initialize Express middlewares
   */
  private InitializeMiddlewares(): void {
    // Enhanced Security Layer - Applied first
    // HTTPS Enforcement (production only)
    ExApp.use(this.Security.EnforceHTTPS);

    // Request Smuggling Protection
    ExApp.use(this.Security.PreventRequestSmuggling);

    // Block suspicious User-Agents
    ExApp.use(this.Security.BlockSuspiciousUserAgents);

    // Helmet Security Headers
    ExApp.use(
      helmet({
        contentSecurityPolicy: false, // Disable CSP for API
        crossOriginEmbedderPolicy: false,
        hsts: {
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true,
        },
        frameguard: {
          action: 'deny', // Prevent clickjacking
        },
        noSniff: true, // Prevent MIME sniffing
        xssFilter: true, // Enable XSS filter
      })
    );

    // CORS configuration
    ExApp.use(
      cors({
        origin: (origin, callback) => {
          console.log({
            origin,
          });
          const AllowedOrigins = this.Config.Cors.Origins;
          if (!origin) return callback(null, true);
          if (AllowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          return callback(new Error('Not allowed by CORS'));
        },
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
    ExApp.use(compression());

    // Raw body middleware for webhook signature verification
    // MUST be before body parsers
    // Support for application/json webhooks
    ExApp.use(
      '/api/webhooks',
      express.json({
        limit: '10mb',
        verify: (req: any, _res, buf) => {
          // Store raw body for signature verification
          req.rawBody = buf.toString('utf-8');
        },
      })
    );

    ExApp.use(
      '/webhook',
      express.json({
        limit: '10mb',
        verify: (req: any, _res, buf) => {
          req.rawBody = buf.toString('utf-8');
        },
      })
    );

    // Support for application/x-www-form-urlencoded webhooks
    ExApp.use(
      '/api/webhooks',
      express.urlencoded({
        extended: true,
        limit: '10mb',
        verify: (req: any, _res, buf) => {
          // Store raw body for signature verification
          req.rawBody = buf.toString('utf-8');
        },
      })
    );

    ExApp.use(
      '/webhook',
      express.urlencoded({
        extended: true,
        limit: '10mb',
        verify: (req: any, _res, buf) => {
          req.rawBody = buf.toString('utf-8');
        },
      })
    );

    // Body parsers for other routes
    ExApp.use(express.json({ limit: '10mb' }));
    ExApp.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Cookie parser
    ExApp.use(cookieParser());

    // Advanced Security Protections (after body parsing)
    // Webhook paths excluded from certain security checks as they contain legitimate code/SQL in payloads
    const isWebhookPath = (path: string) =>
      path.startsWith('/api/webhooks') || path.startsWith('/webhook');

    ExApp.use((req, res, next) => {
      if (isWebhookPath(req.path)) {
        // Skip SQL/NoSQL/Command/Directory Traversal injection checks for webhooks
        // Webhooks use HMAC signature verification instead and may contain legitimate code/paths
        return next();
      }
      // Apply security checks for non-webhook paths
      this.Security.PreventXSS(req, res, () => {
        this.Security.PreventSQLInjection(req, res, () => {
          this.Security.PreventNoSQLInjection(req, res, () => {
            this.Security.PreventCommandInjection(req, res, () => {
              this.Security.PreventDirectoryTraversal(req, res, next);
            });
          });
        });
      });
    });

    // Parameter Pollution applies to all routes including webhooks
    ExApp.use(this.Security.PreventParameterPollution);

    // CSRF Protection
    // Generate token for all requests (so cookie is set)
    ExApp.use(this.Csrf.GenerateToken);
    // Verify token for state-changing methods
    ExApp.use(this.Csrf.VerifyToken);

    // Idempotency Check
    ExApp.use(this.Idempotency.CheckIdempotency);

    // Request logging
    if (this.Config.NodeEnv === 'development') {
      ExApp.use(morgan('dev'));
    }
    ExApp.use(this.RequestLogger.LogRequest);

    // Trust proxy (for rate limiting and IP detection)
    ExApp.set('trust proxy', 1);

    Logger.Info('Middlewares initialized successfully');
  }

  /**
   * Initialize application routes
   */
  private InitializeRoutes(): void {
    new Routes(ExApp);
    Logger.Info('Routes initialized successfully');
  }

  /**
   * Initialize static file serving for Single Page Application
   */
  private InitializeStaticServing(): void {
    const clientBuildPath = path.join(__dirname, '../public');
    // Serve static files
    ExApp.use(express.static(clientBuildPath));
    // Handle SPA routing - return index.html for all non-API routes
    ExApp.get(/^(?!\/api|\/webhook|\/health).*/, (req, res, next) => {
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
    ExApp.use(this.ErrorHandler.Handle404);

    // Global error handler
    ExApp.use(this.ErrorHandler.HandleError);

    Logger.Info('Error handling initialized successfully');
  }

  /**
   * Get Express application instance
   */
  public GetApp(): Application {
    return ExApp;
  }
}

export default App;
