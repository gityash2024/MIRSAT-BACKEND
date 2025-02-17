"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePassword = exports.getUserProfile = exports.deleteUser = exports.updateUser = exports.getUser = exports.getUsers = exports.createUser = void 0;
const User_1 = require("../models/User");
const ApiError_1 = require("../utils/ApiError");
const catchAsync_1 = require("../utils/catchAsync");
const email_service_1 = require("../services/email.service");
exports.createUser = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { name, email, password, role, permissions } = req.body;
    const existingUser = await User_1.User.findOne({ email });
    if (existingUser) {
        return next(new ApiError_1.ApiError('Email already registered', 400));
    }
    const user = await User_1.User.create({
        name,
        email,
        password,
        role,
        permissions: permissions,
        createdBy: req.user._id,
    });
    await email_service_1.emailService.sendWelcomeEmail(email, name);
    res.status(201).json({
        success: true,
        data: user,
    });
});
exports.getUsers = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const users = await User_1.User.find()
        .select('-password')
        .populate('createdBy', 'name email')
        .sort('-createdAt');
    res.status(200).json({
        success: true,
        count: users.length,
        data: users,
    });
});
exports.getUser = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const user = await User_1.User.findById(req.params.id)
        .select('-password')
        .populate('createdBy', 'name email');
    if (!user) {
        return next(new ApiError_1.ApiError('User not found', 404));
    }
    res.status(200).json({
        success: true,
        data: user,
    });
});
exports.updateUser = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { name, email, role, permissions, isActive } = req.body;
    const user = await User_1.User.findById(req.params.id);
    if (!user) {
        return next(new ApiError_1.ApiError('User not found', 404));
    }
    if (email && email !== user.email) {
        const existingUser = await User_1.User.findOne({ email });
        if (existingUser) {
            return next(new ApiError_1.ApiError('Email already in use', 400));
        }
    }
    user.name = name || user.name;
    user.email = email || user.email;
    user.role = role || user.role;
    user.permissions = permissions || user.permissions;
    user.isActive = isActive !== undefined ? isActive : user.isActive;
    const updatedUser = await user.save();
    res.status(200).json({
        success: true,
        data: updatedUser,
    });
});
exports.deleteUser = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const user = await User_1.User.findById(req.params.id);
    if (!user) {
        return next(new ApiError_1.ApiError('User not found', 404));
    }
    await user.deleteOne();
    res.status(200).json({
        success: true,
        message: 'User deleted successfully',
    });
});
exports.getUserProfile = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const user = await User_1.User.findById(req.user._id).select('-password');
    if (!user) {
        return next(new ApiError_1.ApiError('User not found', 404));
    }
    res.status(200).json({
        success: true,
        data: user,
    });
});
exports.updatePassword = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    const user = await User_1.User.findById(req.user._id).select('+password');
    if (!user) {
        return next(new ApiError_1.ApiError('User not found', 404));
    }
    if (!(await user.comparePassword(currentPassword))) {
        return next(new ApiError_1.ApiError('Current password is incorrect', 401));
    }
    user.password = newPassword;
    await user.save();
    res.status(200).json({
        success: true,
        message: 'Password updated successfully',
    });
});
//# sourceMappingURL=user.controller.js.map