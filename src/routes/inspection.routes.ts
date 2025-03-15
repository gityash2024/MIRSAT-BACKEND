import express from 'express';
import { validate } from '../middleware/validate.middleware';
import { hasPermission, protect } from '../middleware/auth.middleware';
import * as inspectionController from '../controllers/inspection.controller';
import * as inspectionValidation from '../validations/inspection.validation';

const router = express.Router();

// Create inspection level
router.post(
  '/',
  protect,
  hasPermission('create_inspections'),
  inspectionController.createInspectionLevel
);

// Get all inspection levels
router.get(
  '/',
  protect,
  hasPermission('view_inspections'),
  validate(inspectionValidation.queryInspectionLevels),
  inspectionController.getInspectionLevels
);

// Get single inspection level
router.get(
  '/:inspectionId',
  protect,
  hasPermission('view_inspections'),
  validate(inspectionValidation.getInspectionLevel),
  inspectionController.getInspectionLevel
);

// Update inspection level
router.patch(
  '/:inspectionId',
  protect,
  hasPermission('edit_inspections'),
  inspectionController.updateInspectionLevel
);

// Delete inspection level
router.delete(
  '/:inspectionId',
  protect,
  hasPermission('delete_inspections'),
  validate(inspectionValidation.deleteInspectionLevel),
  inspectionController.deleteInspectionLevel
);

// Delete sub-level
router.delete(
  '/:inspectionId/sub-levels/:subLevelId',
  protect,
  hasPermission('delete_inspections'),
  inspectionController.deleteInspectionLevel
);

// Update sub level
router.patch(
  '/:inspectionId/sub-levels/:subLevelId',
  protect,
  hasPermission('edit_inspections'),
  inspectionController.updateSubLevel
);
router.get(
  '/export/:format',
  protect,
  hasPermission('view_inspections'),
  inspectionController.exportInspectionLevels
);

// Reorder sub levels
router.post(
  '/:inspectionId/sub-levels/reorder',
  protect,
  hasPermission('edit_inspections'),
  inspectionController.reorderSubLevels
);

export default router;