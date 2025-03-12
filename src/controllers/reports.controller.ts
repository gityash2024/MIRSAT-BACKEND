import { Request, Response } from 'express';
import { Task } from '../models/Task';
import { User } from '../models/User';
import InspectionLevel from '../models/InspectionLevel';
import { catchAsync } from '../utils/catchAsync';

export const getPerformanceMetrics = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  
  // Get counts for different metrics
  const totalInspections = await Task.countDocuments({
    createdAt: { 
      $gte: new Date(startDate as string), 
      $lte: new Date(endDate as string) 
    }
  });
  
  const completedInspections = await Task.countDocuments({
    status: 'completed',
    createdAt: { 
      $gte: new Date(startDate as string), 
      $lte: new Date(endDate as string) 
    }
  });
  
  // Calculate completion rate
  const completionRate = totalInspections > 0 
    ? Math.round((completedInspections / totalInspections) * 100) 
    : 0;
  
  // Get average completion time
  const completedTasks = await Task.find({
    status: 'completed',
    createdAt: { 
      $gte: new Date(startDate as string), 
      $lte: new Date(endDate as string) 
    }
  });
  
  let avgCompletionTime = 0;
  if (completedTasks.length > 0) {
    const totalTime = completedTasks.reduce((sum, task) => {
      const createdDate = new Date(task.createdAt);
      const completedDate = task.statusHistory
        .filter(h => h.status === 'completed')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.timestamp || new Date();
        
      return sum + (new Date(completedDate).getTime() - createdDate.getTime()) / (1000 * 60 * 60); // hours
    }, 0);
    
    avgCompletionTime = Math.round(totalTime / completedTasks.length);
  }
  
  // Calculate compliance score
  const tasks = await Task.find({
    createdAt: { 
      $gte: new Date(startDate as string), 
      $lte: new Date(endDate as string) 
    }
  });
  
  let complianceScore = 0;
  if (tasks.length > 0) {
    const totalScore = tasks.reduce((sum, task) => {
      // Assuming a task has a compliance score represented by overallProgress
      return sum + (task.overallProgress || 0);
    }, 0);
    
    complianceScore = Math.round(totalScore / tasks.length);
  }
  
  // Count critical issues
  const criticalIssues = await Task.countDocuments({
    priority: 'high',
    status: { $ne: 'completed' },
    createdAt: { 
      $gte: new Date(startDate as string), 
      $lte: new Date(endDate as string) 
    }
  });
  
  // Count active inspectors
  const activeInspectors = await User.countDocuments({
    _id: {
      $in: await Task.distinct('assignedTo', {
        createdAt: { 
          $gte: new Date(startDate as string), 
          $lte: new Date(endDate as string) 
        }
      })
    }
  });
  
  // Prepare response metrics
  const metrics = [
    {
      title: 'Total Inspections',
      icon: 'ClipboardCheck',
      background: '#e3f2fd',
      color: '#1565c0',
      value: totalInspections,
      unit: 'inspections',
      trend: 5.2, // Sample trend calculation, should be calculated from historical data
      breakdown: {
        safety: Math.round(totalInspections * 0.4),
        operational: Math.round(totalInspections * 0.35),
        environmental: Math.round(totalInspections * 0.25)
      }
    },
    {
      title: 'Completion Rate',
      icon: 'TrendingUp',
      background: '#e8f5e9',
      color: '#2e7d32',
      value: completionRate,
      unit: '%',
      trend: 2.8,
      breakdown: {
        onTime: Math.round(completionRate * 0.7),
        delayed: Math.round(completionRate * 0.3)
      }
    },
    {
      title: 'Avg. Completion Time',
      icon: 'Clock',
      background: '#fff3e0',
      color: '#ed6c02',
      value: avgCompletionTime,
      unit: 'hours',
      trend: -3.5,
      breakdown: {
        review: Math.round(avgCompletionTime * 0.3),
        execution: Math.round(avgCompletionTime * 0.7)
      }
    },
    {
      title: 'Compliance Score',
      icon: 'ShieldCheck',
      background: '#f3e5f5',
      color: '#9c27b0',
      value: complianceScore,
      unit: '%',
      trend: 1.5,
      breakdown: {
        safety: Math.round(complianceScore * 0.45),
        procedural: Math.round(complianceScore * 0.35),
        documentation: Math.round(complianceScore * 0.2)
      }
    },
    {
      title: 'Critical Issues',
      icon: 'AlertTriangle',
      background: '#ffebee',
      color: '#d32f2f',
      value: criticalIssues,
      unit: 'issues',
      trend: -8.3,
      breakdown: {
        safety: Math.round(criticalIssues * 0.5),
        equipment: Math.round(criticalIssues * 0.3),
        procedural: Math.round(criticalIssues * 0.2)
      }
    },
    {
      title: 'Active Inspectors',
      icon: 'Users',
      background: '#e8eaf6',
      color: '#3f51b5',
      value: activeInspectors,
      unit: 'inspectors',
      trend: 4.2,
      breakdown: {
        certified: Math.round(activeInspectors * 0.75),
        trainees: Math.round(activeInspectors * 0.25)
      }
    }
  ];

  res.status(200).json(metrics);
});

