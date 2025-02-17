"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userValidation = void 0;
const express_validator_1 = require("express-validator");
exports.userValidation = {
    createUser: [
        (0, express_validator_1.body)('name').trim().notEmpty().withMessage('Name is required'),
        (0, express_validator_1.body)('email').isEmail().withMessage('Must be a valid email address'),
        (0, express_validator_1.body)('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long'),
        (0, express_validator_1.body)('role')
            .notEmpty()
            .withMessage('Role is required'),
        (0, express_validator_1.body)('permissions')
            .optional()
            .isArray()
            .withMessage('Permissions must be an array'),
    ],
    updateUser: [
        (0, express_validator_1.body)('name').optional().trim(),
        (0, express_validator_1.body)('email').optional().isEmail().withMessage('Must be a valid email address'),
        (0, express_validator_1.body)('role').optional(),
        (0, express_validator_1.body)('permissions').optional().isArray(),
        (0, express_validator_1.body)('isActive').optional().isBoolean(),
    ],
    updatePassword: [
        (0, express_validator_1.body)('currentPassword')
            .notEmpty()
            .withMessage('Current password is required'),
        (0, express_validator_1.body)('newPassword')
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
//# sourceMappingURL=user.validation.js.map