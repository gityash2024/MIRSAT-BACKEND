"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = void 0;
const User_1 = require("../models/User");
const Notification_1 = require("../models/Notification");
const email_service_1 = require("./email.service");
const logger_1 = require("../utils/logger");
const socket_service_1 = require("./socket.service");
const constants_1 = require("../utils/constants");
class NotificationService {
    async create(notificationData) {
        try {
            const notification = await Notification_1.Notification.create(notificationData);
            socket_service_1.socketService.sendToUser(notificationData.recipient, constants_1.SOCKET_EVENTS.NOTIFICATION.NEW, notification);
            const user = await User_1.User.findById(notificationData.recipient);
            if (user && user.email) {
                await email_service_1.emailService.sendEmail(user.email, notificationData.title, this.generateEmailContent(notificationData));
            }
            return notification;
        }
        catch (error) {
            logger_1.logger.error('Error creating notification:', error);
            throw error;
        }
    }
    async getUserNotifications(userId, query = {}) {
        const { page = 1, limit = 10, read } = query;
        const skip = (page - 1) * limit;
        const filter = { recipient: userId };
        if (read !== undefined) {
            filter.read = read === 'true';
        }
        const notifications = await Notification_1.Notification.find(filter)
            .sort('-createdAt')
            .skip(skip)
            .limit(parseInt(limit))
            .exec();
        const total = await Notification_1.Notification.countDocuments(filter);
        return {
            notifications,
            pagination: {
                current: parseInt(page),
                total: Math.ceil(total / limit),
                records: total,
            },
        };
    }
    async markAsRead(notificationId, userId) {
        const notification = await Notification_1.Notification.findOneAndUpdate({ _id: notificationId, recipient: userId, read: false }, { read: true, readAt: new Date() }, { new: true });
        return notification;
    }
    async markAllAsRead(userId) {
        await Notification_1.Notification.updateMany({ recipient: userId, read: false }, { read: true, readAt: new Date() });
    }
    async deleteNotification(notificationId, userId) {
        await Notification_1.Notification.findOneAndDelete({
            _id: notificationId,
            recipient: userId,
        });
    }
    generateEmailContent(notification) {
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
exports.notificationService = new NotificationService();
//# sourceMappingURL=notification.service.js.map