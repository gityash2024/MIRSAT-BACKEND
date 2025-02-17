"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasPermission = exports.DEFAULT_ROLE_PERMISSIONS = exports.ROLES = exports.PERMISSIONS = void 0;
exports.PERMISSIONS = {
    DASHBOARD: {
        VIEW: 'view_dashboard',
        MANAGE: 'manage_dashboard'
    },
    USERS: {
        VIEW: 'view_users',
        CREATE: 'create_users',
        EDIT: 'edit_users',
        DELETE: 'delete_users'
    },
    ROLES: {
        MANAGE: 'manage_roles',
        MANAGE_PERMISSIONS: 'manage_permissions'
    },
    TASKS: {
        VIEW: 'view_tasks',
        CREATE: 'create_tasks',
        EDIT: 'edit_tasks',
        DELETE: 'delete_tasks',
        ASSIGN: 'assign_tasks',
        REVIEW: 'review_tasks'
    },
    INSPECTIONS: {
        VIEW: 'view_inspections',
        CREATE: 'create_inspections',
        EDIT: 'edit_inspections',
        DELETE: 'delete_inspections',
        APPROVE: 'approve_inspections'
    },
    REPORTS: {
        VIEW: 'view_reports',
        CREATE: 'create_reports',
        EXPORT: 'export_reports',
        SHARE: 'share_reports'
    },
    CALENDAR: {
        VIEW: 'view_calendar',
        MANAGE: 'manage_calendar',
        SCHEDULE: 'schedule_events'
    },
    SETTINGS: {
        VIEW: 'view_settings',
        MANAGE: 'manage_settings',
        SYSTEM: 'system_config'
    }
};
exports.ROLES = {
    SUPERADMIN: 'superadmin',
    ADMIN: 'admin',
    MANAGER: 'manager',
    INSPECTOR: 'inspector',
    USER: 'user'
};
exports.DEFAULT_ROLE_PERMISSIONS = {
    [exports.ROLES.SUPERADMIN]: Object.values(exports.PERMISSIONS).flatMap(group => Object.values(group)),
    [exports.ROLES.ADMIN]: [
        exports.PERMISSIONS.DASHBOARD.VIEW,
        exports.PERMISSIONS.DASHBOARD.MANAGE,
        exports.PERMISSIONS.USERS.VIEW,
        exports.PERMISSIONS.USERS.CREATE,
        exports.PERMISSIONS.USERS.EDIT,
        exports.PERMISSIONS.USERS.DELETE,
        exports.PERMISSIONS.ROLES.MANAGE,
        exports.PERMISSIONS.TASKS.VIEW,
        exports.PERMISSIONS.TASKS.CREATE,
        exports.PERMISSIONS.TASKS.EDIT,
        exports.PERMISSIONS.TASKS.DELETE,
        exports.PERMISSIONS.TASKS.ASSIGN,
        exports.PERMISSIONS.TASKS.REVIEW,
        exports.PERMISSIONS.INSPECTIONS.VIEW,
        exports.PERMISSIONS.INSPECTIONS.CREATE,
        exports.PERMISSIONS.INSPECTIONS.EDIT,
        exports.PERMISSIONS.INSPECTIONS.DELETE,
        exports.PERMISSIONS.INSPECTIONS.APPROVE,
        exports.PERMISSIONS.REPORTS.VIEW,
        exports.PERMISSIONS.REPORTS.CREATE,
        exports.PERMISSIONS.REPORTS.EXPORT,
        exports.PERMISSIONS.REPORTS.SHARE,
        exports.PERMISSIONS.CALENDAR.VIEW,
        exports.PERMISSIONS.CALENDAR.MANAGE,
        exports.PERMISSIONS.CALENDAR.SCHEDULE,
        exports.PERMISSIONS.SETTINGS.VIEW,
        exports.PERMISSIONS.SETTINGS.MANAGE,
    ],
    [exports.ROLES.MANAGER]: [
        exports.PERMISSIONS.DASHBOARD.VIEW,
        exports.PERMISSIONS.TASKS.VIEW,
        exports.PERMISSIONS.TASKS.CREATE,
        exports.PERMISSIONS.TASKS.EDIT,
        exports.PERMISSIONS.TASKS.ASSIGN,
        exports.PERMISSIONS.INSPECTIONS.VIEW,
        exports.PERMISSIONS.INSPECTIONS.CREATE,
        exports.PERMISSIONS.REPORTS.VIEW,
        exports.PERMISSIONS.REPORTS.CREATE,
        exports.PERMISSIONS.CALENDAR.VIEW,
        exports.PERMISSIONS.CALENDAR.SCHEDULE
    ],
    [exports.ROLES.INSPECTOR]: [
        exports.PERMISSIONS.DASHBOARD.VIEW,
        exports.PERMISSIONS.TASKS.VIEW,
        exports.PERMISSIONS.TASKS.EDIT,
        exports.PERMISSIONS.INSPECTIONS.VIEW,
        exports.PERMISSIONS.INSPECTIONS.CREATE,
        exports.PERMISSIONS.CALENDAR.VIEW
    ],
    [exports.ROLES.USER]: [
        exports.PERMISSIONS.DASHBOARD.VIEW,
        exports.PERMISSIONS.TASKS.VIEW,
        exports.PERMISSIONS.INSPECTIONS.VIEW,
        exports.PERMISSIONS.CALENDAR.VIEW
    ]
};
const hasPermission = (userPermissions, requiredPermission) => {
    return userPermissions.includes(requiredPermission);
};
exports.hasPermission = hasPermission;
//# sourceMappingURL=permissions.js.map