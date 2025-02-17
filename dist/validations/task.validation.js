"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskValidation = void 0;
const express_validator_1 = require("express-validator");
exports.taskValidation = {
    createTask: [
        (0, express_validator_1.body)('title')
            .trim()
            .notEmpty()
            .withMessage('Task title is required')
            .isLength({ max: 200 })
            .withMessage('Title cannot exceed 200 characters'),
        (0, express_validator_1.body)('description')
            .trim()
            .notEmpty()
            .withMessage('Task description is required'),
        (0, express_validator_1.body)('assignedTo')
            .isArray()
            .withMessage('assignedTo must be an array of user IDs')
            .notEmpty()
            .withMessage('At least one user must be assigned'),
        (0, express_validator_1.body)('priority')
            .isIn(['low', 'medium', 'high'])
            .withMessage('Invalid priority level'),
        (0, express_validator_1.body)('deadline')
            .isISO8601()
            .withMessage('Invalid deadline date')
            .custom((value) => {
            if (new Date(value) < new Date()) {
                throw new Error('Deadline cannot be in the past');
            }
            return true;
        }),
        (0, express_validator_1.body)('location')
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Location cannot exceed 500 characters'),
    ],
    updateTask: [
        (0, express_validator_1.body)('title')
            .optional()
            .trim()
            .isLength({ max: 200 })
            .withMessage('Title cannot exceed 200 characters'),
        (0, express_validator_1.body)('description').optional().trim(),
        (0, express_validator_1.body)('assignedTo')
            .optional()
            .isArray()
            .withMessage('assignedTo must be an array of user IDs')
            .notEmpty()
            .withMessage('At least one user must be assigned'),
        (0, express_validator_1.body)('priority')
            .optional()
            .isIn(['low', 'medium', 'high'])
            .withMessage('Invalid priority level'),
        (0, express_validator_1.body)('deadline')
            .optional()
            .isISO8601()
            .withMessage('Invalid deadline date')
            .custom((value) => {
            if (new Date(value) < new Date()) {
                throw new Error('Deadline cannot be in the past');
            }
            return true;
        }),
        (0, express_validator_1.body)('location')
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Location cannot exceed 500 characters'),
    ],
    updateStatus: [
        (0, express_validator_1.body)('status')
            .isIn(['pending', 'in_progress', 'completed', 'incomplete', 'partially_completed'])
            .withMessage('Invalid status'),
        (0, express_validator_1.body)('comment')
            .trim()
            .notEmpty()
            .withMessage('Status update comment is required'),
    ],
    addComment: [
        (0, express_validator_1.body)('content')
            .trim()
            .notEmpty()
            .withMessage('Comment content is required')
            .isLength({ max: 1000 })
            .withMessage('Comment cannot exceed 1000 characters'),
    ],
};
//# sourceMappingURL=task.validation.js.map