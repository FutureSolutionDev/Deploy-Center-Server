/**
 * Redis connection factory for Deploy Center v3.0 — F-001.
 * Singleton ioredis client used by BullMQ (queue + worker) and Bull Board.
 *
 * Failure mode (FR-005b / research D-04): on disconnect, ioredis retries
 * with exponential backoff automatically; we log lifecycle events and
 * expose a sync IsReady() probe consumed by QueueReadyMiddleware (T018).
 */

import Redis, { RedisOptions } from 'ioredis';
import AppConfig from '@Config/AppConfig';
import Logger from '@Utils/Logger';

/**
 * Lazy resolution to avoid Config → Services circular import. SocketService is
 * accessed only when an event fires, by which time the module graph is settled.
 */
function emitQueueHealth(ready: boolean, reason?: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: SocketService } = require('@Services/SocketService');
    SocketService.GetInstance().EmitQueueHealth(ready, reason);
  } catch {
    // SocketService not yet initialized (e.g. during early boot) — safe to ignore.
  }
}

let cachedClient: Redis | null = null;
let isReady = false;
let lastError: string | null = null;

/** Build the ioredis options once, derived from AppConfig. */
function buildOptions(): RedisOptions {
  const cfg = AppConfig;
  return {
    host: cfg.Redis.Host,
    port: cfg.Redis.Port,
    password: cfg.Redis.Password || undefined,
    db: cfg.Redis.Db,
    // null = commands are queued during reconnect instead of rejected;
    // matches research D-04 ("no silent crash, auto-resume on reconnect").
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    // BullMQ requires this for blocking commands (BRPOPLPUSH etc.).
    // See https://docs.bullmq.io/guide/connections
    lazyConnect: false,
  };
}

/**
 * Get the shared ioredis client. Creates on first call; reuses thereafter.
 * Safe to call from anywhere — Logger lifecycle events are wired once per client.
 */
export function getRedisConnection(): Redis {
  if (cachedClient) return cachedClient;

  cachedClient = new Redis(buildOptions());

  cachedClient.on('connect', () => {
    Logger.Info('Redis: TCP connection established', {
      host: AppConfig.Redis.Host,
      port: AppConfig.Redis.Port,
      db: AppConfig.Redis.Db,
    });
  });

  cachedClient.on('ready', () => {
    const transitioning = !isReady;
    isReady = true;
    lastError = null;
    Logger.Info('Redis: ready to accept commands');
    if (transitioning) emitQueueHealth(true);
  });

  cachedClient.on('error', (err: Error) => {
    const transitioning = isReady;
    isReady = false;
    lastError = err.message;
    // ioredis re-emits frequently during reconnect; rate-limit via Logger.Warn.
    Logger.Warn(`Redis: ${err.message}`);
    if (transitioning) emitQueueHealth(false, err.message);
  });

  cachedClient.on('close', () => {
    const transitioning = isReady;
    isReady = false;
    Logger.Warn('Redis: connection closed');
    if (transitioning) emitQueueHealth(false, 'connection closed');
  });

  cachedClient.on('reconnecting', (delay: number) => {
    Logger.Info(`Redis: reconnecting in ${delay}ms`);
  });

  cachedClient.on('end', () => {
    const transitioning = isReady;
    isReady = false;
    Logger.Warn('Redis: connection ended');
    if (transitioning) emitQueueHealth(false, 'connection ended');
  });

  return cachedClient;
}

/**
 * Sync probe used by QueueReadyMiddleware to short-circuit deployment triggers
 * with HTTP 503 when Redis is down (FR-005b).
 */
export function isRedisReady(): boolean {
  return isReady;
}

/** Last connection error message (for /health endpoint or admin diagnostics). */
export function getRedisLastError(): string | null {
  return lastError;
}

/**
 * Cleanly disconnect — called from graceful shutdown handlers and from
 * test teardown. After disconnect, the next getRedisConnection() rebuilds.
 */
export async function disconnectRedis(): Promise<void> {
  if (cachedClient) {
    try {
      await cachedClient.quit();
    } catch {
      // already closed — ignore
    }
    cachedClient = null;
    isReady = false;
  }
}

export default { getRedisConnection, isRedisReady, getRedisLastError, disconnectRedis };
