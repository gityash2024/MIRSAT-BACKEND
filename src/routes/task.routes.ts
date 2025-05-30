import { Router } from 'express';
import { protect, hasPermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { taskValidation } from '../validations/task.validation';
import { upload } from '../services/upload.service';
import {
  createTask,
  getTasks,
  getTask,
  updateTask,
  updateTaskStatus,
  addTaskComment,
  uploadTaskAttachment,
  deleteTask,
} from '../controllers/task.controller';

const router = Router();

router.use(protect);

router
  .route('/')
  .post(
    hasPermission('create_tasks'),
    validate(taskValidation.createTask),
    createTask
  )
  .get(getTasks);

  
// Add this route with the existing routes in router.route('/:id')
router
  .route('/:id')
  .get(getTask)
  .put(
    hasPermission('edit_tasks'),
    validate(taskValidation.updateTask),
    updateTask
  )
  .delete(
    hasPermission('delete_tasks'),
    deleteTask
  );
router.put(
  '/:id/status',
  validate(taskValidation.updateStatus),
  updateTaskStatus
);

router.post(
  '/:id/comments',
  validate(taskValidation.addComment),
  addTaskComment
);

router.post(
  '/:id/attachments',
  upload.single('file'),
  uploadTaskAttachment
);

export default router;