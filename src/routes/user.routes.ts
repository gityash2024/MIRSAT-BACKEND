// src/routes/user.routes.ts
import express from 'express';
import { userController } from '../controllers/user.controller';
import { auth } from '../middleware/auth.middleware';

const router = express.Router();

router.use(auth);
router.route('/')
  .get(userController.getUsers)
  .post(userController.createUser);

router.route('/:id')
  .get(userController.getUser)
  .put(userController.updateUser)
  .delete(userController.deleteUser);

export default router;