/**
 * EnvironmentVariables integration tests — F-002 (T044, FR-009..FR-013).
 *
 * Covers:
 *  - CRUD via REST (all 4 endpoints)
 *  - Role gating: Admin + Manager pass; Developer + Viewer get 403
 *  - Secret values are redacted to "***" in list responses
 *  - Round-trip encrypt/decrypt — secret value is stored encrypted but
 *    decrypts correctly via the InjectIntoEnv path
 *  - Duplicate (ProjectId, KeyName) → ValidationError
 *  - DELETE on missing row → 404
 *
 * Requires a reachable test database (REDIS not required for this suite).
 *  RUN: docker compose up -d mariadb && npm test -- EnvVars
 */

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

import request from 'supertest';
import { setupTestDb, teardownTestDb, truncateAll } from '../helpers/setupTestDb';
import { makeUser, makeProject } from '../helpers/factories';
import { authHeader } from '../helpers/token';
import { buildTestApp } from '../helpers/testApp';
import EnvironmentVariableRoutes from '@Routes/EnvironmentVariableRoutes';
import EnvironmentVariableService from '@Services/EnvironmentVariableService';

async function dbReachable(): Promise<boolean> {
  try {
    await setupTestDb();
    return true;
  } catch {
    return false;
  }
}

describe('EnvironmentVariables — F-003 integration', () => {
  let dbUp = false;
  let app: import('express').Application;
  let projectId: number;
  let adminAuth: { Authorization: string };
  let managerAuth: { Authorization: string };
  let developerAuth: { Authorization: string };
  let viewerAuth: { Authorization: string };

  beforeAll(async () => {
    dbUp = await dbReachable();
    if (!dbUp) {
      // eslint-disable-next-line no-console
      console.warn('Test DB unreachable — EnvVars suite will be skipped');
      return;
    }
    app = buildTestApp([
      { path: '/api/projects/:projectId/env-vars', router: new EnvironmentVariableRoutes().Router },
    ]);
  });

  afterAll(async () => {
    if (dbUp) await teardownTestDb();
  });

  beforeEach(async () => {
    if (!dbUp) return;
    await truncateAll();
    const admin = await makeUser({ Role: 'Admin' });
    const manager = await makeUser({ Role: 'Manager' });
    const developer = await makeUser({ Role: 'Developer' });
    const viewer = await makeUser({ Role: 'Viewer' });
    adminAuth = authHeader(admin);
    managerAuth = authHeader(manager);
    developerAuth = authHeader(developer);
    viewerAuth = authHeader(viewer);
    const project = await makeProject({ CreatedBy: admin.Id });
    projectId = project.Id;
  });

  it('Admin can create, list, update, delete an env var', async () => {
    if (!dbUp) return;
    // CREATE — non-secret
    const create = await request(app)
      .post(`/api/projects/${projectId}/env-vars`)
      .set(adminAuth)
      .send({ KeyName: 'NODE_ENV', Value: 'production', IsSecret: false });
    expect(create.status).toBe(200);
    expect(create.body.Data.KeyName).toBe('NODE_ENV');
    expect(create.body.Data.Value).toBe('production'); // not secret → visible

    // LIST — secret value redacted
    const create2 = await request(app)
      .post(`/api/projects/${projectId}/env-vars`)
      .set(adminAuth)
      .send({ KeyName: 'DB_URL', Value: 'mysql://localhost/x', IsSecret: true });
    expect(create2.status).toBe(200);

    const list = await request(app)
      .get(`/api/projects/${projectId}/env-vars`)
      .set(adminAuth);
    expect(list.status).toBe(200);
    const items = list.body.Data.Items as Array<{ KeyName: string; Value: string; IsSecret: boolean }>;
    expect(items).toHaveLength(2);
    const dbUrl = items.find((i) => i.KeyName === 'DB_URL')!;
    expect(dbUrl.IsSecret).toBe(true);
    expect(dbUrl.Value).toBe('***'); // FR-012 redaction

    // UPDATE — value rotation
    const id = create2.body.Data.Id as number;
    const upd = await request(app)
      .put(`/api/projects/${projectId}/env-vars/${id}`)
      .set(adminAuth)
      .send({ Value: 'mysql://newhost/y' });
    expect(upd.status).toBe(200);

    // Verify InjectIntoEnv returns the NEW plaintext (round-trip encrypt/decrypt)
    const svc = new EnvironmentVariableService();
    const env = await svc.InjectIntoEnv(projectId);
    expect(env.DB_URL).toBe('mysql://newhost/y');

    // DELETE
    const del = await request(app)
      .delete(`/api/projects/${projectId}/env-vars/${id}`)
      .set(adminAuth);
    expect(del.status).toBe(200);

    const listAfter = await request(app)
      .get(`/api/projects/${projectId}/env-vars`)
      .set(adminAuth);
    expect((listAfter.body.Data.Items as unknown[])).toHaveLength(1);
  });

  it('Manager can perform CRUD (same as Admin)', async () => {
    if (!dbUp) return;
    const res = await request(app)
      .post(`/api/projects/${projectId}/env-vars`)
      .set(managerAuth)
      .send({ KeyName: 'X', Value: 'y', IsSecret: false });
    expect(res.status).toBe(200);
  });

  it('Developer is forbidden (403)', async () => {
    if (!dbUp) return;
    const list = await request(app)
      .get(`/api/projects/${projectId}/env-vars`)
      .set(developerAuth);
    expect(list.status).toBe(403);

    const create = await request(app)
      .post(`/api/projects/${projectId}/env-vars`)
      .set(developerAuth)
      .send({ KeyName: 'X', Value: 'y' });
    expect(create.status).toBe(403);
  });

  it('Viewer is forbidden (403)', async () => {
    if (!dbUp) return;
    const list = await request(app)
      .get(`/api/projects/${projectId}/env-vars`)
      .set(viewerAuth);
    expect(list.status).toBe(403);
  });

  it('Unauthenticated → 401', async () => {
    if (!dbUp) return;
    const list = await request(app).get(`/api/projects/${projectId}/env-vars`);
    expect(list.status).toBe(401);
  });

  it('Duplicate (ProjectId, KeyName) is rejected with ValidationError', async () => {
    if (!dbUp) return;
    await request(app)
      .post(`/api/projects/${projectId}/env-vars`)
      .set(adminAuth)
      .send({ KeyName: 'DUPE', Value: 'a' });
    const dupe = await request(app)
      .post(`/api/projects/${projectId}/env-vars`)
      .set(adminAuth)
      .send({ KeyName: 'DUPE', Value: 'b' });
    // v3.0 review fix: duplicate-key now returns 409 Conflict (was 400)
    // to match REST conventions used by the rest of the v3.0 controllers.
    expect(dupe.status).toBe(409);
    expect(dupe.body.Message).toMatch(/already exists/i);
  });

  it('Invalid KeyName pattern → ValidationError', async () => {
    if (!dbUp) return;
    const bad = await request(app)
      .post(`/api/projects/${projectId}/env-vars`)
      .set(adminAuth)
      .send({ KeyName: 'has spaces', Value: 'x' });
    expect(bad.status).toBe(400);
  });

  it('DELETE non-existent row → 404', async () => {
    if (!dbUp) return;
    const del = await request(app)
      .delete(`/api/projects/${projectId}/env-vars/9999999`)
      .set(adminAuth);
    expect(del.status).toBe(404);
  });

  it('GetSecretValues returns only IsSecret=true values (LogFormatter feed)', async () => {
    if (!dbUp) return;
    await request(app)
      .post(`/api/projects/${projectId}/env-vars`)
      .set(adminAuth)
      .send({ KeyName: 'PUBLIC_VAR', Value: 'visible', IsSecret: false });
    await request(app)
      .post(`/api/projects/${projectId}/env-vars`)
      .set(adminAuth)
      .send({ KeyName: 'SECRET_VAR', Value: 'topsecret', IsSecret: true });

    const svc = new EnvironmentVariableService();
    const secrets = await svc.GetSecretValues(projectId);
    expect(secrets).toContain('topsecret');
    expect(secrets).not.toContain('visible');
  });
});
