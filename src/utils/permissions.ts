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
} as const;
  
  export const DEFAULT_ROLE_PERMISSIONS = {
    admin: Object.values(PERMISSIONS).flatMap(group => Object.values(group)),
    management: [
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
    inspector: [
      PERMISSIONS.DASHBOARD.VIEW,
      PERMISSIONS.TASKS.VIEW,
      PERMISSIONS.TASKS.EDIT,
      PERMISSIONS.INSPECTIONS.VIEW,
      PERMISSIONS.INSPECTIONS.CREATE,
      PERMISSIONS.CALENDAR.VIEW
    ]
  };
  
  export const hasPermission = (userPermissions: string[], requiredPermission: string): boolean => {
    return userPermissions.includes(requiredPermission);
  };