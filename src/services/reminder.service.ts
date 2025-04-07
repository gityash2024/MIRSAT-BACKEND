import cron from 'node-cron';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { notificationService } from './notification.service';
import mongoose from 'mongoose';

class ReminderService {
  private taskDeadlineJob: cron.ScheduledTask;

  constructor() {
    // Schedule task to run at 9:00 AM daily
    this.taskDeadlineJob = cron.schedule('0 9 * * *', () => {
      this.checkTaskDeadlines().catch(err => {
        logger.error('Error in task deadline check job:', err);
      });
    });
  }

  /**
   * Initialize all scheduled jobs
   */
  public initJobs(): void {
    logger.info('Initializing scheduled reminder jobs');
    
    // Start the jobs
    this.taskDeadlineJob.start();
    
    // Run immediately on startup for testing
    if (process.env.NODE_ENV === 'development') {
      logger.info('Running initial deadline check in development mode');
      this.checkTaskDeadlines().catch(err => {
        logger.error('Error in initial task deadline check:', err);
      });
    }
  }

  /**
   * Check for tasks with upcoming deadlines and send notifications
   */
  private async checkTaskDeadlines(): Promise<void> {
    logger.info('Running scheduled task deadline check');
    
    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Find tasks with deadlines approaching in the next 24 hours that are not completed
      const approachingDeadlineTasks = await Task.find({
        deadline: { $gte: now, $lte: tomorrow },
        status: { $ne: 'completed' }
      }).populate('assignedTo');
      
      logger.info(`Found ${approachingDeadlineTasks.length} tasks with upcoming deadlines`);
      
      // Send notifications for each task
      for (const task of approachingDeadlineTasks) {
        // Get the user IDs from assignedTo array
        const userIds = task.assignedTo.map((u: any) => u._id || u);
        
        // Find the actual user documents
        const users = await User.find({ _id: { $in: userIds } });
        
        for (const user of users) {
          // Calculate hours remaining
          const hoursRemaining = Math.round((task.deadline.getTime() - now.getTime()) / (1000 * 60 * 60));
          
          // Send notification
          await notificationService.create({
            recipient: user._id,
            type: 'DEADLINE_REMINDER',
            title: 'Task Deadline Approaching',
            message: `Task "${task.title}" is due in ${hoursRemaining} hours`,
            data: {
              taskId: task._id,
              priority: task.priority,
              deadline: task.deadline,
              link: `/tasks/${task._id}`
            }
          });
        }
      }
      
      logger.info('Task deadline check completed successfully');
    } catch (error) {
      logger.error('Error checking task deadlines:', error);
      throw error;
    }
  }
}

export const reminderService = new ReminderService(); 