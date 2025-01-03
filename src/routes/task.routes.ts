import express from 'express';
import { taskController } from '../controllers/task.controller';
import { auth } from '../middleware/auth.middleware';

const router = express.Router();

router.use(auth);

router.get('/', taskController.getTasks);
router.post('/', taskController.createTask);
router.get('/:id', taskController.getTask);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

export default router;