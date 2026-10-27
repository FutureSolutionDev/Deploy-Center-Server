/**
 * Auth integration — Deploy Center v3.0 / F-002 (T077).
 *
 * Verifies register → login → refresh → logout end-to-end via the REST
 * surface. Cookies are tracked across requests via supertest's agent.
 *
 * Skipped automatically if the test DB is unreachable.
 */

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

import request from 'supertest';
import cookieParser from 'cookie-parser';
import express from 'express';
import { setupTestDb, teardownTestDb, truncateAll } from '../helpers/setupTestDb';
import AuthRoutes from '@Routes/AuthRoutes';
import AppConfig from '@Config/AppConfig';
import { User } from '@Models/index';
import { makeUser } from '../helpers/factories';

async function dbReachable(): Promise<boolean> {
  try {
    await setupTestDb();
    return true;
  } catch {
    return false;
  }
}

describe('Auth — F-002 integration', () => {
  let dbUp = false;
  let app: import('express').Application;

  beforeAll(async () => {
    dbUp = await dbReachable();
    if (!dbUp) {
      // eslint-disable-next-line no-console
      console.warn('Test DB unreachable — Auth suite skipped');
      return;
    }
    // We build the app inline (not via buildTestApp) so we can mount the
    // /api/auth router at exactly the path the controllers expect.
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', new AuthRoutes().Router);
  });

  afterAll(async () => {
    if (dbUp) await teardownTestDb();
  });

  beforeEach(async () => {
    if (dbUp) await truncateAll();
  });

  it('register on an empty system → first user becomes Admin and gets cookies', async () => {
    if (!dbUp) return;
    const res = await request(app).post('/api/auth/register').send({
      Username: 'reg_user',
      Email: 'reg_user@test.local',
      Password: 'Sup3rSecret!',
      Role: 'viewer',
    });
    expect(res.status).toBe(201);
    expect(res.body.Data.User.Username).toBe('reg_user');
    expect(res.body.Data.User.Role).toBe('admin');

    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie);
    expect(cookieStr).toContain('access_token=');
    expect(cookieStr).toContain('refresh_token=');
  });

  it('register is closed by default once any user exists (SEC-C1)', async () => {
    if (!dbUp) return;
    expect(AppConfig.AllowRegistration).toBe(false);
    await makeUser({ Role: 'Admin' });

    const res = await request(app).post('/api/auth/register').send({
      Username: 'intruder',
      Email: 'intruder@test.local',
      Password: 'Sup3rSecret!',
      Role: 'admin',
    });
    expect(res.status).toBe(403);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(await User.count({ where: { Username: 'intruder' } })).toBe(0);
  });

  it('register ignores a client-supplied Role even when registration is open (SEC-C1)', async () => {
    if (!dbUp) return;
    jest.replaceProperty(AppConfig, 'AllowRegistration', true);
    await makeUser({ Role: 'Admin' });

    const res = await request(app).post('/api/auth/register').send({
      Username: 'selfreg',
      Email: 'selfreg@test.local',
      Password: 'Sup3rSecret!',
      Role: 'admin',
      IsActive: true,
      AccountStatus: 'active',
    });
    expect(res.status).toBe(201);
    expect(res.body.Data.User.Role).toBe('viewer');
    const stored = await User.findOne({ where: { Username: 'selfreg' } });
    expect(stored?.get('Role')).toBe('viewer');
  });

  it('register rejects malformed bodies with 400', async () => {
    if (!dbUp) return;
    const res = await request(app).post('/api/auth/register').send({
      Username: 'bad name; rm -rf /',
      Email: 'not-an-email',
      Password: 'Sup3rSecret!',
    });
    expect(res.status).toBe(400);
    expect(await User.count()).toBe(0);
  });

  it('two concurrent first registrations produce exactly one Admin', async () => {
    if (!dbUp) return;
    const [a, b] = await Promise.all([
      request(app).post('/api/auth/register').send({
        Username: 'race_a',
        Email: 'race_a@test.local',
        Password: 'Sup3rSecret!',
      }),
      request(app).post('/api/auth/register').send({
        Username: 'race_b',
        Email: 'race_b@test.local',
        Password: 'Sup3rSecret!',
      }),
    ]);
    const created = [a, b].filter((r) => r.status === 201);
    expect(created).toHaveLength(1);
    expect(await User.count()).toBe(1);
    expect(await User.count({ where: { Role: 'admin' } })).toBe(1);
  });

  it('registration-status reports first-admin setup, then closed', async () => {
    if (!dbUp) return;
    const before = await request(app).get('/api/auth/registration-status');
    expect(before.status).toBe(200);
    expect(before.body.Data).toEqual({ AllowRegistration: true, SetupRequired: true });

    await makeUser({ Role: 'Admin' });
    const after = await request(app).get('/api/auth/registration-status');
    expect(after.body.Data).toEqual({ AllowRegistration: false, SetupRequired: false });
  });

  it('login → wrong password → 401', async () => {
    if (!dbUp) return;
    await makeUser({ Username: 'login_user', Password: 'CorrectHorse!' });
    const res = await request(app).post('/api/auth/login').send({
      Username: 'login_user',
      Password: 'WrongPass!',
    });
    expect(res.status).toBe(401);
  });

  it('login → refresh → logout (cookies clear)', async () => {
    if (!dbUp) return;
    await makeUser({ Username: 'flow_user', Password: 'Hunter22!' });

    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({
      Username: 'flow_user',
      Password: 'Hunter22!',
    });
    expect(login.status).toBe(200);

    const refresh = await agent.post('/api/auth/refresh');
    expect(refresh.status).toBe(200);

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);

    const clears = logout.headers['set-cookie'];
    const cookieStr = Array.isArray(clears) ? clears.join(';') : String(clears);
    // Expect access_token and refresh_token to be cleared (Max-Age=0 or expires past).
    expect(cookieStr).toMatch(/access_token=;|access_token=.*(Max-Age=0|Expires=Thu, 01 Jan 1970)/i);
  });

  it('refresh without cookie → 400 ValidationError', async () => {
    if (!dbUp) return;
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(400);
  });
});
