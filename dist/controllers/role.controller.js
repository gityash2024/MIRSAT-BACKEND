"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRole = exports.updateRole = exports.getRole = exports.getRoles = exports.createRole = void 0;
const Role_1 = require("../models/Role");
const ApiError_1 = require("../utils/ApiError");
const catchAsync_1 = require("../utils/catchAsync");
exports.createRole = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { name, description, permissions } = req.body;
    const existingRole = await Role_1.Role.findOne({ name });
    if (existingRole) {
        return next(new ApiError_1.ApiError('Role already exists', 400));
    }
    const role = await Role_1.Role.create({
        name,
        description,
        permissions,
        createdBy: req.user._id,
    });
    res.status(201).json({
        success: true,
        data: role,
    });
});
exports.getRoles = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const roles = await Role_1.Role.find()
        .populate('createdBy', 'name email')
        .sort('-createdAt');
    res.status(200).json({
        success: true,
        count: roles.length,
        data: roles,
    });
});
exports.getRole = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const role = await Role_1.Role.findById(req.params.id)
        .populate('createdBy', 'name email');
    if (!role) {
        return next(new ApiError_1.ApiError('Role not found', 404));
    }
    res.status(200).json({
        success: true,
        data: role,
    });
});
exports.updateRole = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { name, description, permissions, isActive } = req.body;
    const role = await Role_1.Role.findById(req.params.id);
    if (!role) {
        return next(new ApiError_1.ApiError('Role not found', 404));
    }
    if (name && name !== role.name) {
        const existingRole = await Role_1.Role.findOne({ name });
        if (existingRole) {
            return next(new ApiError_1.ApiError('Role name already exists', 400));
        }
    }
    role.name = name || role.name;
    role.description = description || role.description;
    role.permissions = permissions || role.permissions;
    role.isActive = isActive !== undefined ? isActive : role.isActive;
    const updatedRole = await role.save();
    res.status(200).json({
        success: true,
        data: updatedRole,
    });
});
exports.deleteRole = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const role = await Role_1.Role.findById(req.params.id);
    if (!role) {
        return next(new ApiError_1.ApiError('Role not found', 404));
    }
    const User = require('../models/User').User;
    const usersWithRole = await User.countDocuments({ role: role.name });
    if (usersWithRole > 0) {
        return next(new ApiError_1.ApiError('Cannot delete role as it is assigned to users', 400));
    }
    await role.deleteOne();
    res.status(200).json({
        success: true,
        message: 'Role deleted successfully',
    });
});
//# sourceMappingURL=role.controller.js.map