const Joi = require('joi');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createComplexSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).required(),
  address: Joi.string().trim().max(500).allow('', null),
});

const createBuildingSchema = Joi.object({
  complex_id: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'complex_id must be a valid UUID',
  }),
  name: Joi.string().trim().min(1).max(255).required(),
  total_floors: Joi.number().integer().min(1).max(200).default(1),
});

const createUnitSchema = Joi.object({
  building_id: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'building_id must be a valid UUID',
  }),
  unit_number: Joi.string().trim().min(1).max(20).required(),
  floor: Joi.number().integer().min(0).max(200).allow(null),
  type: Joi.string()
    .valid('apartment', 'studio', 'penthouse', 'shop', 'office')
    .default('apartment'),
  status: Joi.string()
    .valid('vacant', 'occupied', 'maintenance')
    .default('vacant'),
});

const updateUnitStatusSchema = Joi.object({
  status: Joi.string()
    .valid('vacant', 'occupied', 'maintenance')
    .required(),
});

const assignUserToUnitSchema = Joi.object({
  user_id: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'user_id must be a valid UUID',
  }),
  relation: Joi.string().valid('owner', 'tenant', 'family').default('owner'),
  moved_in_at: Joi.date().iso().default(() => new Date()),
});

const updateUserRoleSchema = Joi.object({
  role: Joi.string()
    .valid('resident', 'admin', 'super_admin', 'security', 'vendor')
    .optional(),
  is_active: Joi.boolean().optional(),
}).min(1).messages({
  'object.min': 'At least one field (role or is_active) must be provided',
});

const listUsersQuerySchema = Joi.object({
  role: Joi.string()
    .valid('resident', 'admin', 'super_admin', 'security', 'vendor')
    .optional(),
});

module.exports = {
  createComplexSchema,
  createBuildingSchema,
  createUnitSchema,
  updateUnitStatusSchema,
  assignUserToUnitSchema,
  updateUserRoleSchema,
  listUsersQuerySchema,
};
