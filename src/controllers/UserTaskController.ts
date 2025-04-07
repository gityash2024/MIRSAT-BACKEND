import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { catchAsync } from '../utils/catchAsync';
import { Task } from '../models/Task';
import { ApiError } from '../utils/ApiError';
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
  assignedTo: any[];
  inspectionLevel: any;
  progress: ITaskProgress[];
  overallProgress: number;
  status: string;
  statusHistory: IStatusHistory[];
  createdAt: Date;
  updatedAt: Date;
  questionnaireCompleted?: boolean;
  questionnaireResponses?: object;
  questionnaireNotes?: string;
  title: string;
  description: string;
  priority: string;
  deadline: Date;
  location?: string;
  comments?: any[];
  questions?: any[];
  attachments?: any[];
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

async function generateTaskPDFContent(doc: PDFKit.PDFDocument, task: any): Promise<void> {
  const colors = {
    primary: '#1a237e',
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

  // Utility functions for consistent drawing
  const drawSectionHeader = (text: string): number => {
    doc.fontSize(16)
       .fillColor(colors.primary)
       .font('Helvetica-Bold')
       .text(text, 50, yPos);
    
    doc.moveTo(50, yPos + 25).lineTo(545, yPos + 25).strokeColor(colors.border).stroke();
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
        
        totalPoints += 2;
        
        switch(value) {
          case 'full_compliance':
          case 'yes':
            earnedPoints += 2;
            break;
          case 'partial_compliance':
            earnedPoints += 1;
            break;
          case 'not_applicable':
          case 'na':
            totalPoints -= 2;
            break;
        }
      });
    }
    
    if (task.progress) {
      task.progress.forEach((item) => {
        if (!item || !item.subLevelId) return;
        
        const isMandatory = true;
        
        if (isMandatory) {
          totalPoints += 2;
          
          switch (item.status) {
            case 'completed':
            case 'full_compliance':
              earnedPoints += 2;
              break;
            case 'in_progress':
            case 'partial_compliance':
              earnedPoints += 1;
              break;
            case 'not_applicable':
              totalPoints -= 2;
              break;
          }
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
      doc.image(logoPath, 50, yPos, { width: 120 });
      yPos += 130;
    } else {
      // If no logo, draw a placeholder header
      doc.rect(50, yPos, 495, 60)
         .fillAndStroke(colors.background, colors.border);
      
      doc.fontSize(20)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text('Inspection Report', 50, yPos + 10, { align: 'center', width: 495 });
      
      yPos += 80;
    }
  } catch (err) {
    // If logo fails to load, use text header
    doc.rect(50, yPos, 495, 60)
       .fillAndStroke(colors.background, colors.border);
    
    doc.fontSize(20)
       .fillColor(colors.primary)
       .font('Helvetica-Bold')
       .text('Inspection Report', 50, yPos + 10, { align: 'center', width: 495 });
    
    yPos += 80;
  }
  
const score : any= calculateOverallScore();
doc.rect(50, yPos, 495, 40)
   .fillAndStroke('#f8f9fa', '#dee2e6');

   doc.fillColor(colors.primary)
   .fontSize(14)
   .font('Helvetica-Bold')
   .text(`Score ${score.achieved} / ${score.total} (${score.percentage}%)`, 70, yPos + 12);
  
  doc.fillColor(colors.text)
     .fontSize(10)
     .font('Helvetica')
     .text(`Flagged items: ${task.flaggedItems?.length || 0}`, 350, yPos + 14);
  
  doc.fillColor(colors.text)
     .fontSize(10)
     .font('Helvetica')
     .text(`Actions: 0`, 450, yPos + 14);
  
  yPos += 60;
  
  // Asset selection section
  ensureSpace(120);
  doc.rect(50, yPos, 495, 100)
     .fillAndStroke('#f1f3f5', '#dee2e6');
  
  doc.fontSize(14)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text('Asset selection', 70, yPos + 10);
  
  yPos += 40;
  
  doc.fontSize(12)
     .fillColor(colors.text)
     .font('Helvetica')
     .text('Before proceeding, please select the asset you are inspecting. This will help ensure accurate reporting.', 70, yPos);
  
  yPos += 30;
  
  doc.fontSize(12)
     .fillColor(colors.primary)
     .font('Helvetica-Bold')
     .text('Please choose the asset:', 70, yPos);
  
  const asset = task.asset || {};
  const assetName = typeof asset === 'object' 
    ? (asset.displayName || asset.name || 'N/A') 
    : 'Asset ID: ' + asset;
  
  doc.rect(350, yPos - 3, 180, 20)
     .stroke('#dee2e6');
  
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica')
     .text(assetName, 355, yPos);
  
  yPos += 40;
  
  // Inspection Data section
  ensureSpace(300);
  doc.rect(50, yPos, 495, 250)
     .fillAndStroke('#f1f3f5', '#dee2e6');
  
  doc.fontSize(14)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text('Inspection Data', 70, yPos + 10);
  
  yPos += 40;
  
  // Draw inspection details in a table-like format
  const inspectionDetails = [
    { label: 'Document Control Number', value: task._id.toString().substring(0, 6) || '000000' },
    { label: 'Name of Compliance representative', value: task.assignedTo?.[0]?.name || 'N/A' },
    { label: 'Place of Compliance visit', value: task.location || 'N/A' },
    { label: 'Date of Compliance visit', value: task.createdAt ? new Date(task.createdAt).toLocaleDateString() : 'N/A' },
    { label: 'Type of Compliance visit', value: '' },
    { 
      label: `Is the ${task.inspectionLevel?.type || 'Asset'} Licensed?`, 
      value: '', 
      isStatus: true, 
      status: task.status === 'completed' ? 'Yes' : 'No'
    },
    { 
      label: 'What is the type of the compliance visit?', 
      value: '', 
      isStatus: true, 
      status: 'Supplementary Compliance visit'
    },
    { 
      label: `Name of ${task.inspectionLevel?.type || 'Asset'}`,
      value: ''
    },
    { 
      label: 'Please enter the Legal Entity Name', 
      value: typeof task.asset === 'object' ? (task.asset.company || task.asset.displayName || 'N/A') : 'N/A'
    }
  ];
  
  for (const detail of inspectionDetails) {
    ensureSpace(30);
    
    doc.fontSize(10)
       .fillColor(colors.text)
       .font('Helvetica')
       .text(detail.label, 70, yPos);
    
    if (detail.isStatus) {
      doc.rect(350, yPos - 3, 180, 20)
         .fillAndStroke('#6c757d', '#5a6268');
      
      doc.fontSize(10)
         .fillColor('white')
         .font('Helvetica-Bold')
         .text(detail.status || '', 355, yPos);
    } else if (detail.value) {
      doc.rect(350, yPos - 3, 180, 20)
         .stroke('#dee2e6');
      
      doc.fontSize(10)
         .fillColor(colors.text)
         .font('Helvetica')
         .text(detail.value, 355, yPos);
    }
    
    yPos += 30;
  }
  
  yPos += 20;
  
  // Process flagged items
  ensureSpace(50);
  if (task.flaggedItems && task.flaggedItems.length > 0) {
    doc.rect(50, yPos, 495, 30)
       .fillAndStroke('#f1f3f5', '#dee2e6');
    
    doc.fontSize(14)
       .fillColor(colors.text)
       .font('Helvetica-Bold')
       .text(`Flagged items ${task.flaggedItems.length} flagged`, 70, yPos + 8);
    
    yPos += 40;
    
    // Process each flagged item
    for (const item of task.flaggedItems) {
      ensureSpace(120);
      
      doc.fontSize(12)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text(`${item.category || 'Area'} / ${item.title || 'Item'}`, 70, yPos);
      
      yPos += 20;
      
      // Draw item status
      doc.fontSize(10)
         .fillColor(colors.text)
         .font('Helvetica')
         .text('Is a compliance issue identified?', 70, yPos);
      
      let statusText = 'Non Compliant';
      if (item.status === 'full_compliance') statusText = 'Full Compliance';
      else if (item.status === 'partial_compliance') statusText = 'Partial Compliance';
      else if (item.status === 'not_applicable') statusText = 'Not Applicable';
      
      doc.rect(350, yPos - 3, 180, 20)
         .fillAndStroke('#dc3545', '#c82333');
      
      doc.fontSize(10)
         .fillColor('white')
         .font('Helvetica-Bold')
         .text(statusText, 355, yPos);
      
      yPos += 30;
      
      // Add item notes if available
      if (item.notes) {
        const noteLines = doc.heightOfString(item.notes, { width: 450, align: 'left' });
        ensureSpace(noteLines + 20);
        
        doc.fontSize(10)
           .fillColor(colors.text)
           .font('Helvetica')
           .text(item.notes, 70, yPos, { width: 450, align: 'left' });
        
        yPos += noteLines + 10;
      }
      
      // Add separator
      doc.moveTo(50, yPos).lineTo(545, yPos).stroke('#dee2e6');
      yPos += 20;
    }
  }
  
  // Process assessment areas
  if (task.inspectionLevel && task.inspectionLevel.subLevels) {
    // Process sublevels recursively and organize by sections
    const sections: Record<string, any[]> = {};
    
    const processSubLevels = (subLevels: any[], parentPath = ''): void => {
      for (const subLevel of subLevels) {
        if (!subLevel) continue;
        
        // Get section name (use first part of path or category)
        const category = subLevel.category || parentPath.split(' / ')[0] || 'General';
        
        if (!sections[category]) {
          sections[category] = [];
        }
        
        // Find progress item
        const progressItem = task.progress?.find((p: any) => 
          p && p.subLevelId && subLevel._id && 
          p.subLevelId.toString() === subLevel._id.toString()
        );
        
        const path = parentPath 
          ? `${parentPath} / ${subLevel.name || 'Unnamed'}` 
          : (subLevel.name || 'Unnamed');
        
        // Add to section
        sections[category].push({
          id: subLevel._id,
          name: subLevel.name || 'Unnamed',
          path,
          status: progressItem?.status || 'pending',
          notes: progressItem?.notes || '',
          photos: progressItem?.photos || [],
          mandatory: subLevel.mandatory !== false
        });
        
        // Process nested sub-levels
        if (subLevel.subLevels && subLevel.subLevels.length > 0) {
          processSubLevels(subLevel.subLevels, path);
        }
      }
    };
    
    processSubLevels(task.inspectionLevel.subLevels);
    
    // Render each section
    for (const [sectionName, items] of Object.entries(sections)) {
      ensureSpace(50);
      
      // Calculate section score
      let sectionTotal = 0;
      let sectionAchieved = 0;
      
      items.forEach(item => {
        if (item.mandatory) {
          sectionTotal += 2;
          
          if (item.status === 'completed' || item.status === 'full_compliance') {
            sectionAchieved += 2;
          } else if (item.status === 'in_progress' || item.status === 'partial_compliance') {
            sectionAchieved += 1;
          } else if (item.status === 'not_applicable') {
            sectionTotal -= 2;
          }
        }
      });
      
      const sectionPercentage = sectionTotal > 0 
        ? Math.round((sectionAchieved / sectionTotal) * 100) 
        : 0;
      
      // Draw section header
      doc.rect(50, yPos, 495, 30)
         .fillAndStroke('#f1f3f5', '#dee2e6');
      
      doc.fontSize(14)
         .fillColor(colors.text)
         .font('Helvetica-Bold')
         .text(`${sectionName} ${items.filter(i => i.mandatory).length > 0 ? `${sectionAchieved / 2} flagged, ${sectionAchieved} / ${sectionTotal} (${sectionPercentage}%)` : ''}`, 70, yPos + 8);
      
      yPos += 40;
      
      // Draw section subitems
      for (const item of items) {
        ensureSpace(80);
        
        // Add subsection if there's a path with multiple parts
        if (item.path.includes(' / ')) {
          const pathParts = item.path.split(' / ');
          const subSection = pathParts.slice(1).join(' / ');
          
          doc.fontSize(12)
             .fillColor(colors.primary)
             .font('Helvetica-Bold')
             .text(`${subSection}`, 70, yPos);
          
          yPos += 20;
        }
        
        // Draw item status
        doc.fontSize(10)
           .fillColor(colors.text)
           .font('Helvetica')
           .text(item.name, 70, yPos);
        
        let statusText = 'Pending';
        let fillColor = '#ffc107';
        let strokeColor = '#e0a800';
        
        if (item.status === 'completed' || item.status === 'full_compliance') {
          statusText = 'Full Compliance';
          fillColor = '#28a745';
          strokeColor = '#218838';
        } else if (item.status === 'in_progress' || item.status === 'partial_compliance') {
          statusText = 'Partial Compliance';
          fillColor = '#ffc107';
          strokeColor = '#e0a800';
        } else if (item.status === 'non_compliance') {
          statusText = 'Non Compliant';
          fillColor = '#dc3545';
          strokeColor = '#c82333';
        } else if (item.status === 'not_applicable') {
          statusText = 'Not Applicable';
          fillColor = '#6c757d';
          strokeColor = '#5a6268';
        }
        
        doc.rect(350, yPos - 3, 180, 20)
           .fillAndStroke(fillColor, strokeColor);
        
        doc.fontSize(10)
           .fillColor('white')
           .font('Helvetica-Bold')
           .text(statusText, 355, yPos);
        
        yPos += 30;
        
        // Add item notes if available
        if (item.notes) {
          const noteLines = doc.heightOfString(item.notes, { width: 450, align: 'left' });
          ensureSpace(noteLines + 20);
          
          doc.fontSize(10)
             .fillColor(colors.text)
             .font('Helvetica')
             .text(item.notes, 70, yPos, { width: 450, align: 'left' });
          
          yPos += noteLines + 10;
        }
        
        // Add photo thumbnails if available
        if (item.photos && item.photos.length > 0) {
          ensureSpace(120);
          
          doc.fontSize(10)
             .fillColor(colors.primary)
             .font('Helvetica-Bold')
             .text('Photos:', 70, yPos);
          
          yPos += 20;
          
          // Hard to include external images, so just mention them
          doc.fontSize(10)
             .fillColor(colors.text)
             .font('Helvetica')
             .text(`${item.photos.length} photos attached`, 70, yPos);
          
          yPos += 30;
        }
        
        // Add separator
        doc.moveTo(50, yPos).lineTo(545, yPos).stroke('#dee2e6');
        yPos += 20;
      }
    }
  }
  
  // Process questionnaire
  if (task.questions && task.questions.length > 0 && task.questionnaireResponses) {
    ensureSpace(50);
    
    doc.rect(50, yPos, 495, 30)
       .fillAndStroke('#f1f3f5', '#dee2e6');
    
    doc.fontSize(14)
       .fillColor(colors.text)
       .font('Helvetica-Bold')
       .text('Questionnaire Responses', 70, yPos + 8);
    
    yPos += 40;
    
    // Group questions by category
    const categories: Record<string, any[]> = {};
    
    task.questions.forEach((question:any) => {
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
    
    // Render each category
    for (const [categoryName, questions] of Object.entries(categories)) {
      ensureSpace(50);
      
      // Calculate category score
      let categoryTotal = 0;
      let categoryAchieved = 0;
      
      questions.forEach(question => {
        if (question.mandatory) {
          categoryTotal += 2;
          
          if (question.response === 'full_compliance' || question.response === 'yes') {
            categoryAchieved += 2;
          } else if (question.response === 'partial_compliance') {
            categoryAchieved += 1;
          } else if (question.response === 'not_applicable' || question.response === 'na') {
            categoryTotal -= 2;
          }
        }
      });
      
      const categoryPercentage = categoryTotal > 0 
        ? Math.round((categoryAchieved / categoryTotal) * 100) 
        : 0;
      
      // Draw category header
      doc.rect(50, yPos, 495, 30)
         .fillAndStroke('#f1f3f5', '#dee2e6');
      
      doc.fontSize(12)
         .fillColor(colors.primary)
         .font('Helvetica-Bold')
         .text(`${categoryName} ${questions.filter(q => q.mandatory).length > 0 ? `${categoryAchieved / 2} flagged, ${categoryAchieved} / ${categoryTotal} (${categoryPercentage}%)` : ''}`, 70, yPos + 8);
      
      yPos += 40;
      
      // Draw questions
      for (const question of questions) {
        ensureSpace(80);
        
        doc.fontSize(10)
           .fillColor(colors.text)
           .font('Helvetica')
           .text(question.text, 70, yPos);
        
        let statusText = 'Pending';
        let fillColor = '#ffc107';
        let strokeColor = '#e0a800';
        
        if (question.response === 'full_compliance' || question.response === 'yes') {
          statusText = 'Full Compliance';
          fillColor = '#28a745';
          strokeColor = '#218838';
        } else if (question.response === 'partial_compliance') {
          statusText = 'Partial Compliance';
          fillColor = '#ffc107';
          strokeColor = '#e0a800';
        } else if (question.response === 'non_compliance' || question.response === 'no') {
          statusText = 'Non Compliant';
          fillColor = '#dc3545';
          strokeColor = '#c82333';
        } else if (question.response === 'not_applicable' || question.response === 'na') {
          statusText = 'Not Applicable';
          fillColor = '#6c757d';
          strokeColor = '#5a6268';
        }
        
        doc.rect(350, yPos - 3, 180, 20)
           .fillAndStroke(fillColor, strokeColor);
        
        doc.fontSize(10)
           .fillColor('white')
           .font('Helvetica-Bold')
           .text(statusText, 355, yPos);
        
        yPos += 30;
        
        // Add comment if available
        if (question.comment) {
          const commentLines = doc.heightOfString(question.comment, { width: 450, align: 'left' });
          ensureSpace(commentLines + 20);
          
          doc.fontSize(10)
             .fillColor(colors.text)
             .font('Helvetica')
             .text(question.comment, 70, yPos, { width: 450, align: 'left' });
          
          yPos += commentLines + 10;
        }
        
        // Add separator
        doc.moveTo(50, yPos).lineTo(545, yPos).stroke('#dee2e6');
        yPos += 20;
      }
    }
  }
  
  // Notes section
  ensureSpace(120);
  doc.rect(50, yPos, 495, 30)
     .fillAndStroke('#f1f3f5', '#dee2e6');
  
  doc.fontSize(14)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text('Notes', 70, yPos + 8);
  
  yPos += 40;
  
  // Inspector notes
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text("Compliance representative's notes (if applicable)", 70, yPos);
  
  yPos += 20;
  
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica')
     .text(task.questionnaireNotes || "Nothing", 70, yPos);
  
  yPos += 30;
  
  // Owner notes
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text(`Notes of the owner of the ${task.inspectionLevel?.type || 'asset'} (if any)`, 70, yPos);
  
  yPos += 20;
  
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica')
     .text("Very good", 70, yPos);
  
  yPos += 40;
  
  // Acknowledgment section
  ensureSpace(250);
  doc.rect(50, yPos, 495, 30)
     .fillAndStroke('#f1f3f5', '#dee2e6');
  
  doc.fontSize(14)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text('Acknowledgment', 70, yPos + 8);
  
  yPos += 40;
  
  // Inspector acknowledgment
  doc.fontSize(12)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text(`Acknowledgement (${task.inspectionLevel?.type || 'Asset'})`, 70, yPos);
  
  yPos += 30;
  
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text('I acknowledge that', 70, yPos);
  
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica')
     .text(typeof task.asset === 'object' 
       ? (task.asset.company || task.asset.displayName || 'Test') 
       : 'Test', 350, yPos);
  
  yPos += 30;
  
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text(`As the owner of the ${task.inspectionLevel?.type || 'asset'} or the official representative:`, 70, yPos);
  
  yPos += 30;
  
  // Checkboxes
  const checkItems = [
    'The correctness of the information agreed above.',
    `Full compliance with the terms of the regulations for the ${task.inspectionLevel?.type || 'asset'}.`,
    'Complete the compliance visit process.'
  ];
  
  for (const item of checkItems) {
    ensureSpace(30);
    
    // Draw checkbox
    doc.rect(70, yPos, 15, 15)
       .stroke('#6c757d');
    
    doc.fontSize(12)
       .fillColor('#6c757d')
       .font('Helvetica-Bold')
       .text('☑', 71, yPos - 1);
    
    doc.fontSize(10)
       .fillColor(colors.text)
       .font('Helvetica')
       .text(item, 95, yPos + 2);
    
    yPos += 25;
  }
  
  yPos += 10;
  
  // Signature fields
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text('Date', 70, yPos);
  
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica')
     .text(new Date().toLocaleDateString(), 350, yPos);
  
  yPos += 30;
  
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text('Signature', 70, yPos);
  
  doc.moveTo(350, yPos + 20).lineTo(500, yPos + 20).stroke('#000');
  
  yPos += 40;
  
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica')
     .text(new Date().toLocaleTimeString(), 350, yPos);
  
  yPos += 40;
  
  // Authority acknowledgment
  ensureSpace(200);
  doc.fontSize(12)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text(`Acknowledgement (Authority)`, 70, yPos);
  
  yPos += 30;
  
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text('I acknowledge that', 70, yPos);
  
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica')
     .text(task.assignedTo?.[0]?.name || 'Inspector', 350, yPos);
  
  yPos += 30;
  
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text('As a representative of the Authority:', 70, yPos);
  
  yPos += 30;
  
  // Checkboxes
  for (const item of checkItems) {
    ensureSpace(30);
    
    // Draw checkbox
    doc.rect(70, yPos, 15, 15)
       .stroke('#6c757d');
    
    doc.fontSize(12)
       .fillColor('#6c757d')
       .font('Helvetica-Bold')
       .text('☑', 71, yPos - 1);
    
    doc.fontSize(10)
       .fillColor(colors.text)
       .font('Helvetica')
       .text(item, 95, yPos + 2);
    
    yPos += 25;
  }
  
  yPos += 10;
  
  // Signature fields
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text('Date', 70, yPos);
  
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica')
     .text(new Date().toLocaleDateString(), 350, yPos);
  
  yPos += 30;
  
  doc.fontSize(10)
     .fillColor(colors.text)
     .font('Helvetica-Bold')
     .text('Signature', 70, yPos);
  
  doc.moveTo(350, yPos + 20).lineTo(500, yPos + 20).stroke('#000');
  
  // Add page numbers
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    
    doc.fontSize(10)
       .fillColor(colors.lightText)
       .text(
         `${i + 1}/${range.count}`,
         50,
         doc.page.height - 50,
         { align: 'right', width: maxWidth }
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
          case 'Partial Compliance':
            scoreValue = 1;
            break;
          case 'non_compliance':
          case 'Non Compliant':
          case 'no':
            scoreValue = 0;
            break;
          case 'not_applicable':
          case 'Not Applicable':
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
          }
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
  
  const allSubLevelIds = getAllSubLevelIds(task.inspectionLevel?.subLevels || []);
  
  let timeSpent = 0;
  if (task.statusHistory && task.statusHistory.length > 0) {
    const startTime = new Date(task.statusHistory[0].timestamp).getTime();
    const endTime = task.status === 'completed' 
      ? new Date(task.statusHistory[task.statusHistory.length - 1].timestamp).getTime()
      : Date.now();
    timeSpent = (endTime - startTime) / (1000 * 60 * 60);
  }

  const subLevelTimeSpent: Record<string, string> = {};
  if (task.progress && Array.isArray(task.progress)) {
    task.progress.forEach((p: any) => {
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

  const userProgress = task.progress && Array.isArray(task.progress) ? task.progress.filter((p: any) => {
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
  if (task.progress && Array.isArray(task.progress)) {
    const findFlaggedSubLevels = (subLevels: any[], parentPath = ''): void => {
      if (!subLevels || !Array.isArray(subLevels)) return;
      
      for (const subLevel of subLevels) {
        if (!subLevel || !subLevel._id) continue;
        
        const currentPath = parentPath ? `${parentPath} > ${subLevel.name || 'Unnamed'}` : (subLevel.name || 'Unnamed');
        const progress:any = task.progress.find((p: any) => 
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
    
    if (task.inspectionLevel && task.inspectionLevel.subLevels) {
      findFlaggedSubLevels(task.inspectionLevel.subLevels);
    }
  }
  
  // Add questionnaire data from the inspection level instead of task
  if (task.inspectionLevel && task.inspectionLevel.questionnaireResponses && task.inspectionLevel.questions) {
    const inspectionLevel = task.inspectionLevel;
    Object.entries(inspectionLevel.questionnaireResponses).forEach(([key, value]) => {
      if (!key.includes('-')) return;
      
      const questionId = key.split('-')[1];
      if (!questionId) return;
      
      const question = inspectionLevel.questions.find((q: any) => 
        q && (
          (q._id && q._id.toString() === questionId) || 
          (q.id && q.id.toString() === questionId)
        )
      );
      
      if (question && (value === 'non_compliance' || value === 'Non Compliant' || value === 'no')) {
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
  }

  const taskObject = task.toObject();
  
  // Add questionnaire data from inspection level to maintain backward compatibility
  if (task.inspectionLevel) {
    // Use type assertion to avoid TypeScript errors
    const taskObjectWithQuestionnaire = taskObject as any;
    taskObjectWithQuestionnaire.questions = task.inspectionLevel.questions || [];
    taskObjectWithQuestionnaire.questionnaireResponses = task.inspectionLevel.questionnaireResponses || {};
    taskObjectWithQuestionnaire.questionnaireCompleted = task.inspectionLevel.questionnaireCompleted || false;
    taskObjectWithQuestionnaire.questionnaireNotes = task.inspectionLevel.questionnaireNotes || '';
  }

  const taskWithMetrics = {
    ...taskObject,
    taskMetrics: {
      timeSpent: Math.round(timeSpent * 10) / 10,
      completionRate: Math.round(userCompletionRate),
      userProgress: userProgress.length,
      totalSubTasks: totalSubLevels,
      subLevelTimeSpent
    },
    flaggedItems
  };

  return taskWithMetrics;
}