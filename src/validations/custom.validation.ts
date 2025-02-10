// src/validations/custom.validation.ts

import { ObjectSchema } from 'joi';

export const objectId = (value: string, helpers: any) => {
  if (!value.match(/^[0-9a-fA-F]{24}$/)) {
    return helpers.message('"{{#label}}" must be a valid mongo id');
  }
  return value;
};

export const validateSchema = (schema: ObjectSchema) => {
  return (data: any) => {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      const message = error.details.map((detail) => detail.message).join(', ');
      return { error: message };
    }
    return { value };
  };
};