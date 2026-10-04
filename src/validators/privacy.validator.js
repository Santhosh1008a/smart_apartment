const Joi = require('joi');

const createPrivacyRequestSchema = Joi.object({
  request_type: Joi.string()
    .valid('access', 'correction', 'deletion', 'withdraw_consent', 'other')
    .required(),
  details: Joi.string().trim().max(2000).allow('', null),
});

const updatePrivacyRequestSchema = Joi.object({
  status: Joi.string().valid('in_review', 'needs_information', 'completed', 'rejected'),
  resolution_note: Joi.string().trim().max(2000).allow('', null),
}).min(1);

const privacyRequestFilterSchema = Joi.object({
  status: Joi.string().valid('received', 'in_review', 'needs_information', 'completed', 'rejected'),
});

module.exports = { createPrivacyRequestSchema, updatePrivacyRequestSchema, privacyRequestFilterSchema };
