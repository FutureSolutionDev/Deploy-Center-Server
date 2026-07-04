import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import AppConfig from '@Config/AppConfig';
import Logger from '@Utils/Logger';
import { Deployment } from '@Models/index';

export class SocketService {
  private static Instance: SocketService;
  private IO?: SocketIOServer;

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

    this.IO.on('connection', (socket: Socket) => {
      this.HandleConnection(socket);
    });

    Logger.Info('Socket.IO initialized successfully');
  }

  /**
   * Handle new socket connection
   */
  private HandleConnection(socket: Socket): void {
    Logger.Info(`Socket connected: ${socket.id}`);

    // Join room based on project if needed
    socket.on('join:project', async (projectId: number) => {
      await socket.join(`project:${projectId}`);
      Logger.Info(`Socket ${socket.id} joined project:${projectId}`);
    });

    // Join room based on deployment if needed
    socket.on('join:deployment', async (deploymentId: number) => {
      await socket.join(`deployment:${deploymentId}`);
      Logger.Info(`Socket ${socket.id} joined deployment:${deploymentId}`);
    });

    // Join room based on userId for session management
    socket.on('join:user', async (userId: number) => {
      await socket.join(`user:${userId}`);
      Logger.Info(`Socket ${socket.id} joined user:${userId}`);
    });

    socket.on('disconnect', () => {
      Logger.Info(`Socket disconnected: ${socket.id}`);
    });
  }

  /**
   * v3.0 F-001 — emit queue health transition to all connected clients.
   * Fired by RedisConfig lifecycle listeners on connect / error / end.
   * v2.1 clients ignore the unknown event safely.
   */
  public EmitQueueHealth(ready: boolean, reason?: string): void {
    if (!this.IO) return;
    this.IO.emit('queue:health', { ready, reason });
  }

  /**
   * Emit deployment update event
   */
  public EmitDeploymentUpdate(deployment: Deployment): void {
    if (!this.IO) return;

    // Emit to global listeners (e.g., deployments list, queue)
    this.IO.emit('deployment:updated', deployment);

    // Emit to specific project room
    this.IO.to(`project:${deployment.ProjectId}`).emit('deployment:updated', deployment);

    // Emit to specific deployment room
    this.IO.to(`deployment:${deployment.Id}`).emit('deployment:updated', deployment);
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
   * Emit deployment completed event
   */
  public EmitDeploymentCompleted(deployment: Deployment): void {
    if (!this.IO) return;

    this.IO.emit('deployment:completed', deployment);
    this.IO.to(`project:${deployment.ProjectId}`).emit('deployment:completed', deployment);
    this.IO.to(`deployment:${deployment.Id}`).emit('deployment:completed', deployment);
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
