import Joi from 'joi';

export const addQuestionSchema = {
  body: Joi.object().keys({
    text: Joi.string().required().trim(),
    answerType: Joi.string().required().valid(
      'yesno', 
      'text', 
      'number', 
      'select', 
      'multiple_choice', 
      'compliance'
    ),
    options: Joi.array().items(Joi.string()),
    required: Joi.boolean().default(true)
  })
}; 

export const updateQuestionSchema = {
  body: Joi.object().keys({
    text: Joi.string().trim(),
    answerType: Joi.string().valid(
      'yesno', 
      'text', 
      'number', 
      'select', 
      'multiple_choice', 
      'compliance'
    ),
    options: Joi.array().items(Joi.string()),
    required: Joi.boolean()
  })
}; 