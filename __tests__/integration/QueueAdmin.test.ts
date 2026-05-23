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

async function redisReachable(): Promise<boolean> {
  try {
    await getTestRedis().ping();
    return true;
  } catch {
    return false;
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