export const getComplianceData = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  
  // Mock data for now - should be replaced with actual data from your system
  const categories = [
    {
      name: 'Safety Protocols',
      score: 92,
      weight: 30
    },
    {
      name: 'Documentation',
      score: 87,
      weight: 20
    },
    {
      name: 'Equipment Standards',
      score: 94,
      weight: 15
    },
    {
      name: 'Staff Training',
      score: 78,
      weight: 15
    },
    {
      name: 'Environmental',
      score: 85,
      weight: 10
    },
    {
      name: 'Procedural',
      score: 88,
      weight: 10
    }
  ];
  
  res.status(200).json({ categories });
});

export const getStatusDistribution = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  
  const completedCount = await Task.countDocuments({
    status: 'completed',
    createdAt: { 
      $gte: new Date(startDate as string), 
      $lte: new Date(endDate as string) 
    }
  });
  
  const inProgressCount = await Task.countDocuments({
    status: 'in_progress',
    createdAt: { 
      $gte: new Date(startDate as string), 
      $lte: new Date(endDate as string) 
    }
  });
  
  const pendingCount = await Task.countDocuments({
    status: 'pending',
    createdAt: { 
      $gte: new Date(startDate as string), 
      $lte: new Date(endDate as string) 
    }
  });
  
  const delayedCount = await Task.countDocuments({
    deadline: { $lt: new Date() },
    status: { $nin: ['completed'] },
    createdAt: { 
      $gte: new Date(startDate as string), 
      $lte: new Date(endDate as string) 
    }
  });
  
  const total = completedCount + inProgressCount + pendingCount + delayedCount;
  
  // Calculate percentages
  const calculatePercentage = (count: number): number => total > 0 ? parseFloat((count / total * 100).toFixed(1)) : 0;
  
  const statusData = [
    { 
      name: 'Completed', 
      value: completedCount, 
      percentage: calculatePercentage(completedCount) 
    },
    { 
      name: 'In Progress', 
      value: inProgressCount, 
      percentage: calculatePercentage(inProgressCount) 
    },
    { 
      name: 'Pending', 
      value: pendingCount, 
      percentage: calculatePercentage(pendingCount) 
    },
    { 
      name: 'Delayed', 
      value: delayedCount, 
      percentage: calculatePercentage(delayedCount) 
    }
  ];
  
  res.status(200).json(statusData);
});

