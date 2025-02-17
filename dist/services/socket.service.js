"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketService = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = require("../utils/logger");
class SocketService {
    constructor() {
        this.userSockets = new Map();
    }
    initialize(server) {
        this.io = new socket_io_1.Server(server, {
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
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
                socket.data.userId = decoded.id;
                const userSockets = this.userSockets.get(decoded.id) || [];
                userSockets.push(socket.id);
                this.userSockets.set(decoded.id, userSockets);
                next();
            }
            catch (error) {
                next(new Error('Authentication error'));
            }
        });
        this.io.on('connection', (socket) => {
            logger_1.logger.info(`User connected: ${socket.data.userId}`);
            socket.on('disconnect', () => {
                const userId = socket.data.userId;
                const userSockets = this.userSockets.get(userId) || [];
                const updatedSockets = userSockets.filter(id => id !== socket.id);
                if (updatedSockets.length === 0) {
                    this.userSockets.delete(userId);
                }
                else {
                    this.userSockets.set(userId, updatedSockets);
                }
                logger_1.logger.info(`User disconnected: ${userId}`);
            });
        });
    }
    sendToUser(userId, event, data) {
        const userSockets = this.userSockets.get(userId);
        if (userSockets) {
            userSockets.forEach(socketId => {
                this.io.to(socketId).emit(event, data);
            });
        }
    }
    sendToUsers(userIds, event, data) {
        userIds.forEach(userId => {
            this.sendToUser(userId, event, data);
        });
    }
    broadcastToAll(event, data) {
        this.io.emit(event, data);
    }
}
exports.socketService = new SocketService();
//# sourceMappingURL=socket.service.js.map