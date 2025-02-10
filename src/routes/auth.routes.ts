import { Router } from 'express';
import { register, login, forgotPassword, resetPassword } from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { authValidation } from '../validations/auth.validation';

const router = Router();

router.post('/register', protect, validate(authValidation.register), register);
router.post('/login', validate(authValidation.login), login);
router.post('/forgot-password', validate(authValidation.forgotPassword), forgotPassword);
router.post('/reset-password', validate(authValidation.resetPassword), resetPassword);

export default router;