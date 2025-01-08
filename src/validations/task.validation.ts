import { body } from 'express-validator';

export const taskValidation = {
  createTask: [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Task title is required')
      .isLength({ max: 200 })
      .withMessage('Title cannot exceed 200 characters'),
    body('description')
      .trim()
      .notEmpty()
      .withMessage('Task description is required'),
    body('assignedTo')
      .isArray()
      .withMessage('assignedTo must be an array of user IDs')
      .notEmpty()
      .withMessage('At least one user must be assigned'),
    body('priority')
      .isIn(['low', 'medium', 'high'])
      .withMessage('Invalid priority level'),
    body('deadline')
      .isISO8601()
      .withMessage('Invalid deadline date')
      .custom((value) => {
        if (new Date(value) < new Date()) {
          throw new Error('Deadline cannot be in the past');
        }
        return true;
      }),
    body('location')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Location cannot exceed 500 characters'),
  ],

  updateTask: [
    body('title')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Title cannot exceed 200 characters'),
    body('description').optional().trim(),
    body('assignedTo')
      .optional()
      .isArray()
      .withMessage('assignedTo must be an array of user IDs')
      .notEmpty()
      .withMessage('At least one user must be assigned'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high'])
      .withMessage('Invalid priority level'),
    body('deadline')
      .optional()
      .isISO8601()
      .withMessage('Invalid deadline date')
      .custom((value) => {
        if (new Date(value) < new Date()) {
          throw new Error('Deadline cannot be in the past');
        }
        return true;
      }),
    body('location')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Location cannot exceed 500 characters'),
  ],

  updateStatus: [
    body('status')
      .isIn(['pending', 'in_progress', 'completed', 'incomplete', 'partially_completed'])
      .withMessage('Invalid status'),
    body('comment')
      .trim()
      .notEmpty()
      .withMessage('Status update comment is required'),
  ],

  addComment: [
    body('content')
      .trim()
      .notEmpty()
      .withMessage('Comment content is required')
      .isLength({ max: 1000 })
      .withMessage('Comment cannot exceed 1000 characters'),
  ],
};