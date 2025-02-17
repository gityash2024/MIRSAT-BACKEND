"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.login = exports.register = void 0;
const crypto_1 = __importDefault(require("crypto"));
const User_1 = require("../models/User");
const email_service_1 = require("../services/email.service");
const catchAsync_1 = require("../utils/catchAsync");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ApiError_1 = require("../utils/ApiError");
const generateToken = (id) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined');
    }
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    return jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: expiresIn
    });
};
exports.register = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    var _a;
    const { name, email, password, role } = req.body;
    const existingUser = await User_1.User.findOne({ email });
    if (existingUser) {
        return next(new ApiError_1.ApiError('Email already registered', 400));
    }
    const user = await User_1.User.create({
        name,
        email,
        password,
        role,
        createdBy: (_a = req === null || req === void 0 ? void 0 : req.user) === null || _a === void 0 ? void 0 : _a._id,
    });
    await email_service_1.emailService.sendWelcomeEmail(email, name);
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
exports.login = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { email, password } = req.body;
    const user = await User_1.User.findOne({ email }).select('+password');
    console.log(user);
    console.log(email, password);
    if (!user || !(await user.comparePassword(password))) {
        return next(new ApiError_1.ApiError('Invalid credentials', 401));
    }
    if (!user.isActive) {
        return next(new ApiError_1.ApiError('Your account has been deactivated', 401));
    }
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
exports.forgotPassword = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { email } = req.body;
    const user = await User_1.User.findOne({ email });
    if (!user) {
        return next(new ApiError_1.ApiError('No user found with this email', 404));
    }
    const resetToken = crypto_1.default.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto_1.default
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 3600000);
    await user.save();
    try {
        await email_service_1.emailService.sendPasswordResetEmail(email, resetToken);
        res.status(200).json({
            success: true,
            message: 'Password reset email sent',
        });
    }
    catch (error) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        return next(new ApiError_1.ApiError('Error sending email', 500));
    }
});
exports.resetPassword = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { token, password } = req.body;
    const hashedToken = crypto_1.default
        .createHash('sha256')
        .update(token)
        .digest('hex');
    const user = await User_1.User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
    });
    if (!user) {
        return next(new ApiError_1.ApiError('Invalid or expired reset token', 400));
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
//# sourceMappingURL=auth.controller.js.map