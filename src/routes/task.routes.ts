import { Router } from 'express';
import { protect, authorize, hasPermission } from '../middleware/auth.middleware';
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
} from '../controllers/task.controller';

const router = Router();

router.use(protect);

router
  .route('/')
  .post(
    authorize('admin', 'manager'),
    hasPermission('create_task'),
    validate(taskValidation.createTask),
    createTask
  )
  .get(getTasks);

router
  .route('/:id')
  .get(getTask)
  .put(
    authorize('admin', 'manager'),
    hasPermission('edit_task'),
    validate(taskValidation.updateTask),
    updateTask
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