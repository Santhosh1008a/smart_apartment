const Joi = require('joi');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const triggerEmergencySchema = Joi.object({
  unit_id: Joi.string().pattern(uuidPattern).allow(null).messages({
    'string.pattern.base': 'unit_id must be a valid UUID',
  }),
  type: Joi.string().trim().min(1).max(50).required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').default('high'),
  description: Joi.string().trim().max(1000).allow('', null),
  location_lat: Joi.number().min(-90).max(90).allow(null),
  location_lng: Joi.number().min(-180).max(180).allow(null),
});

const assignParkingSchema = Joi.object({
  slot_id: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'slot_id must be a valid UUID',
  }),
  unit_id: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'unit_id must be a valid UUID',
  }),
  vehicle_number: Joi.string().trim().min(1).max(20).required(),
  vehicle_type: Joi.string().valid('car', 'bike', 'ev').allow(null),
});

const raiseVendorRequestSchema = Joi.object({
  unit_id: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'unit_id must be a valid UUID',
  }),
  category: Joi.string()
    .valid('plumber', 'electrician', 'carpenter', 'painter', 'cleaner', 'security', 'other')
    .required(),
  description: Joi.string().trim().max(1000).allow('', null),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
});

const listVendorsQuerySchema = Joi.object({
  category: Joi.string()
    .valid('plumber', 'electrician', 'carpenter', 'painter', 'cleaner', 'security', 'other')
    .optional(),
});

module.exports = {
  triggerEmergencySchema,
  assignParkingSchema,
  raiseVendorRequestSchema,
  listVendorsQuerySchema,
};
