export const PERMISSIONS = {
    TASK: {
      CREATE: 'create_task',
      EDIT: 'edit_task',
      DELETE: 'delete_task',
      VIEW: 'view_task'
    },
    USER: {
      MANAGE: 'manage_users'
    },
    REPORT: {
      GENERATE: 'generate_reports'
    },
    CALENDAR: {
      MANAGE: 'manage_calendar'
    },
    NOTIFICATION: {
      CONFIGURE: 'configure_notifications'
    }
  } as const;
  
  export const DEFAULT_ROLE_PERMISSIONS = {
    admin: Object.values(PERMISSIONS).flatMap(group => Object.values(group)),
    manager: [
      PERMISSIONS.TASK.CREATE,
      PERMISSIONS.TASK.EDIT,
      PERMISSIONS.TASK.VIEW,
      PERMISSIONS.REPORT.GENERATE,
      PERMISSIONS.CALENDAR.MANAGE
    ],
    inspector: [
      PERMISSIONS.TASK.VIEW,
      PERMISSIONS.TASK.EDIT
    ]
  };
  
  export const hasPermission = (userPermissions: string[], requiredPermission: string): boolean => {
    return userPermissions.includes(requiredPermission);
  };