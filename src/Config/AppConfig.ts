/**
 * Application Configuration Class
 * Singleton pattern for centralized configuration management
 * Following SOLID principles and PascalCase naming convention
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

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
    this.NodeEnv = process.env.NODE_ENV || 'development';
    this.Port = parseInt(process.env.PORT || '3000', 10);
    this.Host = process.env.HOST || '0.0.0.0';
    this.ClientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    // Database Configuration (MariaDB)
    this.Database = {
      Host: process.env.DB_HOST || 'localhost',
      Port: parseInt(process.env.DB_PORT || '3306', 10),
      Name: process.env.DB_NAME || 'deploy_center',
      Username: process.env.DB_USERNAME || 'root',
      Password: process.env.DB_PASSWORD || '',
      Dialect: process.env.DB_DIALECT || 'mariadb',
      Pool: {
        Max: parseInt(process.env.DB_POOL_MAX || '20', 10),
        Min: parseInt(process.env.DB_POOL_MIN || '5', 10),
        Acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000', 10),
        Idle: parseInt(process.env.DB_POOL_IDLE || '10000', 10),
      },
      AutoMigrate:
        process.env.DB_AUTO_MIGRATE !== undefined
          ? process.env.DB_AUTO_MIGRATE === 'true'
          : this.NodeEnv !== 'production',
    };

    // JWT Configuration
    this.Jwt = {
      Secret: process.env.JWT_SECRET || 'change_this_secret_in_production',
      Expiry: process.env.JWT_EXPIRY || '7d',
      RefreshSecret: process.env.JWT_REFRESH_SECRET || 'change_this_refresh_secret',
      RefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
    };

    // Encryption Configuration
    this.EncryptionKey = process.env.ENCRYPTION_KEY || 'change_this_encryption_key_32bytes';

    // GitHub Webhook Configuration
    this.Github = {
      WebhookSecret: process.env.GITHUB_WEBHOOK_SECRET || 'Future_CENTRAL_DEPLOY_2025',
    };

    // Notification Configurations
    this.Notifications = {
      Discord: {
        WebhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
        Enabled: process.env.DISCORD_ENABLED === 'true',
      },
      Slack: {
        WebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        Enabled: process.env.SLACK_ENABLED === 'true',
      },
      Email: {
        Host: process.env.SMTP_HOST || 'smtp.gmail.com',
        Port: parseInt(process.env.SMTP_PORT || '587', 10),
        Secure: process.env.SMTP_SECURE === 'true',
        User: process.env.SMTP_USER || '',
        Password: process.env.SMTP_PASSWORD || '',
        From: process.env.EMAIL_FROM || 'Deploy Center <noreply@deploycentre.com>',
        Enabled: process.env.EMAIL_ENABLED === 'true',
      },
      Telegram: {
        BotToken: process.env.TELEGRAM_BOT_TOKEN || '',
        ChatId: process.env.TELEGRAM_CHAT_ID || '',
        Enabled: process.env.TELEGRAM_ENABLED === 'true',
      },
    };

    // Logging Configuration
    this.Logging = {
      Level: process.env.LOG_LEVEL || 'info',
      Directory: process.env.LOG_DIR || path.join(__dirname, '../../logs'),
      MaxFiles: process.env.LOG_MAX_FILES || '30d',
      MaxSize: process.env.LOG_MAX_SIZE || '20m',
    };

    // Rate Limiting Configuration
    this.RateLimit = {
      WindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
      MaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    };

    // CORS Configuration
    this.Cors = {
      Origins: (process.env.CORS_ORIGIN || 'http://localhost:5176,http://localhost:5175,http://localhost:5174,http://localhost:5173,http://localhost:3001').split(','),
      Credentials: process.env.CORS_CREDENTIALS === 'true',
    };

    // Session Configuration
    this.SessionSecret = process.env.SESSION_SECRET || 'change_this_session_secret';

    // Deployment Configuration
    this.Deployment = {
      BackupDir: process.env.BACKUP_DIR || path.join(__dirname, '../../backups'),
      BackupRetentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
      MaxConcurrent: parseInt(process.env.MAX_CONCURRENT_DEPLOYMENTS || '5', 10),
    };

    // Default Admin Configuration
    this.DefaultAdmin = {
      Username: process.env.DEFAULT_ADMIN_USERNAME,
      Email: process.env.DEFAULT_ADMIN_EMAIL,
      Password: process.env.DEFAULT_ADMIN_PASSWORD,
    };

    // Health Check Configuration
    this.HealthCheck = {
      IntervalMinutes: parseInt(process.env.HEALTH_CHECK_INTERVAL_MINUTES || '5', 10),
      TimeoutMs: parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || '5000', 10),
    };

    // Cleanup Job Configuration
    this.Cleanup = {
      LogsDays: parseInt(process.env.CLEANUP_LOGS_DAYS || '90', 10),
      BackupsDays: parseInt(process.env.CLEANUP_BACKUPS_DAYS || '30', 10),
      IntervalHours: parseInt(process.env.CLEANUP_INTERVAL_HOURS || '24', 10),
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
