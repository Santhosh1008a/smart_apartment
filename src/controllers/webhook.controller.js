const crypto = require('crypto');
const { query, getClient } = require('../config/db');
const logger = require('../utils/logger');

/**
 * Razorpay Webhook Handler — Idempotent
 * 
 * Critical guarantees:
 * 1. Signature verified via HMAC-SHA256
 * 2. Duplicate webhooks are safely ignored (rz_payment_id UNIQUE constraint)
 * 3. Full DB transaction: razorpay_txns → payments → invoices
 * 4. Uses getClient() for proper transaction isolation
 */
exports.handleRazorpayWebhook = async (req, res) => {
  let client;
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return res.status(500).send('Webhook secret not configured');
    }

    // --- Step 1: Verify HMAC signature ---
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).send('Missing signature header');
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(req.body) // raw buffer from express.raw()
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.warn('Webhook signature verification failed');
      return res.status(400).send('Invalid signature');
    }

    // --- Step 2: Parse event ---
    const event = JSON.parse(req.body.toString());
    logger.info(`Webhook received: ${event.event}`);

    if (event.event !== 'payment.captured') {
      // Acknowledge events we don't handle
      return res.status(200).send('OK');
    }

    const paymentEntity = event.payload.payment.entity;
    const rzOrderId = paymentEntity.order_id;
    const rzPaymentId = paymentEntity.id;

    if (!rzOrderId || !rzPaymentId) {
      logger.warn('Webhook missing order_id or payment_id');
      return res.status(400).send('Missing payment data');
    }

    // --- Step 3: Atomic transaction with FOR UPDATE lock ---
    client = await getClient();
    await client.query('BEGIN');

    // Find the matching order and lock it
    const txnCheck = await client.query(
      `SELECT rt.id AS txn_id, rt.payment_id, rt.rz_payment_id
       FROM razorpay_txns rt
       WHERE rt.rz_order_id = $1 FOR UPDATE`,
      [rzOrderId]
    );

    if (txnCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      logger.warn(`Webhook: No matching order found for ${rzOrderId}`);
      return res.status(200).send('Order not found — ignoring');
    }

    const { txn_id, payment_id, rz_payment_id: existing_payment_id } = txnCheck.rows[0];

    // --- Step 4: Idempotency check inside the lock ---
    if (existing_payment_id) {
      await client.query('ROLLBACK');
      logger.info(`Webhook duplicate ignored (already verified): ${rzPaymentId}`);
      return res.status(200).send('Already processed');
    }

    // 5a. Update razorpay_txns with payment ID
    await client.query(
      `UPDATE razorpay_txns SET rz_payment_id = $1 WHERE id = $2`,
      [rzPaymentId, txn_id]
    );

    // 5b. Update payment status (only if not already captured)
    const paymentUpdate = await client.query(
      `UPDATE payments SET status = 'captured', paid_at = now()
       WHERE id = $1 AND status != 'captured'
       RETURNING invoice_id`,
      [payment_id]
    );

    // 5c. Update invoice status
    if (paymentUpdate.rows.length > 0) {
      const invoice_id = paymentUpdate.rows[0].invoice_id;
      await client.query(
        `UPDATE invoices SET status = 'paid' WHERE id = $1 AND status != 'paid'`,
        [invoice_id]
      );
    }

    await client.query('COMMIT');
    logger.info(`Webhook processed successfully: order=${rzOrderId} payment=${rzPaymentId}`);

    // --- Step 5: Fire-and-forget notification ---
    try {
      const userResult = await query(
        `SELECT p.user_id, p.invoice_id, i.amount, i.type
         FROM payments p JOIN invoices i ON p.invoice_id = i.id
         WHERE p.id = $1`,
        [payment_id]
      );
      if (userResult.rows.length > 0) {
        const { user_id, amount, type } = userResult.rows[0];
        const { notify } = require('../services/notification.service');
        const io = global.__io; // Set in app.js if needed
        notify(io, user_id, 'payment_success',
          'Payment Successful',
          `Your ${type} payment of ₹${amount} has been confirmed.`,
          { payment_id, amount }
        ).catch(() => {});
      }
    } catch (notifyErr) {
      // Never crash the webhook for notification failures
    }

    res.status(200).send('OK');
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (rbErr) { /* ignore */ }
    }
    
    // Handle unique constraint violation gracefully (concurrent webhook delivery)
    if (err.code === '23505') {
      logger.info('Webhook duplicate ignored via unique constraint.');
      return res.status(200).send('Already processed');
    }

    logger.error('Webhook processing error:', err);
    // Return 200 to prevent Razorpay from retrying on our bugs
    // Only return 5xx for truly transient errors
    res.status(500).send('Internal error');
  } finally {
    if (client) client.release();
  }
};
