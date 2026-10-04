const Joi = require('joi');

const registerSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  phone: Joi.string()
    .trim()
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid 10-digit Indian phone number',
      'any.required': 'Phone number is required',
    }),
  password: Joi.string().min(12).max(128).required().messages({
    'string.min': 'Password must be at least 12 characters long',
    'any.required': 'Password is required',
  }),
  full_name: Joi.string().trim().min(2).max(255).required().messages({
    'string.min': 'Name must be at least 2 characters',
    'any.required': 'Full name is required',
  }),
  complex_id: Joi.string().uuid().required().messages({
    'string.guid': 'Please provide a valid complex ID',
    'any.required': 'Complex selection is required',
  }),
  terms_accepted: Joi.boolean().valid(true).required(),
  privacy_acknowledged: Joi.boolean().valid(true).required(),
  // NOTE: 'role' is intentionally excluded — public registration always defaults to 'resident'
});

const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().required(),
});

const updateProfileSchema = Joi.object({
  full_name: Joi.string().trim().min(2).max(255),
  phone: Joi.string().trim().pattern(/^[6-9]\d{9}$/),
  emergency_contact: Joi.string().trim().max(30).allow('', null),
}).min(1);

const changePasswordSchema = Joi.object({
  current_password: Joi.string().min(1).max(128).required(),
  new_password: Joi.string().min(12).max(128).invalid(Joi.ref('current_password')).required(),
});

const refreshSchema = Joi.object({});

module.exports = { registerSchema, loginSchema, refreshSchema, updateProfileSchema, changePasswordSchema };
