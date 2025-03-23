import express from 'express';
import { protect } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import * as questionLibraryController from '../controllers/questionLibrary.controller';
import * as questionLibraryValidation from '../validations/questionLibrary.validation';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

router
  .route('/')
  .get(questionLibraryController.getQuestionLibrary)
  .post(validate(questionLibraryValidation.addQuestionSchema), questionLibraryController.addQuestionToLibrary);

router
  .route('/:id')
  .delete(questionLibraryController.deleteQuestionFromLibrary);

export default router; 