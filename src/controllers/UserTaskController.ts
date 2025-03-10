import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../utils/catchAsync';
import { Task } from '../models/Task';
import { ApiError } from '../utils/ApiError';
import { pick } from 'lodash';
import mongoose from 'mongoose';

interface QueryFilters {
  [key: string]: any;
}

// Using mongoose.Types.ObjectId for compatibility with the Task model
interface ITaskProgress {
  subLevelId: mongoose.Types.ObjectId;
  status: string;
  startedAt?: Date;
  completedAt?: Date;
  completedBy?: mongoose.Types.ObjectId | any;
  notes?: string;
  photos?: string[];
}

interface IStatusHistory {
  status: string;
  changedBy: mongoose.Types.ObjectId;
  comment: string;
  timestamp: Date;
}

interface ISubLevel {
  _id: mongoose.Types.ObjectId;
  subLevels?: ISubLevel[];
}

// Use any for flexibility with mongoose document methods
interface ITaskDocument extends mongoose.Document {
  assignedTo: any[];
  inspectionLevel: any;
  progress: any[];
  overallProgress: number;
  status: string;
  statusHistory: any[];
  createdAt: Date;
  updatedAt: Date;
  toObject(): any;
}

export const getUserTasks = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const filter: any = { assignedTo: userId };
  
  const queryFilters = pick(req.query, ['status', 'priority', 'inspectionLevel']) as QueryFilters;
  const search = req.query.search as string;
  
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  Object.keys(queryFilters).forEach(key => {
    if (queryFilters[key]) {
      if (Array.isArray(queryFilters[key])) {
        filter[key] = { $in: queryFilters[key] };
      } else if (key === 'inspectionLevel') {
        filter[key] = queryFilters[key];
      } else {
        filter[key] = { $regex: queryFilters[key], $options: 'i' };
      }
    }
  });

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const sortBy = req.query.sortBy 
    ? (req.query.sortBy as string).split(',').join(' ')
    : '-deadline';

  const [tasks, totalTasks] = await Promise.all([
    Task.find(filter)
      .populate('inspectionLevel', 'name type priority')
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('progress.completedBy', 'name email')
      .sort(sortBy)
      .skip(skip)
      .limit(limit),
    Task.countDocuments(filter)
  ]);

  res.status(httpStatus.OK).json({
    status: 'success',
    results: tasks,
    page,
    limit,
    totalPages: Math.ceil(totalTasks / limit),
    totalResults: totalTasks
  });
});

export const getUserDashboardStats = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  const [
    totalAssigned,
    completed,
    inProgress,
    pending,
    overdue
  ] = await Promise.all([
    Task.countDocuments({ assignedTo: userId }),
    Task.countDocuments({ assignedTo: userId, status: 'completed' }),
    Task.countDocuments({ assignedTo: userId, status: 'in_progress' }),
    Task.countDocuments({ assignedTo: userId, status: 'pending' }),
    Task.countDocuments({ 
      assignedTo: userId, 
      deadline: { $lt: new Date() },
      status: { $nin: ['completed'] }
    })
  ]);

  const recentTasks = await Task.find({ assignedTo: userId })
    .sort('-createdAt')
    .limit(5)
    .populate('inspectionLevel', 'name')
    .select('title description status deadline location priority overallProgress');

  const statusCounts = [
    { status: 'Pending', count: pending, color: '#f97316' },
    { status: 'In Progress', count: inProgress, color: '#3b82f6' },
    { status: 'Completed', count: completed, color: '#22c55e' },
    { status: 'Overdue', count: overdue, color: '#ef4444' },
  ];

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const completedThisMonth = await Task.countDocuments({
    assignedTo: userId,
    status: 'completed',
    'statusHistory.status': 'completed',
    'statusHistory.timestamp': { $gte: startOfMonth }
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const completedTasks = await Task.find({
    assignedTo: userId,
    status: 'completed',
    updatedAt: { $gte: thirtyDaysAgo }
  }).select('createdAt updatedAt');
  
  let avgCompletionTime = 0;
  if (completedTasks.length > 0) {
    const totalTime = completedTasks.reduce((acc, task) => {
      const creationTime = new Date(task.createdAt).getTime();
      const completionTime = new Date(task.updatedAt).getTime();
      return acc + (completionTime - creationTime);
    }, 0);
    
    avgCompletionTime = totalTime / completedTasks.length / (1000 * 60 * 60 * 24);
  }

  res.status(httpStatus.OK).json({
    status: 'success',
    data: {
      stats: [
        {
          icon: 'ListChecks',
          value: totalAssigned.toString(),
          label: 'Assigned Tasks',
          color: '#1976d2',
          bgColor: '#e3f2fd'
        },
        {
          icon: 'CheckSquare',
          value: completed.toString(),
          label: 'Completed Tasks',
          color: '#2e7d32',
          bgColor: '#e8f5e9'
        },
        {
          icon: 'Clock',
          value: inProgress.toString(),
          label: 'In Progress',
          color: '#ed6c02',
          bgColor: '#fff3e0'
        },
        {
          icon: 'AlertCircle',
          value: overdue.toString(),
          label: 'Overdue Tasks',
          color: '#d32f2f',
          bgColor: '#ffebee'
        }
      ],
      recentTasks,
      statusCounts,
      performance: {
        completedThisMonth,
        avgCompletionTime: avgCompletionTime.toFixed(1),
        totalAssigned
      }
    }
  });
});

