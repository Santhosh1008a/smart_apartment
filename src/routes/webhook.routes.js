const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');

// IMPORTANT: Webhook requires the raw string/buffer for HMAC signature verification inside the controller.
// Do NOT place `express.json()` before this route in app.js
router.post(
  '/razorpay',
  express.raw({ type: 'application/json' }),
  webhookController.handleRazorpayWebhook
);

module.exports = router;
