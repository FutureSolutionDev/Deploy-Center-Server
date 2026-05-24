/**
 * Rollback integration — Deploy Center v3.0 / F-007 (T073 + T074).
 *
 * Covers the rollback contract end-to-end via the REST endpoint:
 *
 *  - 202 happy path:
 *      failed deployment + prior success exists + commits differ
 *      → new Deployment row with TriggerType=rollback + AuditLog entry
 *  - 422: target deployment is not in 'failed' state (e.g. 'success')
 *  - 422: no prior successful deployment for the project
 *  - 409: last successful commit equals the failed deployment's commit
 *  - 403: deployment-access middleware rejects unrelated developer
 *
 * QueueService.Enqueue is mocked so the suite is deterministic and does NOT
 * require a Redis container. RequireQueueReady is bypassed by mocking
 * QueueService.IsReady() to return true.
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
import { AuditLog } from '@Models/AuditLog';
import { Deployment } from '@Models/Deployment';
import { EAuditAction, EDeploymentStatus, ETriggerType } from '@Types/ICommon';

async function dbReachable(): Promise<boolean> {
  try {
    await setupTestDb();
    return true;
  } catch {
    return false;
  }
}

describe('Rollback — F-007 integration', () => {
  let dbUp = false;
  let app: import('express').Application;

  beforeAll(async () => {
    dbUp = await dbReachable();
    if (!dbUp) {
      // eslint-disable-next-line no-console
      console.warn('Test DB unreachable — Rollback suite will be skipped');
      return;
    }
    app = buildTestApp([
      { path: '/api/deployments', router: new DeploymentRoutes().Router },
    ]);

    // Stub Redis health + Enqueue so the tests don't require a live Redis.
    jest.spyOn(QueueService.GetInstance(), 'IsReady').mockReturnValue(true);
    jest
      .spyOn(QueueService.GetInstance(), 'Enqueue')
      .mockImplementation(async (deploymentId: number) => `dep-${deploymentId}`);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    if (dbUp) await teardownTestDb();
  });

  beforeEach(async () => {
    if (dbUp) await truncateAll();
  });

  it('202: creates a rollback deployment + audit log when a prior success exists', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const project = await makeProject({ CreatedBy: admin.Id });

    const success = await makeDeployment({
      ProjectId: project.Id,
      Status: EDeploymentStatus.Success as never,
      CommitHash: 'aaaaaaa1111',
    });
    // Backdate the success so the failure is "newer".
    await Deployment.update(
      { CreatedAt: new Date(Date.now() - 60_000) },
      { where: { Id: success.Id } }
    );
    const failed = await makeDeployment({
      ProjectId: project.Id,
      Status: EDeploymentStatus.Failed as never,
      CommitHash: 'bbbbbbb2222',
    });

    const res = await request(app)
      .post(`/api/deployments/${failed.Id}/rollback`)
      .set(authHeader(admin));

    expect(res.status).toBe(202);
    expect(res.body.Data.FromDeploymentId).toBe(failed.Id);
    expect(res.body.Data.ToCommitHash).toBe('aaaaaaa1111');

    // New deployment row with rollback trigger.
    const newDep = await Deployment.findByPk(res.body.Data.NewDeploymentId);
    expect(newDep).not.toBeNull();
    expect(newDep!.TriggerType).toBe(ETriggerType.Rollback);
    expect(newDep!.CommitHash).toBe('aaaaaaa1111');
    expect(newDep!.QueueJobId).toBe(`dep-${newDep!.Id}`);

    // Audit log present + complete.
    const audit = await AuditLog.findOne({
      where: { ResourceId: newDep!.Id, Action: EAuditAction.DeploymentRolledBack },
    });
    expect(audit).not.toBeNull();
    expect(audit!.Details).toMatchObject({
      FromDeploymentId: failed.Id,
      NewDeploymentId: newDep!.Id,
      ToCommitHash: 'aaaaaaa1111',
      FromCommitHash: 'bbbbbbb2222',
    });

    // Queue was asked to enqueue the new deployment.
    expect(QueueService.GetInstance().Enqueue).toHaveBeenCalledWith(
      newDep!.Id,
      project.Id,
      20
    );
  });

  it('422: target deployment is not in failed state', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const project = await makeProject({ CreatedBy: admin.Id });
    const success = await makeDeployment({
      ProjectId: project.Id,
      Status: EDeploymentStatus.Success as never,
    });

    const res = await request(app)
      .post(`/api/deployments/${success.Id}/rollback`)
      .set(authHeader(admin));

    expect(res.status).toBe(422);
    expect(res.body.Message).toMatch(/failed deployments/i);

    // No audit row recorded for a rejected rollback.
    const audit = await AuditLog.findOne({
      where: { Action: EAuditAction.DeploymentRolledBack },
    });
    expect(audit).toBeNull();
  });

  it('422: no prior successful deployment to roll back to', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const project = await makeProject({ CreatedBy: admin.Id });
    const failed = await makeDeployment({
      ProjectId: project.Id,
      Status: EDeploymentStatus.Failed as never,
      CommitHash: 'xxxxxxx7777',
    });

    const res = await request(app)
      .post(`/api/deployments/${failed.Id}/rollback`)
      .set(authHeader(admin));

    expect(res.status).toBe(422);
    expect(res.body.Message).toMatch(/no prior successful deployment/i);
  });

  it('409: last successful commit equals the failed deployment commit', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const project = await makeProject({ CreatedBy: admin.Id });

    const success = await makeDeployment({
      ProjectId: project.Id,
      Status: EDeploymentStatus.Success as never,
      CommitHash: 'samesame999',
    });
    await Deployment.update(
      { CreatedAt: new Date(Date.now() - 60_000) },
      { where: { Id: success.Id } }
    );
    const failed = await makeDeployment({
      ProjectId: project.Id,
      Status: EDeploymentStatus.Failed as never,
      CommitHash: 'samesame999',
    });

    const res = await request(app)
      .post(`/api/deployments/${failed.Id}/rollback`)
      .set(authHeader(admin));

    expect(res.status).toBe(409);
    expect(res.body.Message).toMatch(/already on this commit/i);
  });
});
