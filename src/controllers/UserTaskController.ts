import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../utils/catchAsync';
import { Task } from '../models/Task';
import ApiError from '../utils/ApiError';
import { pick } from 'lodash';
import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import InspectionLevel from '../models/InspectionLevel';

interface QueryFilters {
  [key: string]: any;
}

interface ITaskProgress {
  subLevelId: mongoose.Types.ObjectId;
  status: string;
  startedAt?: Date;
  completedAt?: Date;
  completedBy?: mongoose.Types.ObjectId | any;
  notes?: string;
  photos?: string[];
  timeSpent?: number;
}

interface IStatusHistory {
  status: string;
  changedBy: mongoose.Types.ObjectId;
  comment: string;
  timestamp: Date;
}

interface ISubLevel {
  _id: mongoose.Types.ObjectId;
  name?: string;
  description?: string;
  subLevels?: ISubLevel[];
  [key: string]: any;
}

interface ITask extends mongoose.Document {
  title: string;
  description?: string;
  priority: string;
  status: string;
  deadline?: Date;
  overallProgress?: number;
  flaggedItems?: Array<any>;
  progress?: Array<ITaskProgress>;
  inspectionLevel?: any;
  assignedTo?: Array<any>;
  createdBy?: any;
  statusHistory?: IStatusHistory[];
  createdAt?: Date;
  updatedAt?: Date;
  reports?: Array<any>;
  comments?: Array<any>;
  asset?: any;
  questionnaireResponses?: Record<string, any>;
  questions?: Array<any>;
  questionnaireCompleted?: boolean;
  questionnaireNotes?: string;
  location?: string;
  attachments?: any[];
  signature?: string;
  signedBy?: mongoose.Types.ObjectId | any;
  signedAt?: Date;
  toObject(): any;
}

interface ITaskExtended extends ITask {
  questions?: Array<any>;
  questionnaireResponses?: Record<string, any>;
  questionnaireCompleted?: boolean;
  questionnaireNotes?: string;
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
  const { status, notes, photos, timeSpent } = req.body;
  const userId = req.user?._id;

  if (!mongoose.Types.ObjectId.isValid(taskId) || (subLevelId && !mongoose.Types.ObjectId.isValid(subLevelId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid task or sub-level ID');
  }

  const task = await Task.findById(taskId) as ITask;
  
  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
  }
  
  const isAssigned = task.assignedTo.some((id: any) => id.toString() === userId?.toString());
  if (!isAssigned) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not assigned to this task');
  }

  if (!subLevelId && req.body.finalSubmit) {
    task.status = 'completed';
    
    task.statusHistory.push({
      status: 'completed',
      changedBy: userId,
      comment: 'Task completed by inspector',
      timestamp: new Date()
    });
    
    await task.save();
    
    const updatedTask = await getPopulatedTask(taskId, userId);
    
    return res.status(httpStatus.OK).json({
      status: 'success',
      data: updatedTask
    });
  }

  let progressEntry = task.progress.find((p: any) => p.subLevelId?.toString() === subLevelId);
  
  // Support both standard status values and compliance status values
  const validStatus = ['pending', 'in_progress', 'completed', 'full_compliance', 'partial_compliance', 'non_compliance', 'not_applicable'];
  
