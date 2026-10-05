const Joi = require('joi');

const categories = ['maintenance', 'water_supply', 'electricity', 'safety', 'events', 'general'];
const uuid = Joi.string().pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const noticeFields = {
  title: Joi.string().trim().min(3).max(160),
  message: Joi.string().trim().min(3).max(5000),
  category: Joi.string().valid(...categories),
  priority: Joi.string().valid('normal', 'important'),
  starts_at: Joi.date().iso(),
  ends_at: Joi.date().iso().allow(null),
};

const createNoticeSchema = Joi.object({
  ...noticeFields,
  title: noticeFields.title.required(),
  message: noticeFields.message.required(),
  category: noticeFields.category.required(),
  priority: noticeFields.priority.default('normal'),
  starts_at: noticeFields.starts_at.required(),
});

const updateNoticeSchema = Joi.object(noticeFields).min(1);
const noticeIdParamsSchema = Joi.object({ id: uuid.required() });

module.exports = { createNoticeSchema, updateNoticeSchema, noticeIdParamsSchema };
