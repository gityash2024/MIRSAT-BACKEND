"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authValidation = void 0;
const express_validator_1 = require("express-validator");
exports.authValidation = {
    register: [
        (0, express_validator_1.body)('name').trim().notEmpty().withMessage('Name is required'),
        (0, express_validator_1.body)('email').isEmail().withMessage('Must be a valid email address'),
        (0, express_validator_1.body)('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long'),
    ],
    login: [
        (0, express_validator_1.body)('email').isEmail().withMessage('Must be a valid email address'),
        (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required'),
    ],
    forgotPassword: [
        (0, express_validator_1.body)('email').isEmail().withMessage('Must be a valid email address'),
    ],
    resetPassword: [
        (0, express_validator_1.body)('token').notEmpty().withMessage('Token is required'),
        (0, express_validator_1.body)('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long'),
    ],
};
//# sourceMappingURL=auth.validation.js.map