const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const questionnaireValidation = require('../../validations/questionnaire.validation');
const questionnaireController = require('../../controllers/questionnaire.controller');

const router = express.Router();

router
  .route('/')
  .post(auth('manageQuestionnaires'), validate(questionnaireValidation.createQuestionnaire), questionnaireController.createQuestionnaire)
  .get(auth('getQuestionnaires'), validate(questionnaireValidation.getQuestionnaires), questionnaireController.getQuestionnaires);

router
  .route('/:id')
  .get(auth('getQuestionnaires'), validate(questionnaireValidation.getQuestionnaire), questionnaireController.getQuestionnaire)
  .patch(auth('manageQuestionnaires'), validate(questionnaireValidation.updateQuestionnaire), questionnaireController.updateQuestionnaire)
  .delete(auth('manageQuestionnaires'), validate(questionnaireValidation.deleteQuestionnaire), questionnaireController.deleteQuestionnaire);

router
  .route('/:id/duplicate')
  .post(auth('manageQuestionnaires'), validate(questionnaireValidation.duplicateQuestionnaire), questionnaireController.duplicateQuestionnaire);

// Route to import questions from the library
router
  .route('/import-from-library')
  .post(auth('manageQuestionnaires'), questionnaireController.importQuestionsFromLibrary);

module.exports = router; 