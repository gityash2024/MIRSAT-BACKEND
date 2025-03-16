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
  
  if (!progressEntry) {
    task.progress.push({
      subLevelId: new mongoose.Types.ObjectId(subLevelId),
      status: status || 'pending',
      startedAt: status === 'in_progress' ? new Date() : undefined,
      completedBy: status === 'completed' ? userId : undefined,
      completedAt: status === 'completed' ? new Date() : undefined,
      notes: notes || '',
      photos: photos || [],
      timeSpent: timeSpent || 0
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
    const completedSubLevels = task.progress.filter((p: any) => 
      p.status === 'completed' && allSubLevelIds.includes(p.subLevelId.toString())
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

  task.questionnaireResponses = responses || {};
  task.questionnaireCompleted = completed || false;
  task.questionnaireNotes = notes || '';
  
  if (task.status === 'pending' && completed) {
    task.status = 'in_progress';
    
    task.statusHistory.push({
      status: 'in_progress',
      changedBy: userId,
      comment: 'Pre-inspection questionnaire completed',
      timestamp: new Date()
    });
  }

  await task.save();

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
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4'
    });
    
    try {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=task-report-${taskId}.pdf`);
      
      doc.pipe(res);
      
      await generateTaskPDFContent(doc, task);
      
      doc.end();
      
      return;
    } catch (err) {
      console.error('PDF generation error:', err);
      if (!res.headersSent) {
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
          status: 'error',
          message: 'Error generating PDF report'
        });
      }
      return;
    }
  } else if (format === 'excel') {
    try {
      const workbook = new ExcelJS.Workbook();
      await generateTaskExcelContent(workbook, task);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=task-report-${taskId}.xlsx`);
      
      const buffer = await workbook.xlsx.writeBuffer();
      res.send(buffer);
      
      return;
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
  
  return;
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

  const drawSectionHeader = (text: string, y: number): number => {
    doc.fontSize(16)
       .fillColor(colors.primary)
       .font('Helvetica-Bold')
       .text(text, 50, y);
    
    doc.moveTo(50, y + 25).lineTo(545, y + 25).strokeColor(colors.border).stroke();
    return y + 40;
  };

  const drawStatusBadge = (status: string, x: number, y: number): number => {
    let color;
    switch(status) {
      case 'completed': color = colors.green; break;
      case 'in_progress': color = colors.amber; break;
      case 'pending': color = colors.amber; break;
      case 'incomplete': color = colors.red; break;
      default: color = colors.gray;
    }
    
    const displayStatus = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
    const textWidth = doc.widthOfString(displayStatus);
    const rectWidth = textWidth + 20;
    
    doc.roundedRect(x, y, rectWidth, 20, 5)
       .fill(color);
    
    doc.fillColor('white')
       .fontSize(10)
       .text(displayStatus, x + 10, y + 5);
    
    return x + rectWidth + 10;
  };

  const calculateOverallScore = (task: any): { score: number, total: number, percentage: number } => {
    if (!task) return { score: 0, total: 0, percentage: 0 };
    
    let totalPoints = 0;
    let earnedPoints = 0;
    let totalCategories = 0;
    
    const sections = ['A', 'B', 'C', 'D', 'E', 'F'];
    
    sections.forEach(section => {
      const sectionProperty = Object.keys(task).find(key => 
        key.startsWith(section) && typeof task[key] === 'object'
      );
      
      if (sectionProperty && task[sectionProperty]) {
        const sectionData = task[sectionProperty];
        
        Object.keys(sectionData).forEach(subSection => {
          if (typeof sectionData[subSection] === 'object') {
            const subSectionData = sectionData[subSection];
            
            if (subSectionData.score !== undefined && 
                subSectionData.maxScore !== undefined) {
              earnedPoints += subSectionData.score;
              totalPoints += subSectionData.maxScore;
              totalCategories++;
            }
          }
        });
      }
    });
    
    if (totalPoints === 0 && task.progress) {
      const completed = task.progress.filter((p: any) => p.status === 'completed').length;
      const total = task.progress.length;
      
      if (total > 0) {
        earnedPoints = completed;
        totalPoints = total;
      }
    }
    
    if (totalPoints === 0 && task.overallProgress !== undefined) {
      return {
        score: task.overallProgress,
        total: 100,
        percentage: task.overallProgress
      };
    }
    
    const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    
    return {
      score: earnedPoints,
      total: totalPoints,
      percentage
    };
  };

  const drawComplianceStatus = (status: string, x: number, y: number): number => {
    let color, text;
    
    switch(status) {
      case 'full_compliance':
      case 'Full Compliance':
        color = colors.green;
        text = 'Full Compliance';
        break;
      case 'partial_compliance':
      case 'Partial Compliance':
        color = colors.amber;
        text = 'Partial Compliance';
        break;
      case 'non_compliance':
      case 'Non Compliant':
        color = colors.red;
        text = 'Non Compliant';
        break;
      case 'not_applicable':
      case 'Not Applicable':
        color = colors.gray;
        text = 'Not Applicable';
        break;
      default:
        color = colors.gray;
        text = status || 'Unknown';
    }
    
    const textWidth = doc.widthOfString(text);
    const rectWidth = textWidth + 20;
    
    doc.roundedRect(x, y, rectWidth, 20, 5)
       .fill(color);
    
    doc.fillColor('white')
       .fontSize(10)
       .text(text, x + 10, y + 5);
    
    return x + rectWidth + 10;
  };

  doc.rect(50, 50, 495, 60)
     .fillAndStroke(colors.background, colors.border);
  
  doc.fontSize(20)
     .fillColor(colors.primary)
     .font('Helvetica-Bold')
     .text('Task Inspection Report', 50, 60, { align: 'center', width: 495 });
  
  const currentDate = new Date().toLocaleString();
  doc.fontSize(10)
     .fillColor(colors.lightText)
     .font('Helvetica')
     .text(`Generated on: ${currentDate}`, 50, 85, { align: 'center', width: 495 });
  
  let yPos = 130;
  
  yPos = drawSectionHeader('Task Information', yPos);
  
  doc.rect(50, yPos, 495, 100)
     .fillAndStroke('white', colors.border);
  
  doc.fontSize(12)
     .fillColor(colors.text)
     .text(`Title: ${task.title || 'N/A'}`, 60, yPos + 10);
  
  doc.text(`Status: `, 60, yPos + 30);
  drawStatusBadge(task.status || 'pending', 110, yPos + 28);
  
  doc.text(`Priority: ${task.priority || 'N/A'}`, 60, yPos + 50);
  doc.text(`Deadline: ${task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}`, 60, yPos + 70);
  
  if (task.location) {
    doc.text(`Location: ${task.location}`, 300, yPos + 10);
  }
  
  const score = calculateOverallScore(task);
  doc.text(`Overall Progress: ${task.overallProgress || score.percentage || 0}%`, 300, yPos + 30);
  
  if (score.total > 0) {
    doc.text(`Score: ${score.score.toFixed(2)} / ${score.total.toFixed(2)} (${score.percentage}%)`, 300, yPos + 50);
  }
  
  yPos += 120;
  
  if (task.inspectionLevel && task.inspectionLevel.subLevels) {
    yPos = drawSectionHeader('Inspection Progress', yPos);
    
    if (task.overallProgress !== undefined) {
      const progressWidth = 495;
      const progressHeight = 20;
      
      doc.rect(50, yPos, progressWidth, progressHeight)
         .fillAndStroke('#f0f0f0', colors.border);
      
      const filledWidth = (task.overallProgress / 100) * progressWidth;
      doc.rect(50, yPos, filledWidth, progressHeight)
         .fill(colors.primary);
      
      doc.fillColor('white')
         .fontSize(10)
         .text(`${task.overallProgress}%`, 50 + (progressWidth / 2) - 15, yPos + 5);
      
      yPos += 30;
    }
    
    const renderSubLevels = (subLevels: any[], depth = 0, maxDepth = 3): void => {
      if (!subLevels || !Array.isArray(subLevels) || depth > maxDepth) return;
      
      for (const subLevel of subLevels) {
        if (!subLevel || !subLevel._id) continue;
        
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }
        
        const status = task.progress?.find((p: any) => 
          p && p.subLevelId && subLevel._id && 
          p.subLevelId.toString() === subLevel._id.toString()
        )?.status || 'pending';
        
        const indent = depth * 15;
        const xPos = 50 + indent;
        
        doc.circle(xPos + 5, yPos + 5, 3)
           .fill(status === 'completed' ? colors.green : colors.amber);
        
        doc.fillColor(colors.text)
           .fontSize(11)
           .font(depth === 0 ? 'Helvetica-Bold' : 'Helvetica')
           .text(subLevel.name || 'Untitled', xPos + 15, yPos);
        
        drawStatusBadge(status, 400, yPos - 5);
        
        yPos += 20;
        
        const progressItem = task.progress?.find((p: any) => 
          p && p.subLevelId && subLevel._id && 
          p.subLevelId.toString() === subLevel._id.toString()
        );
        
        if (progressItem && progressItem.notes) {
          doc.fontSize(9)
             .fillColor(colors.lightText)
             .text('Notes:', xPos + 15, yPos)
             .text(progressItem.notes, xPos + 15, yPos + 12, { 
               width: 460 - indent,
               align: 'left',
             });
          
          yPos += 40;
        }
        
        if (subLevel.subLevels && subLevel.subLevels.length > 0) {
          renderSubLevels(subLevel.subLevels, depth + 1, maxDepth);
        }
      }
    };
    
    renderSubLevels(task.inspectionLevel.subLevels);
  }
  
  if (task.flaggedItems && task.flaggedItems.length > 0) {
    yPos = yPos > 600 ? yPos : 600;
    
    if (yPos > 700) {
      doc.addPage();
      yPos = 50;
    }
    
    yPos = drawSectionHeader('Flagged Items', yPos);
    
    task.flaggedItems.forEach((item: any, index: number) => {
      if (!item) return;
      
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }
      
      doc.fontSize(11)
         .fillColor(colors.text)
         .font('Helvetica-Bold')
         .text(`${index + 1}. ${item.category || 'Item'}: ${item.title || 'Untitled'}`, 60, yPos);
      
      drawComplianceStatus(item.status, 400, yPos - 5);
      
      yPos += 30;
      
      if (item.notes) {
        doc.fontSize(10)
           .fillColor(colors.text)
           .font('Helvetica')
           .text(item.notes, 60, yPos, { width: 485 });
        
        yPos += 30;
      }
    });
  }
  
  if (task.questionnaireCompleted && task.questionnaireResponses) {
    if (yPos > 650) {
      doc.addPage();
      yPos = 50;
    }
    
    yPos = drawSectionHeader('Pre-Inspection Questionnaire', yPos);
    
    const responses = task.questionnaireResponses;
    
    if (responses && Object.keys(responses).length > 0) {
      Object.entries(responses).forEach(([key, value]) => {
        if (!key || !key.includes('-') || !value) return;
        
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }
        
        const questionId = key.split('-')[1];
        if (!questionId) return;
        
        const question = task.questions?.find((q: any) => 
          q && (
            (q._id && q._id.toString() === questionId) || 
            (q.id && q.id.toString() === questionId)
          )
        );
        
        if (question) {
          doc.fontSize(11)
             .fillColor(colors.text)
             .font('Helvetica-Bold')
             .text(question.text || 'Question', 60, yPos);
          
          yPos += 20;
          
          doc.fontSize(10)
             .fillColor(colors.secondary)
             .font('Helvetica')
             .text(`Response: `, 60, yPos);
          
          drawComplianceStatus(value as string, 130, yPos - 5);
          
          yPos += 30;
        }
      });
    } else {
      doc.fontSize(10)
         .fillColor(colors.lightText)
         .text('No questionnaire responses found.', 60, yPos);
      
      yPos += 20;
    }
    
    if (task.questionnaireNotes) {
      doc.fontSize(11)
         .fillColor(colors.text)
         .font('Helvetica-Bold')
         .text('Questionnaire Notes:', 60, yPos);
      
      yPos += 20;
      
      doc.fontSize(10)
         .fillColor(colors.text)
         .font('Helvetica')
         .text(task.questionnaireNotes, 60, yPos, { width: 485 });
      
      yPos += 40;
    }
  }
  
  const range = doc.bufferedPageRange();
  if (range.count > 0) {
    const totalPages = range.count;
    for (let i = 0; i < totalPages; i++) {
      try {
        doc.switchToPage(i);
        doc.fontSize(8)
           .fillColor(colors.lightText)
           .text(
             `Page ${i + 1} of ${totalPages}`,
             50,
             doc.page.height - 50,
             { align: 'center', width: doc.page.width - 100 }
           );
      } catch (err) {
        console.error(`Error adding page number to page ${i}`, err);
      }
    }
  }
}

