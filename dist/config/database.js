"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("../utils/logger");
const adminSeeder_1 = require("../seeders/adminSeeder");
const connectDB = async () => {
    try {
        const conn = await mongoose_1.default.connect(process.env.MONGODB_URI);
        logger_1.logger.info(`MongoDB Connected: ${conn.connection.host}`);
        await (0, adminSeeder_1.seedAdmin)();
    }
    catch (error) {
        logger_1.logger.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
};
exports.default = connectDB;
//# sourceMappingURL=database.js.map