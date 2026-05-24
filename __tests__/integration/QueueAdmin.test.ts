/**
 * Bull Board / QueueAdmin RBAC integration — F-002 (T045, FR-003).
 *
 * Verifies the /admin/queues sub-tree is gated correctly:
 *   - Unauthenticated → 401
 *   - Authenticated non-Admin → 403
 *   - Admin → 200 (Bull Board HTML or JSON)
 *
 * Requires Redis up (Bull Board needs the BullMQ adapter). Auto-skips
 * if Redis is unreachable.
 */

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

import express from 'express';
import request from 'supertest';
import { setupTestDb, teardownTestDb, truncateAll } from '../helpers/setupTestDb';
import { makeUser } from '../helpers/factories';
import { authHeader } from '../helpers/token';
import { flushTestRedis, closeTestRedis, getTestRedis } from '../helpers/redis';
import AuthMiddleware from '@Middleware/AuthMiddleware';
import RoleMiddleware from '@Middleware/RoleMiddleware';
import { EUserRole } from '@Types/ICommon';
import { getBullBoardRouter, BULL_BOARD_BASE_PATH } from '@Services/QueueAdminService';
import QueueService from '@Services/QueueService';
import { disconnectRedis } from '@Config/RedisConfig';

/**
 * Safe Redis-probe pattern (mirrors __tests__/unit/Services/QueueService.test.ts):
 *
 * Use a *separate throwaway* client with `retryStrategy: () => null` +
 * short timeouts so we fail fast when Redis is down. Using
 * `getTestRedis().ping()` here would open the SHARED client (lazyConnect=false)
 * which then enters ioredis's reconnect-forever loop and holds Jest open
 * for the full testTimeout — turning a "skipped suite" into a 20s hang.
 */
async function redisReachable(): Promise<boolean> {
  const Redis = (await import('ioredis')).default;
  const probe = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    db: Number(process.env.REDIS_DB ?? 1),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  try {
    await probe.connect();
    await probe.ping();
    return true;
  } catch {
    return false;
  } finally {
    probe.disconnect();
    // Keep getTestRedis referenced so its cleanup in afterAll still runs.
    void getTestRedis;
  }
}

describe('Bull Board /admin/queues RBAC — F-001 FR-003', () => {
  let infraUp = false;
  let app: express.Application;

  beforeAll(async () => {
    try {
      await setupTestDb();
    } catch {
      // eslint-disable-next-line no-console
      console.warn('Test DB unreachable — QueueAdmin suite skipped');
      return;
    }
    infraUp = await redisReachable();
    if (!infraUp) {
      // eslint-disable-next-line no-console
      console.warn('Test Redis unreachable — QueueAdmin suite skipped');
      return;
    }
    await flushTestRedis();

    // Build a minimal app that mirrors App.InitializeRoutes' Bull Board mount.
    app = express();
    const auth = new AuthMiddleware();
    const role = new RoleMiddleware();
    app.use(
      BULL_BOARD_BASE_PATH,
      auth.Authenticate,
      role.RequireRole([EUserRole.Admin]),
      getBullBoardRouter()
    );
  });

  afterAll(async () => {
    if (!infraUp) return;
    await QueueService.GetInstance().StopWorker();
    await flushTestRedis();
    await closeTestRedis();
    await disconnectRedis();
    await teardownTestDb();
  });

  beforeEach(async () => {
    if (infraUp) await truncateAll();
  });

  it('GET /admin/queues unauthenticated → 401', async () => {
    if (!infraUp) return;
    const res = await request(app).get(BULL_BOARD_BASE_PATH);
    expect(res.status).toBe(401);
  });

  it('GET /admin/queues as Developer → 403', async () => {
    if (!infraUp) return;
    const dev = await makeUser({ Role: 'Developer' });
    const res = await request(app).get(BULL_BOARD_BASE_PATH).set(authHeader(dev));
    expect(res.status).toBe(403);
  });

  it('GET /admin/queues as Manager → 403 (Admin-only per FR-003)', async () => {
    if (!infraUp) return;
    const mgr = await makeUser({ Role: 'Manager' });
    const res = await request(app).get(BULL_BOARD_BASE_PATH).set(authHeader(mgr));
    expect(res.status).toBe(403);
  });

  it('GET /admin/queues as Viewer → 403', async () => {
    if (!infraUp) return;
    const v = await makeUser({ Role: 'Viewer' });
    const res = await request(app).get(BULL_BOARD_BASE_PATH).set(authHeader(v));
    expect(res.status).toBe(403);
  });

  it('GET /admin/queues as Admin → 200 (Bull Board UI served)', async () => {
    if (!infraUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const res = await request(app).get(BULL_BOARD_BASE_PATH).set(authHeader(admin));
    // Bull Board may redirect to its UI index — accept 200 OR 302.
    expect([200, 302]).toContain(res.status);
  });
});
