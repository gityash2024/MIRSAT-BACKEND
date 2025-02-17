"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedAdmin = void 0;
const User_1 = require("../models/User");
const Role_1 = require("../models/Role");
const logger_1 = require("../utils/logger");
const permissions_1 = require("../utils/permissions");
const mongoose_1 = __importDefault(require("mongoose"));
const adminPermissions = Object.values(permissions_1.PERMISSIONS).flatMap(group => Object.values(group));
const adminUser = {
    name: 'Super Admin',
    email: process.env.ADMIN_EMAIL || 'admin@mirsat.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123!',
    role: 'admin',
    isActive: true,
    permissions: [
        'view_tasks', 'create_tasks', 'edit_tasks', 'delete_tasks',
        'view_users', 'create_users', 'edit_users', 'delete_users',
        'manage_roles', 'manage_permissions',
        'view_reports', 'create_reports', 'export_reports',
        'view_calendar', 'manage_calendar', 'schedule_events',
        'view_settings', 'manage_settings', 'system_config', 'view_inspections',
        'create_inspections',
        'edit_inspections',
        'delete_inspections',
        'approve_inspections'
    ]
};
const seedAdmin = async () => {
    try {
        let admin = await User_1.User.findOne({ email: adminUser.email });
        if (!admin) {
            admin = await User_1.User.create(Object.assign({}, adminUser));
            logger_1.logger.info('Admin user created successfully');
        }
        let adminRole = await Role_1.Role.findOne({ name: 'admin' });
        if (!adminRole) {
            adminRole = await Role_1.Role.create({
                name: 'admin',
                description: 'Super Admin Role with all permissions',
                permissions: adminUser.permissions,
                createdBy: admin._id,
                isActive: true
            });
            logger_1.logger.info('Admin role created successfully');
            admin.role = 'admin';
            await admin.save();
        }
        logger_1.logger.info('Admin seeding completed successfully');
        return { admin, adminRole };
    }
    catch (error) {
        logger_1.logger.error('Error seeding admin:', error);
        throw error;
    }
};
exports.seedAdmin = seedAdmin;
if (require.main === module) {
    require('dotenv').config();
    mongoose_1.default.connect(process.env.MONGODB_URI)
        .then(() => {
        logger_1.logger.info('Connected to MongoDB');
        return (0, exports.seedAdmin)();
    })
        .then(() => {
        logger_1.logger.info('Seeding completed successfully');
        process.exit(0);
    })
        .catch((error) => {
        logger_1.logger.error('Error in seeding:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=adminSeeder.js.map