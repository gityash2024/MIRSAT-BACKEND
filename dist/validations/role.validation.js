"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleValidation = void 0;
const express_validator_1 = require("express-validator");
exports.roleValidation = {
    createRole: [
        (0, express_validator_1.body)('name')
            .trim()
            .notEmpty()
            .withMessage('Role name is required')
            .matches(/^[a-zA-Z0-9_]+$/)
            .withMessage('Role name can only contain letters, numbers and underscores'),
        (0, express_validator_1.body)('description')
            .trim()
            .notEmpty()
            .withMessage('Description is required'),
        (0, express_validator_1.body)('permissions')
            .isArray()
            .withMessage('Permissions must be an array')
            .custom((permissions) => {
            const validPermissions = [
                'view_dashboard',
                'manage_dashboard',
                'view_users',
                'create_users',
                'edit_users',
                'delete_users',
                'manage_roles',
                'manage_permissions',
                'view_tasks',
                'create_tasks',
                'edit_tasks',
                'delete_tasks',
                'assign_tasks',
                'review_tasks',
                'view_inspections',
                'create_inspections',
                'edit_inspections',
                'delete_inspections',
                'approve_inspections',
                'view_reports',
                'create_reports',
                'export_reports',
                'share_reports',
                'view_calendar',
                'manage_calendar',
                'schedule_events',
                'view_settings',
                'manage_settings',
                'system_config'
            ];
            return permissions.every(permission => validPermissions.includes(permission));
        })
            .withMessage('Invalid permissions specified'),
    ],
    updateRole: [
        (0, express_validator_1.body)('name')
            .optional()
            .trim()
            .matches(/^[a-zA-Z0-9_]+$/)
            .withMessage('Role name can only contain letters, numbers and underscores'),
        (0, express_validator_1.body)('description')
            .optional()
            .trim(),
        (0, express_validator_1.body)('permissions')
            .optional()
            .isArray()
            .custom((permissions) => {
            const validPermissions = [
                'create_tasks',
                'edit_tasks',
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
        (0, express_validator_1.body)('isActive')
            .optional()
            .isBoolean()
            .withMessage('isActive must be a boolean'),
    ],
};
//# sourceMappingURL=role.validation.js.map