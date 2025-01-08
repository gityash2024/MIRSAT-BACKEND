import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import {ApiError} from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';

export const protect = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined;

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ApiError('Not authorized to access this route', 401));
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new ApiError('User not found', 404));
    }

    if (!user.isActive) {
      return next(new ApiError('User account is deactivated', 401));
    }

    req.user = user;
    next();
  } catch (error) {
    return next(new ApiError('Not authorized to access this route', 401));
  }
});

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError('Not authorized to access this route', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(`User role ${req.user.role} is not authorized to access this route`, 403));
    }

    next();
  };
};

export const hasPermission = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError('Not authorized to access this route', 401));
    }

    const hasAllPermissions = permissions.every(permission => 
      req.user.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      return next(new ApiError('You do not have the required permissions', 403));
    }

    next();
  };
};