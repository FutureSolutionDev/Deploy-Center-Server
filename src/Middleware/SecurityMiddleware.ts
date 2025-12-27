/**
 * Enhanced Security Middleware
 * Additional security layers beyond basic Helmet configuration
 * Following SOLID principles and PascalCase naming convention
 */

import { Request, Response, NextFunction } from 'express';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';

export class SecurityMiddleware {
  /**
   * Prevent Parameter Pollution
   * Blocks duplicate query parameters that could bypass validation
   */
  public PreventParameterPollution = (req: Request, res: Response, next: NextFunction): void => {
    const query = req.query;

    for (const key in query) {
      if (Array.isArray(query[key]) && (query[key] as string[]).length > 1) {
        Logger.Warn('Parameter pollution detected', {
          ip: req.ip,
          path: req.path,
          parameter: key,
          values: query[key],
        });

        ResponseHelper.Error(res, 'Invalid request: duplicate parameters detected', undefined, 400);
        return;
      }
    }

    next();
  };

  /**
   * NoSQL Injection Protection
   * Prevents MongoDB/NoSQL injection attacks in request data
   */
  public PreventNoSQLInjection = (req: Request, res: Response, next: NextFunction): void => {
    const suspiciousPatterns = [
      /\$where/i,
      /\$ne/i,
      /\$gt/i,
      /\$gte/i,
      /\$lt/i,
      /\$lte/i,
      /\$or/i,
      /\$and/i,
      /\$not/i,
      /\$nor/i,
      /\$exists/i,
      /\$type/i,
      /\$in/i,
      /\$nin/i,
      /\$regex/i,
      /\$expr/i,
    ];

    const checkForInjection = (obj: any, path = ''): boolean => {
      if (!obj || typeof obj !== 'object') return false;

      for (const key in obj) {
        const currentPath = path ? `${path}.${key}` : key;

        // Check if key contains suspicious patterns
        if (suspiciousPatterns.some((pattern) => pattern.test(key))) {
          Logger.Warn('Potential NoSQL injection detected in key', {
            ip: req.ip,
            path: req.path,
            suspiciousKey: currentPath,
          });
          return true;
        }

        // Recursively check nested objects
        if (typeof obj[key] === 'object') {
          if (checkForInjection(obj[key], currentPath)) {
            return true;
          }
        }

        // Check string values for suspicious patterns
        if (typeof obj[key] === 'string') {
          if (suspiciousPatterns.some((pattern) => pattern.test(obj[key]))) {
            Logger.Warn('Potential NoSQL injection detected in value', {
              ip: req.ip,
              path: req.path,
              suspiciousPath: currentPath,
            });
            return true;
          }
        }
      }

      return false;
    };

    // Check body, query, and params
    if (checkForInjection(req.body) || checkForInjection(req.query) || checkForInjection(req.params)) {
      ResponseHelper.Error(res, 'Invalid request: suspicious patterns detected', undefined, 400);
      return;
    }

    next();
  };

  /**
   * Detect and block suspicious User-Agents
   * Blocks known malicious scanners and bots
   */
  public BlockSuspiciousUserAgents = (req: Request, res: Response, next: NextFunction): void => {
    const userAgent = req.headers['user-agent'] || '';

    const suspiciousAgents = [
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /masscan/i,
      /acunetix/i,
      /nessus/i,
      /openvas/i,
      /metasploit/i,
      /burp/i,
      /zap/i,
      /w3af/i,
      /dirbuster/i,
      /gobuster/i,
      /wpscan/i,
      /havij/i,
      /wget/i,
      /curl/i, // Optional: block curl (can be legitimate for APIs)
    ];

    if (suspiciousAgents.some((pattern) => pattern.test(userAgent))) {
      Logger.Warn('Suspicious User-Agent detected', {
        ip: req.ip,
        path: req.path,
        userAgent,
      });

      // Return 403 Forbidden instead of giving away that we detected them
      ResponseHelper.Error(res, 'Access denied', undefined, 403);
      return;
    }

    next();
  };

