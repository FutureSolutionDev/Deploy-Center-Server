/**
 * Project / deployment authorization + secret DTOs — v3.0.1 / SEC-H4, SEC-H3.
 *
 * A route table is exercised for every role against a project the caller is
 * NOT a member of, then against one they are, and project payloads are
 * checked for leaked secrets.
 */

import request from 'supertest';
import { setupTestDb, teardownTestDb, truncateAll } from '../helpers/setupTestDb';
import { makeDeployment, makeProject, makeUser } from '../helpers/factories';
import { authHeader } from '../helpers/token';
import { buildTestApp } from '../helpers/testApp';
import DeploymentRoutes from '@Routes/DeploymentRoutes';
import ProjectRoutes from '@Routes/ProjectRoutes';
import WebhookRoutes from '@Routes/WebhookRoutes';
import UsersRoutes from '@Routes/UsersRoutes';
import QueueService from '@Services/QueueService';
import { Deployment, Project, ProjectMember } from '@Models/index';
import type { User } from '@Models/User';
import { SECRET_MASK } from '@Utils/DtoMapper';
import AccessControlService from '@Services/AccessControlService';
import { EUserRole } from '@Types/ICommon';

async function dbReachable(): Promise<boolean> {
  try {
    await setupTestDb();
    return true;
  } catch {
    return false;
  }
}

type TMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

const SECRET_VAR = 'sk_live_super_secret_value_123';
const TELEGRAM_TOKEN = '123456:telegram-bot-token-secret';

