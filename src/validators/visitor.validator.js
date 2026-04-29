const Joi = require('joi');

const createPassSchema = Joi.object({
  visitor_name: Joi.string().trim().min(2).max(255).required(),
  visitor_phone: Joi.string()
    .pattern(/^\d{10}$/)
    .allow('', null)
    .messages({ 'string.pattern.base': 'Visitor phone must be a 10-digit number' }),
  purpose: Joi.string().trim().max(500).allow('', null),
  valid_from: Joi.date().iso().default(() => new Date()),
  valid_until: Joi.date().iso().greater(Joi.ref('valid_from')).required().messages({
    'date.greater': 'valid_until must be after valid_from',
    'any.required': 'valid_until is required',
  }),
});

const verifyQRSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'QR token is required',
  }),
});

module.exports = { createPassSchema, verifyQRSchema };
