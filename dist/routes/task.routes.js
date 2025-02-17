"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const task_validation_1 = require("../validations/task.validation");
const upload_service_1 = require("../services/upload.service");
const task_controller_1 = require("../controllers/task.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.protect);
router
    .route('/')
    .post((0, auth_middleware_1.hasPermission)('create_tasks'), (0, validate_middleware_1.validate)(task_validation_1.taskValidation.createTask), task_controller_1.createTask)
    .get(task_controller_1.getTasks);
router
    .route('/:id')
    .get(task_controller_1.getTask)
    .put((0, auth_middleware_1.hasPermission)('edit_tasks'), (0, validate_middleware_1.validate)(task_validation_1.taskValidation.updateTask), task_controller_1.updateTask);
router.put('/:id/status', (0, validate_middleware_1.validate)(task_validation_1.taskValidation.updateStatus), task_controller_1.updateTaskStatus);
router.post('/:id/comments', (0, validate_middleware_1.validate)(task_validation_1.taskValidation.addComment), task_controller_1.addTaskComment);
router.post('/:id/attachments', upload_service_1.upload.single('file'), task_controller_1.uploadTaskAttachment);
exports.default = router;
//# sourceMappingURL=task.routes.js.map