async function generateTaskExcelContent(workbook: ExcelJS.Workbook, task: any): Promise<void> {
  // Create evaluation sheet
  const evalSheet = workbook.addWorksheet('Evaluation');
  
  // Add headers
  evalSheet.addRow(['Category', 'Subcategory', 'Question', 'Score', 'Max Score', 'Status', 'Notes']);
  
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
  
  // Process inspection items based on Yacht Chartering Operators methodology
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
          fullName
        });
        
        if (level.subLevels && level.subLevels.length > 0) {
          result = [...result, ...flattenLevels(level.subLevels, fullName)];
        }
      });
      
      return result;
    };
    
    const allLevels = flattenLevels(task.inspectionLevel.subLevels || []);
    
    // Add rows for inspection items
    if (task.progress) {
      task.progress.forEach((progress: any) => {
        if (!progress || !progress.subLevelId) return;
        
        const level = allLevels.find(l => l.id === progress.subLevelId.toString());
        
        if (level) {
          let scoreValue = 0;
          let maxScoreValue = 1;
          
          // Scoring according to the methodology
          switch (progress.status) {
            case 'completed': 
              scoreValue = 1; 
              break;
            case 'in_progress': 
              scoreValue = 0.5; 
              break;
            default: 
              scoreValue = 0;
          }
          
          totalScore += scoreValue;
          maxScore += maxScoreValue;
          
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
                  argb: progress.status === 'completed' ? '4CAF50' : 
                        progress.status === 'in_progress' ? 'FFC107' : 'F44336' 
                }
              };
            }
          }
          
          rowIndex++;
        }
      });
    }
  }
  
  // Process questionnaire items
  if (task.questionnaireCompleted && task.questionnaireResponses && task.questions) {
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
        let maxScoreValue = 1;
        
        // Scoring according to the methodology
        switch (value) {
          case 'full_compliance':
          case 'Full Compliance':
          case 'yes':
            scoreValue = 1;
            break;
          case 'partial_compliance': 
          case 'Partial Compliance':
            scoreValue = 0.5;
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
  evalSheet.getColumn(1).width = 15;
  evalSheet.getColumn(2).width = 20;
  evalSheet.getColumn(3).width = 40;
  evalSheet.getColumn(4).width = 10;
  evalSheet.getColumn(5).width = 10;
  evalSheet.getColumn(6).width = 15;
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
  
  // Format columns
  summarySheet.getColumn(1).width = 20;
  summarySheet.getColumn(2).width = 40;
  
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
};


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
    .populate('statusHistory.changedBy', 'name email');
  
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
        const progress = task.progress.find((p: any) => 
          p && p.subLevelId && subLevel._id && 
          p.subLevelId.toString() === subLevel._id.toString()
        );
        
        if (progress && progress.status !== 'completed') {
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
  
  if (task.questionnaireResponses && task.questions) {
    Object.entries(task.questionnaireResponses).forEach(([key, value]) => {
      if (!key.includes('-')) return;
      
      const questionId = key.split('-')[1];
      if (!questionId) return;
      
      const question = task.questions.find((q: any) => 
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

  const taskWithMetrics = {
    ...task.toObject(),
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