import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import roleRoutes from './role.routes';
import taskRoutes from './task.routes';
import notificationRoutes from './notification.routes';
import inspectionRoutes from './inspection.routes';
import userTaskRoutes from './userTask.routes';
import DasboardRoutes from './dashboard.routes';
import ReportsRoutes from './reports.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/tasks', taskRoutes);
router.use('/notifications', notificationRoutes);
router.use('/inspection',inspectionRoutes);
router.use('/user-tasks', userTaskRoutes);
router.use('/dashboard', DasboardRoutes);
router.use('/reports', ReportsRoutes);

export default router;