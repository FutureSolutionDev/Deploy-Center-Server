/**
 * Idempotency Middleware
 * Prevents duplicate request processing using idempotency keys
 * Following SOLID principles and PascalCase naming convention
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import ResponseHelper from '@Utils/ResponseHelper';
import Logger from '@Utils/Logger';

interface IIdempotencyRecord {
  Response: {
    StatusCode: number;
    Body: any;
    Headers: Record<string, string>;
  };
  Timestamp: number;
}

export class IdempotencyMiddleware {
  private readonly Store: Map<string, IIdempotencyRecord>;
  private readonly HeaderName: string = 'Idempotency-Key';
  private readonly TtlMs: number = 10 * 60 * 1000; // 10 minutes
  private readonly CleanupIntervalMs: number = 5 * 60 * 1000; // 5 minutes
  private CleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.Store = new Map();
    this.StartCleanupTimer();
  }

  /**
   * Start periodic cleanup of expired idempotency records
   */
  private StartCleanupTimer(): void {
    this.CleanupTimer = setInterval(() => {
      this.CleanupExpiredRecords();
    }, this.CleanupIntervalMs);
  }

  /**
   * Cleanup expired idempotency records
   */
  private CleanupExpiredRecords(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, record] of this.Store.entries()) {
      if (now - record.Timestamp > this.TtlMs) {
        this.Store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      Logger.Debug(`Cleaned up ${cleaned} expired idempotency records`);
    }
  }

  /**
   * Stop cleanup timer (for graceful shutdown)
   */
  public StopCleanupTimer(): void {
    if (this.CleanupTimer) {
      clearInterval(this.CleanupTimer);
      this.CleanupTimer = null;
    }
  }

  /**
   * Validate idempotency key format
   */
  private ValidateKey(key: string): boolean {
    // Key should be a valid UUID or at least 16 characters
    if (!key || key.length < 16 || key.length > 255) {
      return false;
    }

    // Check for valid characters (alphanumeric, hyphens, underscores)
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    return validPattern.test(key);
  }

  /**
   * Generate hash of request for comparison
   */
  private GenerateRequestHash(req: Request): string {
    const requestData = {
      Method: req.method,
      Path: req.path,
      Body: req.body,
      Query: req.query,
    };

    return crypto.createHash('sha256').update(JSON.stringify(requestData)).digest('hex');
  }

  /**
   * Check idempotency and handle duplicate requests
   */
  public CheckIdempotency = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Only apply to mutation methods
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return next();
      }

      // Get idempotency key from header
      const idempotencyKey = req.headers[this.HeaderName.toLowerCase()] as string;

      // If no idempotency key provided, skip check (optional)
      if (!idempotencyKey) {
        Logger.Debug('No idempotency key provided, skipping check', {
          method: req.method,
          path: req.path,
        });
        return next();
      }

      // Validate key format
      if (!this.ValidateKey(idempotencyKey)) {
        Logger.Warn('Invalid idempotency key format', { key: idempotencyKey });
        ResponseHelper.ValidationError(res, 'Invalid idempotency key format', {
          IdempotencyKey: 'Must be 16-255 characters, alphanumeric with hyphens/underscores',
        });
        return;
      }

      // Generate request hash for additional verification
      const requestHash = this.GenerateRequestHash(req);
      const storageKey = `${idempotencyKey}:${requestHash}`;

      // Check if we have a cached response for this key
      const cachedRecord = this.Store.get(storageKey);

      if (cachedRecord) {
        const now = Date.now();
        const age = now - cachedRecord.Timestamp;

        // Check if record is still valid
        if (age <= this.TtlMs) {
          Logger.Info('Returning cached response for duplicate idempotent request', {
            key: idempotencyKey,
            ageMs: age,
            method: req.method,
            path: req.path,
          });

          // Return cached response
          res.status(cachedRecord.Response.StatusCode);

          // Set cached headers
          Object.entries(cachedRecord.Response.Headers).forEach(([headerName, value]) => {
            res.setHeader(headerName, value);
          });

          // Add idempotency header to indicate this is a cached response
          res.setHeader('X-Idempotency-Cached', 'true');

          res.json(cachedRecord.Response.Body);
          return;
        } else {
          // Expired, remove it
          this.Store.delete(storageKey);
        }
      }

      // Store the idempotency key in request for later use
      (req as any).idempotencyKey = storageKey;

      // Intercept response to cache it
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      res.json = (body: any) => {
        this.CacheResponse(storageKey, res.statusCode, body, res.getHeaders());
        return originalJson(body);
      };

      res.send = (body: any) => {
        this.CacheResponse(storageKey, res.statusCode, body, res.getHeaders());
        return originalSend(body);
      };

      next();
    } catch (error) {
      Logger.Error('Idempotency check error', error as Error);
      // Don't block request on idempotency errors
      next();
    }
  };

  /**
   * Cache response for idempotency
   */
  private CacheResponse(
    key: string,
    statusCode: number,
    body: any,
    headers: Record<string, any>
  ): void {
    try {
      // Only cache successful responses (2xx)
      if (statusCode >= 200 && statusCode < 300) {
        const record: IIdempotencyRecord = {
          Response: {
            StatusCode: statusCode,
            Body: body,
            Headers: this.SerializeHeaders(headers),
          },
          Timestamp: Date.now(),
        };

        this.Store.set(key, record);

        Logger.Debug('Cached response for idempotency', {
          key: key.substring(0, 50), // Log partial key for privacy
          statusCode,
        });
      }
    } catch (error) {
      Logger.Error('Failed to cache idempotency response', error as Error);
    }
  }

  /**
   * Serialize headers to plain object
   */
  private SerializeHeaders(headers: Record<string, any>): Record<string, string> {
    const serialized: Record<string, string> = {};

    Object.entries(headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        serialized[key] = value;
      } else if (Array.isArray(value)) {
        serialized[key] = value.join(', ');
      } else if (value !== undefined) {
        serialized[key] = String(value);
      }
    });

    return serialized;
  }

  /**
   * Manually clear a specific idempotency key
   */
  public ClearKey(key: string): boolean {
    return this.Store.delete(key);
  }

  /**
   * Clear all idempotency records
   */
  public ClearAll(): void {
    this.Store.clear();
    Logger.Info('Cleared all idempotency records');
  }

  /**
   * Get statistics about idempotency store
   */
  public GetStats(): {
    TotalRecords: number;
    ExpiredRecords: number;
    ActiveRecords: number;
  } {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const record of this.Store.values()) {
      if (now - record.Timestamp > this.TtlMs) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      TotalRecords: this.Store.size,
      ExpiredRecords: expired,
      ActiveRecords: active,
    };
  }
}

export default IdempotencyMiddleware;
