
import express from 'express';
import { validate } from '../middleware/validate.middleware';
import {  hasPermission, protect } from '../middleware/auth.middleware';
import * as inspectionController from '../controllers/inspection.controller';
import * as inspectionValidation from '../validations/inspection.validation';

const router = express.Router();

// Create inspection level
// Create inspection level
router.post(
  '/',
  protect,  // Add this first
  hasPermission('create_inspections'),
  inspectionController.createInspectionLevel
);

// Get all inspection levels
router.get(
  '/',
  protect, // Add protect middleware first
  hasPermission('view_inspections'),
  validate(inspectionValidation.queryInspectionLevels),
  inspectionController.getInspectionLevels
);
// Get single inspection level
router.get(
  '/:inspectionId',
  protect,  // Add this first
  hasPermission('view_inspections'),
  validate(inspectionValidation.getInspectionLevel),
  inspectionController.getInspectionLevel
);

// Update inspection level
router.patch(
  '/:inspectionId',
  protect,  // Add this first
  hasPermission('edit_inspections'),
  inspectionController.updateInspectionLevel
);

// Delete inspection level
router.delete(
  '/:inspectionId',
  protect,  // Add this first
  hasPermission('delete_inspections'),
  validate(inspectionValidation.deleteInspectionLevel),
  inspectionController.deleteInspectionLevel
);

// Update sub levelEDIT_INSPECTION
router.patch(
  '/:inspectionId/sub-levels/:subLevelId',
  protect,  // Add this first
  hasPermission('edit_inspections'),
  inspectionController.updateSubLevel
);

// Reorder sub levels
router.post(
  '/:inspectionId/sub-levels/reorder',
  protect,  // Add this first

  hasPermission('edit_inspections'),
  inspectionController.reorderSubLevels
);

export default router;