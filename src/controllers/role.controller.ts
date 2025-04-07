import { Request, Response, NextFunction } from 'express';
import { Role } from '../models/Role';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';
import { notificationService } from '../services/notification.service';
import mongoose from 'mongoose';

export const createRole = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { name, description, permissions } = req.body;

  // Check if role already exists
  const existingRole = await Role.findOne({ name });
  if (existingRole) {
    return next(new ApiError('Role already exists', 400));
  }

  const role = await Role.create({
    name,
    description,
    permissions,
    createdBy: req.user!._id,
  });

  res.status(201).json({
    success: true,
    data: role,
  });
});

export const getRoles = catchAsync(async (req: Request, res: Response) => {
  const roles = await Role.find()
    .populate('createdBy', 'name email')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: roles.length,
    data: roles,
  });
});

export const getRole = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const role = await Role.findById(req.params.id)
    .populate('createdBy', 'name email');

  if (!role) {
    return next(new ApiError('Role not found', 404));
  }

  res.status(200).json({
    success: true,
    data: role,
  });
});

export const updateRole = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { name, description, permissions, isActive } = req.body;

  const role = await Role.findById(req.params.id);

  if (!role) {
    return next(new ApiError('Role not found', 404));
  }

  // Check if new name already exists (if name is being updated)
  if (name && name !== role.name) {
    const existingRole = await Role.findOne({ name });
    if (existingRole) {
      return next(new ApiError('Role name already exists', 400));
    }
  }

  role.name = name || role.name;
  role.description = description || role.description;
  role.permissions = permissions || role.permissions;
  role.isActive = isActive !== undefined ? isActive : role.isActive;

  const updatedRole = await role.save();

  // Notify affected users about role changes
  if (role.name) {
    // Find users with this role and get their IDs
    const usersWithRole = await User.find({ role: role.name }).select('_id');
    
    // Send notifications to affected users
    for (const user of usersWithRole) {
      await notificationService.create({
        recipient: user._id,
        type: 'ROLE_UPDATED',
        title: 'Role Permissions Updated',
        message: `Your role "${role.name}" has been updated with new permissions`,
        data: { roleId: role._id, roleName: role.name }
      });
    }
  }

  res.status(200).json({
    success: true,
    data: updatedRole,
  });
});

export const deleteRole = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const role = await Role.findById(req.params.id);

  if (!role) {
    return next(new ApiError('Role not found', 404));
  }

  // Check if any users are assigned this role before deletion
  const User = require('../models/User').User;
  const usersWithRole = await User.countDocuments({ role: role.name });
  
  if (usersWithRole > 0) {
    return next(new ApiError('Cannot delete role as it is assigned to users', 400));
  }

  await role.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Role deleted successfully',
  });
});