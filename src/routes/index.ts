
import express from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import taskRoutes from './task.routes';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tasks', taskRoutes);

export default router;