import { Server as SocketServer } from 'socket.io';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

class SocketService {
  private io: SocketServer;
  private userSockets: Map<string, string[]> = new Map();

  initialize(server: Server) {
    this.io = new SocketServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          throw new Error('Authentication error');
        }

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        socket.data.userId = decoded.id;

        // Store socket connection
        const userSockets = this.userSockets.get(decoded.id) || [];
        userSockets.push(socket.id);
        this.userSockets.set(decoded.id, userSockets);

        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', (socket) => {
      logger.info(`User connected: ${socket.data.userId}`);

      socket.on('disconnect', () => {
        const userId = socket.data.userId;
        const userSockets = this.userSockets.get(userId) || [];
        const updatedSockets = userSockets.filter(id => id !== socket.id);
        
        if (updatedSockets.length === 0) {
          this.userSockets.delete(userId);
        } else {
          this.userSockets.set(userId, updatedSockets);
        }

        logger.info(`User disconnected: ${userId}`);
      });
    });
  }

  sendToUser(userId: string, event: string, data: any) {
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      userSockets.forEach(socketId => {
        this.io.to(socketId).emit(event, data);
      });
    }
  }

  sendToUsers(userIds: string[], event: string, data: any) {
    userIds.forEach(userId => {
      this.sendToUser(userId, event, data);
    });
  }

  broadcastToAll(event: string, data: any) {
    this.io.emit(event, data);
  }
}

export const socketService = new SocketService();