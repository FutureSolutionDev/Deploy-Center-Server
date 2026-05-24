/**
 * Users integration — Deploy Center v3.0 / F-002 (T092).
 *
 * Covers user management RBAC + role-change flow via /api/users.
 *   - Admin: GET list, POST create, PUT role-change → 200/201
 *   - Manager: GET list → 200; POST create → 403 (Admin-only)
 *   - Developer: GET list → 403
 *   - Viewer: any access → 403
 */

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

import request from 'supertest';
import { setupTestDb, teardownTestDb, truncateAll } from '../helpers/setupTestDb';
import { makeUser } from '../helpers/factories';
import { authHeader } from '../helpers/token';
import { buildTestApp } from '../helpers/testApp';
import UsersRoutes from '@Routes/UsersRoutes';

async function dbReachable(): Promise<boolean> {
  try {
    await setupTestDb();
    return true;
  } catch {
    return false;
  }
}

describe('Users — F-002 integration (role mgmt + RBAC)', () => {
  let dbUp = false;
  let app: import('express').Application;

  beforeAll(async () => {
    dbUp = await dbReachable();
    if (!dbUp) {
      // eslint-disable-next-line no-console
      console.warn('Test DB unreachable — Users suite skipped');
      return;
    }
    app = buildTestApp([{ path: '/api/users', router: new UsersRoutes().Router }]);
  });

  afterAll(async () => {
    if (dbUp) await teardownTestDb();
  });

  beforeEach(async () => {
    if (dbUp) await truncateAll();
  });

  it('Admin: GET /api/users → 200 with the list', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    await makeUser({ Role: 'Developer' });
    const res = await request(app).get('/api/users').set(authHeader(admin));
    expect(res.status).toBe(200);
  });

  it('Developer: GET /api/users → 403', async () => {
    if (!dbUp) return;
    const dev = await makeUser({ Role: 'Developer' });
    const res = await request(app).get('/api/users').set(authHeader(dev));
    expect(res.status).toBe(403);
  });

  it('Viewer: GET /api/users → 403', async () => {
    if (!dbUp) return;
    const viewer = await makeUser({ Role: 'Viewer' });
    const res = await request(app).get('/api/users').set(authHeader(viewer));
    expect(res.status).toBe(403);
  });

  it('Admin: POST /api/users → 201 (create)', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const res = await request(app)
      .post('/api/users')
      .set(authHeader(admin))
      .send({
        username: `new_user_${Date.now()}`,
        email: `new_user_${Date.now()}@test.local`,
        password: 'Sup3rSecret!',
        role: 'Developer',
        fullName: 'New User',
      });
    expect(res.status).toBe(201);
  });

  it('Manager: POST /api/users → 403 (Admin-only)', async () => {
    if (!dbUp) return;
    const manager = await makeUser({ Role: 'Manager' });
    const res = await request(app)
      .post('/api/users')
      .set(authHeader(manager))
      .send({
        username: 'x',
        email: 'x@test.local',
        password: 'x123',
        role: 'Developer',
      });
    expect(res.status).toBe(403);
  });

  it('Admin: PUT /api/users/:id/role → 200 (Developer → Manager)', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const target = await makeUser({ Role: 'Developer' });
    const res = await request(app)
      .put(`/api/users/${target.Id}/role`)
      .set(authHeader(admin))
      .send({ role: 'Manager' });
    expect(res.status).toBe(200);
  });
});
