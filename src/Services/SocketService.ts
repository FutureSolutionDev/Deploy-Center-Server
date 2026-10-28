import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import AppConfig from '@Config/AppConfig';
import Logger from '@Utils/Logger';
import { User } from '@Models/index';
import { EAccountStatus } from '@Types/ICommon';
import AccessControlService, { IAccessSubject } from '@Services/AccessControlService';
import { ToDeploymentDto } from '@Utils/DtoMapper';

/** Room every Admin / Manager socket joins: receives events for all projects. */
export const STAFF_ROOM = 'scope:all-projects';
/** Room every authenticated socket joins (non-sensitive system events). */
export const AUTHENTICATED_ROOM = 'scope:authenticated';
/**
 * How often open sockets are re-authorized. A role change, a removed project
 * membership, a disabled account, an expired token or a rotated JWT secret
 * takes effect on live sockets within this interval.
 */
export const SOCKET_RECONCILE_INTERVAL_MS = 30_000;

export interface ISocketUser extends IAccessSubject {
  Username: string;
}

type TJoinAck = (result: { Ok: boolean; Error?: string }) => void;

interface IDeploymentLike {
  Id: number;
  ProjectId: number;
}

/** Read one cookie value from a raw Cookie header without extra dependencies. */
export function ReadCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    const raw = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

export class SocketService {
  private static Instance: SocketService;
  private IO?: SocketIOServer;
  private ReconcileTimer?: NodeJS.Timeout;

  // Per-deployment log sink: redacts + persists the SAME line that is streamed
  // to the socket, so the stored log matches the live view character-for-character.
  private logSinks = new Map<
    number,
    { redact: (line: string) => string; persist: (line: string) => void }
  >();

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static GetInstance(): SocketService {
    if (!SocketService.Instance) {
      SocketService.Instance = new SocketService();
    }
    return SocketService.Instance;
  }

