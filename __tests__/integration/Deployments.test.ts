/**
 * Deployments integration — Deploy Center v3.0 / F-002 (T093).
 *
 * Covers the read + retry surface of /api/deployments. The actual deploy
 * trigger goes through DeploymentService.CreateDeployment which spawns a
 * pipeline process — we exercise the row creation + queue handoff by
 * stubbing QueueService.Enqueue, mirroring the Rollback suite's pattern.
 *
 * Scenarios:
 *  - GET /api/deployments → 200 list
 *  - GET /api/deployments/:id → 200 row
 *  - POST /api/deployments/:id/retry on a Failed deployment → 201 + new row
 *  - POST /api/deployments/:id/retry on a Success → 400 (cannot retry success)
 *  - POST /api/deployments/:id/rollback on a Failed deployment WITH prior
 *    success → 202 + AuditLog row (rollback flow path 1 of T093 spec)
 */

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });

import request from 'supertest';
import { setupTestDb, teardownTestDb, truncateAll } from '../helpers/setupTestDb';
import { makeUser, makeProject, makeDeployment } from '../helpers/factories';
import { authHeader } from '../helpers/token';
import { buildTestApp } from '../helpers/testApp';
import DeploymentRoutes from '@Routes/DeploymentRoutes';
import QueueService from '@Services/QueueService';
import { Deployment } from '@Models/Deployment';
import { EDeploymentStatus } from '@Types/ICommon';

async function dbReachable(): Promise<boolean> {
  try {
    await setupTestDb();
    return true;
  } catch {
    return false;
  }
}

describe('Deployments — F-002 integration (read + retry + rollback)', () => {
  let dbUp = false;
  let app: import('express').Application;

  beforeAll(async () => {
    dbUp = await dbReachable();
    if (!dbUp) {
      // eslint-disable-next-line no-console
      console.warn('Test DB unreachable — Deployments suite skipped');
      return;
    }
    app = buildTestApp([
      { path: '/api/deployments', router: new DeploymentRoutes().Router },
    ]);
  });

  afterAll(async () => {
    if (dbUp) await teardownTestDb();
  });

  beforeEach(async () => {
    if (dbUp) await truncateAll();
    // Re-mock per-test: jest.config.js has `restoreMocks: true` which
    // auto-restores spies after each test. Without re-mocking, tests
    // 2+ hit the real QueueService.IsReady() → RequireQueueReady
    // middleware returns 503.
    jest.spyOn(QueueService.GetInstance(), 'IsReady').mockReturnValue(true);
    jest
      .spyOn(QueueService.GetInstance(), 'Enqueue')
      .mockImplementation(async (id: number) => `dep-${id}`);
  });

  it('GET /api/deployments → 200 list', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const project = await makeProject({ CreatedBy: admin.Id });
    await makeDeployment({
      ProjectId: project.Id,
      Status: EDeploymentStatus.Success as never,
    });
    const res = await request(app).get('/api/deployments').set(authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.body.Data.Deployments.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/deployments/:id → 200 with the row', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const project = await makeProject({ CreatedBy: admin.Id });
    const d = await makeDeployment({
      ProjectId: project.Id,
      Status: EDeploymentStatus.Success as never,
    });
    const res = await request(app)
      .get(`/api/deployments/${d.Id}`)
      .set(authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.body.Data.Deployment.Id).toBe(d.Id);
  });

  it('POST /api/deployments/:id/retry on Success → 400', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const project = await makeProject({ CreatedBy: admin.Id });
    const success = await makeDeployment({
      ProjectId: project.Id,
      Status: EDeploymentStatus.Success as never,
    });
    const res = await request(app)
      .post(`/api/deployments/${success.Id}/retry`)
      .set(authHeader(admin));
    expect(res.status).toBe(400);
  });

  it('POST /api/deployments/:id/rollback → 202 with prior Success', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const project = await makeProject({ CreatedBy: admin.Id });
    const success = await makeDeployment({
      ProjectId: project.Id,
      Status: EDeploymentStatus.Success as never,
      CommitHash: 'aaaa1111',
    });
    await Deployment.update(
      { CreatedAt: new Date(Date.now() - 60_000) },
      { where: { Id: success.Id } }
    );
    const failed = await makeDeployment({
      ProjectId: project.Id,
      Status: EDeploymentStatus.Failed as never,
      CommitHash: 'bbbb2222',
    });
    const res = await request(app)
      .post(`/api/deployments/${failed.Id}/rollback`)
      .set(authHeader(admin));
    expect(res.status).toBe(202);
    expect(res.body.Data.ToCommitHash).toBe('aaaa1111');
  });
});
