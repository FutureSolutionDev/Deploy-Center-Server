/**
 * Command injection through the API — v3.0.1 / ENG-C2.
 *
 * The SecurityMiddleware regex filter is NOT mounted here on purpose: these
 * tests prove the service-level validation alone rejects hostile refs, repo
 * URLs and rsync options.
 */

import request from 'supertest';
import { setupTestDb, teardownTestDb, truncateAll } from '../helpers/setupTestDb';
import { makeProject, makeUser } from '../helpers/factories';
import { authHeader } from '../helpers/token';
import { buildTestApp } from '../helpers/testApp';
import DeploymentRoutes from '@Routes/DeploymentRoutes';
import ProjectRoutes from '@Routes/ProjectRoutes';
import QueueService from '@Services/QueueService';
import { Deployment, Project } from '@Models/index';

async function dbReachable(): Promise<boolean> {
  try {
    await setupTestDb();
    return true;
  } catch {
    return false;
  }
}

const BAD_BRANCHES = [
  'main; touch /tmp/dc-pwned',
  'main\ntouch /tmp/dc-pwned',
  '$(touch /tmp/dc-pwned)',
  '--upload-pack=touch /tmp/dc-pwned',
  'a..b',
];

const BAD_COMMITS = [
  'abc1234; touch /tmp/dc-pwned',
  'abc1234\ntouch /tmp/dc-pwned',
  '--orphan=x',
  'HEAD~1',
  'ZZZZZZZ',
];

describe('Command injection — ENG-C2', () => {
  let dbUp = false;
  let app: import('express').Application;

  beforeAll(async () => {
    dbUp = await dbReachable();
  });

  afterAll(async () => {
    if (dbUp) await teardownTestDb();
  });

  beforeEach(async () => {
    if (!dbUp) return;
    await truncateAll();
    // Fresh routers per test → fresh in-memory DeploymentLimiter.
    app = buildTestApp([
      { path: '/api/deployments', router: new DeploymentRoutes().Router },
      { path: '/api/projects', router: new ProjectRoutes().Router },
    ]);
    jest.spyOn(QueueService.GetInstance(), 'IsReady').mockReturnValue(true);
    jest
      .spyOn(QueueService.GetInstance(), 'Enqueue')
      .mockImplementation(async (id: number) => `dep-${id}`);
  });

  it.each(BAD_BRANCHES)('manual deploy rejects branch %j', async (Branch) => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const project = await makeProject({ CreatedBy: admin.Id });
    const res = await request(app)
      .post(`/api/deployments/projects/${project.Id}/deploy`)
      .set(authHeader(admin))
      .send({ Branch });
    expect(res.status).toBe(400);
    expect(await Deployment.count()).toBe(0);
  });

  it.each(BAD_COMMITS)('manual deploy rejects commit %j', async (CommitHash) => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const project = await makeProject({ CreatedBy: admin.Id });
    const res = await request(app)
      .post(`/api/deployments/projects/${project.Id}/deploy`)
      .set(authHeader(admin))
      .send({ Branch: 'main', CommitHash });
    expect(res.status).toBe(400);
    expect(await Deployment.count()).toBe(0);
  });

  it('manual deploy still accepts a valid branch and commit', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const project = await makeProject({ CreatedBy: admin.Id });
    const res = await request(app)
      .post(`/api/deployments/projects/${project.Id}/deploy`)
      .set(authHeader(admin))
      .send({ Branch: 'feature/login', CommitHash: 'abc1234' });
    expect(res.status).toBe(201);
    expect(await Deployment.count()).toBe(1);
  });

  it.each([
    ['RepoUrl', { RepoUrl: 'ext::sh -c touch% /tmp/dc-pwned' }],
    ['RepoUrl', { RepoUrl: 'file:///etc/passwd' }],
    ['RepoUrl', { RepoUrl: '--upload-pack=touch /tmp/dc-pwned' }],
    ['Branch', { Branch: 'main;id' }],
    ['RsyncOptions', { Config: { Branch: 'main', RsyncOptions: '-e "sh -c id"', Pipeline: [], Variables: {}, AutoDeploy: false } }],
    ['RsyncOptions', { Config: { Branch: 'main', RsyncOptions: '--rsync-path=id', Pipeline: [], Variables: {}, AutoDeploy: false } }],
  ])('project create rejects a hostile %s', async (_field, overrides) => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const res = await request(app)
      .post('/api/projects')
      .set(authHeader(admin))
      .send({
        Name: 'inj-project',
        RepoUrl: 'https://github.com/org/repo.git',
        Branch: 'main',
        ProjectPath: '/tmp/test/inj',
        ProjectType: 'node',
        ...overrides,
      });
    expect(res.status).toBe(400);
    expect(await Project.count({ where: { Name: 'inj-project' } })).toBe(0);
  });

  it('project update rejects a hostile RepoUrl and keeps the old one', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const project = await makeProject({ CreatedBy: admin.Id, RepoUrl: 'git@github.com:org/ok.git' });
    const res = await request(app)
      .put(`/api/projects/${project.Id}`)
      .set(authHeader(admin))
      .send({ RepoUrl: 'git@github.com:org/ok.git; touch /tmp/dc-pwned' });
    expect(res.status).toBe(400);
    await project.reload();
    expect(project.RepoUrl).toBe('git@github.com:org/ok.git');
  });
});