  /**
   * Initialize Socket.IO server
   */
  public Initialize(httpServer: HttpServer): void {
    if (this.IO) {
      return;
    }

    const ClientUrl = (AppConfig?.ClientUrl || 'http://localhost:5173') as string;

    this.IO = new SocketIOServer(httpServer, {
      cors: {
        origin: [ClientUrl, 'http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      path: '/v1/ws',
    });

    // SEC-C2: every connection must present a valid access token. Anonymous
    // sockets are rejected before any event handler is attached.
    this.IO.use((socket, next) => {
      this.AuthenticateSocket(socket)
        .then(async (user) => {
          socket.data.user = user;
          socket.data.rooms = await this.ResolveInitialRooms(user);
          next();
        })
        .catch((error: Error) => {
          Logger.Warn('Socket connection rejected', { reason: error.message, socketId: socket.id });
          next(new Error('Unauthorized'));
        });
    });

    this.IO.on('connection', (socket: Socket) => {
      this.HandleConnection(socket);
    });

    this.ReconcileTimer = setInterval(() => {
      void this.ReconcileAll();
    }, SOCKET_RECONCILE_INTERVAL_MS);
    this.ReconcileTimer.unref();

    Logger.Info('Socket.IO initialized successfully');
  }

  /**
   * Close the Socket.IO server (graceful shutdown and test teardown).
   */
  public async Shutdown(): Promise<void> {
    if (this.ReconcileTimer) {
      clearInterval(this.ReconcileTimer);
      this.ReconcileTimer = undefined;
    }
    if (!this.IO) return;
    const io = this.IO;
    this.IO = undefined;
    await new Promise<void>((resolve) => {
      void io.close(() => resolve());
    });
  }

  /**
   * Validate the handshake credentials and load the current user from the DB.
   * Accepts the httpOnly `access_token` cookie (browsers) or `auth.token`
   * (non-browser clients). The DB lookup means disabled / suspended accounts
   * are rejected even while their JWT is still unexpired.
   */
  private async AuthenticateSocket(socket: Socket): Promise<ISocketUser> {
    const cookieToken = ReadCookie(socket.handshake.headers.cookie, 'access_token');
    const authToken =
      typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : null;
    const token = cookieToken || authToken;
    if (!token) {
      throw new Error('No token provided');
    }

    const payload = jwt.verify(token, AppConfig.Jwt.Secret, { algorithms: ['HS256'] }) as {
      UserId?: unknown;
    };
    const userId = AccessControlService.ParseId(payload.UserId);
    if (userId === null) {
      throw new Error('Malformed token payload');
    }
    const user = await this.LoadActiveUser(userId);
    // Kept in memory only, so the reconciler can re-verify expiry and secret.
    socket.data.token = token;
    return user;
  }

  /**
   * Re-authorize every open socket (see SOCKET_RECONCILE_INTERVAL_MS).
   */
  public async ReconcileAll(): Promise<void> {
    if (!this.IO) return;
    const sockets = [...this.IO.of('/').sockets.values()];
    for (const socket of sockets) {
      await this.ReconcileSocket(socket);
    }
  }

  /**
   * Re-authorize the open sockets of one user right away, for callers that
   * change that user's access.
   */
  public async ReconcileUser(userId: number): Promise<void> {
    if (!this.IO) return;
    const sockets = [...this.IO.of('/').sockets.values()].filter(
      (socket) => (socket.data.user as ISocketUser | undefined)?.UserId === userId
    );
    for (const socket of sockets) {
      await this.ReconcileSocket(socket);
    }
  }

  /**
   * Leave every room the user may no longer see, join any room newly granted,
   * and disconnect when the token or the account is no longer valid.
   */
  private async ReconcileSocket(socket: Socket): Promise<void> {
    try {
      const user = socket.data.user as ISocketUser | undefined;
      const token = socket.data.token as string | undefined;
      if (!user || !token) {
        throw new Error('Missing socket session');
      }
      jwt.verify(token, AppConfig.Jwt.Secret, { algorithms: ['HS256'] });
      const current = await this.LoadActiveUser(user.UserId);
      socket.data.user = current;

      const granted = new Set(await this.ResolveInitialRooms(current));
      for (const room of [...socket.rooms]) {
        if (room === socket.id || granted.has(room)) continue;
        const separator = room.indexOf(':');
        const kind = room.slice(0, separator);
        const id = AccessControlService.ParseId(room.slice(separator + 1));
        let keep = false;
        if (id !== null && kind === 'project') {
          keep = await AccessControlService.CanViewProject(current, id);
        } else if (id !== null && kind === 'deployment') {
          keep = await AccessControlService.CanViewDeployment(current, id);
        }
        if (!keep) {
          await socket.leave(room);
          Logger.Info('Socket left a room after re-authorization', { socketId: socket.id, room });
        }
      }
      await socket.join([...granted]);
    } catch (error) {
      Logger.Info('Socket disconnected after re-authorization', {
        socketId: socket.id,
        reason: (error as Error).message,
      });
      socket.disconnect(true);
    }
  }

  private async LoadActiveUser(userId: number): Promise<ISocketUser> {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User not found');
    if (!user.get('IsActive')) throw new Error('User account is disabled');
    if (user.get('AccountStatus') && user.get('AccountStatus') !== EAccountStatus.Active) {
      throw new Error('User account is not active');
    }
    return {
      UserId: user.Id,
      Username: user.Username,
      Role: user.Role,
    };
  }

  /**
   * Rooms are decided by the server: the user's own room, the staff room for
   * Admin/Manager, and one room per accessible project for Developer/Viewer.
   */
  private async ResolveInitialRooms(user: ISocketUser): Promise<string[]> {
    const rooms = [`user:${user.UserId}`, AUTHENTICATED_ROOM];
    const accessible = await AccessControlService.GetAccessibleProjectIds(user);
    if (accessible === 'all') {
      rooms.push(STAFF_ROOM);
    } else {
      accessible.forEach((projectId) => rooms.push(`project:${projectId}`));
    }
    return rooms;
  }

  /**
   * Handle a new, already-authenticated socket connection. Handlers are
   * attached synchronously so events sent right after `connect` are not lost.
   */
  private HandleConnection(socket: Socket): void {
    const user = socket.data.user as ISocketUser;
    Logger.Info(`Socket connected: ${socket.id}`, { userId: user.UserId });

    void socket.join((socket.data.rooms as string[] | undefined) ?? [`user:${user.UserId}`]);

    socket.on('join:project', (projectId: unknown, ack?: unknown) => {
      void this.HandleJoin(socket, 'project', projectId, ack);
    });

    socket.on('join:deployment', (deploymentId: unknown, ack?: unknown) => {
      void this.HandleJoin(socket, 'deployment', deploymentId, ack);
    });

    // Backward compatibility: v2.1/v3.0 clients emit join:user with their own
    // id. The user room is already joined from the verified token; any other
    // id is refused.
    socket.on('join:user', (userId: unknown, ack?: unknown) => {
      const ok = AccessControlService.ParseId(userId) === user.UserId;
      if (!ok) {
        Logger.Warn('Socket join:user denied', { socketId: socket.id, userId: user.UserId });
      }
      this.Ack(ack, ok ? { Ok: true } : { Ok: false, Error: 'Forbidden' });
    });

    socket.on('disconnect', () => {
      Logger.Info(`Socket disconnected: ${socket.id}`);
    });
  }

  /**
   * Authorize and perform a room join with the same rules as the HTTP layer.
   * The user is re-read from the DB so a role change or deactivation applies
   * to an already-open socket on its next join.
   */
  private async HandleJoin(
    socket: Socket,
    kind: 'project' | 'deployment',
    rawId: unknown,
    ack: unknown
  ): Promise<void> {
    const id = AccessControlService.ParseId(rawId);
    if (id === null) {
      this.Ack(ack, { Ok: false, Error: 'Invalid id' });
      return;
    }

    try {
      const current = await this.LoadActiveUser((socket.data.user as ISocketUser).UserId);
      socket.data.user = current;

      const allowed =
        kind === 'project'
          ? await AccessControlService.CanViewProject(current, id)
          : await AccessControlService.CanViewDeployment(current, id);

      if (!allowed) {
        Logger.Warn(`Socket join:${kind} denied`, {
          socketId: socket.id,
          userId: current.UserId,
          [`${kind}Id`]: id,
        });
        this.Ack(ack, { Ok: false, Error: 'Forbidden' });
        return;
      }

      await socket.join(`${kind}:${id}`);
      Logger.Info(`Socket ${socket.id} joined ${kind}:${id}`);
      this.Ack(ack, { Ok: true });
    } catch (error) {
      Logger.Warn(`Socket join:${kind} failed`, { socketId: socket.id, reason: (error as Error).message });
      this.Ack(ack, { Ok: false, Error: 'Forbidden' });
      if (/disabled|not active|not found/i.test((error as Error).message)) {
        socket.disconnect(true);
      }
    }
  }

  private Ack(ack: unknown, result: { Ok: boolean; Error?: string }): void {
    if (typeof ack === 'function') {
      (ack as TJoinAck)(result);
    }
  }

  /** Rooms that should receive an event about a deployment. */
  private DeploymentRooms(deployment: IDeploymentLike): string[] {
    return [STAFF_ROOM, `project:${deployment.ProjectId}`, `deployment:${deployment.Id}`];
  }

  /**
   * v3.0 F-001 — emit queue health transitions. Only authenticated sockets
   * exist; the failure reason (which can contain internal host details) is
   * sent to staff only.
   */
  public EmitQueueHealth(ready: boolean, reason?: string): void {
    if (!this.IO) return;
    this.IO.to(STAFF_ROOM).emit('queue:health', { ready, reason });
    this.IO.to(AUTHENTICATED_ROOM).except(STAFF_ROOM).emit('queue:health', { ready });
  }

  /**
   * Emit deployment update event. Delivered once per socket to staff, the
   * project room and the deployment room; never broadcast globally.
   */
  public EmitDeploymentUpdate(deployment: IDeploymentLike): void {
    if (!this.IO) return;
    this.IO.to(this.DeploymentRooms(deployment)).emit(
      'deployment:updated',
      ToDeploymentDto(deployment)
    );
  }

  /**
   * Register a persistence sink for a deployment's logs. Every line passed to
   * EmitDeploymentLog is redacted, streamed to the socket, AND persisted through
   * this sink — guaranteeing the stored log matches the live view exactly
   * (framework messages + raw command stdout/stderr, nothing dropped).
   */
  public RegisterLogSink(
    deploymentId: number,
    sink: { redact: (line: string) => string; persist: (line: string) => void }
  ): void {
    this.logSinks.set(deploymentId, sink);
  }

  /**
   * Remove a deployment's log sink (called once its log file is closed).
   */
  public UnregisterLogSink(deploymentId: number): void {
    this.logSinks.delete(deploymentId);
  }

  /**
   * Emit deployment log event — the single choke point for ALL deployment logs.
   * Redacts secrets once, streams to the deployment room, and persists the exact
   * same line via the registered sink, so nothing shown to the user is missing
   * from storage.
   */
  public EmitDeploymentLog(deploymentId: number, logLine: string): void {
    const sink = this.logSinks.get(deploymentId);
    // Redact once so the identical safe line is both streamed and stored.
    const safeLine = sink ? sink.redact(logLine) : logLine;

    if (this.IO) {
      const payload = {
        DeploymentId: deploymentId,
        Log: safeLine,
        Timestamp: new Date(),
      };
      // Emit to specific deployment room only (to reduce traffic)
      this.IO.to(`deployment:${deploymentId}`).emit('deployment:log', payload);
    }

    // Persist the exact line displayed (parity guaranteed by construction).
    if (sink) {
      sink.persist(safeLine);
    }
  }

  /**
   * Emit deployment completed event (same rooms and DTO as updates).
   */
  public EmitDeploymentCompleted(deployment: IDeploymentLike): void {
    if (!this.IO) return;
    this.IO.to(this.DeploymentRooms(deployment)).emit(
      'deployment:completed',
      ToDeploymentDto(deployment)
    );
  }

  /**
   * v3.0 F-007 (T069) — fire after a rollback is enqueued so listening UIs
   * can correlate the failed deployment with its replacement and switch the
   * detail view over without polling.
   *
   * v2.1 clients don't subscribe to this event; they keep working unchanged.
   */
  public EmitRollbackQueued(payload: {
    FromDeploymentId: number;
    NewDeploymentId: number;
    ToCommitHash: string;
  }): void {
    if (!this.IO) return;
    // Emit ONLY to the failed-deployment room. Previously this also did a
    // global emit, so subscribers of the failed-deployment room received
    // the same event twice. The deployments list (and any global watcher)
    // already gets a separate `deployment:updated` for the new rollback
    // deployment via EmitDeploymentUpdate.
    this.IO.to(`deployment:${payload.FromDeploymentId}`).emit(
      'deployment:rollback-queued',
      payload
    );
  }

  /**
   * Emit session revoked event to force logout
   */
  public EmitSessionRevoked(userId: number, sessionId: number): void {
    if (!this.IO) return;

    const payload = {
      UserId: userId,
      SessionId: sessionId,
      Message: 'Your session has been revoked',
    };

    // Emit to specific user room to force logout
    this.IO.to(`user:${userId}`).emit('session:revoked', payload);

    Logger.Info('Session revoked event emitted', { userId, sessionId });
  }
}

export default SocketService;