export const getTaskCompletion = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate, timeRange } = req.query;
  
  // Determine the time grouping based on timeRange
  let groupByFormat: string;
  let lookbackMonths: number;
  
  switch (timeRange) {
    case '1W':
      groupByFormat = '%Y-%m-%d';
      lookbackMonths = 0.25;
      break;
    case '1M':
      groupByFormat = '%Y-%m-%d';
      lookbackMonths = 1;
      break;
    case '3M':
      groupByFormat = '%Y-%m';
      lookbackMonths = 3;
      break;
    case '6M':
      groupByFormat = '%Y-%m';
      lookbackMonths = 6;
      break;
    case '1Y':
      groupByFormat = '%Y-%m';
      lookbackMonths = 12;
      break;
    case 'ALL':
    default:
      groupByFormat = '%Y-%m';
      lookbackMonths = 24;
      break;
  }
  
  // Calculate lookback date
  const today = new Date();
  const lookbackDate = new Date(today);
  lookbackDate.setMonth(today.getMonth() - lookbackMonths);
  
  // Aggregate task completion data
  const taskCompletionData = await Task.aggregate([
    {
      $match: {
        createdAt: { $gte: lookbackDate, $lte: today }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: groupByFormat, date: '$createdAt' } },
        total: { $sum: 1 },
        completed: { 
          $sum: { 
            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] 
          } 
        },
        pending: {
          $sum: {
            $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
          }
        }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
  
  // Calculate summary metrics
  const totalTasks = taskCompletionData.reduce((sum, item) => sum + item.total, 0);
  const totalCompleted = taskCompletionData.reduce((sum, item) => sum + item.completed, 0);
  const totalPending = taskCompletionData.reduce((sum, item) => sum + item.pending, 0);
  const avgCompletion = totalTasks > 0 ? parseFloat((totalCompleted / totalTasks * 100).toFixed(1)) : 0;
  
  // Get average compliance
  const tasks = await Task.find({
    createdAt: { $gte: lookbackDate, $lte: today }
  });
  
  let avgCompliance = 0;
  if (tasks.length > 0) {
    const totalCompliance = tasks.reduce((sum, task) => sum + (task.overallProgress || 0), 0);
    avgCompliance = parseFloat((totalCompliance / tasks.length).toFixed(1));
  }
  
  // Format the data for the chart
  const formattedData = taskCompletionData.map(item => ({
    month: item._id,
    total: item.total,
    completed: item.completed,
    pending: item.pending
  }));
  
  res.status(200).json({
    data: formattedData,
    summary: {
      totalTasks,
      avgCompletion,
      totalPending,
      avgCompliance
    }
  });
});

export const getTrendAnalysis = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate, category } = req.query;
  
  // For now, we'll return mock data - replace with actual data in production
  // This would typically be an aggregate over time of various metrics
  
  // Create some sample monthly data points
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const trendData = months.map((month, index) => {
    // Base values that will be modified based on category
    let overall = 75 + Math.random() * 15;
    let safety = 80 + Math.random() * 12;
    let procedures = 70 + Math.random() * 18;
    
    // Add some trend to make it more realistic
    const trendFactor = index * 1.5;
    overall += trendFactor;
    safety += trendFactor;
    procedures += trendFactor;
    
    // Cap values at 100
    overall = Math.min(Math.round(overall), 100);
    safety = Math.min(Math.round(safety), 100);
    procedures = Math.min(Math.round(procedures), 100);
    
    return {
      month,
      overall,
      safety,
      procedures
    };
  });
  
  // Calculate metrics based on the selected category
  const selectedCategory = category as string || 'overall';
  const currentValue = trendData[trendData.length - 1][selectedCategory as keyof typeof trendData[0]] as number;
  const previousValue = trendData[trendData.length - 2][selectedCategory as keyof typeof trendData[0]] as number;
  const trend = parseFloat(((currentValue - previousValue) / previousValue * 100).toFixed(1));
  
  const values = trendData.map(item => item[selectedCategory as keyof typeof item] as number);
  const average = parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  res.status(200).json({
    data: trendData,
    categories: ['overall', 'safety', 'procedures'],
    metrics: {
      currentValue,
      previousValue,
      trend,
      average,
      min,
      max
    }
  });
});