export const updateTaskProgress = catchAsync(async (req: Request, res: Response) => {
  const { taskId, subLevelId } = req.params;
  const { status, notes, photos } = req.body;
  const userId = req.user?._id;

  if (!mongoose.Types.ObjectId.isValid(taskId) || !mongoose.Types.ObjectId.isValid(subLevelId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid task or sub-level ID');
  }

  const task = await Task.findById(taskId);
  
  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
  }
  
  const isAssigned = task.assignedTo.some((id: any) => id.toString() === userId?.toString());
  if (!isAssigned) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not assigned to this task');
  }

  let progressEntry = task.progress.find((p: any) => p.subLevelId?.toString() === subLevelId);
  
  if (!progressEntry) {
    task.progress.push({
      subLevelId: new mongoose.Types.ObjectId(subLevelId),
      status: status || 'pending',
      startedAt: status === 'in_progress' ? new Date() : undefined,
      completedBy: status === 'completed' ? userId : undefined,
      completedAt: status === 'completed' ? new Date() : undefined,
      notes: notes || '',
      photos: photos || []
    });
  } else {
    if (status) {
      progressEntry.status = status;
      if (status === 'in_progress' && !progressEntry.startedAt) {
        progressEntry.startedAt = new Date();
      }
      if (status === 'completed') {
        progressEntry.completedBy = userId;
        progressEntry.completedAt = new Date();
      }
    }
    if (notes !== undefined) progressEntry.notes = notes;
    if (photos !== undefined) progressEntry.photos = photos;
  }

  const inspectionLevel = await mongoose.model('InspectionLevel').findById(task.inspectionLevel)
    .populate({
      path: 'subLevels',
      populate: {
        path: 'subLevels',
        populate: {
          path: 'subLevels'
        }
      }
    });

  const getAllSubLevelIds = (subLevels: any[]): string[] => {
    let ids: string[] = [];
    if (!subLevels || !Array.isArray(subLevels)) return ids;
    
    for (const sl of subLevels) {
      ids.push(sl._id.toString());
      if (sl.subLevels && Array.isArray(sl.subLevels)) {
        ids = [...ids, ...getAllSubLevelIds(sl.subLevels)];
      }
    }
    return ids;
  };

  const allSubLevelIds = getAllSubLevelIds(inspectionLevel?.subLevels || []);
  const totalSubLevels = allSubLevelIds.length;
  
  if (totalSubLevels > 0) {
    const completedSubLevels = task.progress.filter((p: any) => 
      p.status === 'completed' && allSubLevelIds.includes(p.subLevelId.toString())
    ).length;
    
    task.overallProgress = Math.round((completedSubLevels / totalSubLevels) * 100);
  }

  if (task.overallProgress === 100) {
    task.status = 'completed';
    
    task.statusHistory.push({
      status: 'completed',
      changedBy: userId,
      comment: 'All inspection items completed',
      timestamp: new Date()
    });
  } else if (task.overallProgress > 0) {
    task.status = 'in_progress';
    
    if (task.statusHistory.length === 0 || 
        task.statusHistory[task.statusHistory.length - 1].status !== 'in_progress') {
      task.statusHistory.push({
        status: 'in_progress',
        changedBy: userId,
        comment: 'Task in progress',
        timestamp: new Date()
      });
    }
  }

  await task.save();

  const updatedTask = await Task.findById(taskId)
    .populate({
      path: 'inspectionLevel',
      populate: {
        path: 'subLevels',
        populate: {
          path: 'subLevels',
          populate: {
            path: 'subLevels'
          }
        }
      }
    })
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .populate('progress.completedBy', 'name email')
    .populate('comments.user', 'name email')
    .populate('statusHistory.changedBy', 'name email');

  interface SubLevelTimeSpent {
    [key: string]: string;
  }
  
  const userProgress = updatedTask?.progress.filter((p: any) => 
    p.completedBy && p.completedBy._id.toString() === userId?.toString() && 
    allSubLevelIds.includes(p.subLevelId.toString())
  ) || [];
  
  const userCompletionRate = totalSubLevels > 0
    ? (userProgress.length / totalSubLevels) * 100
    : 0;

  let timeSpent = 0;
  if (updatedTask?.statusHistory && updatedTask.statusHistory.length > 0) {
    const startTime = new Date(updatedTask.statusHistory[0].timestamp).getTime();
    const endTime = updatedTask.status === 'completed' 
      ? new Date(updatedTask.statusHistory[updatedTask.statusHistory.length - 1].timestamp).getTime()
      : Date.now();
    timeSpent = (endTime - startTime) / (1000 * 60 * 60);
  }

  const subLevelTimeSpent: SubLevelTimeSpent = {};
  updatedTask?.progress.forEach((p: any) => {
    if (p.completedAt && p.startedAt) {
      const startTime = new Date(p.startedAt).getTime();
      const endTime = new Date(p.completedAt).getTime();
      const time = (endTime - startTime) / (1000 * 60 * 60);
      subLevelTimeSpent[p.subLevelId.toString()] = time.toFixed(1);
    }
  });

  const taskWithMetrics = {
    ...(updatedTask?.toObject() || {}),
    taskMetrics: {
      timeSpent: Math.round(timeSpent * 10) / 10,
      completionRate: Math.round(userCompletionRate),
      userProgress: userProgress.length,
      totalSubTasks: totalSubLevels,
      subLevelTimeSpent
    }
  };

  res.status(httpStatus.OK).json({
    status: 'success',
    data: taskWithMetrics
  });
});

