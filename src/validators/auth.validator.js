const Joi = require('joi');

const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid 10-digit Indian phone number',
      'any.required': 'Phone number is required',
    }),
  password: Joi.string().min(8).max(128).required().messages({
    'string.min': 'Password must be at least 8 characters long',
    'any.required': 'Password is required',
  }),
  full_name: Joi.string().trim().min(2).max(255).required().messages({
    'string.min': 'Name must be at least 2 characters',
    'any.required': 'Full name is required',
  }),
  // NOTE: 'role' is intentionally excluded — public registration always defaults to 'resident'
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Refresh token is required',
  }),
});

module.exports = { registerSchema, loginSchema, refreshSchema };
