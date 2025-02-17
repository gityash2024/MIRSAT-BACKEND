"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = __importDefault(require("./app"));
const database_1 = __importDefault(require("./config/database"));
const logger_1 = require("./utils/logger");
const http_1 = require("http");
const socket_service_1 = require("./services/socket.service");
const httpServer = (0, http_1.createServer)(app_1.default);
socket_service_1.socketService.initialize(httpServer);
const PORT = process.env.PORT || 5000;
(0, database_1.default)().then(() => {
    httpServer.listen(PORT, () => {
        logger_1.logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
})
    .catch((error) => {
    logger_1.logger.error('Database connection failed', error);
    process.exit(1);
});
process.on('unhandledRejection', (err) => {
    logger_1.logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
    logger_1.logger.error(err.name, err.message);
    process.exit(1);
});
//# sourceMappingURL=server.js.map