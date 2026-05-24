/**
 * Projects integration — Deploy Center v3.0 / F-002 (T092).
 *
 * Covers CRUD + RBAC for the /api/projects surface. Skipped automatically
 * when the test DB is unreachable.
 *
 * Scenarios:
 *   - Admin creates a project → 201
 *   - Viewer attempts to create → 403
 *   - Admin lists projects (sees all)
 *   - Admin deletes own project → 200
 *   - Viewer attempts to delete → 403
 */

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

import request from 'supertest';
import { setupTestDb, teardownTestDb, truncateAll } from '../helpers/setupTestDb';
import { makeUser, makeProject } from '../helpers/factories';
import { authHeader } from '../helpers/token';
import { buildTestApp } from '../helpers/testApp';
import ProjectRoutes from '@Routes/ProjectRoutes';

async function dbReachable(): Promise<boolean> {
  try {
    await setupTestDb();
    return true;
  } catch {
    return false;
  }
}

describe('Projects — F-002 integration (CRUD + RBAC)', () => {
  let dbUp = false;
  let app: import('express').Application;

  beforeAll(async () => {
    dbUp = await dbReachable();
    if (!dbUp) {
      // eslint-disable-next-line no-console
      console.warn('Test DB unreachable — Projects suite skipped');
      return;
    }
    app = buildTestApp([{ path: '/api/projects', router: new ProjectRoutes().Router }]);
  });

  afterAll(async () => {
    if (dbUp) await teardownTestDb();
  });

  beforeEach(async () => {
    if (dbUp) await truncateAll();
  });

  it('Admin: POST /api/projects → 201 with new row', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const res = await request(app)
      .post('/api/projects')
      .set(authHeader(admin))
      .send({
        Name: `proj_${Date.now()}`,
        RepoUrl: 'git@github.com:test/proj.git',
        Branch: 'main',
        ProjectPath: '/tmp/test/proj',
        ProjectType: 'node',
        Config: { Branch: 'main', AutoDeploy: false, Variables: {}, Pipeline: [] },
      });
    expect(res.status).toBe(201);
    expect(res.body.Data.Project.Id).toBeGreaterThan(0);
  });

  it('Viewer: POST /api/projects → 403', async () => {
    if (!dbUp) return;
    const viewer = await makeUser({ Role: 'Viewer' });
    const res = await request(app)
      .post('/api/projects')
      .set(authHeader(viewer))
      .send({
        Name: `proj_${Date.now()}`,
        RepoUrl: 'git@github.com:test/proj.git',
        Branch: 'main',
        ProjectPath: '/tmp/test/proj',
        ProjectType: 'node',
      });
    expect(res.status).toBe(403);
  });

  it('Admin: GET /api/projects → 200 with the list', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    await makeProject({ CreatedBy: admin.Id });
    await makeProject({ CreatedBy: admin.Id });
    const res = await request(app).get('/api/projects').set(authHeader(admin));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.Data.Projects)).toBe(true);
    expect(res.body.Data.Projects.length).toBeGreaterThanOrEqual(2);
  });

  it('Admin: DELETE own project → 200', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const proj = await makeProject({ CreatedBy: admin.Id });
    const res = await request(app)
      .delete(`/api/projects/${proj.Id}`)
      .set(authHeader(admin));
    expect(res.status).toBe(200);
  });

  it('Viewer: DELETE someone else’s project → 403', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const viewer = await makeUser({ Role: 'Viewer' });
    const proj = await makeProject({ CreatedBy: admin.Id });
    const res = await request(app)
      .delete(`/api/projects/${proj.Id}`)
      .set(authHeader(viewer));
    expect(res.status).toBe(403);
  });
});
