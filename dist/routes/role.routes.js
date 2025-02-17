"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const role_validation_1 = require("../validations/role.validation");
const role_controller_1 = require("../controllers/role.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.protect);
router
    .route('/')
    .post((0, validate_middleware_1.validate)(role_validation_1.roleValidation.createRole), role_controller_1.createRole)
    .get(role_controller_1.getRoles);
router
    .route('/:id')
    .get(role_controller_1.getRole)
    .put((0, validate_middleware_1.validate)(role_validation_1.roleValidation.updateRole), role_controller_1.updateRole)
    .delete(role_controller_1.deleteRole);
exports.default = router;
//# sourceMappingURL=role.routes.js.map