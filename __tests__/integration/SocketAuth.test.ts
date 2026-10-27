/**
 * Socket.IO authentication + room authorization — v3.0.1 / SEC-C2.
 *
 * Boots the real SocketService on an ephemeral port and drives it with
 * socket.io-client, asserting that anonymous sockets are rejected, joins are
 * authorized like the HTTP layer, and deployment events carry DTOs only.
 */

import http from 'http';
import { AddressInfo } from 'net';
import jwt from 'jsonwebtoken';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import AppConfig from '@Config/AppConfig';
import SocketService from '@Services/SocketService';
import { Deployment, Project, ProjectMember } from '@Models/index';
import type { User } from '@Models/User';
import { setupTestDb, teardownTestDb, truncateAll } from '../helpers/setupTestDb';
import { makeDeployment, makeProject, makeUser } from '../helpers/factories';
import { signAccessToken } from '../helpers/token';

async function dbReachable(): Promise<boolean> {
  try {
    await setupTestDb();
    return true;
  } catch {
    return false;
  }
}

describe('Socket.IO auth — SEC-C2', () => {
  let dbUp = false;
  let httpServer: http.Server;
  let url = '';
  const open: ClientSocket[] = [];

  function connect(options: { cookie?: string; token?: string } = {}): ClientSocket {
    const socket = ioClient(url, {
      path: '/v1/ws',
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      extraHeaders: options.cookie ? { Cookie: options.cookie } : undefined,
      auth: options.token ? { token: options.token } : undefined,
    });
    open.push(socket);
    return socket;
  }

  function connected(socket: ClientSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', (err) => reject(err));
    });
  }

  function rejected(socket: ClientSocket): Promise<string> {
    return new Promise((resolve, reject) => {
      socket.once('connect', () => reject(new Error('unexpectedly connected')));
      socket.once('connect_error', (err) => resolve(err.message));
    });
  }

  function join(
    socket: ClientSocket,
    event: string,
    id: unknown
  ): Promise<{ Ok: boolean; Error?: string }> {
    return new Promise((resolve) => socket.emit(event, id, resolve));
  }

  function collect(socket: ClientSocket, event: string): unknown[] {
    const received: unknown[] = [];
    socket.on(event, (payload: unknown) => received.push(payload));
    return received;
  }

  const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
  const cookieFor = (user: User): string => `access_token=${signAccessToken(user)}`;

  beforeAll(async () => {
    dbUp = await dbReachable();
    if (!dbUp) return;
    httpServer = http.createServer();
    SocketService.GetInstance().Initialize(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
    url = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    open.forEach((s) => s.disconnect());
    if (dbUp) {
      await SocketService.GetInstance().Shutdown();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      await teardownTestDb();
    }
  });

  beforeEach(async () => {
    if (dbUp) await truncateAll();
  });

  afterEach(() => {
    open.splice(0).forEach((s) => s.disconnect());
  });

  it('rejects an anonymous socket', async () => {
    if (!dbUp) return;
    expect(await rejected(connect())).toBe('Unauthorized');
  });

  it('rejects a forged token and a token signed with another secret', async () => {
    if (!dbUp) return;
    const forged = jwt.sign({ UserId: 1, Role: 'admin' }, 'not-the-server-secret');
    expect(await rejected(connect({ cookie: `access_token=${forged}` }))).toBe('Unauthorized');
    expect(await rejected(connect({ token: 'garbage' }))).toBe('Unauthorized');
  });

  it('rejects a valid token for a disabled user', async () => {
    if (!dbUp) return;
    const user = await makeUser({ IsActive: false });
    expect(await rejected(connect({ cookie: cookieFor(user) }))).toBe('Unauthorized');
  });

  it('accepts the access_token cookie and the auth.token fallback', async () => {
    if (!dbUp) return;
    const user = await makeUser({ Role: 'Viewer' });
    await connected(connect({ cookie: cookieFor(user) }));
    await connected(connect({ token: signAccessToken(user) }));
  });

  it('refuses cross-project and cross-deployment joins for a Developer', async () => {
    if (!dbUp) return;
    const dev = await makeUser({ Role: 'Developer' });
    const own = await makeProject();
    const other = await makeProject();
    await ProjectMember.create({ ProjectId: own.Id, UserId: dev.Id, Role: 'member', AddedBy: dev.Id });
    const otherDeployment = await makeDeployment({ ProjectId: other.Id });
    const ownDeployment = await makeDeployment({ ProjectId: own.Id });

    const socket = connect({ cookie: cookieFor(dev) });
    await connected(socket);

    expect(await join(socket, 'join:project', other.Id)).toEqual({ Ok: false, Error: 'Forbidden' });
    expect(await join(socket, 'join:deployment', otherDeployment.Id)).toEqual({
      Ok: false,
      Error: 'Forbidden',
    });
    expect(await join(socket, 'join:project', own.Id)).toEqual({ Ok: true });
    expect(await join(socket, 'join:deployment', ownDeployment.Id)).toEqual({ Ok: true });
    expect((await join(socket, 'join:project', '1 OR 1=1')).Ok).toBe(false);
  });

  it('refuses joining another user room', async () => {
    if (!dbUp) return;
    const a = await makeUser();
    const b = await makeUser();
    const socket = connect({ cookie: cookieFor(a) });
    await connected(socket);
    expect((await join(socket, 'join:user', b.Id)).Ok).toBe(false);
    expect((await join(socket, 'join:user', a.Id)).Ok).toBe(true);

    const revoked = collect(socket, 'session:revoked');
    SocketService.GetInstance().EmitSessionRevoked(b.Id, 99);
    await wait(150);
    expect(revoked).toHaveLength(0);
  });

  it('delivers deployment events only to authorized sockets, once, as a DTO', async () => {
    if (!dbUp) return;
    const admin = await makeUser({ Role: 'Admin' });
    const dev = await makeUser({ Role: 'Developer' });
    const outsider = await makeUser({ Role: 'Developer' });
    const project = await makeProject({ CreatedBy: admin.Id });
    await ProjectMember.create({ ProjectId: project.Id, UserId: dev.Id, Role: 'member', AddedBy: admin.Id });
    const created = await makeDeployment({ ProjectId: project.Id });
    const deployment = await Deployment.findByPk(created.Id, {
      include: [{ model: Project, as: 'Project' }],
    });

    const adminSocket = connect({ cookie: cookieFor(admin) });
    const devSocket = connect({ cookie: cookieFor(dev) });
    const outsiderSocket = connect({ cookie: cookieFor(outsider) });
    const anonymousRejected = rejected(connect());
    await Promise.all([connected(adminSocket), connected(devSocket), connected(outsiderSocket)]);
    expect(await anonymousRejected).toBe('Unauthorized');
    // Admin also sits in the project and deployment rooms: still one delivery.
    await join(adminSocket, 'join:project', project.Id);
    await join(adminSocket, 'join:deployment', created.Id);

    const adminEvents = collect(adminSocket, 'deployment:updated');
    const devEvents = collect(devSocket, 'deployment:updated');
    const outsiderEvents = collect(outsiderSocket, 'deployment:updated');

    SocketService.GetInstance().EmitDeploymentUpdate(deployment as Deployment);
    await wait(200);

    expect(adminEvents).toHaveLength(1);
    expect(devEvents).toHaveLength(1);
    expect(outsiderEvents).toHaveLength(0);

    const payload = devEvents[0] as Record<string, unknown>;
    const serialized = JSON.stringify(payload);
    expect(payload.Id).toBe(created.Id);
    expect(serialized).not.toContain('WebhookSecret');
    expect(serialized).not.toContain(project.get('WebhookSecret') as string);
    expect(serialized).not.toContain('SshKeyEncrypted');
    expect(serialized).not.toContain('"Config"');
    expect((payload.Project as Record<string, unknown>).Name).toBe(project.Name);
  });

  it('does not deliver live logs to a socket that was refused the deployment room', async () => {
    if (!dbUp) return;
    const outsider = await makeUser({ Role: 'Viewer' });
    const deployment = await makeDeployment();
    const socket = connect({ cookie: cookieFor(outsider) });
    await connected(socket);
    await join(socket, 'join:deployment', deployment.Id);

    const logs = collect(socket, 'deployment:log');
    SocketService.GetInstance().EmitDeploymentLog(deployment.Id, 'secret build output');
    await wait(150);
    expect(logs).toHaveLength(0);
  });

  it('keeps the JWT secret configured for tests', () => {
    expect(AppConfig.Jwt.Secret.length).toBeGreaterThan(32);
  });
});
