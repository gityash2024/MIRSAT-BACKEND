// validations/assetType.validation.ts
import Joi from 'joi';

export const assetTypeValidation = {
  createAssetType: Joi.object({
    name: Joi.string().required().trim().messages({
      'any.required': 'Name is required',
      'string.empty': 'Name cannot be empty',
    }),
  }),
  
  updateAssetType: Joi.object({
    name: Joi.string().required().trim().messages({
      'any.required': 'Name is required',
      'string.empty': 'Name cannot be empty',
    }),
  }),
};