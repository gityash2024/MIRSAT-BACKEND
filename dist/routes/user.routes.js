"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const user_validation_1 = require("../validations/user.validation");
const user_controller_1 = require("../controllers/user.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.protect);
router.get('/profile', user_controller_1.getUserProfile);
router.put('/update-password', (0, validate_middleware_1.validate)(user_validation_1.userValidation.updatePassword), user_controller_1.updatePassword);
router
    .route('/')
    .post((0, validate_middleware_1.validate)(user_validation_1.userValidation.createUser), user_controller_1.createUser)
    .get(user_controller_1.getUsers);
router
    .route('/:id')
    .get(user_controller_1.getUser)
    .put((0, validate_middleware_1.validate)(user_validation_1.userValidation.updateUser), user_controller_1.updateUser)
    .delete(user_controller_1.deleteUser);
exports.default = router;
//# sourceMappingURL=user.routes.js.map