"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const user_routes_1 = __importDefault(require("./user.routes"));
const role_routes_1 = __importDefault(require("./role.routes"));
const task_routes_1 = __importDefault(require("./task.routes"));
const notification_routes_1 = __importDefault(require("./notification.routes"));
const inspection_routes_1 = __importDefault(require("./inspection.routes"));
const router = (0, express_1.Router)();
router.use('/auth', auth_routes_1.default);
router.use('/users', user_routes_1.default);
router.use('/roles', role_routes_1.default);
router.use('/tasks', task_routes_1.default);
router.use('/notifications', notification_routes_1.default);
router.use('/inspection', inspection_routes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map