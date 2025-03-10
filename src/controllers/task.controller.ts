import { Request, Response, NextFunction } from 'express';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';
import { uploadService } from '../services/upload.service';
import InspectionLevel from '../../src/models/InspectionLevel';
export const deleteTask = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const task = await Task.findById(req.params.id);

  if (!task) {
    return next(new ApiError('Task not found', 404));
  }

  await Task.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Task deleted successfully'
  });
});
export const createTask = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  let { title, description, assignedTo, priority, deadline, location, attachments, inspectionLevel } = req.body;

  const users = await User.find({ _id: { $in: assignedTo }, isActive: true });
  if (users.length !== assignedTo.length) {
    return next(new ApiError('One or more assigned users are invalid or inactive', 400));
  }

  // Get the inspection level to create appropriate progress entries
  const inspection = await InspectionLevel.findById(inspectionLevel);
  if (!inspection) {
    return next(new ApiError('Invalid inspection level', 400));
  }

  // Function to flatten nested sub-levels into a single array
  const flattenSubLevels = (subLevels:any, result:any = []) => {
    if (!subLevels || !subLevels.length) return result;
    
    subLevels.forEach((sl:any) => {
      result.push(sl);
      if (sl.subLevels && sl.subLevels.length > 0) {
        flattenSubLevels(sl.subLevels, result);
      }
    });
    
    return result;
  };

  // Create progress entries for all sub-levels
  const allSubLevels = flattenSubLevels(inspection.subLevels);
  const progress = allSubLevels.map((sl:any) => ({
    subLevel: sl._id,
    subLevelName: sl.name,
    status: 'pending',
    completedAt: null,
    completedBy: null,
    signoff: {
      required: sl.requiresSignoff || false,
      signed: false,
      signedBy: null,
      signedAt: null
    },
    comments: []
  }));

  const task = await Task.create({
    title,
    description,
    inspectionLevel,
    assignedTo,
    priority,
    deadline,
    location,
    attachments,
    createdBy: req.user!._id,
    progress
  });

  const populatedTask = await Task.findById(task._id)
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
export const getTasks = catchAsync(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;
  const search = req.query.search as string;

  let query: any = {};

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

  if (req.user!.role !== 'admin') {
    query.assignedTo = req.user!._id;
  }

  const total = await Task.countDocuments(query);
  const tasks = await Task.find(query)
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

export const getTask = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const task = await Task.findById(req.params.id)
    .populate('assignedTo', 'name email department')
    .populate('createdBy', 'name email')
    .populate('inspectionLevel', 'name type priority subLevels')
    .populate('progress.completedBy', 'name email')
    .populate('progress.signoff.signedBy', 'name email')
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

  if (updates.assignedTo) {
    const users = await User.find({ _id: { $in: updates.assignedTo }, isActive: true });
    if (users.length !== updates.assignedTo.length) {
      return next(new ApiError('One or more assigned users are invalid or inactive', 400));
    }
  }

  Object.assign(task, updates);
  await task.save();

  const updatedTask = await Task.findById(task._id)
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

  const updatedTask = await Task.findById(task._id)
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

  const updatedTask = await Task.findById(task._id)
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

  const updatedTask = await Task.findById(task._id)
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