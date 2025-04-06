// routes/assetType.routes.ts
import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { assetTypeValidation } from '../validations/assetType.validation';
import {
  createAssetType,
  getAssetTypes,
  getAssetType,
  updateAssetType,
  deleteAssetType
} from '../controllers/assetType.controller';

const router = Router();

// All routes require authentication
router.use(protect);

// Get all asset types and create a new asset type
router
  .route('/')
  .get(getAssetTypes)
  .post(validate(assetTypeValidation.createAssetType), createAssetType);

// Get, update, and delete a specific asset type
router
  .route('/:id')
  .get(getAssetType)
  .put(validate(assetTypeValidation.updateAssetType), updateAssetType)
  .delete(deleteAssetType);

export default router;