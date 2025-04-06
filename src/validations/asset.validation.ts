// validations/asset.validation.ts
import Joi from 'joi';

export const assetValidation = {
  createAsset: Joi.object({
    uniqueId: Joi.number().required().messages({
      'any.required': 'Unique ID is required',
      'number.base': 'Unique ID must be a number',
    }),
    type: Joi.string().required().trim().messages({
      'any.required': 'Type is required',
      'string.empty': 'Type cannot be empty',
    }),
    displayName: Joi.string().required().trim().messages({
      'any.required': 'Display name is required',
      'string.empty': 'Display name cannot be empty',
    }),
    city: Joi.string().required().trim().messages({
      'any.required': 'City is required',
      'string.empty': 'City cannot be empty',
    }),
    location: Joi.string().required().trim().messages({
      'any.required': 'Location is required',
      'string.empty': 'Location cannot be empty',
    }),
  }),
  
  updateAsset: Joi.object({
    uniqueId: Joi.number().required().messages({
      'any.required': 'Unique ID is required',
      'number.base': 'Unique ID must be a number',
    }),
    type: Joi.string().required().trim().messages({
      'any.required': 'Type is required',
      'string.empty': 'Type cannot be empty',
    }),
    displayName: Joi.string().required().trim().messages({
      'any.required': 'Display name is required',
      'string.empty': 'Display name cannot be empty',
    }),
    city: Joi.string().required().trim().messages({
      'any.required': 'City is required',
      'string.empty': 'City cannot be empty',
    }),
    location: Joi.string().required().trim().messages({
      'any.required': 'Location is required',
      'string.empty': 'Location cannot be empty',
    }),
  }),
};