const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { paymentLimiter } = require('../middlewares/rateLimiter.middleware');
const { generateInvoiceSchema, createOrderSchema, verifyPaymentSchema } = require('../validators/payment.validator');

const { resolveTenant } = require('../middlewares/tenant.middleware');

// Admin routes for invoices (resolveTenant needed to set req.complexId)
router.post('/admin/invoices', requireAuth, requireRole(['admin', 'super_admin']), resolveTenant, validate(generateInvoiceSchema), paymentController.generateInvoice);

// Resident routes
router.get('/invoices', requireAuth, paymentController.listMyInvoices);
router.post('/payments/create-order', requireAuth, paymentLimiter, validate(createOrderSchema), paymentController.createOrder);
router.post('/payments/verify', requireAuth, paymentLimiter, validate(verifyPaymentSchema), paymentController.verifyPayment);

module.exports = router;
