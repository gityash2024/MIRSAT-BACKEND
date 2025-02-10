import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { userValidation } from '../validations/user.validation';
import {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  getUserProfile,
  updatePassword,
} from '../controllers/user.controller';

const router = Router();

router.use(protect);

// Profile routes
router.get('/profile', getUserProfile);
router.put('/update-password', validate(userValidation.updatePassword), updatePassword);

// Admin only routes

router
  .route('/')
  .post(validate(userValidation.createUser), createUser)
  .get(getUsers);

router
  .route('/:id')
  .get(getUser)
  .put(validate(userValidation.updateUser), updateUser)
  .delete(deleteUser);

export default router;