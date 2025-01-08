import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';
import { catchAsync } from '../utils/catchAsync';

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