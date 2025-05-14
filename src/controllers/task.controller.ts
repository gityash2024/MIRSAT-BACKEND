import { Request, Response, NextFunction } from 'express';
import { Task } from '../models/Task';
import { User } from '../models/User';
import ApiError from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';
import { uploadService } from '../services/upload.service';
import { notificationService } from '../services/notification.service';
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
  let { title, description, assignedTo, priority, deadline, location, attachments, inspectionLevel, asset, preInspectionQuestions } = req.body;

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
  const progressEntries = allSubLevels.map((sl:any) => ({
    subLevelId: sl._id,
    status: 'pending'
  }));

  // Create new task with all fields
  const newTask = new Task({
    title,
    description,
    assignedTo,
    createdBy: req.user._id,
    priority,
    deadline,
    location,
    inspectionLevel,
    asset,  // Add the asset field
    progress: progressEntries,
    attachments,
    preInspectionQuestions, // Add pre-inspection questions
    statusHistory: [{
      status: 'pending',
      changedBy: req.user._id,
      comment: 'Task created',
      timestamp: new Date()
    }]
  });

  await newTask.save();
  
  const populatedTask = await Task.findById(newTask._id)
    .populate('assignedTo', 'name email department')
    .populate('createdBy', 'name email')
    .populate('asset', 'uniqueId type displayName');  // Populate the asset field

  // Send notifications to all assigned users
  for (const user of users) {
    await notificationService.create({
      recipient: user._id,
      type: 'TASK_ASSIGNED',
      title: 'New Task Assigned',
      message: `You have been assigned to the task: ${title}`,
      data: {
        taskId: newTask._id,
        priority: priority,
        link: `/tasks/${newTask._id}`
      }
    });
  }

  res.status(201).json({
    success: true,
    message: 'Task created successfully',
    data: populatedTask
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

  // Add asset filter
  if (req.query.asset) {
    query.asset = req.query.asset;
  }

  if (req.user!.role !== 'admin') {
    query.assignedTo = req.user!._id;
  }

  const total = await Task.countDocuments(query);
  const tasks = await Task.find(query)
    .populate('assignedTo', 'name email department')
    .populate('createdBy', 'name email')
    .populate('inspectionLevel', 'name type priority subLevels')
    .populate('asset', 'uniqueId type displayName')
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
    .populate('asset', 'uniqueId type displayName')
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
  const { 
    title, 
    description, 
    assignedTo, 
    priority, 
    deadline, 
    location, 
    status,
    asset,
    preInspectionQuestions
  } = req.body;

  const task = await Task.findById(req.params.id);

  if (!task) {
    return next(new ApiError('Task not found', 404));
  }

  // Check if assignedTo is being updated
  if (assignedTo && JSON.stringify(task.assignedTo) !== JSON.stringify(assignedTo)) {
    // Get new users
    const newUsers = assignedTo.filter((userId: any) => 
      !task.assignedTo.includes(userId)
    );

    // Send notifications to newly assigned users
    for (const userId of newUsers) {
      await notificationService.create({
        recipient: userId,
        type: 'TASK_ASSIGNED',
        title: 'New Task Assignment',
        message: `You have been assigned to the task: ${task.title}`,
        data: {
          taskId: task._id,
          priority: priority || task.priority,
          link: `/tasks/${task._id}`
        }
      });
    }
  }

  // Check if status is being updated
  if (status && status !== task.status) {
    // Notify all assigned users about status change
    for (const userId of task.assignedTo) {
      await notificationService.create({
        recipient: userId,
        type: 'TASK_STATUS_UPDATE',
        title: 'Task Status Updated',
        message: `Task "${task.title}" status has been updated to ${status}`,
        data: {
          taskId: task._id,
          oldStatus: task.status,
          newStatus: status,
          link: `/tasks/${task._id}`
        }
      });
    }
  }

  // Update task
  const updatedTask = await Task.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        title,
        description,
        assignedTo,
        priority,
        deadline,
        location,
        status,
        asset,
        preInspectionQuestions
      },
      $push: {
        statusHistory: {
          status: status || task.status,
          changedBy: req.user._id,
          comment: req.body.comment || 'Status updated',
          timestamp: new Date()
        }
      }
    },
    { new: true }
  )
  .populate('assignedTo', 'name email department')
  .populate('createdBy', 'name email')
  .populate('inspectionLevel', 'name type priority subLevels')
  .populate('asset', 'uniqueId type displayName')
  .populate('progress.completedBy', 'name email')
  .populate('progress.signoff.signedBy', 'name email');

  res.status(200).json({
    success: true,
    data: updatedTask
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
    .populate('asset', 'uniqueId type displayName')
    .populate('progress.completedBy', 'name email')
    .populate('progress.signoff.signedBy', 'name email')
    .populate('comments.user', 'name email')
    .populate('statusHistory.changedBy', 'name email');

  res.status(200).json({
    success: true,
    data: updatedTask,
  });
});