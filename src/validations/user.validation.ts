import { body } from 'express-validator';

export const userValidation = {
  createUser: [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Must be a valid email address'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long'),
    body('role')
      .notEmpty()
      .withMessage('Role is required'),
    body('permissions')
      .optional()
      .isArray()
      .withMessage('Permissions must be an array'),
  ],

  updateUser: [
    body('name').optional().trim(),
    body('email').optional().isEmail().withMessage('Must be a valid email address'),
    body('role').optional(),
    body('permissions').optional().isArray(),
    body('isActive').optional().isBoolean(),
  ],

  updatePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .custom((value, { req }) => {
        if (value === req.body.currentPassword) {
          throw new Error('New password cannot be the same as current password');
        }
        return true;
      }),
  ],
};