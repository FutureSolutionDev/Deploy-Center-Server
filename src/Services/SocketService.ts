import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import AppConfig from '@Config/AppConfig';
import Logger from '@Utils/Logger';
import { Deployment } from '@Models/index';

export class SocketService {
  private static Instance: SocketService;
  private IO?: SocketIOServer;

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

    socket.on('disconnect', () => {
      Logger.Info(`Socket disconnected: ${socket.id}`);
    });
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
   * Emit deployment log event
   */
  public EmitDeploymentLog(deploymentId: number, logLine: string): void {
    if (!this.IO) return;

    const payload = {
      DeploymentId: deploymentId,
      Log: logLine,
      Timestamp: new Date(),
    };

    // Emit to specific deployment room only (to reduce traffic)
    this.IO.to(`deployment:${deploymentId}`).emit('deployment:log', payload);
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
}

export default SocketService;
