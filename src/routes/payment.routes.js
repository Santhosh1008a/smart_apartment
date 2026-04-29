const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { paymentLimiter } = require('../middlewares/rateLimiter.middleware');
const { generateInvoiceSchema, createOrderSchema, verifyPaymentSchema } = require('../validators/payment.validator');

router.use(requireAuth);

// Admin routes for invoices
router.post('/admin/invoices', requireRole(['admin', 'super_admin']), validate(generateInvoiceSchema), paymentController.generateInvoice);

// Resident routes
router.get('/invoices', paymentController.listMyInvoices);
router.post('/payments/create-order', paymentLimiter, validate(createOrderSchema), paymentController.createOrder);
router.post('/payments/verify', paymentLimiter, validate(verifyPaymentSchema), paymentController.verifyPayment);

module.exports = router;
