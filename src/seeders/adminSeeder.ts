// src/seeders/adminSeeder.ts

import { User } from '../models/User';
import { Role } from '../models/Role';
import { logger } from '../utils/logger';
import { PERMISSIONS } from '../utils/permissions';
import mongoose from 'mongoose';
const adminPermissions = Object.values(PERMISSIONS).flatMap(group => Object.values(group));

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
export const seedAdmin = async () => {
  try {
    // Create admin user first
    let admin = await User.findOne({ email: adminUser.email });
    
    if (!admin) {
      admin = await User.create({
        ...adminUser
      });
      logger.info('Admin user created successfully');
    }

    // Create admin role
    let adminRole = await Role.findOne({ name: 'admin' });
    
    if (!adminRole) {
      adminRole = await Role.create({
        name: 'admin',
        description: 'Super Admin Role with all permissions',
        permissions: adminUser.permissions,
        createdBy: admin._id,
        isActive: true
      });
      logger.info('Admin role created successfully');

      // Update admin user with role reference
      admin.role = 'admin';
      await admin.save();
    }

    logger.info('Admin seeding completed successfully');
    return { admin, adminRole };

  } catch (error) {
    logger.error('Error seeding admin:', error);
    throw error;
  }
};

// If running seeder directly
if (require.main === module) {
  // Load environment variables
  require('dotenv').config();
  
  // Connect to database and run seeder
  mongoose.connect(process.env.MONGODB_URI!)
    .then(() => {
      logger.info('Connected to MongoDB');
      return seedAdmin();
    })
    .then(() => {
      logger.info('Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Error in seeding:', error);
      process.exit(1);
    });
}