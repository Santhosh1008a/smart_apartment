const Joi = require('joi');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = Joi.string().pattern(uuidPattern).messages({ 'string.pattern.base': 'must be a valid UUID' });

const createSlotSchema = Joi.object({
  display_name: Joi.string().trim().min(2).max(120).allow('', null),
  parking_area: Joi.string().trim().min(1).max(80).allow('', null),
  slot_label: Joi.string().trim().min(1).max(40).allow('', null),
  building_id: uuid.allow(null),
  parking_type: Joi.string().valid('car', 'bike', 'ev', 'other').default('car'),
  slot_kind: Joi.string().valid('resident', 'visitor', 'accessible', 'staff').default('resident'),
  status: Joi.string().valid('available', 'occupied', 'reserved', 'maintenance', 'inactive').default('available'),
  notes: Joi.string().trim().max(500).allow('', null),
});

const updateSlotSchema = Joi.object({
  display_name: Joi.string().trim().min(2).max(120),
  parking_area: Joi.string().trim().min(1).max(80).allow('', null),
  slot_label: Joi.string().trim().min(1).max(40).allow('', null),
  parking_type: Joi.string().valid('car', 'bike', 'ev', 'other'),
  slot_kind: Joi.string().valid('resident', 'visitor', 'accessible', 'staff'),
  status: Joi.string().valid('available', 'occupied', 'reserved', 'maintenance', 'inactive'),
  notes: Joi.string().trim().max(500).allow('', null),
}).min(1);

const slotQuerySchema = Joi.object({
  status: Joi.string().valid('available', 'occupied', 'assigned', 'reserved', 'maintenance', 'inactive'),
  slot_kind: Joi.string().valid('resident', 'visitor', 'accessible', 'staff'),
});

const createVehicleSchema = Joi.object({
  vehicle_number: Joi.string().trim().min(2).max(20).required(),
  vehicle_type: Joi.string().valid('car', 'bike', 'ev', 'other').default('car'),
  make_model: Joi.string().trim().max(80).allow('', null),
  color: Joi.string().trim().max(40).allow('', null),
});

const assignSlotSchema = Joi.object({
  slot_id: uuid.required(),
  unit_id: uuid.required(),
  vehicle_id: uuid.allow(null),
  notes: Joi.string().trim().max(500).allow('', null),
});

const createRequestSchema = Joi.object({
  vehicle_id: uuid.allow(null),
  request_type: Joi.string().valid('extra_parking', 'visitor_parking', 'slot_change').default('extra_parking'),
  reason: Joi.string().trim().max(1000).allow('', null),
});

const reviewRequestSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected').required(),
  admin_notes: Joi.string().trim().max(1000).allow('', null),
});

const requestQuerySchema = Joi.object({
  status: Joi.string().valid('pending', 'approved', 'rejected', 'cancelled'),
});

const listVehiclesQuerySchema = Joi.object({
  unit_id: uuid,
});

const createVisitorSessionSchema = Joi.object({
  slot_id: uuid.allow(null),
  visitor_pass_id: uuid.allow(null),
  visitor_name: Joi.string().trim().min(2).max(120).required(),
  visitor_phone: Joi.string().trim().max(20).allow('', null),
  vehicle_number: Joi.string().trim().min(2).max(20).required(),
  host_unit_id: uuid.allow(null),
  notes: Joi.string().trim().max(500).allow('', null),
});

const visitorSessionQuerySchema = Joi.object({
  status: Joi.string().valid('active', 'released').default('active'),
});

const verifyVehicleQuerySchema = Joi.object({
  vehicle_number: Joi.string().trim().min(2).max(20).required(),
});

module.exports = {
  createSlotSchema,
  updateSlotSchema,
  slotQuerySchema,
  createVehicleSchema,
  assignSlotSchema,
  createRequestSchema,
  reviewRequestSchema,
  requestQuerySchema,
  listVehiclesQuerySchema,
  createVisitorSessionSchema,
  visitorSessionQuerySchema,
  verifyVehicleQuerySchema,
};
