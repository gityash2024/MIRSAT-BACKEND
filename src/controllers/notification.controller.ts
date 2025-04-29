import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';
import { catchAsync } from '../utils/catchAsync';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError';

export const getNotifications = catchAsync(async (req: Request, res: Response) => {
  const result = await notificationService.getUserNotifications(req.user!._id, req.query);

  res.status(200).json({
    success: true,
    ...result,
  });
});

export const markAsRead = catchAsync(async (req: Request, res: Response) => {
  const notification = await notificationService.markAsRead(req.params.id, req.user!._id);

  res.status(200).json({
    success: true,
    data: notification,
  });
});

export const markAllAsRead = catchAsync(async (req: Request, res: Response) => {
  await notificationService.markAllAsRead(req.user!._id);

  res.status(200).json({
    success: true,
    message: 'All notifications marked as read',
  });
});

export const deleteNotification = catchAsync(async (req: Request, res: Response) => {
  await notificationService.deleteNotification(req.params.id, req.user!._id);

  res.status(200).json({
    success: true,
    message: 'Notification deleted successfully',
  });
});

export const createTestNotification = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.body;
  
  if (!userId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User ID is required');
  }
  
  const notification = await notificationService.create({
    recipient: userId,
    type: 'info',
    title: 'Test Notification',
    message: 'This is a test notification created at ' + new Date().toLocaleString(),
    data: {
      priority: 'medium',
      link: '/dashboard'
    }
  });
  
  res.status(httpStatus.CREATED).json({
    success: true,
    notification
  });
});