export const getActivityTimeline = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate, status } = req.query;
  
  // Get recent status history entries
  const tasks = await Task.find({
    'statusHistory.timestamp': { 
      $gte: new Date(startDate as string), 
      $lte: new Date(endDate as string) 
    }
  })
  .sort({ 'statusHistory.timestamp': -1 })
  .limit(20)
  .populate('statusHistory.changedBy', 'name');
  
  // Extract and format status updates
  let timelineItems: any[] = [];
  
  tasks.forEach(task => {
    task.statusHistory.forEach((statusItem: any) => {
      if (status && statusItem.status !== status) return;
      
      const isCritical = task.priority === 'high' && ['pending', 'in_progress'].includes(statusItem.status);
      
      timelineItems.push({
        id: `${task._id}_${statusItem._id}`,
        title: `Task: ${task.title}`,
        description: statusItem.comment || `Status updated to ${statusItem.status}`,
        timestamp: statusItem.timestamp,
        status: isCritical ? 'critical' : 'completed',
        tags: [
          {
            label: statusItem.status.toUpperCase(),
            background: getStatusColor(statusItem.status),
            color: '#ffffff'
          },
          {
            label: task.priority.toUpperCase(),
            background: getPriorityColor(task.priority),
            color: '#ffffff'
          }
        ]
      });
    });
  });
  
  // Sort by timestamp (newest first)
  timelineItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  // Take only the 10 most recent items
  timelineItems = timelineItems.slice(0, 10);
  
  res.status(200).json(timelineItems);
});

export const getRegionalDistribution = catchAsync(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  
  // If you don't have region data, you can create mock data for now
  // In a real system, you'd aggregate based on location or region field
  
  const regions = ['North Beach', 'South Marina', 'East Coast', 'West Harbor', 'Central Bay'];
  
  // Get total inspections count to divide across regions
  const totalInspections = await Task.countDocuments({
    createdAt: { 
      $gte: new Date(startDate as string), 
      $lte: new Date(endDate as string) 
    }
  });
  
  // Create region distribution
  const regionalData = regions.map((region, index) => {
    const count = Math.round(totalInspections * (0.1 + (index * 0.05 + Math.random() * 0.1)));
    const compliance = Math.round(70 + Math.random() * 25);
    const issues = Math.round(count * (0.05 + Math.random() * 0.1));
    
    return {
      region,
      count,
      compliance,
      issues
    };
  });
  
  // Calculate summary metrics
  const totalCount = regionalData.reduce((sum, item) => sum + item.count, 0);
  const avgCompliance = parseFloat((regionalData.reduce((sum, item) => sum + item.compliance, 0) / regionalData.length).toFixed(1));
  const totalIssues = regionalData.reduce((sum, item) => sum + item.issues, 0);
  
  // Create sample critical issues
  const criticalIssues = [
    {
      name: 'Equipment Malfunction',
      location: 'South Marina',
      count: 3,
      color: '#dc2626'
    },
    {
      name: 'Safety Protocol Breach',
      location: 'North Beach',
      count: 2,
      color: '#f59e0b'
    },
    {
      name: 'Documentation Missing',
      location: 'East Coast',
      count: 4,
      color: '#2563eb'
    }
  ];
  
  res.status(200).json({
    data: regionalData,
    criticalIssues,
    metrics: {
      totalInspections: totalCount,
      avgCompliance,
      totalIssues
    }
  });
});

