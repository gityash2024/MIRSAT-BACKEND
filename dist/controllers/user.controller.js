"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePassword = exports.getUserProfile = exports.deleteUser = exports.updateUser = exports.getUser = exports.getUsers = exports.createUser = void 0;
const User_1 = require("../models/User");
const ApiError_1 = require("../utils/ApiError");
const catchAsync_1 = require("../utils/catchAsync");
const email_service_1 = require("../services/email.service");

exports.createUser = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    // Log the entire request body for debugging
    console.log('Create user request body:', JSON.stringify(req.body, null, 2));
    
    const { name, email, password, role, permissions, phone, department, address, emergencyContact, isActive } = req.body;
  
    // Check if user exists
    const existingUser = await User_1.User.findOne({ email });
    if (existingUser) {
      return next(new ApiError_1.ApiError('Email already registered', 400));
    }
  
    // Create a complete user object with all fields
    const userData = {
      name,
      email,
      password,
      role,
      permissions: permissions || [],
      phone: phone || '',
      department: department || '',
      address: address || '',
      emergencyContact: emergencyContact || '',
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id,
    };
  
    // Log the user data being created
    console.log('Creating user with data:', JSON.stringify(userData, null, 2));
  
    // Create user with all fields
    const user = await User_1.User.create(userData);
  
    // Log what was created for debugging
    console.log('User created response:', JSON.stringify(user, null, 2));
  
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
    
    // Log user data for debugging
    console.log('Retrieved user data:', JSON.stringify(user, null, 2));
    
    res.status(200).json({
        success: true,
        data: user,
    });
});

exports.updateUser = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    // Log the entire request body for debugging
    console.log('Update request body:', JSON.stringify(req.body, null, 2));
    
    const { name, email, role, permissions, isActive, phone, department, address, emergencyContact } = req.body;
    
    const user = await User_1.User.findById(req.params.id);
    
    if (!user) {
        return next(new ApiError_1.ApiError('User not found', 404));
    }
    
    // Check if email is being changed and is already in use
    if (email && email !== user.email) {
        const existingUser = await User_1.User.findOne({ email });
        if (existingUser) {
            return next(new ApiError_1.ApiError('Email already in use', 400));
        }
    }
    
    // Create an update object with all fields
    const updateData = {
        name: name || user.name,
        email: email || user.email,
        role: role || user.role,
        permissions: permissions || user.permissions,
        isActive: isActive !== undefined ? isActive : user.isActive,
        phone: phone !== undefined ? phone : user.phone,
        department: department !== undefined ? department : user.department,
        address: address !== undefined ? address : user.address,
        emergencyContact: emergencyContact !== undefined ? emergencyContact : user.emergencyContact
    };
    
    // Log the update data
    console.log('Updating user with data:', JSON.stringify(updateData, null, 2));
    
    // Update all fields directly
    Object.assign(user, updateData);
    
    // Save the user
    const updatedUser = await user.save();
    
    // Log the updated user
    console.log('User after update:', JSON.stringify(updatedUser, null, 2));
    
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