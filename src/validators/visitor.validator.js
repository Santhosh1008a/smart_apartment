const Joi = require('joi');

const createPassSchema = Joi.object({
  visitor_name: Joi.string().trim().min(2).max(255).required(),
  visitor_phone: Joi.string()
    .pattern(/^\d{10}$/)
    .allow('', null)
    .messages({ 'string.pattern.base': 'Visitor phone must be a 10-digit number' }),
  purpose: Joi.string().trim().max(500).allow('', null),
  valid_from: Joi.date().iso().default(() => new Date()),
  is_overnight: Joi.boolean().default(false),
  valid_until: Joi.date().iso().greater(Joi.ref('valid_from')).optional().messages({
    'date.greater': 'valid_until must be after valid_from',
  }),
});

const verifyQRSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'QR token is required',
  }),
});

module.exports = { createPassSchema, verifyQRSchema };