export const getTaskDetails = catchAsync(async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const userId = req.user?._id;

  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid task ID');
  }

  const task = await Task.findById(taskId)
    .populate({
      path: 'inspectionLevel',
      populate: {
        path: 'subLevels',
        populate: {
          path: 'subLevels',
          populate: {
            path: 'subLevels'
          }
        }
      }
    })
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email')
    .populate('progress.completedBy', 'name email')
    .populate('comments.user', 'name email')
    .populate('statusHistory.changedBy', 'name email');

  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
  }

  const isAssigned = task.assignedTo.some((assignee: any) => assignee._id.toString() === userId?.toString());
  if (!isAssigned) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not assigned to this task');
  }

  const getAllSubLevelIds = (subLevels: any[]): string[] => {
    let ids: string[] = [];
    if (!subLevels || !Array.isArray(subLevels)) return ids;
    
    for (const sl of subLevels) {
      ids.push(sl._id.toString());
      if (sl.subLevels && Array.isArray(sl.subLevels)) {
        ids = [...ids, ...getAllSubLevelIds(sl.subLevels)];
      }
    }
    return ids;
  };

  // Access the populated subLevels from the inspectionLevel
  const populatedInspectionLevel = task.inspectionLevel as any;
  const allSubLevelIds = getAllSubLevelIds(populatedInspectionLevel?.subLevels || []);
  
  let timeSpent = 0;
  if (task.statusHistory && task.statusHistory.length > 0) {
    const startTime = new Date(task.statusHistory[0].timestamp).getTime();
    const endTime = task.status === 'completed' 
      ? new Date(task.statusHistory[task.statusHistory.length - 1].timestamp).getTime()
      : Date.now();
    timeSpent = (endTime - startTime) / (1000 * 60 * 60);
  }

  interface SubLevelTimeSpent {
    [key: string]: string;
  }
  
  const subLevelTimeSpent: SubLevelTimeSpent = {};
  task.progress.forEach((p: any) => {
    if (p.completedAt && p.startedAt) {
      const startTime = new Date(p.startedAt).getTime();
      const endTime = new Date(p.completedAt).getTime();
      const time = (endTime - startTime) / (1000 * 60 * 60);
      subLevelTimeSpent[p.subLevelId.toString()] = time.toFixed(1);
    }
  });

  const userProgress = task.progress.filter((p: any) => 
    p.completedBy && p.completedBy._id.toString() === userId?.toString() && 
    allSubLevelIds.includes(p.subLevelId.toString())
  );
  
  const totalSubLevels = allSubLevelIds.length;
  const userCompletionRate = totalSubLevels > 0
    ? (userProgress.length / totalSubLevels) * 100
    : 0;

  const taskWithMetrics = {
    ...task.toObject(),
    taskMetrics: {
      timeSpent: Math.round(timeSpent * 10) / 10,
      completionRate: Math.round(userCompletionRate),
      userProgress: userProgress.length,
      totalSubTasks: totalSubLevels,
      subLevelTimeSpent
    }
  };

  res.status(httpStatus.OK).json({
    status: 'success',
    data: taskWithMetrics
  });
});

export const startTask = catchAsync(async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const userId = req.user?._id;

  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid task ID');
  }

  const task = await Task.findById(taskId);
  
  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
  }
  
  const isAssigned = task.assignedTo.some((id: any) => id.toString() === userId?.toString());
  if (!isAssigned) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not assigned to this task');
  }

  if (task.status === 'pending') {
    task.status = 'in_progress';
    
    task.statusHistory.push({
      status: 'in_progress',
      changedBy: userId,
      comment: 'Task started',
      timestamp: new Date()
    });
    
    await task.save();
  }

  const updatedTask = await Task.findById(taskId)
    .populate({
      path: 'inspectionLevel',
      populate: {
        path: 'subLevels',
        populate: {
          path: 'subLevels'
        }
      }
    })
    .populate('assignedTo', 'name email')
    .populate('createdBy', 'name email');

  res.status(httpStatus.OK).json({
    status: 'success',
    data: updatedTask
  });
});