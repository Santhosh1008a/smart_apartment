const Joi = require('joi');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = Joi.string().pattern(uuidPattern);
const price = Joi.number().precision(2).min(0).max(100000000);
const limit = Joi.number().integer().min(0).max(10000000).allow(null);

const dashboardQuerySchema = Joi.object({
  range: Joi.string().valid('7d', '30d', '3m', '6m', '1y').default('30d'),
  complex_id: uuid.allow(''),
  page: Joi.number().integer().min(1).max(100000).default(1),
  page_size: Joi.number().integer().min(10).max(100).default(10),
  search: Joi.string().trim().max(100).allow(''),
  status: Joi.string().valid('active', 'trial', 'cancelled', 'expired'),
  plan_id: uuid,
  sort: Joi.string().valid('complex', 'plan', 'amount', 'status', 'started', 'renewal').default('started'),
  order: Joi.string().valid('asc', 'desc').default('desc'),
});

const planSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  description: Joi.string().trim().max(1000).allow('', null),
  monthly_price: price.allow(null),
  yearly_price: price.allow(null),
  max_units: limit,
  max_residents: limit,
  max_admins: limit,
  features: Joi.array().items(Joi.string().trim().min(1).max(120)).max(30),
});

const updatePlanSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  description: Joi.string().trim().max(1000).allow('', null),
  monthly_price: price.allow(null),
  yearly_price: price.allow(null),
  max_units: limit,
  max_residents: limit,
  max_admins: limit,
  features: Joi.array().items(Joi.string().trim().min(1).max(120)).max(30),
  is_active: Joi.boolean(),
}).min(1);

const createSubscriptionSchema = Joi.object({
  complex_id: uuid.required(),
  plan_id: uuid.required(),
  billing_cycle: Joi.string().valid('monthly', 'yearly').required(),
  status: Joi.string().valid('active', 'trial').default('trial'),
  amount: price,
  started_at: Joi.date().iso(),
  renewal_at: Joi.date().iso().allow(null),
  notes: Joi.string().trim().max(1000).allow('', null),
});

const updateSubscriptionSchema = Joi.object({
  plan_id: uuid,
  billing_cycle: Joi.string().valid('monthly', 'yearly'),
  status: Joi.string().valid('active', 'trial', 'cancelled', 'expired'),
  amount: price,
  renewal_at: Joi.date().iso(),
  notes: Joi.string().trim().max(1000).allow('', null),
}).min(1);

const reportQuerySchema = Joi.object({
  type: Joi.string().valid('revenue', 'subscriptions', 'usage', 'transactions').required(),
  range: Joi.string().valid('7d', '30d', '3m', '6m', '1y').default('30d'),
  complex_id: uuid.allow(''),
  page: Joi.number().integer().min(1).max(100000).default(1),
  page_size: Joi.number().integer().min(10).max(100).default(10),
  search: Joi.string().trim().max(100).allow(''),
  status: Joi.string().valid('active', 'trial', 'cancelled', 'expired', 'pending', 'captured', 'failed', 'refunded'),
  plan_id: uuid,
  sort: Joi.string().valid('complex', 'plan', 'amount', 'status', 'started', 'renewal').default('started'),
  order: Joi.string().valid('asc', 'desc').default('desc'),
});

module.exports = {
  dashboardQuerySchema,
  planSchema,
  updatePlanSchema,
  createSubscriptionSchema,
  updateSubscriptionSchema,
  reportQuerySchema,
};
