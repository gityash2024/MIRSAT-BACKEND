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

  const calculateScores = (task: any) => {
    let totalEarned = 0;
    let totalMaximum = 0;
    
    // Calculate scores based on questionnaire responses
    if (task.questions && task.questions.length > 0 && task.questionnaireResponses) {
      task.questions.forEach((question: any) => {
        if (!question) return;
        
        const questionId = question._id?.toString() || question.id?.toString();
        if (!questionId) return;
        
        // Skip if NA or no weight
        const weight = question.weight || 1;
        if (weight <= 0) return;
        
        // Find response - try different key formats
        let response = null;
        
        const possibleKeys = [
          `q-${questionId}`,
          `question-${questionId}`,
          questionId
        ];
        
        for (const key of possibleKeys) {
          if (task.questionnaireResponses[key] !== undefined) {
            response = task.questionnaireResponses[key];
            break;
          }
        }
        
        // If not found, try to find by checking if key includes or ends with questionId
        if (!response) {
          const foundKey = Object.keys(task.questionnaireResponses || {}).find(key => 
            !key.startsWith('c-') && (key.includes(questionId) || key.endsWith(questionId))
          );
          
          if (foundKey) {
            response = task.questionnaireResponses[foundKey];
          }
        }
        
        // Calculate points based on response
        const maxScore = question.scoring?.max || 2;
        const maxPointsForQuestion = maxScore * weight;
        
        // Skip N/A questions from calculation
        if (response === 'not_applicable' || response === 'na' || response === 'N/A') {
          return;
        }
        
        totalMaximum += maxPointsForQuestion;
        
        if (response) {
          if (response === 'full_compliance' || response === 'yes' || response === 'Yes' || 
              response === 'Full Compliance' || response === 'Full compliance') {
            totalEarned += maxPointsForQuestion;
          } else if (response === 'partial_compliance' || response === 'Partial Compliance' || 
                    response === 'Partial compliance') {
            totalEarned += maxPointsForQuestion / 2;
          }
        }
      });
    }
    
    // Calculate percentage
    const progressPercentage = totalMaximum > 0 ? (totalEarned / totalMaximum) * 100 : 0;
    
    return {
      earned: totalEarned,
      maximum: totalMaximum,
      percentage: Math.round(progressPercentage)
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
  
  // Calculate scores and progress
  const scores = calculateScores(task);
  
  // Determine if all questions are answered
  const allQuestionsAnswered = task.questions && task.questions.length > 0 && 
    task.questions.every((q: any) => {
      if (!q) return true;
      const qId = q._id?.toString() || q.id?.toString();
      return Object.keys(task.questionnaireResponses || {}).some(key => 
        !key.startsWith('c-') && (key.includes(qId) || key.endsWith(qId))
      );
    });
  
  // Determine if all questions are fully compliant
  const allQuestionsFullyCompliant = scores.earned === scores.maximum && scores.maximum > 0;
  
  // Determine task status based on questionnaire completion
  let taskStatus = 'pending';
  if (allQuestionsFullyCompliant) {
    taskStatus = 'completed';
  } else if (allQuestionsAnswered) {
    taskStatus = 'completed'; // Still completed even if not all full compliance
  } else if (Object.keys(task.questionnaireResponses || {}).some(key => !key.startsWith('c-'))) {
    taskStatus = 'in_progress';
  }
  
  // Draw progress summary box with improved design
  doc.rect(leftMargin, yPos, contentWidth, 80)
     .fillAndStroke('#f1f5f9', '#e2e8f0');
  
  // Left section - Overall Progress
  doc.fillColor(colors.primary)
     .fontSize(14)
     .font('Helvetica-Bold')
     .text('Overall Progress:', leftMargin + 15, yPos + 15);
  
  // Create a progress bar
  const progressBarWidth = 100;
  const progressBarHeight = 10;
  const progressBarX = leftMargin + 160;
  const progressBarY = yPos + 18;
  
  // Background of progress bar
  doc.rect(progressBarX, progressBarY, progressBarWidth, progressBarHeight)
     .fillAndStroke('#e2e8f0', '#d1d5db');
  
  // Calculate progress percentage - either from scores or task's overall progress
  const progressPercentage = allQuestionsAnswered ? 100 : scores.percentage;
  
  // Filled portion of progress bar
  const filledWidth = (progressPercentage / 100) * progressBarWidth;
  doc.rect(progressBarX, progressBarY, filledWidth, progressBarHeight)
     .fill(progressPercentage === 100 ? colors.green : colors.primary);
  
  // Progress percentage
  doc.fillColor(colors.text)
     .fontSize(16)
     .font('Helvetica-Bold')
     .text(`${progressPercentage}%`, progressBarX + progressBarWidth + 10, yPos + 15);
  
  // Right section - Task Status
  doc.fillColor(colors.primary)
     .fontSize(14)
     .font('Helvetica-Bold')
     .text('Status:', leftMargin + 350, yPos + 15);
  
  // Draw status badge
  drawStatusBadge(taskStatus, leftMargin + 400, yPos + 13);
  
  // Bottom section - Score breakdown
  doc.fillColor(colors.primary)
     .fontSize(12)
     .font('Helvetica-Bold')
     .text('Score Details:', leftMargin + 15, yPos + 45);
  
  doc.fillColor(colors.text)
     .fontSize(10)
     .font('Helvetica')
     .text(`${Math.round(scores.earned)} of ${Math.round(scores.maximum)} points`, leftMargin + 100, yPos + 47);
  
  yPos += 100;
  
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
    ['Location:', task.location || 'N/A']
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
      
      const questionId = question._id?.toString() || question.id?.toString();
      if (!questionId) return;
      
      // Find response - try to match exact key format
      let response = null;
      let responseKey = null;
      
      // Try different key formats
      const possibleKeys = [
        `q-${questionId}`,
        `question-${questionId}`,
        questionId
      ];
      
      for (const key of possibleKeys) {
        if (task.questionnaireResponses[key] !== undefined) {
          responseKey = key;
          response = task.questionnaireResponses[key];
          break;
        }
      }
      
      // If not found, try to find by checking if key includes or ends with questionId
      if (!responseKey) {
        responseKey = Object.keys(task.questionnaireResponses || {}).find(key => 
          !key.startsWith('c-') && (key.includes(questionId) || key.endsWith(questionId))
        );
        
        if (responseKey) {
          response = task.questionnaireResponses[responseKey];
        }
      }
      
      const commentKey = `c-${questionId}`;
      const comment = task.questionnaireResponses[commentKey] || '';
      
      // Calculate the earned and max score for this question directly
      const weight = question.weight || 1;
      const maxScore = question.scoring?.max || 2;
      const maxPointsForQuestion = maxScore * weight;
      
      let earnedPointsForQuestion = 0;
      let isNA = false;
      
      if (response) {
        if (response === 'not_applicable' || response === 'na' || response === 'N/A') {
          isNA = true;
        } else if (response === 'full_compliance' || response === 'yes' || response === 'Yes' || 
                 response === 'Full Compliance' || response === 'Full compliance') {
          earnedPointsForQuestion = maxPointsForQuestion;
        } else if (response === 'partial_compliance' || response === 'Partial Compliance' || 
                  response === 'Partial compliance') {
          earnedPointsForQuestion = maxPointsForQuestion / 2;
        }
      }
      
      // Get page and section info directly from the question object
      const page = question.page || '';
      const section = question.section || '';
      
      categories[category].push({
        id: questionId,
        text: question.text,
        response,
        comment,
        section,
        page,
        earned: earnedPointsForQuestion,
        max: maxPointsForQuestion,
        isNA
      });
    });
    
    // Render each category
    Object.entries(categories).forEach(([category, questions]) => {
      ensureSpace(70);
      
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
      const questionColWidth = contentWidth * 0.5;
      const responseColWidth = contentWidth * 0.25;
      const scoreColWidth = contentWidth * 0.25;
      
      doc.rect(leftMargin, tableHeaderY, questionColWidth, 20)
         .rect(leftMargin + questionColWidth, tableHeaderY, responseColWidth, 20)
         .rect(leftMargin + questionColWidth + responseColWidth, tableHeaderY, scoreColWidth, 20)
         .fillAndStroke('#f1f5f9', '#e2e8f0');
      
      doc.fontSize(10)
         .fillColor(colors.text)
         .font('Helvetica-Bold')
         .text('Question', leftMargin + 10, tableHeaderY + 5)
         .text('Response', leftMargin + questionColWidth + 10, tableHeaderY + 5)
         .text('Score', leftMargin + questionColWidth + responseColWidth + 10, tableHeaderY + 5);
      
      yPos += 25;
      
      // Questions and responses
      questions.forEach((question, index) => {
        ensureSpace(60);
        
        const rowBgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        const rowY = yPos;
        
        // Calculate required height for question text
        const questionTextHeight = doc.heightOfString(question.text, { 
          width: questionColWidth - 20,
          align: 'left'
        });
        
        const rowHeight = Math.max(40, questionTextHeight + 25);
        
        // Draw row background
        doc.rect(leftMargin, rowY, questionColWidth, rowHeight)
           .rect(leftMargin + questionColWidth, rowY, responseColWidth, rowHeight)
           .rect(leftMargin + questionColWidth + responseColWidth, rowY, scoreColWidth, rowHeight)
           .fillAndStroke(rowBgColor, '#e2e8f0');
        
        // Breadcrumb path for question using the page and section info
        let breadcrumb = category;
        
        if (question.page && question.section) {
          breadcrumb = `${category} › Page ${question.page} › ${question.section}`;
        } else if (question.section) {
          breadcrumb = `${category} › ${question.section}`;
        } else if (question.page) {
          breadcrumb = `${category} › Page ${question.page}`;
        }
        
        // Question text with breadcrumb
        doc.fontSize(8)
           .fillColor(colors.secondary)
           .font('Helvetica')
           .text(breadcrumb, leftMargin + 10, rowY + 7);
        
        doc.fontSize(9)
           .fillColor(colors.text)
           .font('Helvetica')
           .text(question.text, leftMargin + 10, rowY + 18, {
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
            case 'Full compliance':
              responseColor = colors.green;
              responseText = 'Full compliance';
              break;
            case 'no':
            case 'No':
            case 'non_compliance':
            case 'Non Compliance':
            case 'Non compliance':
              responseColor = colors.red;
              responseText = 'Non compliance';
              break;
            case 'partial_compliance':
            case 'Partial Compliance':
            case 'Partial compliance':
              responseColor = colors.amber;
              responseText = 'Partial compliance';
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
          doc.roundedRect(leftMargin + questionColWidth + 10, rowY + 10, responseColWidth - 20, 20, 5)
             .fillAndStroke(responseColor, responseColor);
          
          doc.fontSize(9)
             .fillColor('white')
             .font('Helvetica-Bold')
             .text(responseText, leftMargin + questionColWidth + 15, rowY + 15, {
               width: responseColWidth - 30,
               align: 'center'
             });
        } else {
          doc.fontSize(9)
             .fillColor(colors.lightText)
             .font('Helvetica')
             .text('No response', leftMargin + questionColWidth + 10, rowY + 15);
        }
        
        // Score section
        if (question.isNA) {
          doc.fontSize(9)
             .fillColor(colors.text)
             .font('Helvetica')
             .text('N/A', 
                 leftMargin + questionColWidth + responseColWidth + (scoreColWidth / 2) - 10, 
                 rowY + 15);
        } else {
          doc.fontSize(9)
             .fillColor(colors.text)
             .font('Helvetica-Bold')
             .text(`${question.earned} / ${question.max}`, 
                 leftMargin + questionColWidth + responseColWidth + (scoreColWidth / 2) - 15, 
                 rowY + 15);
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
    });
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
       .fillAndStroke('#e0e7ff', '#c7d2fe');
    
    doc.fontSize(10)
       .fillColor(colors.primary)
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
      let statusText;
      switch (item.status) {
        case 'full_compliance':
        case 'Full Compliance':
          statusColor = colors.green;
          statusText = 'Complete';
          break;
        case 'partial_compliance':
        case 'Partial Compliance':
          statusColor = colors.amber;
          statusText = 'In Progress';
          break;
        case 'not_applicable':
        case 'Not Applicable':
          statusColor = colors.gray;
          statusText = 'N/A';
          break;
        default:
          statusColor = colors.red;
          statusText = 'Incomplete';
      }
      
      const statusX = leftMargin + categoryColWidth + itemColWidth + 5;
      const statusY = rowY + 5;
      const statusWidth = statusColWidth - 10;
      
      doc.roundedRect(statusX, statusY, statusWidth, rowHeight - 10, 3)
         .fillAndStroke(statusColor, statusColor);
      
      doc.fontSize(8)
         .fillColor('white')
         .font('Helvetica-Bold')
         .text(statusText, statusX + 5, statusY + 5, { width: statusWidth - 10, align: 'center' });
      
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
  
  // Add the signature if available
  if (task.signature) {
    ensureSpace(80);
    
    doc.fontSize(10)
       .fillColor(colors.text)
       .font('Helvetica-Bold')
       .text('Inspector Signature:', leftMargin, yPos);
    
    yPos += 20;
    
    // Draw signature frame with background
    doc.rect(leftMargin, yPos, contentWidth * 0.45, 60)
       .fillAndStroke('#ffffff', '#e2e8f0');
       
    try {
      // If signature is base64, we can display it directly
      if (task.signature.startsWith('data:image')) {
        doc.image(task.signature, leftMargin + 10, yPos + 5, { 
          width: contentWidth * 0.4,
          height: 50,
          fit: [contentWidth * 0.4, 50]
        });
      } else {
        // Otherwise just show a text placeholder
        doc.fontSize(9)
           .fillColor(colors.lightText)
           .font('Helvetica')
           .text('Digital signature applied', leftMargin + 20, yPos + 25);
      }
    } catch (err) {
      // If signature image fails, use text
      doc.fontSize(9)
         .fillColor(colors.lightText)
         .font('Helvetica')
         .text('Digital signature applied', leftMargin + 20, yPos + 25);
    }
    
    // Add signed by and date if available
    if (task.signedBy && task.signedBy.name) {
      doc.fontSize(9)
         .fillColor(colors.text)
         .font('Helvetica')
         .text(`Signed by: ${task.signedBy.name}`, leftMargin, yPos + 70);
    }
    
    if (task.signedAt) {
      doc.fontSize(9)
         .fillColor(colors.text)
         .font('Helvetica')
         .text(`Date: ${new Date(task.signedAt).toLocaleString()}`, 
               task.signedBy && task.signedBy.name ? leftMargin + 200 : leftMargin, 
               yPos + 70);
    }
    
    yPos += 100;
  } else {
    // No signature available, show placeholders
    // Inspector signature
    doc.fontSize(10)
       .fillColor(colors.text)
       .font('Helvetica-Bold')
       .text('Inspector Signature:', leftMargin, yPos);
    
    yPos += 20;
    
    doc.rect(leftMargin, yPos, contentWidth * 0.45, 40)
       .fillAndStroke('#ffffff', '#e2e8f0');
    
    doc.fontSize(9)
       .fillColor(colors.lightText)
       .font('Helvetica')
       .text('Awaiting signature', leftMargin + 20, yPos + 15);
    
    // Person in charge signature
    doc.fontSize(10)
       .fillColor(colors.text)
       .font('Helvetica-Bold')
       .text('Person in Charge Signature:', leftMargin + contentWidth * 0.55, yPos - 20);
    
    doc.rect(leftMargin + contentWidth * 0.55, yPos, contentWidth * 0.45, 40)
       .fillAndStroke('#ffffff', '#e2e8f0');
    
    doc.fontSize(9)
       .fillColor(colors.lightText)
       .font('Helvetica')
       .text('Awaiting signature', leftMargin + contentWidth * 0.55 + 20, yPos + 15);
    
    yPos += 50;
    
    // Date line
    doc.fontSize(10)
       .fillColor(colors.text)
       .font('Helvetica-Bold')
       .text('Date:', leftMargin, yPos);
    
    doc.moveTo(leftMargin + 35, yPos + 12)
       .lineTo(leftMargin + 150, yPos + 12)
       .stroke('#e2e8f0');
  }
  
  // Add page numbers and footer
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    
    // Add footer background
    doc.rect(0, doc.page.height - 30, doc.page.width, 30)
       .fillAndStroke('#f8fafc', '#f8fafc');
    
    // Add time generated on bottom left
    doc.fontSize(8)
       .fillColor(colors.lightText)
       .font('Helvetica')
       .text(
         `Generated on ${new Date().toLocaleString()}`,
         leftMargin,
         doc.page.height - 20,
         { align: 'left', width: contentWidth / 2 }
       );
    
    // Add page number on bottom right
    doc.fontSize(8)
       .fillColor(colors.lightText)
       .font('Helvetica')
       .text(
         `Page ${i + 1} of ${range.count}`,
         leftMargin + contentWidth / 2,
         doc.page.height - 20,
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