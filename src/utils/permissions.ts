export const PERMISSIONS = {
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
    VIEW: 'view_inspections',           // Use snake_case consistently
    CREATE: 'create_inspections',       // Use plural form
    EDIT: 'edit_inspections',
    DELETE: 'delete_inspections',
    APPROVE: 'approve_inspections'
  },
  QUESTIONNAIRES: {
    VIEW: 'getQuestionnaires',
    MANAGE: 'manageQuestionnaires'
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
} as const;

export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  INSPECTOR: 'inspector',
  USER: 'user'
} as const;

export const DEFAULT_ROLE_PERMISSIONS = {
  [ROLES.SUPERADMIN]: Object.values(PERMISSIONS).flatMap(group => Object.values(group)),
  [ROLES.ADMIN]: [
    PERMISSIONS.DASHBOARD.VIEW,
    PERMISSIONS.DASHBOARD.MANAGE,
    PERMISSIONS.USERS.VIEW,
    PERMISSIONS.USERS.CREATE,
    PERMISSIONS.USERS.EDIT,
    PERMISSIONS.USERS.DELETE,
    PERMISSIONS.ROLES.MANAGE,
    PERMISSIONS.TASKS.VIEW,
    PERMISSIONS.TASKS.CREATE,
    PERMISSIONS.TASKS.EDIT,
    PERMISSIONS.TASKS.DELETE,
    PERMISSIONS.TASKS.ASSIGN,
    PERMISSIONS.TASKS.REVIEW,
    PERMISSIONS.INSPECTIONS.VIEW,
    PERMISSIONS.INSPECTIONS.CREATE,
    PERMISSIONS.INSPECTIONS.EDIT,
    PERMISSIONS.INSPECTIONS.DELETE,
    PERMISSIONS.INSPECTIONS.APPROVE,
    PERMISSIONS.QUESTIONNAIRES.VIEW,
    PERMISSIONS.QUESTIONNAIRES.MANAGE,
    PERMISSIONS.REPORTS.VIEW,
    PERMISSIONS.REPORTS.CREATE,
    PERMISSIONS.REPORTS.EXPORT,
    PERMISSIONS.REPORTS.SHARE,
    PERMISSIONS.CALENDAR.VIEW,
    PERMISSIONS.CALENDAR.MANAGE,
    PERMISSIONS.CALENDAR.SCHEDULE,
    PERMISSIONS.SETTINGS.VIEW,
    PERMISSIONS.SETTINGS.MANAGE,
  ],
  [ROLES.MANAGER]: [
    PERMISSIONS.DASHBOARD.VIEW,
    PERMISSIONS.TASKS.VIEW,
    PERMISSIONS.TASKS.CREATE,
    PERMISSIONS.TASKS.EDIT,
    PERMISSIONS.TASKS.ASSIGN,
    PERMISSIONS.INSPECTIONS.VIEW,
    PERMISSIONS.INSPECTIONS.CREATE,
    PERMISSIONS.REPORTS.VIEW,
    PERMISSIONS.REPORTS.CREATE,
    PERMISSIONS.CALENDAR.VIEW,
    PERMISSIONS.CALENDAR.SCHEDULE
  ],
  [ROLES.INSPECTOR]: [
    PERMISSIONS.DASHBOARD.VIEW,
    PERMISSIONS.TASKS.VIEW,
    PERMISSIONS.TASKS.EDIT,
    PERMISSIONS.INSPECTIONS.VIEW,
    PERMISSIONS.INSPECTIONS.CREATE,
    PERMISSIONS.CALENDAR.VIEW
  ],
  [ROLES.USER]: [
    PERMISSIONS.DASHBOARD.VIEW,
    PERMISSIONS.TASKS.VIEW,
    PERMISSIONS.INSPECTIONS.VIEW,
    PERMISSIONS.CALENDAR.VIEW
  ]
};

export const hasPermission = (userPermissions: string[], requiredPermission: string): boolean => {
  return userPermissions.includes(requiredPermission);
};