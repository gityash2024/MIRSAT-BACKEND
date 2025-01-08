import { Request, Response, NextFunction } from 'express';
import { Task } from '../models/Task';
import { User } from '../models/User';
import {ApiError} from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';
import { uploadService } from '../services/upload.service';

export const createTask = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { title, description, assignedTo, priority, deadline, location } = req.body;

  // Verify all assigned users exist and are active
  const users = await User.find({ _id: { $in: assignedTo }, isActive: true });
  if (users.length !== assignedTo.length) {
    return next(new ApiError('One or more assigned users are invalid or inactive', 400));
  }

  const task = await Task.create({
    title,
    description,
    assignedTo,
    priority,
    deadline,
    location,
    createdBy: req.user!._id,
  });

  res.status(201).json({
    success: true,
    data: task,
  });
});

export const getTasks = catchAsync(async (req: Request, res: Response) => {
  let query: any = {};

  // Filter by status if provided
  if (req.query.status) {
    query.status = req.query.status;
  }

  // Filter by priority if provided
  if (req.query.priority) {
    query.priority = req.query.priority;
  }

  // Filter tasks based on user role
  if (req.user!.role !== 'admin') {
    query.assignedTo = req.user!._id;
  }

  const tasks = await Task.find(query)
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .sort('-createdAt');

  res.status(200).json({
    success: true,
    count: tasks.length,
    data: tasks,
  });
});

export const getTask = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const task = await Task.findById(req.params.id)
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .populate('comments.user', 'name email')
    .populate('statusHistory.changedBy', 'name email');

  if (!task) {
    return next(new ApiError('Task not found', 404));
  }

  res.status(200).json({
    success: true,
    data: task,
  });
});

export const updateTask = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const updates = req.body;
  const task = await Task.findById(req.params.id);

  if (!task) {
    return next(new ApiError('Task not found', 404));
  }

  // Verify assigned users if being updated
  if (updates.assignedTo) {
    const users = await User.find({ _id: { $in: updates.assignedTo }, isActive: true });
    if (users.length !== updates.assignedTo.length) {
      return next(new ApiError('One or more assigned users are invalid or inactive', 400));
    }
  }

  // Update the task
  Object.assign(task, updates);
  await task.save();

  res.status(200).json({
    success: true,
    data: task,
  });
});

export const updateTaskStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { status, comment } = req.body;
  const task = await Task.findById(req.params.id);

  if (!task) {
    return next(new ApiError('Task not found', 404));
  }

  task.status = status;
  task.statusHistory.push({
    status,
    changedBy: req.user!._id,
    comment,
    timestamp: new Date(),
  });

  await task.save();

  res.status(200).json({
    success: true,
    data: task,
  });
});

export const addTaskComment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { content } = req.body;
  const task = await Task.findById(req.params.id);

  if (!task) {
    return next(new ApiError('Task not found', 404));
  }

  task.comments.push({
    user: req.user!._id,
    content,
    createdAt: new Date(),
  });

  await task.save();

  res.status(200).json({
    success: true,
    data: task,
  });
});

export const uploadTaskAttachment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return next(new ApiError('Please upload a file', 400));
  }

  const task = await Task.findById(req.params.id);
  if (!task) {
    return next(new ApiError('Task not found', 404));
  }

  const uploadResult = await uploadService.uploadFile(req.file);
  task.attachments.push(uploadResult);
  await task.save();

  res.status(200).json({
    success: true,
    data: task,
  });
});