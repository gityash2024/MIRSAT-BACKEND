const Joi = require('joi');
const { objectId } = require('./custom.validation');

// Adapter to use TS validation with old v1 routes
const {
  createQuestionnaire: createQuestionnaireTs,
  getQuestionnaires: getQuestionnairesTs,
  getQuestionnaire: getQuestionnaireTs,
  updateQuestionnaire: updateQuestionnaireTs,
  deleteQuestionnaire: deleteQuestionnaireTs,
  duplicateQuestionnaire: duplicateQuestionnaireTs
} = require('./questionnaire.validation.ts');

const createQuestionnaire = {
  body: Joi.object().keys({
    title: Joi.string().required(),
    description: Joi.string().allow('', null),
    category: Joi.string().valid('safety', 'health', 'environment', 'quality', 'other'),
    status: Joi.string().valid('draft', 'published'),
    questions: Joi.array().items(
      Joi.object().keys({
        text: Joi.string().required(),
        type: Joi.string().valid('text', 'number', 'yesno', 'radio', 'checkbox', 'dropdown', 'compliance', 'file', 'date'),
        required: Joi.boolean(),
        requirementType: Joi.string().valid('mandatory', 'recommended'),
        weight: Joi.number(),
        options: Joi.array().items(
          Joi.object().keys({
            text: Joi.string().required(),
            value: Joi.string(),
            score: Joi.number()
          })
        ),
        scoring: Joi.object().keys({
          enabled: Joi.boolean(),
          max: Joi.number()
        }),
        scores: Joi.object().pattern(Joi.string(), Joi.number())
      })
    ),
    metadata: Joi.object().keys({
      usedInTemplates: Joi.number(),
      lastUpdated: Joi.date()
    })
  }),
};

const getQuestionnaires = {
  query: Joi.object().keys({
    title: Joi.string(),
    category: Joi.string(),
    status: Joi.string(),
    page: Joi.number().integer(),
    limit: Joi.number().integer(),
    sortBy: Joi.string(),
    sortOrder: Joi.string().valid('asc', 'desc'),
  }),
};

const getQuestionnaire = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
};

const updateQuestionnaire = {
  params: Joi.object().keys({
    id: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      title: Joi.string(),
      description: Joi.string().allow('', null),
      category: Joi.string().valid('safety', 'health', 'environment', 'quality', 'other'),
      status: Joi.string().valid('draft', 'published'),
      questions: Joi.array().items(
        Joi.object().keys({
          text: Joi.string().required(),
          type: Joi.string().valid('text', 'number', 'yesno', 'radio', 'checkbox', 'dropdown', 'compliance', 'file', 'date'),
          required: Joi.boolean(),
          requirementType: Joi.string().valid('mandatory', 'recommended'),
          weight: Joi.number(),
          options: Joi.array().items(
            Joi.object().keys({
              text: Joi.string().required(),
              value: Joi.string(),
              score: Joi.number()
            })
          ),
          scoring: Joi.object().keys({
            enabled: Joi.boolean(),
            max: Joi.number()
          }),
          scores: Joi.object().pattern(Joi.string(), Joi.number())
        })
      ),
      metadata: Joi.object().keys({
        usedInTemplates: Joi.number(),
        lastUpdated: Joi.date()
      })
    })
    .min(1),
};

const deleteQuestionnaire = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
};

const duplicateQuestionnaire = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
};

module.exports = {
  createQuestionnaire,
  getQuestionnaires,
  getQuestionnaire,
  updateQuestionnaire,
  deleteQuestionnaire,
  duplicateQuestionnaire
}; 