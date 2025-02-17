"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOCKET_EVENTS = void 0;
exports.SOCKET_EVENTS = {
    NOTIFICATION: {
        NEW: 'notification:new',
        READ: 'notification:read',
        DELETE: 'notification:delete',
    },
    TASK: {
        CREATE: 'task:create',
        UPDATE: 'task:update',
        DELETE: 'task:delete',
        STATUS_CHANGE: 'task:status_change',
        COMMENT: 'task:comment',
    },
    USER: {
        ONLINE: 'user:online',
        OFFLINE: 'user:offline',
    },
};
//# sourceMappingURL=constants.js.map