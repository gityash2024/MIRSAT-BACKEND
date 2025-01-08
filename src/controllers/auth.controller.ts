import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { User } from '../models/User';
import { emailService } from '../services/email.service';
import { catchAsync } from '../utils/catchAsync';
import jwt from 'jsonwebtoken';
import {ApiError} from '../utils/ApiError';


const generateToken = (id: any): any => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined');
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'; // Default to 7 day if not specified

  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: expiresIn
  });
};

export const register = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { name, email, password, role } = req.body;


  // Check if email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new ApiError('Email already registered', 400));
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    role,
    createdBy: req?.user?._id,
  });

  // Send welcome email
  await emailService.sendWelcomeEmail(email, name);

  // Generate token
  const token = generateToken(user._id);

  res.status(201).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

export const login = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    return next(new ApiError('Invalid credentials', 401));
  }

  if (!user.isActive) {
    return next(new ApiError('Your account has been deactivated', 401));
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  const token = generateToken(user._id);

  res.status(200).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

export const forgotPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return next(new ApiError('No user found with this email', 404));
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  user.passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour
  await user.save();

  try {
    await emailService.sendPasswordResetEmail(email, resetToken);

    res.status(200).json({
      success: true,
      message: 'Password reset email sent',
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return next(new ApiError('Error sending email', 500));
  }
});

export const resetPassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { token, password } = req.body;

  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new ApiError('Invalid or expired reset token', 400));
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password reset successful',
  });
});