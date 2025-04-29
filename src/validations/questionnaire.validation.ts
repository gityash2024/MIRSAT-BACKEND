import Joi from 'joi';
import { objectId } from './custom.validation';

export const createQuestionnaire = {
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

export const getQuestionnaires = {
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

export const getQuestionnaire = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
};

export const updateQuestionnaire = {
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

export const deleteQuestionnaire = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
};

export const duplicateQuestionnaire = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId),
  }),
}; 