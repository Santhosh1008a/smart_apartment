const Joi = require('joi');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const generateInvoiceSchema = Joi.object({
  unit_id: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'unit_id must be a valid UUID',
  }),
  type: Joi.string()
    .valid('maintenance', 'water', 'electricity', 'parking', 'other')
    .required(),
  amount: Joi.number().positive().precision(2).required().messages({
    'number.positive': 'Amount must be greater than 0',
  }),
  due_date: Joi.date().iso().required().custom((value, helpers) => {
    // Allow today or any future date (ignore time component)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (value < today) {
      return helpers.error('date.min');
    }
    return value;
  }).messages({
    'date.min': 'due_date must be today or in the future',
  }),
  period_start: Joi.date().iso().allow(null),
  period_end: Joi.date().iso().allow(null),
});

const createOrderSchema = Joi.object({
  invoice_id: Joi.string().pattern(uuidPattern).required().messages({
    'string.pattern.base': 'invoice_id must be a valid UUID',
  }),
});

const verifyPaymentSchema = Joi.object({
  razorpay_order_id: Joi.string().required(),
  razorpay_payment_id: Joi.string().required(),
  razorpay_signature: Joi.string().required(),
});

module.exports = { generateInvoiceSchema, createOrderSchema, verifyPaymentSchema };