  if (status && !validStatus.includes(status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Invalid status value. Must be one of: ${validStatus.join(', ')}`);
  }
  
  if (!progressEntry) {
    task.progress.push({
      subLevelId: new mongoose.Types.ObjectId(subLevelId),
      status: status || 'pending',
      startedAt: status === 'in_progress' || status === 'partial_compliance' ? new Date() : undefined,
      completedBy: (status === 'completed' || status === 'full_compliance') ? userId : undefined,
      completedAt: (status === 'completed' || status === 'full_compliance') ? new Date() : undefined,
      notes: notes || '',
      photos: photos || [],
      timeSpent: timeSpent || 0
    });
  } else {
    if (status) {
      progressEntry.status = status;
      if ((status === 'in_progress' || status === 'partial_compliance') && !progressEntry.startedAt) {
        progressEntry.startedAt = new Date();
      }
      if (status === 'completed' || status === 'full_compliance') {
        progressEntry.completedBy = userId;
        progressEntry.completedAt = new Date();
      }
    }
    if (notes !== undefined) progressEntry.notes = notes;
    if (photos !== undefined) progressEntry.photos = photos;
    if (timeSpent !== undefined) progressEntry.timeSpent = timeSpent;
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
    // Count both 'completed' and 'full_compliance' as completed checkpoints
    const completedSubLevels = task.progress.filter((p: any) => 
      (p.status === 'completed' || p.status === 'full_compliance') && 
      allSubLevelIds.includes(p.subLevelId.toString())
    ).length;
    
    task.overallProgress = Math.round((completedSubLevels / totalSubLevels) * 100);
  }

  if (task.overallProgress === 100) {
    task.status = 'completed';
    
    if (task.statusHistory.length === 0 || 
        task.statusHistory[task.statusHistory.length - 1].status !== 'completed') {
      task.statusHistory.push({
        status: 'completed',
        changedBy: userId,
        comment: 'All inspection items completed',
        timestamp: new Date()
      });
    }
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

  const updatedTask = await getPopulatedTask(taskId, userId);

  return res.status(httpStatus.OK).json({
    status: 'success',
    data: updatedTask
  });
});

export const updateTaskQuestionnaire = catchAsync(async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const { responses, notes, completed } = req.body;
  const userId = req.user?._id;

  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid task ID');
  }

  const task = await Task.findById(taskId) as ITask;
  
  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
  }
  
  const isAssigned = task.assignedTo.some((id: any) => id.toString() === userId?.toString());
  if (!isAssigned) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not assigned to this task');
  }

  // Get the inspection level associated with this task
  const inspectionLevel = await InspectionLevel.findById(task.inspectionLevel);
  if (!inspectionLevel) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Inspection level not found');
  }

  // Update the inspection level questionnaire
  inspectionLevel.questionnaireResponses = responses || {};
  inspectionLevel.questionnaireCompleted = completed || false;
  inspectionLevel.questionnaireNotes = notes || '';
  
  await inspectionLevel.save();

  // Update the task status if needed
  if (task.status === 'pending' && completed) {
    task.status = 'in_progress';
    
    task.statusHistory.push({
      status: 'in_progress',
      changedBy: userId,
      comment: 'Pre-inspection questionnaire completed',
      timestamp: new Date()
    });
    
    await task.save();
  }

  const updatedTask = await getPopulatedTask(taskId, userId);

  res.status(httpStatus.OK).json({
    status: 'success',
    data: updatedTask
  });
});

export const getTaskDetails = catchAsync(async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const userId = req.user?._id;

  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid task ID');
  }

  const task = await getPopulatedTask(taskId, userId);

  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
  }

  const isAssigned = task.assignedTo.some((assignee: any) => assignee._id.toString() === userId?.toString());
  if (!isAssigned) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not assigned to this task');
  }

  res.status(httpStatus.OK).json({
    status: 'success',
    data: task
  });
});

export const startTask = catchAsync(async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const userId = req.user?._id;

  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid task ID');
  }

  const task = await Task.findById(taskId) as ITask;
  
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

  const updatedTask = await getPopulatedTask(taskId, userId);

  res.status(httpStatus.OK).json({
    status: 'success',
    data: updatedTask
  });
});

export const exportTaskReport = catchAsync(async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const format = req.query.format as string || 'pdf';
  const userId = req.user?._id;

  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid task ID');
  }

  const task = await getPopulatedTask(taskId, userId);
  
  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
  }
  
  const isAssigned = task.assignedTo.some((assignee: any) => 
    assignee && assignee._id && assignee._id.toString() === userId?.toString()
  );
  
  if (!isAssigned) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not assigned to this task');
  }

  if (format === 'pdf') {
    try {
      // Create a PDF document with strict content control
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        bufferPages: true,
        autoFirstPage: true,
        info: {
          Title: `Inspection Report - ${task.title || 'Task'}`,
          Author: 'Inspection System',
          Subject: 'Inspection Report',
          Keywords: 'inspection, compliance, report',
          CreationDate: new Date()
        }
      });
      
      // Set up response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=task-report-${taskId}.pdf`);
      
      // Create a stream to pipe the PDF into the response
      doc.pipe(res);
      
      // Generate the PDF content
      await generateTaskPDFContent(doc, task);
      
      // Finalize and end the document
      doc.end();
      
      return undefined;
    } catch (err) {
      console.error('PDF generation error:', err);
      if (!res.headersSent) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
          status: 'error',
          message: 'Error generating PDF report'
        });
      }
      return undefined;
    }
  } else if (format === 'excel') {
    try {
      const workbook = new ExcelJS.Workbook();
      await generateTaskExcelContent(workbook, task);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=task-report-${taskId}.xlsx`);
      
      const buffer = await workbook.xlsx.writeBuffer();
      res.send(buffer);
      
      return undefined;
    } catch (err) {
      console.error('Excel generation error:', err);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        status: 'error',
        message: 'Error generating Excel report'
      });
    }
  } else {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Unsupported format');
  }
  
  return undefined;
});

/**
 * Save a signature for a task
 * @route POST /api/v1/user-tasks/:taskId/signature
 */
export const saveTaskSignature = catchAsync(async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const { signature } = req.body;
  const userId = req.user?._id;

  if (!signature) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Signature is required');
  }

  const task = await Task.findById(taskId);

  if (!task) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Task not found');
  }

  // Check if user is assigned to this task
  if (!task.assignedTo.some(id => id.toString() === userId.toString())) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not assigned to this task');
  }

  // Save the signature to the task
  task.signature = signature;
  task.signedBy = userId;
  task.signedAt = new Date();

  await task.save();

  res.status(httpStatus.OK).json({
    status: 'success',
    data: task
  });
});

async function generateTaskPDFContent(doc: PDFKit.PDFDocument, task: any): Promise<void> {
  const colors = {
    primary: '#1A237E', // Color navy - more standardized
    secondary: '#3949ab',
    text: '#333333',
    lightText: '#666666',
    background: '#f8fafc',
    border: '#e2e8f0',
    green: '#4caf50',
    amber: '#ffc107',
    red: '#f44336',
    gray: '#9e9e9e'
  };

  let yPos = 50;
  const maxWidth = 495;
  const pageWidth = 595.28; // A4 width in points
  const leftMargin = 50;
  const rightMargin = 50;
  const contentWidth = pageWidth - leftMargin - rightMargin;

  // Utility functions for consistent drawing
  const drawSectionHeader = (text: string): number => {
    doc.fontSize(16)
       .fillColor(colors.primary)
       .font('Helvetica-Bold')
       .text(text, leftMargin, yPos);
    
    doc.moveTo(leftMargin, yPos + 25).lineTo(pageWidth - rightMargin, yPos + 25).strokeColor(colors.border).stroke();
    yPos += 40;
    return yPos;
  };

  const drawStatusBadge = (status: string, x: number, y: number): number => {
    let color;
    switch(status) {
      case 'completed':
      case 'full_compliance': 
        color = colors.green; 
        break;
      case 'in_progress':
      case 'partial_compliance': 
        color = colors.amber; 
        break;
      case 'pending': 
        color = colors.amber; 
        break;
      case 'incomplete':
      case 'non_compliance': 
        color = colors.red; 
        break;
      case 'not_applicable':
        color = colors.gray;
        break;
      default: 
        color = colors.gray;
    }
    
    const displayStatus = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
    const textWidth = doc.widthOfString(displayStatus);
    const rectWidth = textWidth + 20;
    
    doc.roundedRect(x, y, rectWidth, 20, 5)
       .fill(color);
    
    doc.fillColor('white')
       .fontSize(10)
       .text(displayStatus, x + 10, y + 5);
    
    return x + rectWidth + 10;
  };

  const calculateOverallScore = (): { achieved: number, total: number, percentage: number } => {
    if (!task) return { achieved: 0, total: 0, percentage: 0 };
    
    let totalPoints = 0;
    let earnedPoints = 0;
    
    if (task.questionnaireResponses) {
      const responses = task.questionnaireResponses;
      
      Object.entries(responses).forEach(([key, value]) => {
        if (!key.includes('-') || key.startsWith('c-')) return;
        
        const questionId = key.split('-')[1];
        if (!questionId) return;
        
        const question = task.questions?.find((q: any) => 
          q && (q._id?.toString() === questionId || q.id?.toString() === questionId)
        );
        
        // Skip if we can't find the question
        if (!question) return;
        
        // Get the weight and max score from the question if available
        const weight = question.weight || 1;
        const maxScore = question.scoring?.max || 2;
        
        // Skip N/A responses in scoring
        if (value === 'not_applicable' || value === 'na' || value === 'N/A') {
          return;
        }
        
        totalPoints += maxScore * weight;
        
        switch(value) {
          case 'full_compliance':
          case 'yes':
          case 'Yes':
            earnedPoints += maxScore * weight;
            break;
          case 'partial_compliance':
            earnedPoints += (maxScore / 2) * weight;
            break;
        }
      });
    }
    
    if (task.progress) {
      task.progress.forEach((item: any) => {
        if (!item || !item.subLevelId) return;
        
        // Skip N/A items in scoring
        if (item.status === 'not_applicable') {
          return;
        }
        
        totalPoints += 2; // Each checkpoint is worth 2 points
        
        switch (item.status) {
          case 'completed':
          case 'full_compliance':
            earnedPoints += 2;
            break;
          case 'in_progress':
          case 'partial_compliance':
            earnedPoints += 1;
            break;
        }
      });
    }
    
    if (totalPoints === 0 && task.overallProgress !== undefined) {
      return {
        achieved: task.overallProgress,
        total: 100,
        percentage: task.overallProgress
      };
    }
    
    const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    
    return {
      achieved: earnedPoints,
      total: totalPoints,
      percentage
    };
  };
  
  // Function to check page space and add new page if needed
  const ensureSpace = (requiredSpace: number): void => {
    if (yPos + requiredSpace > doc.page.height - 50) {
      doc.addPage();
      yPos = 50;
    }
  };

  // Draw the header with logo and title
  try {
    const logoPath = path.join(process.cwd(), 'public/logo.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, leftMargin, yPos, { width: 120 });
      
      // Add report title next to logo
      doc.fontSize(22)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text('Inspection Report', leftMargin + 140, yPos + 15);
      
      yPos += 100;
    } else {
      // If no logo, draw a placeholder header
      doc.rect(leftMargin, yPos, contentWidth, 60)
         .fillAndStroke(colors.background, colors.border);
      
      doc.fontSize(22)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text('Inspection Report', leftMargin, yPos + 15, { align: 'center', width: contentWidth });
      
      yPos += 80;
    }
  } catch (err) {
    // If logo fails to load, use text header
    doc.rect(leftMargin, yPos, contentWidth, 60)
       .fillAndStroke(colors.background, colors.border);
    
    doc.fontSize(22)
       .fillColor(colors.primary)
       .font('Helvetica-Bold')
       .text('Inspection Report', leftMargin, yPos + 15, { align: 'center', width: contentWidth });
    
    yPos += 80;
  }
  
  // Draw inspection title
  doc.fontSize(18)
     .fillColor(colors.primary)
     .font('Helvetica-Bold')
     .text(task.title || 'Inspection Task', leftMargin, yPos);
     
  yPos += 30;
  
  // Draw task overview
  const score = calculateOverallScore();
  
  // Draw score summary box
  doc.rect(leftMargin, yPos, contentWidth, 60)
     .fillAndStroke('#f1f5f9', '#e2e8f0');
  
  doc.fillColor(colors.primary)
     .fontSize(14)
     .font('Helvetica-Bold')
     .text('Compliance Score:', leftMargin + 15, yPos + 10);
  
  doc.fillColor(colors.text)
     .fontSize(24)
     .font('Helvetica-Bold')
     .text(`${score.percentage}%`, leftMargin + 180, yPos + 10);
     
  doc.fillColor(colors.text)
     .fontSize(12)
     .font('Helvetica')
     .text(`${score.achieved} of ${score.total} points`, leftMargin + 180, yPos + 35);

  // Add inspection status on right side
  doc.fillColor(colors.primary)
     .fontSize(14)
     .font('Helvetica-Bold')
     .text('Status:', leftMargin + 300, yPos + 10);

  // Draw status badge
  drawStatusBadge(task.status || 'pending', leftMargin + 350, yPos + 8);
  
  yPos += 80;
  
  // Task information
  ensureSpace(100);
  drawSectionHeader('Task Information');
  
  const taskInfoTable = [
    ['Task ID:', task._id ? task._id.toString() : 'N/A'],
    ['Assigned To:', task.assignedTo && task.assignedTo.length > 0 
                   ? (task.assignedTo[0].name || 'Unnamed User') 
                   : 'Unassigned'],
    ['Created On:', task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'N/A'],
    ['Priority:', task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'N/A'],
    ['Deadline:', task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'],
    ['Completion:', `${task.overallProgress || 0}%`]
  ];
  
  // Draw info table
  let tableY = yPos;
  const colWidth1 = 120;
  const colWidth2 = contentWidth - colWidth1;
  
  taskInfoTable.forEach(([label, value]) => {
    doc.fontSize(10)
       .fillColor(colors.lightText)
       .font('Helvetica')
       .text(label, leftMargin, tableY);
       
    doc.fontSize(10)
       .fillColor(colors.text)
       .font('Helvetica-Bold')
       .text(value, leftMargin + colWidth1, tableY);
    
    tableY += 20;
  });
  
  yPos = tableY + 20;
  
  // Add description if available
  if (task.description) {
    ensureSpace(80);
    doc.fontSize(10)
       .fillColor(colors.lightText)
       .font('Helvetica')
       .text('Description:', leftMargin, yPos);
       
    yPos += 15;
    
    doc.fontSize(10)
       .fillColor(colors.text)
       .font('Helvetica')
       .text(task.description, leftMargin, yPos, { width: contentWidth });
    
    const textHeight = doc.heightOfString(task.description, { width: contentWidth });
    yPos += textHeight + 20;
  }
  
  // Inspection Data section
  ensureSpace(100);
  drawSectionHeader('Inspection Results');
  
  // Process sublevels and questions
  if (task.inspectionLevel && task.inspectionLevel.subLevels) {
    ensureSpace(50);
  
    // Helper function to process sublevels recursively with better format
    const processSubLevelsForPDF = (subLevels: any[], level = 0, maxDepth = 10): void => {
      if (!subLevels || !Array.isArray(subLevels) || level > maxDepth) return;
      
      for (const subLevel of subLevels) {
        if (!subLevel) continue;
        
        // Ensure space for the sublevel and its details
        ensureSpace(80);
        
        // Get progress information
        const progress = task.progress?.find((p: any) => 
          p.subLevelId && (
            p.subLevelId.toString() === subLevel._id.toString() || 
            (typeof p.subLevelId === 'object' && p.subLevelId._id && p.subLevelId._id.toString() === subLevel._id.toString())
          )
        );
        
        const status = progress?.status || 'pending';
        
        // Indent based on level
        const indent = level * 15;
        
        // Draw level header with gradient background
        const levelBoxWidth = contentWidth - indent;
        doc.rect(leftMargin + indent, yPos, levelBoxWidth, 30)
           .fillAndStroke(level === 0 ? '#e0e7ff' : '#f1f5f9', '#e2e8f0');
        
        // Level title and status on the same line
        doc.fontSize(12 - (level * 0.5))
           .fillColor(colors.primary)
           .font('Helvetica-Bold')
           .text(subLevel.name || 'Unnamed Level', leftMargin + indent + 10, yPos + 10, 
                 { width: levelBoxWidth - 120, continued: true });
        
        // Add status badge at the right side of the header
        const statusX = pageWidth - rightMargin - 110;
        drawStatusBadge(status, statusX, yPos + 5);
        
        yPos += 40;
        
        // Add description if available
        if (subLevel.description && subLevel.description !== 'No description provided') {
          ensureSpace(40);
          doc.fontSize(9)
             .fillColor(colors.text)
             .font('Helvetica')
             .text(subLevel.description, leftMargin + indent + 10, yPos, 
                   { width: levelBoxWidth - 20 });
          
          const descHeight = doc.heightOfString(subLevel.description, { width: levelBoxWidth - 20 });
          yPos += descHeight + 10;
        }
        
        // Add notes if available
        if (progress && progress.notes) {
          ensureSpace(40);
          doc.fontSize(9)
             .fillColor(colors.primary)
             .font('Helvetica-Bold')
             .text('Inspector Notes:', leftMargin + indent + 10, yPos);
          
          yPos += 15;
          
          doc.rect(leftMargin + indent + 10, yPos, levelBoxWidth - 20, 50)
             .fillAndStroke('#ffffff', '#e2e8f0');
          
          doc.fontSize(9)
             .fillColor(colors.text)
             .font('Helvetica')
             .text(progress.notes, leftMargin + indent + 15, yPos + 5, 
                   { width: levelBoxWidth - 30 });
          
          yPos += 60;
        }
        
        // Process photos
        if (progress && progress.photos && progress.photos.length > 0) {
          ensureSpace(30);
          doc.fontSize(9)
             .fillColor(colors.primary)
             .font('Helvetica-Bold')
             .text('Photos:', leftMargin + indent + 10, yPos);
          
          yPos += 15;
          
          // Just show count for now - actual photos would need to be fetched and embedded
          doc.fontSize(9)
             .fillColor(colors.text)
             .font('Helvetica')
             .text(`${progress.photos.length} photo(s) attached`, leftMargin + indent + 10, yPos);
          
          yPos += 20;
        }
        
        // Process nested sublevels
        if (subLevel.subLevels && subLevel.subLevels.length > 0) {
          ensureSpace(10);
          processSubLevelsForPDF(subLevel.subLevels, level + 1, maxDepth);
        }
        
        // Add some extra space after this level
        yPos += 10;
      }
    };
    
    // Start processing top-level sublevels
    processSubLevelsForPDF(task.inspectionLevel.subLevels);
  }
  
  // Questionnaire results section
  if (task.questions && task.questions.length > 0 && task.questionnaireResponses) {
    ensureSpace(50);
    drawSectionHeader('Questionnaire Results');
    
    // Group questions by category
    const categories: Record<string, any[]> = {};
    
    task.questions.forEach((question: any) => {
      if (!question) return;
      
      const category = question.category || 'General';
      
      if (!categories[category]) {
        categories[category] = [];
      }
      
      // Find response
      const questionId = question._id || question.id;
      const responseKey = Object.keys(task.questionnaireResponses || {}).find(key => 
        key.includes(questionId) || key.endsWith(questionId)
      );
      
      const response = responseKey ? task.questionnaireResponses[responseKey] : null;
      const commentKey = `c-${questionId}`;
      const comment = task.questionnaireResponses[commentKey] || '';
      
      categories[category].push({
        id: questionId,
        text: question.text || 'Question',
        response,
        comment,
        mandatory: question.mandatory !== false
      });
    });
    
    // Process each category
    for (const [category, questions] of Object.entries(categories)) {
      ensureSpace(40);
      
      // Category header
      doc.rect(leftMargin, yPos, contentWidth, 25)
         .fillAndStroke('#e0e7ff', '#c7d2fe');
         
      doc.fontSize(12)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text(category, leftMargin + 10, yPos + 7);
      
      yPos += 35;
      
      // Questions table headers
      const tableHeaderY = yPos;
      const questionColWidth = contentWidth * 0.6;
      const responseColWidth = contentWidth * 0.4;
      
      doc.rect(leftMargin, tableHeaderY, questionColWidth, 20)
         .rect(leftMargin + questionColWidth, tableHeaderY, responseColWidth, 20)
         .fillAndStroke('#f1f5f9', '#e2e8f0');
      
      doc.fontSize(10)
         .fillColor(colors.text)
         .font('Helvetica-Bold')
         .text('Question', leftMargin + 10, tableHeaderY + 5)
         .text('Response', leftMargin + questionColWidth + 10, tableHeaderY + 5);
      
      yPos += 25;
      
      // Questions and responses
      questions.forEach((question, index) => {
        ensureSpace(40);
        
        const rowBgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        const rowY = yPos;
        
        // Calculate required height for question text
        const questionTextHeight = doc.heightOfString(question.text, { 
          width: questionColWidth - 20,
          align: 'left'
        });
        
        const rowHeight = Math.max(30, questionTextHeight + 15);
        
        // Draw row background
        doc.rect(leftMargin, rowY, questionColWidth, rowHeight)
           .rect(leftMargin + questionColWidth, rowY, responseColWidth, rowHeight)
           .fillAndStroke(rowBgColor, '#e2e8f0');
        
        // Question text
        doc.fontSize(9)
           .fillColor(colors.text)
           .font('Helvetica')
           .text(question.text, leftMargin + 10, rowY + 7, {
             width: questionColWidth - 20,
             align: 'left'
           });
        
        // Response 
        if (question.response) {
          let responseColor;
          let responseText;
          
          switch (question.response) {
            case 'yes':
            case 'Yes':
            case 'full_compliance':
            case 'Full Compliance':
              responseColor = colors.green;
              responseText = 'Yes / Full Compliance';
              break;
            case 'no':
            case 'No':
            case 'non_compliance':
            case 'Non Compliance':
              responseColor = colors.red;
              responseText = 'No / Non-Compliance';
              break;
            case 'partial_compliance':
            case 'Partial Compliance':
              responseColor = colors.amber;
              responseText = 'Partial Compliance';
              break;
            case 'not_applicable':
            case 'Not Applicable':
            case 'na':
            case 'N/A':
              responseColor = colors.gray;
              responseText = 'Not Applicable';
              break;
            default:
              responseColor = colors.primary;
              responseText = question.response;
          }
          
          // Draw response badge
          doc.roundedRect(leftMargin + questionColWidth + 10, rowY + 5, responseColWidth - 20, 20, 5)
             .fillAndStroke(responseColor, responseColor);
          
          doc.fontSize(9)
             .fillColor('white')
             .font('Helvetica-Bold')
             .text(responseText, leftMargin + questionColWidth + 15, rowY + 10, {
               width: responseColWidth - 30,
               align: 'center'
             });
        } else {
          doc.fontSize(9)
             .fillColor(colors.lightText)
             .font('Helvetica-Oblique')
             .text('No response', leftMargin + questionColWidth + 10, rowY + 10);
        }
        
        yPos += rowHeight;
        
        // Add comment if available
        if (question.comment) {
          ensureSpace(30);
          
          doc.rect(leftMargin, yPos, contentWidth, 25)
             .fillAndStroke('#f8fafc', '#e2e8f0');
          
          doc.fontSize(8)
             .fillColor(colors.lightText)
             .font('Helvetica-Bold')
             .text('Comment:', leftMargin + 10, yPos + 5, { continued: true });
          
          doc.font('Helvetica')
             .text(' ' + question.comment, { width: contentWidth - 70 });
          
          yPos += 30;
        }
      });
      
      yPos += 15;
    }
  }
  
  // Flagged items section
  if (task.flaggedItems && task.flaggedItems.length > 0) {
    ensureSpace(50);
    drawSectionHeader('Flagged Items');
    
    // Flagged items table headers
    const tableHeaderY = yPos;
    const categoryColWidth = contentWidth * 0.25;
    const itemColWidth = contentWidth * 0.35;
    const statusColWidth = contentWidth * 0.15;
    const notesColWidth = contentWidth * 0.25;
    
    doc.rect(leftMargin, tableHeaderY, categoryColWidth, 20)
       .rect(leftMargin + categoryColWidth, tableHeaderY, itemColWidth, 20)
       .rect(leftMargin + categoryColWidth + itemColWidth, tableHeaderY, statusColWidth, 20)
       .rect(leftMargin + categoryColWidth + itemColWidth + statusColWidth, tableHeaderY, notesColWidth, 20)
       .fillAndStroke(colors.primary, colors.primary);
    
    doc.fontSize(10)
       .fillColor('white')
       .font('Helvetica-Bold')
       .text('Category', leftMargin + 10, tableHeaderY + 5)
       .text('Item', leftMargin + categoryColWidth + 10, tableHeaderY + 5)
       .text('Status', leftMargin + categoryColWidth + itemColWidth + 10, tableHeaderY + 5)
       .text('Notes', leftMargin + categoryColWidth + itemColWidth + statusColWidth + 10, tableHeaderY + 5);
    
    yPos += 25;
    
    // Flagged items rows
    task.flaggedItems.forEach((item: any, index: number) => {
      if (!item) return;
      
      ensureSpace(40);
      
      const rowBgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      const rowY = yPos;
      const rowHeight = 30;
      
      // Draw row background
      doc.rect(leftMargin, rowY, categoryColWidth, rowHeight)
         .rect(leftMargin + categoryColWidth, rowY, itemColWidth, rowHeight)
         .rect(leftMargin + categoryColWidth + itemColWidth, rowY, statusColWidth, rowHeight)
         .rect(leftMargin + categoryColWidth + itemColWidth + statusColWidth, rowY, notesColWidth, rowHeight)
         .fillAndStroke(rowBgColor, '#e2e8f0');
      
      // Fill in data
      doc.fontSize(9)
         .fillColor(colors.text)
         .font('Helvetica')
         .text(item.category || 'N/A', leftMargin + 5, rowY + 10, { width: categoryColWidth - 10 })
         .text(item.title || 'Untitled', leftMargin + categoryColWidth + 5, rowY + 10, { width: itemColWidth - 10 });
      
      // Status with color indicator
      let statusColor;
      switch (item.status) {
        case 'full_compliance':
        case 'Full Compliance':
          statusColor = colors.green;
          break;
        case 'partial_compliance':
        case 'Partial Compliance':
          statusColor = colors.amber;
          break;
        case 'not_applicable':
        case 'Not Applicable':
          statusColor = colors.gray;
          break;
        default:
          statusColor = colors.red;
      }
      
      const statusX = leftMargin + categoryColWidth + itemColWidth + 5;
      const statusY = rowY + 5;
      const statusWidth = statusColWidth - 10;
      
      doc.roundedRect(statusX, statusY, statusWidth, rowHeight - 10, 3)
         .fillAndStroke(statusColor, statusColor);
      
      doc.fontSize(8)
         .fillColor('white')
         .font('Helvetica-Bold')
         .text(item.status || 'N/A', statusX + 5, statusY + 5, { width: statusWidth - 10, align: 'center' });
      
      // Notes
      doc.fontSize(9)
         .fillColor(colors.text)
         .font('Helvetica')
         .text(item.notes || '', leftMargin + categoryColWidth + itemColWidth + statusColWidth + 5, rowY + 10, 
               { width: notesColWidth - 10 });
      
      yPos += rowHeight;
    });
    
    yPos += 20;
  }
  
  // Footer with signature area
  ensureSpace(100);
  drawSectionHeader('Sign-off');
  
  // Inspector signature
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text('Inspector Signature:', leftMargin, yPos);
  
  yPos += 20;
  
  doc.rect(leftMargin, yPos, contentWidth * 0.45, 40)
     .stroke('#e2e8f0');
  
  // Person in charge signature
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text('Person in Charge Signature:', leftMargin + contentWidth * 0.55, yPos - 20);
  
  doc.rect(leftMargin + contentWidth * 0.55, yPos, contentWidth * 0.45, 40)
     .stroke('#e2e8f0');
  
  yPos += 50;
  
  // Date line
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text('Date:', leftMargin, yPos);
  
  doc.moveTo(leftMargin + 35, yPos + 12)
     .lineTo(leftMargin + 150, yPos + 12)
     .stroke('#e2e8f0');
  
  // Add page numbers
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    
    // Add time generated on bottom left
    doc.fontSize(8)
       .fillColor(colors.lightText)
       .font('Helvetica')
       .text(
         `Generated on ${new Date().toLocaleString()}`,
         leftMargin,
         doc.page.height - 30,
         { align: 'left', width: contentWidth / 2 }
       );
    
    // Add page number on bottom right
    doc.fontSize(8)
       .fillColor(colors.lightText)
       .font('Helvetica')
       .text(
         `Page ${i + 1} of ${range.count}`,
         leftMargin + contentWidth / 2,
         doc.page.height - 30,
         { align: 'right', width: contentWidth / 2 }
       );
  }
}

async function generateTaskExcelContent(workbook: ExcelJS.Workbook, task: any): Promise<void> {
  // Create evaluation sheet
  const evalSheet = workbook.addWorksheet('Evaluation');
  
  // Add headers
  evalSheet.addRow(['Category', 'Subcategory', 'Question/Checkpoint', 'Score', 'Max Score', 'Status', 'Notes']);
  
  // Style header row
  const headerRow = evalSheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1A237E' },
    bgColor: { argb: '1A237E' }
  };
  headerRow.font = {
    bold: true,
    color: { argb: 'FFFFFF' }
  };
  
  let rowIndex = 2;
  let totalScore = 0;
  let maxScore = 0;
  
  // Process questionnaire items
  if (task.questionnaireResponses && task.questions) {
    const responses = task.questionnaireResponses;
    
    Object.entries(responses).forEach(([key, value]) => {
      if (!key || !key.includes('-') || !value) return;
      
      const questionId = key.split('-')[1];
      if (!questionId) return;
      
      const question = task.questions.find((q: any) => 
        q && (
          (q._id && q._id.toString() === questionId) || 
          (q.id && q.id.toString() === questionId)
        )
      );
      
      if (question) {
        let scoreValue = 0;
        let maxScoreValue = 2; // Each question worth 2 points
        
        // Scoring according to the methodology
        switch (value) {
          case 'full_compliance':
          case 'Full Compliance':
          case 'yes':
            scoreValue = 2;
            break;
          case 'partial_compliance':
            scoreValue = 1;
            break;
          case 'not_applicable':
          case 'na':
            scoreValue = 0;
            maxScoreValue = 0; // Don't count in the total
            break;
        }
        
        totalScore += scoreValue;
        maxScore += maxScoreValue;
        
        evalSheet.addRow([
          'Questionnaire',
          question.category || 'Pre-inspection',
          question.text || 'Question',
          scoreValue,
          maxScoreValue,
          value,
          ''
        ]);
        
        // Style the row based on compliance
        const row = evalSheet.getRow(rowIndex);
        if (row && row.getCell) {
          const cell = row.getCell(6);
          if (cell) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { 
                argb: value === 'full_compliance' || value === 'Full Compliance' || value === 'yes' ? '4CAF50' : 
                      value === 'partial_compliance' || value === 'Partial Compliance' ? 'FFC107' : 
                      value === 'not_applicable' || value === 'Not Applicable' || value === 'na' ? 'BDBDBD' : 'F44336' 
              }
            };
          }
        }
        
        rowIndex++;
      }
    });
  }
  
  // Process inspection items
  if (task.progress && task.progress.length > 0 && task.inspectionLevel) {
    // Flatten the inspection levels hierarchy
    const flattenLevels = (levels: any[], parentName = ''): any[] => {
      let result: any[] = [];
      
      if (!levels || !Array.isArray(levels)) return result;
      
      levels.forEach(level => {
        if (!level) return;
        
        const fullName = parentName ? `${parentName} > ${level.name || 'Unnamed'}` : (level.name || 'Unnamed');
        const category = parentName.split(' > ')[0] || level.name || 'Unnamed';
        const subcategory = parentName ? fullName.replace(`${category} > `, '') : '';
        
        result.push({
          id: level._id ? level._id.toString() : '',
          name: level.name || 'Unnamed',
          description: level.description || '',
          category,
          subcategory,
          fullName,
          mandatory: level.mandatory !== false
        });
        
        if (level.subLevels && level.subLevels.length > 0) {
          result = [...result, ...flattenLevels(level.subLevels, fullName)];
        }
      });
      
      return result;
    };
    
    const allLevels = flattenLevels(task.inspectionLevel.subLevels || []);
    
    // Add rows for inspection items
    task.progress.forEach((progress: any) => {
      if (!progress || !progress.subLevelId) return;
      
      const level = allLevels.find(l => l.id === progress.subLevelId.toString());
      
      if (level) {
        let scoreValue = 0;
        let maxScoreValue = 2; // Each checkpoint is worth 2 points
        
        // Scoring according to the methodology
        switch (progress.status) {
          case 'completed':
          case 'full_compliance': 
            scoreValue = 2; 
            break;
          case 'in_progress':
          case 'partial_compliance': 
            scoreValue = 1; 
            break;
          case 'not_applicable':
            scoreValue = 0;
            maxScoreValue = 0; // Don't count in the total
            break;
          default: 
            scoreValue = 0;
        }
        
        // Only count mandatory items in the score
        if (level.mandatory) {
          totalScore += scoreValue;
          maxScore += maxScoreValue;
        }
        
        evalSheet.addRow([
          level.category,
          level.subcategory,
          level.name,
          scoreValue,
          maxScoreValue,
          progress.status || 'pending',
          progress.notes || ''
        ]);
        
        // Style the row based on status
        const row = evalSheet.getRow(rowIndex);
        if (row && row.getCell) {
          const cell = row.getCell(6);
          if (cell) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { 
                argb: progress.status === 'completed' || progress.status === 'full_compliance' ? '4CAF50' : 
                      progress.status === 'in_progress' || progress.status === 'partial_compliance' ? 'FFC107' : 
                      progress.status === 'not_applicable' ? 'BDBDBD' : 'F44336' 
              }
            };
          }
        }
        
        rowIndex++;
      }
    });
  }
  
  // Add summary row
  evalSheet.addRow(['Total', '', '', totalScore, maxScore, `${maxScore > 0 ? (totalScore / maxScore * 100).toFixed(2) : 0}%`, '']);
  
  // Style summary row
  const summaryRow = evalSheet.getRow(rowIndex);
  if (summaryRow) {
    summaryRow.font = { bold: true };
    summaryRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'E8EAF6' }
    };
  }
  
  // Format columns
  evalSheet.getColumn(1).width = 20;
  evalSheet.getColumn(2).width = 25;
  evalSheet.getColumn(3).width = 50;
  evalSheet.getColumn(4).width = 10;
  evalSheet.getColumn(5).width = 10;
  evalSheet.getColumn(6).width = 20;
  evalSheet.getColumn(7).width = 40;
  
  // Task Summary sheet
  const summarySheet = workbook.addWorksheet('Task Summary');
  
  // Add task details
  summarySheet.addRow(['Task Report Summary']);
  summarySheet.getRow(1).font = { bold: true, size: 14 };
  
  summarySheet.addRow(['Generated on:', new Date().toLocaleString()]);
  summarySheet.addRow([]);
  
  summarySheet.addRow(['Title:', task.title || 'N/A']);
  summarySheet.addRow(['Status:', task.status || 'N/A']);
  summarySheet.addRow(['Priority:', task.priority || 'N/A']);
  summarySheet.addRow(['Deadline:', task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A']);
  summarySheet.addRow(['Overall Progress:', `${task.overallProgress || 0}%`]);
  summarySheet.addRow(['Score:', `${totalScore} / ${maxScore} (${maxScore > 0 ? (totalScore / maxScore * 100).toFixed(2) : 0}%)`]);
  
  if (task.asset) {
    summarySheet.addRow([]);
    summarySheet.addRow(['Asset Information']);
    summarySheet.getRow(summarySheet.rowCount).font = { bold: true };
    
    const asset = typeof task.asset === 'object' ? task.asset : { _id: task.asset };
    summarySheet.addRow(['Asset ID:', asset._id || 'N/A']);
    
    if (asset.displayName || asset.name) {
      summarySheet.addRow(['Asset Name:', asset.displayName || asset.name || 'N/A']);
    }
    
    if (asset.type) {
      summarySheet.addRow(['Asset Type:', asset.type || 'N/A']);
    }
  }
  
  // Format columns
  summarySheet.getColumn(1).width = 25;
  summarySheet.getColumn(2).width = 50;
  
  // Flagged Items sheet
  if (task.flaggedItems && task.flaggedItems.length > 0) {
    const flaggedSheet = workbook.addWorksheet('Flagged Items');
    
    // Add header row
    flaggedSheet.addRow(['Category', 'Item', 'Status', 'Notes']);
    
    // Style header row
    const headerRow = flaggedSheet.getRow(1);
    if (headerRow) {
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '1A237E' },
        bgColor: { argb: '1A237E' }
      };
      headerRow.font = {
        bold: true,
        color: { argb: 'FFFFFF' }
      };
    }
    
    // Add flagged items
    task.flaggedItems.forEach((item: any, index: number) => {
      if (!item) return;
      
      flaggedSheet.addRow([
        item.category || 'N/A',
        item.title || 'Untitled',
        item.status || 'N/A',
        item.notes || ''
      ]);
      
      // Style row based on status
      const row = flaggedSheet.getRow(index + 2);
      if (row && row.getCell) {
        const cell = row.getCell(3);
        if (cell) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { 
              argb: item.status === 'full_compliance' || item.status === 'Full Compliance' ? '4CAF50' : 
                    item.status === 'partial_compliance' || item.status === 'Partial Compliance' ? 'FFC107' : 
                    item.status === 'not_applicable' || item.status === 'Not Applicable' ? 'BDBDBD' : 'F44336'
            }
          };
        }
      }
    });
    
    // Format columns
    flaggedSheet.getColumn(1).width = 20;
    flaggedSheet.getColumn(2).width = 40;
    flaggedSheet.getColumn(3).width = 20;
    flaggedSheet.getColumn(4).width = 40;
  }
}

async function getPopulatedTask(taskId: string, userId: any): Promise<any> {
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
    .populate('statusHistory.changedBy', 'name email')
    .populate('asset');
  
  if (!task) return null;
  
  // Convert mongoose document to plain object to avoid type issues
  const taskData = task.toObject() as unknown as ITaskExtended;
  
  const getAllSubLevelIds = (subLevels: any[]): string[] => {
    let ids: string[] = [];
    if (!subLevels || !Array.isArray(subLevels)) return ids;
    
    for (const sl of subLevels) {
      if (sl && sl._id) {
        ids.push(sl._id.toString());
        if (sl.subLevels && Array.isArray(sl.subLevels)) {
          ids = [...ids, ...getAllSubLevelIds(sl.subLevels)];
        }
      }
    }
    return ids;
  };
  
  const allSubLevelIds = getAllSubLevelIds(taskData.inspectionLevel?.subLevels || []);
  
  let timeSpent = 0;
  if (taskData.statusHistory && taskData.statusHistory.length > 0) {
    const startTime = new Date(taskData.statusHistory[0].timestamp).getTime();
    const endTime = taskData.status === 'completed' 
      ? new Date(taskData.statusHistory[taskData.statusHistory.length - 1].timestamp).getTime()
      : Date.now();
    timeSpent = (endTime - startTime) / (1000 * 60 * 60);
  }

  const subLevelTimeSpent: Record<string, string> = {};
  if (taskData.progress && Array.isArray(taskData.progress)) {
    taskData.progress.forEach((p: any) => {
      if (p && p.subLevelId) {
        if (p.timeSpent) {
          subLevelTimeSpent[p.subLevelId.toString()] = p.timeSpent.toFixed(1);
        } else if (p.completedAt && p.startedAt) {
          const startTime = new Date(p.startedAt).getTime();
          const endTime = new Date(p.completedAt).getTime();
          const time = (endTime - startTime) / (1000 * 60 * 60);
          subLevelTimeSpent[p.subLevelId.toString()] = time.toFixed(1);
        }
      }
    });
  }

  const userProgress = taskData.progress && Array.isArray(taskData.progress) ? taskData.progress.filter((p: any) => {
    if (!p || !p.subLevelId || !p.completedBy) return false;
    const completedById = typeof p.completedBy === 'object' ? 
      (p.completedBy._id ? p.completedBy._id.toString() : '') : 
      p.completedBy.toString();
    return completedById === userId?.toString() && allSubLevelIds.includes(p.subLevelId.toString());
  }) : [];
  
  const totalSubLevels = allSubLevelIds.length;
  const userCompletionRate = totalSubLevels > 0
    ? (userProgress.length / totalSubLevels) * 100
    : 0;

  const flaggedItems: any[] = [];
  if (taskData.progress && Array.isArray(taskData.progress)) {
    const findFlaggedSubLevels = (subLevels: any[], parentPath = ''): void => {
      if (!subLevels || !Array.isArray(subLevels)) return;
      
      for (const subLevel of subLevels) {
        if (!subLevel || !subLevel._id) continue;
        
        const currentPath = parentPath ? `${parentPath} > ${subLevel.name || 'Unnamed'}` : (subLevel.name || 'Unnamed');
        const progress:any = taskData.progress.find((p: any) => 
          p && p.subLevelId && subLevel._id && 
          p.subLevelId.toString() === subLevel._id.toString()
        );
        
        if (progress && (progress.status === 'non_compliance' || progress.status === 'incomplete')) {
          flaggedItems.push({
            id: subLevel._id.toString(),
            category: parentPath || 'Main',
            title: subLevel.name || 'Unnamed',
            status: progress.status || 'pending',
            notes: progress.notes || '',
            path: currentPath
          });
        }
        
        if (subLevel.subLevels && subLevel.subLevels.length > 0) {
          findFlaggedSubLevels(subLevel.subLevels, currentPath);
        }
      }
    };
    
    if (taskData.inspectionLevel && taskData.inspectionLevel.subLevels) {
      findFlaggedSubLevels(taskData.inspectionLevel.subLevels);
    }
  }
  
  // Process questionnaire data - use task's responses if available, otherwise fallback to inspection level
  const questionnaireResponses = { ...(taskData.questionnaireResponses || {}) };
  const questions = [...(taskData.questions || [])];
  let questionnaireCompleted = taskData.questionnaireCompleted || false;
  let questionnaireNotes = taskData.questionnaireNotes || '';
  
  // Add questionnaire data from the inspection level if task data is insufficient
  if (taskData.inspectionLevel) {
    // If task doesn't have questions, use inspection level questions
    if (!questions.length && taskData.inspectionLevel.questions && taskData.inspectionLevel.questions.length) {
      questions.push(...taskData.inspectionLevel.questions);
    }
    
    // Merge questionnaire responses (task responses take precedence)
    if (taskData.inspectionLevel.questionnaireResponses) {
      Object.entries(taskData.inspectionLevel.questionnaireResponses).forEach(([key, value]) => {
        if (!questionnaireResponses[key]) {
          questionnaireResponses[key] = value;
        }
      });
    }
    
    // Use inspection level completion status if task status is not set
    if (!taskData.questionnaireCompleted && taskData.inspectionLevel.questionnaireCompleted) {
      questionnaireCompleted = taskData.inspectionLevel.questionnaireCompleted;
    }
    
    // Use inspection level notes if task notes are not set
    if (!questionnaireNotes && taskData.inspectionLevel.questionnaireNotes) {
      questionnaireNotes = taskData.inspectionLevel.questionnaireNotes;
    }
  }
  
  // Add flagged questionnaire items
  Object.entries(questionnaireResponses).forEach(([key, value]) => {
    if (!key.includes('-')) return;
    
    const questionId = key.split('-')[1];
    if (!questionId) return;
    
    const question = questions.find((q: any) => 
      q && (
        (q._id && q._id.toString() === questionId) || 
        (q.id && q.id.toString() === questionId)
      )
    );
    
    if (question && (value === 'non_compliance' || value === 'Non Compliant' || value === 'no' || value === 'No')) {
      flaggedItems.push({
        id: questionId,
        category: 'Questionnaire',
        title: question.text || 'Unnamed Question',
        status: value,
        notes: '',
        path: `Questionnaire > ${question.text || 'Unnamed Question'}`
      });
    }
  });

  // Update the task object with the processed questionnaire data
  const enhancedTask = {
    ...taskData,
    questions,
    questionnaireResponses,
    questionnaireCompleted,
    questionnaireNotes,
    taskMetrics: {
      timeSpent: Math.round(timeSpent * 10) / 10,
      completionRate: Math.round(userCompletionRate),
      userProgress: userProgress.length,
      totalSubTasks: totalSubLevels,
      subLevelTimeSpent
    },
    flaggedItems
  };

  return enhancedTask;
}