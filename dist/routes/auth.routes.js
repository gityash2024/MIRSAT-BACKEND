"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const auth_validation_1 = require("../validations/auth.validation");
const router = (0, express_1.Router)();
router.post('/register', auth_middleware_1.protect, (0, validate_middleware_1.validate)(auth_validation_1.authValidation.register), auth_controller_1.register);
router.post('/login', (0, validate_middleware_1.validate)(auth_validation_1.authValidation.login), auth_controller_1.login);
router.post('/forgot-password', (0, validate_middleware_1.validate)(auth_validation_1.authValidation.forgotPassword), auth_controller_1.forgotPassword);
router.post('/reset-password', (0, validate_middleware_1.validate)(auth_validation_1.authValidation.resetPassword), auth_controller_1.resetPassword);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map