  /**
   * Detect Directory Traversal Attacks
   * Prevents path traversal in file operations
   */
  public PreventDirectoryTraversal = (req: Request, res: Response, next: NextFunction): void => {
    const checkTraversal = (value: string): boolean => {
      const traversalPatterns = [
        /\.\./,           // ../
        /\.\.\\/, // ..\
        /%2e%2e/i,        // URL encoded ..
        /%252e%252e/i,    // Double URL encoded ..
        /\.\.%2f/i,       // ..%2f
        /\.\.%5c/i,       // ..%5c
      ];

      return traversalPatterns.some((pattern) => pattern.test(value));
    };

    const checkObject = (obj: any): boolean => {
      if (!obj || typeof obj !== 'object') {
        return typeof obj === 'string' && checkTraversal(obj);
      }

      for (const key in obj) {
        if (typeof obj[key] === 'string' && checkTraversal(obj[key])) {
          return true;
        }
        if (typeof obj[key] === 'object' && checkObject(obj[key])) {
          return true;
        }
      }

      return false;
    };

    if (
      checkObject(req.body) ||
      checkObject(req.query) ||
      checkObject(req.params) ||
      checkTraversal(req.path)
    ) {
      Logger.Warn('Directory traversal attempt detected', {
        ip: req.ip,
        path: req.path,
        body: req.body,
        query: req.query,
        params: req.params,
      });

      ResponseHelper.Error(res, 'Invalid request: illegal path detected', undefined, 400);
      return;
    }

    next();
  };

  /**
   * XSS Protection - Sanitize HTML in request data
   * Prevents Cross-Site Scripting attacks
   */
  public PreventXSS = (req: Request, res: Response, next: NextFunction): void => {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi, // event handlers like onclick=
      /<iframe/gi,
      /<embed/gi,
      /<object/gi,
      /eval\(/gi,
      /expression\(/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
    ];

    const checkXSS = (value: string): boolean => {
      return xssPatterns.some((pattern) => pattern.test(value));
    };

    const sanitizeObject = (obj: any): boolean => {
      if (!obj || typeof obj !== 'object') {
        return typeof obj === 'string' && checkXSS(obj);
      }

      for (const key in obj) {
        if (typeof obj[key] === 'string' && checkXSS(obj[key])) {
          return true;
        }
        if (typeof obj[key] === 'object' && sanitizeObject(obj[key])) {
          return true;
        }
      }

      return false;
    };

    if (sanitizeObject(req.body) || sanitizeObject(req.query) || sanitizeObject(req.params)) {
      Logger.Warn('XSS attempt detected', {
        ip: req.ip,
        path: req.path,
      });

      ResponseHelper.Error(res, 'Invalid request: potentially malicious content detected', undefined, 400);
      return;
    }

    next();
  };

  /**
   * Prevent Command Injection
   * Blocks shell command injection attempts
   */
  public PreventCommandInjection = (req: Request, res: Response, next: NextFunction): void => {
    const commandPatterns = [
      /;\s*\w+/,       // ; command
      /\|\s*\w+/,      // | command
      /&&\s*\w+/,      // && command
      /\|\|\s*\w+/,    // || command
      /`.*`/,          // backticks
      /\$\(.*\)/,      // $(command)
      />\s*\/dev/,     // redirect to device
      />\s*\/proc/,    // redirect to proc
      /curl\s+/i,
      /wget\s+/i,
      /nc\s+/i,        // netcat
      /bash\s+/i,
      /sh\s+/i,
      /powershell/i,
      /cmd\.exe/i,
    ];

    // Fields that contain legitimate shell commands (deployment pipeline)
    const excludedFields = new Set([
      'Run',              // Pipeline step commands
      'Commands',         // Command list
      'Script',           // Shell scripts
      'Command',          // Single command
      'Pipeline',         // Deployment pipeline steps
      'DeployOnPaths',    // May contain shell-like patterns
    ]);

    const checkCommand = (value: string): boolean => {
      return commandPatterns.some((pattern) => pattern.test(value));
    };

    const checkObject = (obj: any): boolean => {
      if (!obj || typeof obj !== 'object') {
        return typeof obj === 'string' && checkCommand(obj);
      }

      for (const key in obj) {
        // Skip excluded fields that legitimately contain commands
        if (excludedFields.has(key)) {
          continue;
        }

        if (typeof obj[key] === 'string' && checkCommand(obj[key])) {
          return true;
        }
        if (typeof obj[key] === 'object' && checkObject(obj[key])) {
          return true;
        }
      }

      return false;
    };

    if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
      Logger.Warn('Command injection attempt detected', {
        ip: req.ip,
        path: req.path,
      });

      ResponseHelper.Error(res, 'Invalid request: potentially dangerous content detected', undefined, 400);
      return;
    }

    next();
  };

