import { body } from 'express-validator';

export const authValidation = {
  register: [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Must be a valid email address'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long'),
    body('role')
      .isIn(['admin', 'manager', 'inspector'])
      .withMessage('Invalid role specified'),
  ],
  
  login: [
    body('email').isEmail().withMessage('Must be a valid email address'),
    body('password').notEmpty().withMessage('Password is required'),
  ],

  forgotPassword: [
    body('email').isEmail().withMessage('Must be a valid email address'),
  ],

  resetPassword: [
    body('token').notEmpty().withMessage('Token is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long'),
  ],
};