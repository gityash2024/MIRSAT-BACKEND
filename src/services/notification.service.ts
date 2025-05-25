import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { emailService } from './email.service';
import { logger } from '../utils/logger';
import { socketService } from './socket.service';
import { SOCKET_EVENTS } from '../utils/constants';
import mongoose from 'mongoose';

interface INotificationData {
  recipient: any;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
}

class NotificationService {
  /**
   * Helper method to safely convert any type of ID to string
   */
  private ensureStringId(id: any): string {
    if (!id) return '';
    
    if (typeof id === 'string') return id;
    if (id instanceof mongoose.Types.ObjectId) return id.toString();
    if (id._id) return this.ensureStringId(id._id);
    
    // Last resort, try String() conversion
    return String(id);
  }

  async create(notificationData: INotificationData) {
    try {
      // Ensure recipient is a valid string ID
      const recipientId = this.ensureStringId(notificationData.recipient);
      
      const notification = await Notification.create({
        ...notificationData,
        recipient: recipientId
      });
      
      socketService.sendToUser(
        recipientId,
        SOCKET_EVENTS.NOTIFICATION.NEW,
        notification
      );
      
      // Get recipient's email
      const user = await User.findById(recipientId);
      
      if (user && user.email) {
        try {
          // Send email notification
          logger.info('Sending email notification to:', user.email, notificationData.title);
          await emailService.sendEmail(
            user.email,
            notificationData.title,
            this.generateEmailContent(notificationData)
          );
        } catch (error) {
          // If email fails, just log it but don't fail the whole notification
          logger.error('Failed to send email notification, but continuing:', error);
        }
      }

      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      // Still return a notification object even if there was an error
      // This ensures that the task creation process doesn't fail
      return {
        _id: new mongoose.Types.ObjectId(),
        recipient: this.ensureStringId(notificationData.recipient),
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data || {},
        read: false,
        createdAt: new Date()
      };
    }
  }

  async getUserNotifications(userId: string, query: any = {}) {
    const { page = 1, limit = 10, read } = query;
    const skip = (page - 1) * limit;

    const filter: any = { recipient: userId };
    if (read !== undefined) {
      filter.read = read === 'true';
    }

    const notifications = await Notification.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit))
      .exec();

    const total = await Notification.countDocuments(filter);

    return {
      notifications,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        records: total,
      },
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId, read: false },
      { read: true, readAt: new Date() },
      { new: true }
    );

    return notification;
  }

  async markAllAsRead(userId: string) {
    await Notification.updateMany(
      { recipient: userId, read: false },
      { read: true, readAt: new Date() }
    );
  }

  async deleteNotification(notificationId: string, userId: string) {
    await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: userId,
    });
  }

  private generateEmailContent(notification: INotificationData): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${notification.title}</h2>
        <p>${notification.message}</p>
        ${notification.data ? `<pre>${JSON.stringify(notification.data, null, 2)}</pre>` : ''}
        <hr>
        <p style="color: #666; font-size: 12px;">
          This is an automated notification from MIRSAT. Please do not reply to this email.
        </p>
      </div>
    `;
  }
}

export const notificationService = new NotificationService();