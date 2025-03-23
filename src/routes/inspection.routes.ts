import { Router } from 'express';
import { protect, hasPermission } from '../middleware/auth.middleware';
import {
  createInspectionLevel,
  getInspectionLevels,
  getInspectionLevel,
  updateInspectionLevel,
  deleteInspectionLevel,
  updateSubLevel,
  exportInspectionLevels,
  reorderSubLevels,
  updateInspectionQuestionnaire,
  getInspectionQuestionnaire,
  updateInspectionQuestions
} from '../controllers/inspection.controller';
import { validate } from '../middleware/validate.middleware';
import { upload } from '../services/upload.service';

const router = Router();

router.use(protect);

router.route('/')
  .post(hasPermission('create_inspections'), createInspectionLevel)
  .get(getInspectionLevels);

router.route('/:id')
  .get(getInspectionLevel)
  .put(hasPermission('edit_inspections'), updateInspectionLevel)
  .delete(hasPermission('delete_inspections'), deleteInspectionLevel);

router.route('/export/:format')
  .get(hasPermission('view_inspections'), exportInspectionLevels);

router.route('/:id/sublevels/:sublevelId')
  .put(hasPermission('edit_inspections'), updateSubLevel)
  .delete(hasPermission('edit_inspections'), deleteInspectionLevel);

router.route('/:id/sublevels/reorder')
  .post(hasPermission('edit_inspections'), reorderSubLevels);

// New routes for questionnaire management
router.route('/:id/questionnaire')
  .get(getInspectionQuestionnaire)
  .post(updateInspectionQuestionnaire);

router.route('/:id/questions')
  .post(hasPermission('edit_inspections'), updateInspectionQuestions);

export default router;