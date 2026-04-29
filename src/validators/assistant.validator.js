const Joi = require('joi');

const assistantPromptSchema = Joi.object({
  message: Joi.string().trim().min(1).max(500).required(),
});

module.exports = {
  assistantPromptSchema,
};
