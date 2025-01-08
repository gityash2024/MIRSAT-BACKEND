import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { roleValidation } from '../validations/role.validation';
import {
  createRole,
  getRoles,
  getRole,
  updateRole,
  deleteRole,
} from '../controllers/role.controller';

const router = Router();

router.use(protect, authorize('admin'));

router
  .route('/')
  .post(validate(roleValidation.createRole), createRole)
  .get(getRoles);

router
  .route('/:id')
  .get(getRole)
  .put(validate(roleValidation.updateRole), updateRole)
  .delete(deleteRole);

export default router;