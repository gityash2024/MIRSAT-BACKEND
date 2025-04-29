import { Router } from 'express';
import { protect, hasPermission } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import * as questionnaireController from '../controllers/questionnaire.controller';
import * as questionnaireValidation from '../validations/questionnaire.validation';

const router = Router();

router
  .route('/')
  .post(
    protect, 
    hasPermission('manageQuestionnaires'), 
    validate(questionnaireValidation.createQuestionnaire), 
    questionnaireController.createQuestionnaire
  )
  .get(
    protect, 
    hasPermission('getQuestionnaires'), 
    validate(questionnaireValidation.getQuestionnaires), 
    questionnaireController.getQuestionnaires
  );

router
  .route('/:id')
  .get(
    protect, 
    hasPermission('getQuestionnaires'), 
    validate(questionnaireValidation.getQuestionnaire), 
    questionnaireController.getQuestionnaire
  )
  .patch(
    protect, 
    hasPermission('manageQuestionnaires'), 
    validate(questionnaireValidation.updateQuestionnaire), 
    questionnaireController.updateQuestionnaire
  )
  .delete(
    protect, 
    hasPermission('manageQuestionnaires'), 
    validate(questionnaireValidation.deleteQuestionnaire), 
    questionnaireController.deleteQuestionnaire
  );

router
  .route('/:id/duplicate')
  .post(
    protect, 
    hasPermission('manageQuestionnaires'), 
    validate(questionnaireValidation.duplicateQuestionnaire), 
    questionnaireController.duplicateQuestionnaire
  );

export default router; 