describe('Access control + secret DTOs — SEC-H4 / SEC-H3', () => {
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
    app = buildTestApp([
      { path: '/api/deployments', router: new DeploymentRoutes().Router },
      { path: '/api/projects', router: new ProjectRoutes().Router },
      { path: '/api/webhooks', router: new WebhookRoutes().Router },
      { path: '/api/users', router: new UsersRoutes().Router },
    ]);
    jest.spyOn(QueueService.GetInstance(), 'IsReady').mockReturnValue(true);
    jest
      .spyOn(QueueService.GetInstance(), 'Enqueue')
      .mockImplementation(async (id: number) => `dep-${id}`);
  });

  async function fixture(): Promise<{ admin: User; project: Project; deployment: Deployment }> {
    const admin = await makeUser({ Role: 'Admin' });
    const project = await makeProject({
      CreatedBy: admin.Id,
      Config: {
        Branch: 'main',
        AutoDeploy: false,
        Pipeline: [],
        Variables: { API_KEY: SECRET_VAR, BuildCommand: 'npm run build' },
        Notifications: {
          Channels: [],
          OnSuccess: true,
          OnFailure: true,
          OnStart: false,
          Telegram: { Enabled: true, BotToken: TELEGRAM_TOKEN, ChatId: '1' },
        },
      },
    });
    const deployment = await makeDeployment({ ProjectId: project.Id });
    return { admin, project, deployment };
  }

  const routes = (p: Project, d: Deployment): Array<[TMethod, string, Record<string, unknown>?]> => [
    ['get', `/api/projects/${p.Id}`],
    ['get', `/api/projects/${p.Id}/deployments`],
    ['get', `/api/projects/${p.Id}/statistics`],
    ['get', `/api/projects/${p.Id}/ssh-key`],
    ['get', `/api/deployments/${d.Id}`],
    ['get', `/api/deployments/${d.Id}/logs`],
    ['get', `/api/deployments/${d.Id}/log/download`],
    ['get', `/api/deployments/projects/${p.Id}/deployments`],
    ['get', `/api/deployments/projects/${p.Id}/queue/status`],
    ['get', `/api/deployments/statistics?projectId=${p.Id}`],
    ['post', `/api/deployments/projects/${p.Id}/deploy`, { Branch: 'main' }],
    ['post', `/api/projects/${p.Id}/deploy`, {}],
    ['post', `/api/projects/${p.Id}/ssh-key`, {}],
    ['put', `/api/projects/${p.Id}/ssh-key`, {}],
    ['delete', `/api/projects/${p.Id}/ssh-key`],
    ['patch', `/api/projects/${p.Id}/ssh-key/toggle`, { Enabled: false }],
    ['post', `/api/projects/${p.Id}/regenerate-webhook`, {}],
    ['post', `/api/deployments/${d.Id}/cancel`, {}],
  ];

  it.each(['Developer', 'Viewer'] as const)(
    '%s who is not a member is refused on every project / deployment route',
    async (role) => {
      if (!dbUp) return;
      const { project, deployment } = await fixture();
      const outsider = await makeUser({ Role: role });

      const failures: string[] = [];
      for (const [method, url, body] of routes(project, deployment)) {
        const res = await request(app)[method](url).set(authHeader(outsider)).send(body ?? {});
        if (res.status !== 403 && res.status !== 404) failures.push(`${method.toUpperCase()} ${url} → ${res.status}`);
      }
      expect(failures).toEqual([]);
      expect(await Deployment.count()).toBe(1);
    }
  );

  it('GET /projects/name/:name hides projects the caller cannot see', async () => {
    if (!dbUp) return;
    const { project } = await fixture();
    const outsider = await makeUser({ Role: 'Viewer' });
    const res = await request(app).get(`/api/projects/name/${project.Name}`).set(authHeader(outsider));
    expect(res.status).toBe(404);
  });

  it('test-webhook endpoints require authentication and project access', async () => {
    if (!dbUp) return;
    const { project, admin } = await fixture();
    const anon = await request(app).get(`/api/webhooks/test/${project.Name}`);
    expect(anon.status).toBe(401);
    const outsider = await makeUser({ Role: 'Developer' });
    const denied = await request(app).get(`/api/webhooks/test/${project.Name}`).set(authHeader(outsider));
    expect(denied.status).toBe(404);
    const ok = await request(app).get(`/api/webhooks/test/${project.Name}`).set(authHeader(admin));
    expect(ok.status).toBe(200);
  });

  it('a Viewer member can read but not mutate; a Developer member can deploy', async () => {
    if (!dbUp) return;
    const { project, deployment, admin } = await fixture();
    const viewer = await makeUser({ Role: 'Viewer' });
    const dev = await makeUser({ Role: 'Developer' });
    await ProjectMember.create({ ProjectId: project.Id, UserId: viewer.Id, Role: 'member', AddedBy: admin.Id });
    await ProjectMember.create({ ProjectId: project.Id, UserId: dev.Id, Role: 'member', AddedBy: admin.Id });

    expect((await request(app).get(`/api/projects/${project.Id}`).set(authHeader(viewer))).status).toBe(200);
    expect((await request(app).get(`/api/deployments/${deployment.Id}`).set(authHeader(viewer))).status).toBe(200);
    expect(
      (await request(app).post(`/api/deployments/projects/${project.Id}/deploy`).set(authHeader(viewer)).send({ Branch: 'main' })).status
    ).toBe(403);
    expect(
      (await request(app).post(`/api/deployments/projects/${project.Id}/deploy`).set(authHeader(dev)).send({ Branch: 'main' })).status
    ).toBe(201);
  });

  it('a Manager is no longer locked out of SSH key management or cancel', async () => {
    if (!dbUp) return;
    const { project, deployment } = await fixture();
    const manager = await makeUser({ Role: 'Manager' });
    const ssh = await request(app).delete(`/api/projects/${project.Id}/ssh-key`).set(authHeader(manager));
    expect(ssh.status).not.toBe(403);
    const cancel = await request(app).post(`/api/deployments/${deployment.Id}/cancel`).set(authHeader(manager)).send({});
    expect(cancel.status).not.toBe(403);
  });

  it('project payloads never contain secrets but report HasValue', async () => {
    if (!dbUp) return;
    const { project, deployment, admin } = await fixture();
    const secret = project.get('WebhookSecret') as string;

    const responses = [
      await request(app).get(`/api/projects/${project.Id}`).set(authHeader(admin)),
      await request(app).get('/api/projects').set(authHeader(admin)),
      await request(app).get(`/api/projects/name/${project.Name}`).set(authHeader(admin)),
      await request(app).get(`/api/deployments/${deployment.Id}`).set(authHeader(admin)),
    ];
    for (const res of responses) {
      expect(res.status).toBe(200);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain(secret);
      expect(body).not.toContain(SECRET_VAR);
      expect(body).not.toContain(TELEGRAM_TOKEN);
      expect(body).not.toContain('SshKeyEncrypted');
      expect(body).not.toContain('"WebhookSecret":"');
    }

    const dto = responses[0]!.body.Data.Project;
    expect(dto.Secrets.WebhookSecret).toEqual({ HasValue: true });
    expect(dto.Secrets['Config.Variables.API_KEY']).toEqual({ HasValue: true });
    expect(dto.Config.Variables.API_KEY).toBe(SECRET_MASK);
    expect(dto.Config.Variables.BuildCommand).toBe('npm run build');
  });

  it('saving a project with masked values keeps the stored secrets; new values replace them', async () => {
    if (!dbUp) return;
    const { project, admin } = await fixture();
    const read = await request(app).get(`/api/projects/${project.Id}`).set(authHeader(admin));
    const config = read.body.Data.Project.Config;

    const untouched = await request(app).put(`/api/projects/${project.Id}`).set(authHeader(admin)).send({ Config: config });
    expect(untouched.status).toBe(200);
    await project.reload();
    expect(project.Config.Variables.API_KEY).toBe(SECRET_VAR);
    expect(project.Config.Notifications?.Telegram?.BotToken).toBe(TELEGRAM_TOKEN);

    config.Variables.API_KEY = 'rotated_value';
    await request(app).put(`/api/projects/${project.Id}`).set(authHeader(admin)).send({ Config: config });
    await project.reload();
    expect(project.Config.Variables.API_KEY).toBe('rotated_value');
  });

  it('the regenerated webhook secret is returned once, to an authorized caller', async () => {
    if (!dbUp) return;
    const { project, admin } = await fixture();
    const res = await request(app).post(`/api/projects/${project.Id}/regenerate-webhook`).set(authHeader(admin)).send({});
    expect(res.status).toBe(200);
    expect(typeof res.body.Data.WebhookSecret).toBe('string');
    const after = await request(app).get(`/api/projects/${project.Id}`).set(authHeader(admin));
    expect(JSON.stringify(after.body)).not.toContain(res.body.Data.WebhookSecret);
  });

  it('user management responses do not include password hashes', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const target = await makeUser({ Role: 'Viewer' });
    const res = await request(app).get(`/api/users/${target.Id}`).set(authHeader(admin));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('PasswordHash');
  });

  it('takes access away from a creator who was removed from the project', async () => {
    if (!dbUp) return;
    const creator = await makeUser({ Role: 'Developer' });
    const other = await makeUser({ Role: 'Developer' });
    const project = await makeProject({ CreatedBy: creator.Id });
    await ProjectMember.bulkCreate([
      { ProjectId: project.Id, UserId: creator.Id, Role: 'owner', AddedBy: creator.Id },
      { ProjectId: project.Id, UserId: other.Id, Role: 'owner', AddedBy: creator.Id },
    ]);
    const subject = { UserId: creator.Id, Role: EUserRole.Developer };
    expect(await AccessControlService.CanViewProject(subject, project.Id)).toBe(true);

    await ProjectMember.destroy({ where: { ProjectId: project.Id, UserId: creator.Id } });
    expect(await AccessControlService.CanViewProject(subject, project.Id)).toBe(false);
    expect(await AccessControlService.CanModifyProject(subject, project.Id)).toBe(false);
    expect(await AccessControlService.GetAccessibleProjectIds(subject)).toEqual([]);

    const del = await request(app).delete(`/api/projects/${project.Id}`).set(authHeader(creator));
    expect(del.status).toBe(403);
    expect(await Project.findByPk(project.Id)).not.toBeNull();
  });

});
