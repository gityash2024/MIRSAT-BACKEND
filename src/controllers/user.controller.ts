import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { Role } from '../models/Role';
import {ApiError} from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';
import { emailService } from '../services/email.service';

export const createUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { name, email, password, role, permissions } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new ApiError('Email already registered', 400));
  }

  // Validate role exists
  // const roleExists = await Role.findOne({ name: role, isActive: true });
  // if (!roleExists) {
  //   console.log('++====++++===++++===++++===+++===++++===++++===+++++==++++===++++ 20')
  //   return next(new ApiError('Invalid role specified', 400));
  // }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    role,
    permissions: permissions ,
    createdBy: req.user!._id,
  });

  // Send welcome email
  await emailService.sendWelcomeEmail(email, name);

  res.status(201).json({
    success: true,
    data: user,
  });
});

export const getUsers = catchAsync(async (req: Request, res: Response) => {
  const users = await User.find()
    .select('-password')
    .populate('createdBy', 'name email')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: users.length,
    data: users,
  });
});


export const getUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.params.id)
    .select('-password')
    .populate('createdBy', 'name email');

  if (!user) {
    return next(new ApiError('User not found', 404));
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

export const updateUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { name, email, role, permissions, isActive, phone, address, emergencyContact } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new ApiError('User not found', 404));
  }

  // Check if email is being changed and is already in use
  if (email && email !== user.email) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new ApiError('Email already in use', 400));
    }
  }

  // // If role is being updated, validate it exists
  // if (role && role !== user.role) {
  //   const roleExists = await Role.findOne({ name: role, isActive: true });
  //   if (!roleExists) {
  //   console.log('++====++++===++++===++++===+++===++++===++++===+++++==++++===++++ 93')

  //     return next(new ApiError('Invalid role specified', 400));
  //   }
  // }

  user.name = name || user.name;
  user.email = email || user.email;
  user.role = role || user.role;
  user.permissions = permissions || user.permissions;
  user.isActive = isActive !== undefined ? isActive : user.isActive;
  user.phone = phone || user.phone;
  user.address = address || user.address;
  user.emergencyContact = emergencyContact || user.emergencyContact;

  const updatedUser = await user.save();

  res.status(200).json({
    success: true,
    data: updatedUser,
  });
});

export const deleteUser = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new ApiError('User not found', 404));
  }

  await user.deleteOne();
  res.status(200).json({
    success: true,
    message: 'User deleted successfully',
  });
});

export const getUserProfile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = await User.findById(req.user!._id).select('-password');

  if (!user) {
    return next(new ApiError('User not found', 404));
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

export const updatePassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user!._id).select('+password');

  if (!user) {
    return next(new ApiError('User not found', 404));
  }

  // Check current password
  if (!(await user.comparePassword(currentPassword))) {
    return next(new ApiError('Current password is incorrect', 401));
  }

  user.password = newPassword;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password updated successfully',
  });
});