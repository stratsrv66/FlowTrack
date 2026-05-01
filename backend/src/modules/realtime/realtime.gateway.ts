import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';

interface AuthSocket extends Socket {
  userId: string;
  projectRooms: Set<string>;
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/realtime',
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  // userId → Set of socketIds (one user can have multiple tabs open)
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Authenticates the socket connection via JWT in handshake */
  async handleConnection(client: AuthSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) throw new WsException('No token provided');

      const payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });

      client.userId = payload.sub;
      client.projectRooms = new Set();

      // Track user socket
      if (!this.userSockets.has(client.userId)) {
        this.userSockets.set(client.userId, new Set());
      }
      this.userSockets.get(client.userId)!.add(client.id);

      // Join personal room for direct notifications
      await client.join(`user:${client.userId}`);

      this.logger.debug(`Client connected: ${client.id} (user: ${client.userId})`);
    } catch (err) {
      this.logger.warn(`Connection rejected: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  /** Cleans up user socket tracking on disconnect */
  handleDisconnect(client: AuthSocket) {
    if (client.userId) {
      const sockets = this.userSockets.get(client.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(client.userId);
          // Broadcast offline presence to all project rooms
          client.projectRooms?.forEach((room) => {
            this.server.to(room).emit('user.presence', {
              userId: client.userId,
              status: 'offline',
            });
          });
        }
      }
    }
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /**
   * Client joins a project room to receive project-scoped events
   * @event join_project
   * @payload { projectId: string }
   */
  @SubscribeMessage('join_project')
  async handleJoinProject(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { projectId: string },
  ) {
    const room = `project:${data.projectId}`;
    await client.join(room);
    client.projectRooms.add(room);

    // Broadcast online presence
    this.server.to(room).emit('user.presence', {
      userId: client.userId,
      status: 'online',
      projectId: data.projectId,
    });

    return { event: 'joined', room };
  }

  /**
   * Client leaves a project room
   * @event leave_project
   * @payload { projectId: string }
   */
  @SubscribeMessage('leave_project')
  async handleLeaveProject(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() data: { projectId: string },
  ) {
    const room = `project:${data.projectId}`;
    await client.leave(room);
    client.projectRooms.delete(room);
  }

  // ==========================================
  // Domain Event Handlers → broadcast to rooms
  // ==========================================

  @OnEvent('issue.created')
  broadcastIssueCreated(payload: { issue: any; actorId: string; projectId: string }) {
    this.server.to(`project:${payload.projectId}`).emit('issue.created', {
      issue: payload.issue,
      actorId: payload.actorId,
    });
  }

  @OnEvent('issue.updated')
  broadcastIssueUpdated(payload: { issue: any; previousIssue: any; actorId: string; projectId: string }) {
    this.server.to(`project:${payload.projectId}`).emit('issue.updated', {
      issue: payload.issue,
      actorId: payload.actorId,
    });
  }

  @OnEvent('issue.deleted')
  broadcastIssueDeleted(payload: { issueId: string; actorId: string; projectId: string }) {
    this.server.to(`project:${payload.projectId}`).emit('issue.deleted', {
      issueId: payload.issueId,
      actorId: payload.actorId,
    });
  }

  @OnEvent('comment.added')
  broadcastCommentAdded(payload: { comment: any; issue: any; actorId: string }) {
    this.server.to(`project:${payload.issue.projectId}`).emit('comment.added', {
      comment: payload.comment,
      issueId: payload.issue.id,
      actorId: payload.actorId,
    });
  }

  /** Pushes a notification directly to a user's personal room */
  @OnEvent('notification.created')
  broadcastNotification(payload: { userId: string; notification: any }) {
    this.server.to(`user:${payload.userId}`).emit('notification', payload.notification);
  }

  /** Returns the set of online user IDs (those with active sockets) */
  getOnlineUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }
}
