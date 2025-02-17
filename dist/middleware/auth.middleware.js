"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasPermission = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const ApiError_1 = require("../utils/ApiError");
const catchAsync_1 = require("../utils/catchAsync");
exports.protect = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    var _a;
    let token;
    if ((_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
        return next(new ApiError_1.ApiError(401, 'Not authorized to access this route'));
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = await User_1.User.findById(decoded.id);
        if (!user) {
            return next(new ApiError_1.ApiError(404, 'User not found'));
        }
        if (!user.isActive) {
            return next(new ApiError_1.ApiError(401, 'User account is deactivated'));
        }
        req.user = Object.assign({}, user.toObject());
        console.log('Token:', token);
        console.log('User found:', user);
        console.log('User permissions:', req.user.permissions);
        next();
    }
    catch (error) {
        return next(new ApiError_1.ApiError(401, 'Not authorized to access this route'));
    }
});
const hasPermission = (requiredPermission) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ApiError_1.ApiError(401, 'Not authorized to access this route'));
        }
        const userPermissions = req.user.permissions || [];
        if (!userPermissions.includes(requiredPermission)) {
            return next(new ApiError_1.ApiError(403, 'You do not have the required permissions'));
        }
        next();
    };
};
exports.hasPermission = hasPermission;
//# sourceMappingURL=auth.middleware.js.map