/**
 * Application Configuration Class
 * Singleton pattern for centralized configuration management
 * Following SOLID principles and PascalCase naming convention
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Read .env into a private object WITHOUT polluting process.env
// This prevents Deploy Center's env vars from leaking into child processes
// (e.g., pm2 reload would inherit PORT, DB_NAME, etc. and break other apps)
const envPath = path.resolve(process.cwd(), '.env');
let _envVars: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  const parsed = dotenv.parse(fs.readFileSync(envPath));
  _envVars = parsed;
}

/** Get env variable from .env file (private) or process.env (system) */
function getEnv(key: string, defaultValue: string = ''): string {
  return _envVars[key] || process.env[key] || defaultValue;
}

export class AppConfig {
  private static Instance: AppConfig;

  // Server Configuration
  public readonly NodeEnv: string;
  public readonly Port: number;
  public readonly Host: string;
  public readonly ClientUrl: string;

  // Database Configuration
  public readonly Database: {
    Host: string;
    Port: number;
    Name: string;
    Username: string;
    Password: string;
    Dialect: string;
    Pool: {
      Max: number;
      Min: number;
      Acquire: number;
      Idle: number;
    };
    AutoMigrate: boolean;
  };

  // JWT Configuration
  public readonly Jwt: {
    Secret: string;
    Expiry: string;
    RefreshSecret: string;
    RefreshExpiry: string;
  };

  // Encryption Configuration
  public readonly EncryptionKey: string;

  // GitHub Webhook Configuration
  public readonly Github: {
    WebhookSecret: string;
  };

  // Notification Configurations
  public readonly Notifications: {
    Discord: {
      WebhookUrl: string;
      Enabled: boolean;
    };
    Slack: {
      WebhookUrl: string;
      Enabled: boolean;
    };
    Email: {
      Host: string;
      Port: number;
      Secure: boolean;
      User: string;
      Password: string;
      From: string;
      Enabled: boolean;
    };
    Telegram: {
      BotToken: string;
      ChatId: string;
      Enabled: boolean;
    };
  };

  // Logging Configuration
  public readonly Logging: {
    Level: string;
    Directory: string;
    MaxFiles: string;
    MaxSize: string;
  };

  // Rate Limiting Configuration
  public readonly RateLimit: {
    WindowMs: number;
    MaxRequests: number;
  };

  // CORS Configuration
  public readonly Cors: {
    Origins: string[];
    Credentials: boolean;
  };

  // Session Configuration
  public readonly SessionSecret: string;

  // Default Admin Setup
  public readonly DefaultAdmin: {
    Username?: string;
    Email?: string;
    Password?: string;
  };

  // Deployment Configuration
  public readonly Deployment: {
    Path: string;
    BackupDir: string;
    BackupRetentionDays: number;
    MaxConcurrent: number;
  };

  // Health Check Configuration
  public readonly HealthCheck: {
    IntervalMinutes: number;
    TimeoutMs: number;
  };

  // Cleanup Job Configuration
  public readonly Cleanup: {
    LogsDays: number;
    BackupsDays: number;
    IntervalHours: number;
  };

