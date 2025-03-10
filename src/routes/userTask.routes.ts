import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import {
  getUserTasks,
  getUserDashboardStats,
  updateTaskProgress,
  getTaskDetails,
  startTask
} from '../controllers/UserTaskController';

const router = Router();

// Protect all routes
router.use(protect);

// Get user dashboard statistics
router.get('/dashboard-stats', getUserDashboardStats);

// Get all tasks assigned to the user
router.get('/', getUserTasks);

// Get detailed task information
router.get('/:taskId', getTaskDetails);

// Start a task
router.post('/:taskId/start', startTask);

// Update progress of a specific sub-level in a task
router.post('/:taskId/progress/:subLevelId', updateTaskProgress);

export default router;