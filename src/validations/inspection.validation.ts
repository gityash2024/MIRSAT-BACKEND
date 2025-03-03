import Joi from 'joi';
import { objectId } from './custom.validation';

// Create a recursive schema for subLevels
const subLevelSchema = Joi.object({
  _id: Joi.string().custom(objectId).optional(),
  id: Joi.alternatives(Joi.string(), Joi.number()).optional(),
  name: Joi.string().required(),
  description: Joi.string().required(),
  order: Joi.number().required(),
  isCompleted: Joi.boolean().optional(),
  completedAt: Joi.date().optional(),
  completedBy: Joi.string().custom(objectId).optional()
});

// Self-reference to allow nesting
subLevelSchema.append({
  subLevels: Joi.array().items(Joi.link('#subLevelSchema')).optional()
}).id('subLevelSchema');

export const queryInspectionLevels = {
  query: Joi.object().keys({
    search: Joi.string().allow('', null),
    name: Joi.string(),
    type: Joi.array().items(Joi.string().valid('safety', 'environmental', 'operational', 'quality')),
    status: Joi.array().items(Joi.string().valid('active', 'inactive', 'draft', 'archived')),
    priority: Joi.array().items(Joi.string().valid('high', 'medium', 'low')),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    populate: Joi.string()
  })
};

export const getInspectionLevel = {
  params: Joi.object().keys({
    inspectionId: Joi.string().custom(objectId).required()
  })
};

export const createInspectionLevel = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    description: Joi.string().required(),
    type: Joi.string().valid('safety', 'environmental', 'operational', 'quality').required(),
    status: Joi.string().valid('active', 'inactive', 'draft', 'archived'),
    priority: Joi.string().valid('high', 'medium', 'low'),
    subLevels: Joi.array().items(subLevelSchema),
    completionCriteria: Joi.object({
      requiredPhotos: Joi.boolean(),
      requiredNotes: Joi.boolean(),
      requiredSignoff: Joi.boolean()
    })
  })
};

export const updateInspectionLevel = {
  params: Joi.object().keys({
    inspectionId: Joi.string().custom(objectId).required()
  }),
  body: Joi.object().keys({
    _id: Joi.string().custom(objectId),
    name: Joi.string(),
    description: Joi.string(),
    type: Joi.string().valid('safety', 'environmental', 'operational', 'quality'),
    status: Joi.string().valid('active', 'inactive', 'draft', 'archived'),
    priority: Joi.string().valid('high', 'medium', 'low'),
    metrics: Joi.object({
      completedTasks: Joi.number(),
      activeInspectors: Joi.number(),
      avgCompletionTime: Joi.number(),
      complianceRate: Joi.number()
    }),
    subLevels: Joi.array().items(subLevelSchema),
    completionCriteria: Joi.object({
      requiredPhotos: Joi.boolean(),
      requiredNotes: Joi.boolean(),
      requiredSignoff: Joi.boolean()
    }),
    createdBy: Joi.object({
      _id: Joi.string().custom(objectId),
      name: Joi.string(),
      email: Joi.string().email()
    }),
    updatedBy: Joi.object({
      _id: Joi.string().custom(objectId),
      name: Joi.string(),
      email: Joi.string().email()
    }),
    assignedTasks: Joi.array(),
    isActive: Joi.boolean(),
    attachments: Joi.array(),
    comments: Joi.array(),
    statusHistory: Joi.array(),
    createdAt: Joi.date(),
    updatedAt: Joi.date(),
    __v: Joi.number(),
    id: Joi.string().custom(objectId)
  })
};

export const deleteInspectionLevel = {
  params: Joi.object().keys({
    inspectionId: Joi.string().custom(objectId).required()
  })
};

export const updateSubLevel = {
  params: Joi.object().keys({
    inspectionId: Joi.string().custom(objectId).required(),
    subLevelId: Joi.string().custom(objectId).required()
  }),
  body: Joi.object().keys({
    name: Joi.string(),
    description: Joi.string(),
    order: Joi.number(),
    isCompleted: Joi.boolean(),
    completedAt: Joi.date(),
    completedBy: Joi.string().custom(objectId),
    subLevels: Joi.array().items(subLevelSchema)
  })
};

export const reorderSubLevels = {
  params: Joi.object().keys({
    inspectionId: Joi.string().custom(objectId).required()
  }),
  body: Joi.object().keys({
    newOrder: Joi.array().items(Joi.string().custom(objectId)).required()
  })
};