  private constructor() {
    // Server Configuration
    this.NodeEnv = getEnv('NODE_ENV', 'development');
    this.Port = parseInt(getEnv('PORT', '3000'), 10);
    this.Host = getEnv('HOST', '0.0.0.0');
    this.ClientUrl = getEnv('CLIENT_URL', 'http://localhost:5173');

    // Database Configuration (MariaDB)
    this.Database = {
      Host: getEnv('DB_HOST', 'localhost'),
      Port: parseInt(getEnv('DB_PORT', '3306'), 10),
      Name: getEnv('DB_NAME', 'deploy_center'),
      Username: getEnv('DB_USERNAME', 'root'),
      Password: getEnv('DB_PASSWORD'),
      Dialect: getEnv('DB_DIALECT', 'mariadb'),
      Pool: {
        Max: parseInt(getEnv('DB_POOL_MAX', '20'), 10),
        Min: parseInt(getEnv('DB_POOL_MIN', '5'), 10),
        Acquire: parseInt(getEnv('DB_POOL_ACQUIRE', '30000'), 10),
        Idle: parseInt(getEnv('DB_POOL_IDLE', '10000'), 10),
      },
      AutoMigrate:
        _envVars.DB_AUTO_MIGRATE !== undefined
          ? _envVars.DB_AUTO_MIGRATE === 'true'
          : this.NodeEnv !== 'production',
    };

    // JWT Configuration
    this.Jwt = {
      Secret: getEnv('JWT_SECRET', 'change_this_secret_in_production'),
      Expiry: getEnv('JWT_EXPIRY', '7d'),
      RefreshSecret: getEnv('JWT_REFRESH_SECRET', 'change_this_refresh_secret'),
      RefreshExpiry: getEnv('JWT_REFRESH_EXPIRY', '30d'),
    };

    // Encryption Configuration
    this.EncryptionKey = getEnv('ENCRYPTION_KEY', 'change_this_encryption_key_32bytes');

    // GitHub Webhook Configuration
    this.Github = {
      WebhookSecret: getEnv('GITHUB_WEBHOOK_SECRET', 'Future_CENTRAL_DEPLOY_2025'),
    };

    // Notification Configurations
    this.Notifications = {
      Discord: {
        WebhookUrl: getEnv('DISCORD_WEBHOOK_URL'),
        Enabled: getEnv('DISCORD_ENABLED') === 'true',
      },
      Slack: {
        WebhookUrl: getEnv('SLACK_WEBHOOK_URL'),
        Enabled: getEnv('SLACK_ENABLED') === 'true',
      },
      Email: {
        Host: getEnv('SMTP_HOST', 'smtp.gmail.com'),
        Port: parseInt(getEnv('SMTP_PORT', '587'), 10),
        Secure: getEnv('SMTP_SECURE') === 'true',
        User: getEnv('SMTP_USER'),
        Password: getEnv('SMTP_PASSWORD'),
        From: getEnv('EMAIL_FROM', 'Deploy Center <noreply@deploycentre.com>'),
        Enabled: getEnv('EMAIL_ENABLED') === 'true',
      },
      Telegram: {
        BotToken: getEnv('TELEGRAM_BOT_TOKEN'),
        ChatId: getEnv('TELEGRAM_CHAT_ID'),
        Enabled: getEnv('TELEGRAM_ENABLED') === 'true',
      },
    };

    // Logging Configuration
    this.Logging = {
      Level: getEnv('LOG_LEVEL', 'info'),
      Directory: getEnv('LOG_DIR', path.join(__dirname, '../../logs')),
      MaxFiles: getEnv('LOG_MAX_FILES', '30d'),
      MaxSize: getEnv('LOG_MAX_SIZE', '20m'),
    };

    // Rate Limiting Configuration
    this.RateLimit = {
      WindowMs: parseInt(getEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10),
      MaxRequests: parseInt(getEnv('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
    };

    // CORS Configuration
    this.Cors = {
      Origins: getEnv('CORS_ORIGIN', 'http://localhost:5176,http://localhost:5175,http://localhost:5174,http://localhost:5173,http://localhost:3001').split(','),
      Credentials: getEnv('CORS_CREDENTIALS') === 'true',
    };

    // Session Configuration
    this.SessionSecret = getEnv('SESSION_SECRET', 'change_this_session_secret');

    // Deployment Configuration
    this.Deployment = {
      Path: getEnv('DEPLOYMENTS_PATH', path.join(process.cwd(), 'deployments')),
      BackupDir: getEnv('BACKUP_DIR', path.join(__dirname, '../../backups')),
      BackupRetentionDays: parseInt(getEnv('BACKUP_RETENTION_DAYS', '30'), 10),
      MaxConcurrent: parseInt(getEnv('MAX_CONCURRENT_DEPLOYMENTS', '5'), 10),
    };

    // Default Admin Configuration
    this.DefaultAdmin = {
      Username: getEnv('DEFAULT_ADMIN_USERNAME') || undefined,
      Email: getEnv('DEFAULT_ADMIN_EMAIL') || undefined,
      Password: getEnv('DEFAULT_ADMIN_PASSWORD') || undefined,
    };

    // Health Check Configuration
    this.HealthCheck = {
      IntervalMinutes: parseInt(getEnv('HEALTH_CHECK_INTERVAL_MINUTES', '5'), 10),
      TimeoutMs: parseInt(getEnv('HEALTH_CHECK_TIMEOUT_MS', '5000'), 10),
    };

    // Cleanup Job Configuration
    this.Cleanup = {
      LogsDays: parseInt(getEnv('CLEANUP_LOGS_DAYS', '90'), 10),
      BackupsDays: parseInt(getEnv('CLEANUP_BACKUPS_DAYS', '30'), 10),
      IntervalHours: parseInt(getEnv('CLEANUP_INTERVAL_HOURS', '24'), 10),
    };
  }

  /**
   * Get singleton instance of AppConfig
   */
  public static GetInstance(): AppConfig {
    if (!AppConfig.Instance) {
      AppConfig.Instance = new AppConfig();
    }
    return AppConfig.Instance;
  }

  /**
   * Check if running in production environment
   */
  public IsProduction(): boolean {
    return this.NodeEnv === 'production';
  }

  /**
   * Check if running in development environment
   */
  public IsDevelopment(): boolean {
    return this.NodeEnv === 'development';
  }

  /**
   * Check if running in test environment
   */
  public IsTest(): boolean {
    return this.NodeEnv === 'test';
  }
}

// Export singleton instance
export default AppConfig.GetInstance();
