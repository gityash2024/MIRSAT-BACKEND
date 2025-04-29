import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import  ApiError  from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';
import { DEFAULT_ROLE_PERMISSIONS, ROLES } from '../utils/permissions';

type Role = keyof typeof DEFAULT_ROLE_PERMISSIONS;

export const protect = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined;

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ApiError(401, 'Not authorized to access this route'));
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new ApiError(404, 'User not found'));
    }

    if (!user.isActive) {
      return next(new ApiError(401, 'User account is deactivated'));
    }

    // Use the user's actual permissions instead of role-based ones
    req.user = {
      ...user.toObject()
    };
    console.log('Token:', token);
    console.log('User found:', user);
    console.log('User permissions:', req.user.permissions);
    next();
  } catch (error) {
    return next(new ApiError(401, 'Not authorized to access this route'));
  }
});

export const hasPermission = (requiredPermission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, 'Not authorized to access this route'));
    }

    const userPermissions = req.user.permissions || [];
    
    if (!userPermissions.includes(requiredPermission)) {
      return next(new ApiError(403, 'You do not have the required permissions'));
    }

    next();
  };
};