  /**
   * Detect SQL Injection Attempts
   * Protects against SQL injection even though we use Sequelize ORM
   */
  public PreventSQLInjection = (req: Request, res: Response, next: NextFunction): void => {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
      /(--|\#|\/\*|\*\/)/,                    // SQL comments
      /('\s*OR\s*'?1'?\s*=\s*'?1)/gi,        // '1'='1'
      /('\s*OR\s*'?1'?\s*=\s*'?1)/gi,        // '1=1
      /(\bOR\b\s+\d+\s*=\s*\d+)/gi,          // OR 1=1
      /('\s*;)/g,                             // '; (command separator)
      /(WAITFOR\s+DELAY)/gi,                  // Time-based injection
      /(SLEEP\()/gi,                          // SLEEP function
      /(BENCHMARK\()/gi,                      // BENCHMARK function
      /(LOAD_FILE\()/gi,                      // File read
      /(INTO\s+OUTFILE)/gi,                   // File write
      /(xp_cmdshell)/gi,                      // Command execution (MSSQL)
    ];

    // Fields that should be excluded from SQL injection check (e.g., file paths, code snippets)
    const excludedFields = new Set([
      'DeployOnPaths',    // Glob patterns for deployment paths
      'Commands',         // Pipeline commands
      'Script',           // Shell scripts
      'Command',          // Single command
      'Pipeline',         // Deployment pipeline steps
      'RsyncOptions',     // Rsync command options (contains -- flags)
      'Config',           // Project configuration (may contain rsync options and pipeline commands)
    ]);

    const checkSQL = (value: string): boolean => {
      return sqlPatterns.some((pattern) => pattern.test(value));
    };

    const checkObject = (obj: any): boolean => {
      if (!obj || typeof obj !== 'object') {
        return typeof obj === 'string' && checkSQL(obj);
      }

      for (const key in obj) {
        // Skip excluded fields
        if (excludedFields.has(key)) {
          continue;
        }

        if (typeof obj[key] === 'string' && checkSQL(obj[key])) {
          return true;
        }
        if (typeof obj[key] === 'object' && checkObject(obj[key])) {
          return true;
        }
      }

      return false;
    };

    if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
      Logger.Warn('SQL injection attempt detected', {
        ip: req.ip,
        path: req.path,
      });

      ResponseHelper.Error(res, 'Invalid request: suspicious SQL patterns detected', undefined, 400);
      return;
    }

    next();
  };

  /**
   * HTTP Request Smuggling Protection
   * Prevents request smuggling attacks
   */
  public PreventRequestSmuggling = (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.headers['content-length'];
    const transferEncoding = req.headers['transfer-encoding'];

    // Reject requests with both Content-Length and Transfer-Encoding
    if (contentLength && transferEncoding) {
      Logger.Warn('Request smuggling attempt: both Content-Length and Transfer-Encoding present', {
        ip: req.ip,
        path: req.path,
      });

      ResponseHelper.Error(res, 'Invalid request headers', undefined, 400);
      return;
    }

    // Reject requests with multiple or suspicious Transfer-Encoding values
    if (transferEncoding) {
      const values = transferEncoding.split(',').map((v) => v.trim().toLowerCase());
      if (values.length > 1 || !values.includes('chunked')) {
        Logger.Warn('Suspicious Transfer-Encoding detected', {
          ip: req.ip,
          path: req.path,
          transferEncoding,
        });

        ResponseHelper.Error(res, 'Invalid Transfer-Encoding', undefined, 400);
        return;
      }
    }

    next();
  };

  /**
   * Enforce HTTPS in Production
   * Redirects HTTP to HTTPS
   */
  public EnforceHTTPS = (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.NODE_ENV === 'production') {
      // Check if request is secure
      const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';

      if (!isSecure) {
        Logger.Info('Redirecting HTTP to HTTPS', {
          ip: req.ip,
          path: req.path,
        });

        const httpsUrl = `https://${req.headers.host}${req.url}`;
        res.redirect(301, httpsUrl);
        return;
      }
    }

    next();
  };
}

export default SecurityMiddleware;
