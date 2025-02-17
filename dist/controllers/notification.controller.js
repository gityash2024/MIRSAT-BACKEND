"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteNotification = exports.markAllAsRead = exports.markAsRead = exports.getNotifications = void 0;
const notification_service_1 = require("../services/notification.service");
const catchAsync_1 = require("../utils/catchAsync");
exports.getNotifications = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const result = await notification_service_1.notificationService.getUserNotifications(req.user._id, req.query);
    res.status(200).json(Object.assign({ success: true }, result));
});
exports.markAsRead = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const notification = await notification_service_1.notificationService.markAsRead(req.params.id, req.user._id);
    res.status(200).json({
        success: true,
        data: notification,
    });
});
exports.markAllAsRead = (0, catchAsync_1.catchAsync)(async (req, res) => {
    await notification_service_1.notificationService.markAllAsRead(req.user._id);
    res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
    });
});
exports.deleteNotification = (0, catchAsync_1.catchAsync)(async (req, res) => {
    await notification_service_1.notificationService.deleteNotification(req.params.id, req.user._id);
    res.status(200).json({
        success: true,
        message: 'Notification deleted successfully',
    });
});
//# sourceMappingURL=notification.controller.js.map