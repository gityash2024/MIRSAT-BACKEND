import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { assetValidation } from '../validations/asset.validation';
import {
  createAsset,
  getAssets,
  getAsset,
  updateAsset,
  deleteAsset,
  exportAssets
} from '../controllers/asset.controller';

const router = Router();

// All routes require authentication
router.use(protect);

// Get all assets and create a new asset
router
  .route('/')
  .get(getAssets)
  .post(validate(assetValidation.createAsset), createAsset);

// Export assets
router.get('/export', exportAssets);

// Get, update, and delete a specific asset
router
  .route('/:id')
  .get(getAsset)
  .put(validate(assetValidation.updateAsset), updateAsset)
  .delete(deleteAsset);

export default router; 