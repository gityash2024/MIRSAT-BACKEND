import { body } from 'express-validator';

export const roleValidation = {
  createRole: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Role name is required')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Role name can only contain letters, numbers and underscores'),
    body('description')
      .trim()
      .notEmpty()
      .withMessage('Description is required'),
    body('permissions')
      .isArray()
      .withMessage('Permissions must be an array')
      .custom((permissions: string[]) => {
        const validPermissions = [
          'create_task',
          'edit_task',
          'delete_task',
          'view_task',
          'manage_users',
          'generate_reports',
          'manage_calendar',
          'configure_notifications'
        ];
        return permissions.every(permission => validPermissions.includes(permission));
      })
      .withMessage('Invalid permissions specified'),
  ],

  updateRole: [
    body('name')
      .optional()
      .trim()
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Role name can only contain letters, numbers and underscores'),
    body('description')
      .optional()
      .trim(),
    body('permissions')
      .optional()
      .isArray()
      .custom((permissions: string[]) => {
        const validPermissions = [
          'create_task',
          'edit_task',
          'delete_task',
          'view_task',
          'manage_users',
          'generate_reports',
          'manage_calendar',
          'configure_notifications'
        ];
        return permissions.every(permission => validPermissions.includes(permission));
      })
      .withMessage('Invalid permissions specified'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
  ],
};