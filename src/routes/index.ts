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
import questionLibraryRoutes from './questionLibrary.routes';
import assetRoutes from './asset.routes';
import assetTypeRoutes from './assetType.routes';
import questionnaireRoutes from './questionnaire.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/tasks', taskRoutes);
router.use('/notifications', notificationRoutes);
router.use('/inspection', inspectionRoutes);
router.use('/user-tasks', userTaskRoutes);
router.use('/dashboard', DasboardRoutes);
router.use('/reports', ReportsRoutes);
router.use('/question-library', questionLibraryRoutes);
router.use('/assets', assetRoutes);
router.use('/asset-types', assetTypeRoutes);
router.use('/questionnaires', questionnaireRoutes);

export default router;