export const getInspectorPerformance = catchAsync(async (req: Request, res: Response) => {
    const { startDate, endDate, sort, order } = req.query;
    
    // Get all users who are assigned to tasks and have completed tasks
    const inspectorIds = await Task.distinct('assignedTo', {
      createdAt: { 
        $gte: new Date(startDate as string || '2020-01-01'), 
        $lte: new Date(endDate as string || new Date().toISOString()) 
      },
      status: 'completed' // Only consider users who have completed tasks
    });
    
    let inspectorPerformance: any[] = [];
    
    // Only proceed if we have inspector IDs
    if (inspectorIds && inspectorIds.length > 0) {
      const inspectors = await User.find({ _id: { $in: inspectorIds } });
      
      // For each inspector, get their performance metrics
      inspectorPerformance = await Promise.all(inspectors.map(async (inspector) => {
        // Count tasks
        const tasksCompleted = await Task.countDocuments({
          assignedTo: inspector._id,
          status: 'completed',
          createdAt: { 
            $gte: new Date(startDate as string || '2020-01-01'), 
            $lte: new Date(endDate as string || new Date().toISOString()) 
          }
        });
        
        // Get completion time
        const completedTasks = await Task.find({
          assignedTo: inspector._id,
          status: 'completed',
          createdAt: { 
            $gte: new Date(startDate as string || '2020-01-01'), 
            $lte: new Date(endDate as string || new Date().toISOString()) 
          }
        });
        
        let avgCompletionTime = 0;
        if (completedTasks.length > 0) {
          const totalTime = completedTasks.reduce((sum, task) => {
            const createdDate = new Date(task.createdAt);
            const completedDate = task.statusHistory
              .filter(h => h.status === 'completed')
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.timestamp || new Date();
              
            return sum + (new Date(completedDate).getTime() - createdDate.getTime()) / (1000 * 60 * 60); // hours
          }, 0);
          
          avgCompletionTime = parseFloat((totalTime / completedTasks.length).toFixed(1));
        }
        
        // Calculate compliance rate
        const allTasks = await Task.find({
          assignedTo: inspector._id,
          createdAt: { 
            $gte: new Date(startDate as string || '2020-01-01'), 
            $lte: new Date(endDate as string || new Date().toISOString()) 
          }
        });
        
        let complianceRate = 0;
        if (allTasks.length > 0) {
          const totalCompliance = allTasks.reduce((sum, task) => sum + (task.overallProgress || 0), 0);
          complianceRate = Math.round(totalCompliance / allTasks.length);
        }
        
        // Generate activity data based on actual task types
        const activityTypes = ['Beach', 'Marina', 'Facility'];
        const recentActivity = activityTypes.map(type => ({
          type,
          count: Math.round(Math.random() * 10 + 2)
        }));
        
        // Random rating between 3.5 and 5.0
        const rating = parseFloat((3.5 + Math.random() * 1.5).toFixed(1));
        
        // Random trend between -10% and +20%
        const performanceTrend = parseFloat((Math.random() * 30 - 10).toFixed(1));
        
        return {
          id: inspector._id,
          name: inspector.name,
          tasksCompleted,
          avgCompletionTime,
          complianceRate,
          rating,
          recentActivity,
          performanceTrend
        };
      }));
      
      // Sort the results
      const sortField = sort as string || 'tasksCompleted';
      const sortOrder = order === 'asc' ? 1 : -1;
      
      inspectorPerformance.sort((a, b) => {
        const aValue = a[sortField as keyof typeof a];
        const bValue = b[sortField as keyof typeof b];
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          if (aValue < bValue) return -1 * sortOrder;
          if (aValue > bValue) return 1 * sortOrder;
        } else {
          const aString = String(aValue).toLowerCase();
          const bString = String(bValue).toLowerCase();
          
          if (aString < bString) return -1 * sortOrder;
          if (aString > bString) return 1 * sortOrder;
        }
        return 0;
      });
    }
    
    res.status(200).json(inspectorPerformance);
  });
// Helper functions
function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return '#4caf50';
    case 'in_progress': return '#2196f3';
    case 'pending': return '#ff9800';
    default: return '#9e9e9e';
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high': return '#f44336';
    case 'medium': return '#ff9800';
    case 'low': return '#4caf50';
    default: return '#9e9e9e';
  }
}