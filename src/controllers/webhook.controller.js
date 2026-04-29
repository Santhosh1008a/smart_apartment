const crypto = require('crypto');
const { query } = require('../config/db');

exports.handleRazorpayWebhook = async (req, res, next) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    // Verify signature
    const signature = req.headers['x-razorpay-signature'];
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(req.body) // Note: req.body MUST be raw buffer here
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).send('Invalid signature');
    }

    // Parse payload
    const event = JSON.parse(req.body.toString());

    if (event.event === 'payment.captured') {
      const paymentEntity = event.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;
      
      // Update our database based on the webhook event
      // This is necessary if the frontend fails to call /verify due to network issue or closing the tab
      const txnCheck = await query('SELECT payment_id FROM razorpay_txns WHERE rz_order_id = $1', [orderId]);
      
      if (txnCheck.rows.length > 0) {
        const payment_id = txnCheck.rows[0].payment_id;

        await query('BEGIN');
        
        await query(
          `UPDATE razorpay_txns SET rz_payment_id = $1 WHERE rz_order_id = $2`,
          [paymentId, orderId]
        );

        const paymentUpdate = await query(
          `UPDATE payments SET status = 'captured', paid_at = now() WHERE id = $1 AND status != 'captured' RETURNING invoice_id`,
          [payment_id]
        );

        if (paymentUpdate.rows.length > 0) {
          const invoice_id = paymentUpdate.rows[0].invoice_id;
          await query(
            `UPDATE invoices SET status = 'paid' WHERE id = $1`,
            [invoice_id]
          );
        }

        await query('COMMIT');
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    await query('ROLLBACK');
    console.error('Webhook error:', err);
    res.status(500).send('Webhook Processing Error');
  }
};
