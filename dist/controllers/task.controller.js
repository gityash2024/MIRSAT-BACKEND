"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadTaskAttachment = exports.addTaskComment = exports.updateTaskStatus = exports.updateTask = exports.getTask = exports.getTasks = exports.createTask = void 0;
const Task_1 = require("../models/Task");
const User_1 = require("../models/User");
const ApiError_1 = require("../utils/ApiError");
const catchAsync_1 = require("../utils/catchAsync");
const upload_service_1 = require("../services/upload.service");
exports.createTask = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    let { title, description, assignedTo, priority, deadline, location, attachments, inspectionLevel } = req.body;
    const users = await User_1.User.find({ _id: { $in: assignedTo }, isActive: true });
    if (users.length !== assignedTo.length) {
        return next(new ApiError_1.ApiError('One or more assigned users are invalid or inactive', 400));
    }
    const task = await Task_1.Task.create({
        title,
        description,
        inspectionLevel,
        assignedTo,
        priority,
        deadline,
        location,
        attachments,
        createdBy: req.user._id,
    });
    const populatedTask = await Task_1.Task.findById(task._id)
        .populate('assignedTo', 'name email department')
        .populate('createdBy', 'name email')
        .populate('inspectionLevel', 'name type priority subLevels')
        .populate('progress.completedBy', 'name email')
        .populate('progress.signoff.signedBy', 'name email')
        .populate('comments.user', 'name email')
        .populate('statusHistory.changedBy', 'name email');
    res.status(201).json({
        success: true,
        data: populatedTask,
    });
});
exports.getTasks = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search;
    let query = {};
    if (search) {
        query.$or = [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { location: { $regex: search, $options: 'i' } }
        ];
    }
    if (req.query.status) {
        query.status = req.query.status;
    }
    if (req.query.priority) {
        query.priority = req.query.priority;
    }
    if (req.user.role !== 'admin') {
        query.assignedTo = req.user._id;
    }
    const total = await Task_1.Task.countDocuments(query);
    const tasks = await Task_1.Task.find(query)
        .populate('assignedTo', 'name email department')
        .populate('createdBy', 'name email')
        .populate('inspectionLevel', 'name type priority subLevels')
        .populate('progress.completedBy', 'name email')
        .populate('progress.signoff.signedBy', 'name email')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit);
    res.status(200).json({
        success: true,
        data: tasks,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    });
});
exports.getTask = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const task = await Task_1.Task.findById(req.params.id)
        .populate('assignedTo', 'name email department')
        .populate('createdBy', 'name email')
        .populate('inspectionLevel', 'name type priority subLevels')
        .populate('progress.completedBy', 'name email')
        .populate('progress.signoff.signedBy', 'name email')
        .populate('comments.user', 'name email')
        .populate('statusHistory.changedBy', 'name email');
    if (!task) {
        return next(new ApiError_1.ApiError('Task not found', 404));
    }
    res.status(200).json({
        success: true,
        data: task,
    });
});
exports.updateTask = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const updates = req.body;
    const task = await Task_1.Task.findById(req.params.id);
    if (!task) {
        return next(new ApiError_1.ApiError('Task not found', 404));
    }
    if (updates.assignedTo) {
        const users = await User_1.User.find({ _id: { $in: updates.assignedTo }, isActive: true });
        if (users.length !== updates.assignedTo.length) {
            return next(new ApiError_1.ApiError('One or more assigned users are invalid or inactive', 400));
        }
    }
    Object.assign(task, updates);
    await task.save();
    const updatedTask = await Task_1.Task.findById(task._id)
        .populate('assignedTo', 'name email department')
        .populate('createdBy', 'name email')
        .populate('inspectionLevel', 'name type priority subLevels')
        .populate('progress.completedBy', 'name email')
        .populate('progress.signoff.signedBy', 'name email')
        .populate('comments.user', 'name email')
        .populate('statusHistory.changedBy', 'name email');
    res.status(200).json({
        success: true,
        data: updatedTask,
    });
});
exports.updateTaskStatus = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { status, comment } = req.body;
    const task = await Task_1.Task.findById(req.params.id);
    if (!task) {
        return next(new ApiError_1.ApiError('Task not found', 404));
    }
    task.status = status;
    task.statusHistory.push({
        status,
        changedBy: req.user._id,
        comment,
        timestamp: new Date(),
    });
    await task.save();
    const updatedTask = await Task_1.Task.findById(task._id)
        .populate('assignedTo', 'name email department')
        .populate('createdBy', 'name email')
        .populate('inspectionLevel', 'name type priority subLevels')
        .populate('progress.completedBy', 'name email')
        .populate('progress.signoff.signedBy', 'name email')
        .populate('comments.user', 'name email')
        .populate('statusHistory.changedBy', 'name email');
    res.status(200).json({
        success: true,
        data: updatedTask,
    });
});
exports.addTaskComment = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    const { content } = req.body;
    const task = await Task_1.Task.findById(req.params.id);
    if (!task) {
        return next(new ApiError_1.ApiError('Task not found', 404));
    }
    task.comments.push({
        user: req.user._id,
        content,
        createdAt: new Date(),
    });
    await task.save();
    const updatedTask = await Task_1.Task.findById(task._id)
        .populate('assignedTo', 'name email department')
        .populate('createdBy', 'name email')
        .populate('inspectionLevel', 'name type priority subLevels')
        .populate('progress.completedBy', 'name email')
        .populate('progress.signoff.signedBy', 'name email')
        .populate('comments.user', 'name email')
        .populate('statusHistory.changedBy', 'name email');
    res.status(200).json({
        success: true,
        data: updatedTask,
    });
});
exports.uploadTaskAttachment = (0, catchAsync_1.catchAsync)(async (req, res, next) => {
    if (!req.file) {
        return next(new ApiError_1.ApiError('Please upload a file', 400));
    }
    const task = await Task_1.Task.findById(req.params.id);
    if (!task) {
        return next(new ApiError_1.ApiError('Task not found', 404));
    }
    const uploadResult = await upload_service_1.uploadService.uploadFile(req.file);
    task.attachments.push(uploadResult);
    await task.save();
    const updatedTask = await Task_1.Task.findById(task._id)
        .populate('assignedTo', 'name email department')
        .populate('createdBy', 'name email')
        .populate('inspectionLevel', 'name type priority subLevels')
        .populate('progress.completedBy', 'name email')
        .populate('progress.signoff.signedBy', 'name email')
        .populate('comments.user', 'name email')
        .populate('statusHistory.changedBy', 'name email');
    res.status(200).json({
        success: true,
        data: updatedTask,
    });
});
//# sourceMappingURL=task.controller.js.map