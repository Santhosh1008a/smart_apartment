const Razorpay = require('razorpay');
const crypto = require('crypto');
const { query, getClient } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');

const razorpayKeyId = process.env.RAZORPAY_KEY_ID?.trim();
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
const instance = razorpayKeyId && razorpayKeySecret
  ? new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret })
  : null;

exports.generateInvoice = async (req, res, next) => {
  try {
    const { unit_id, type, amount, due_date, period_start, period_end } = req.body;
    const admin_id = req.user.id;
    const { complexId } = req;

    if (req.user.role === 'admin' && !complexId) {
      return next(new AppError('Apartment administrators must be assigned to a complex', 403));
    }

    // Verify unit belongs to admin's complex
    if (complexId) {
      const unitCheck = await query(
        `SELECT un.id FROM units un
         JOIN buildings b ON un.building_id = b.id
         WHERE un.id = $1 AND b.complex_id = $2`,
        [unit_id, complexId]
      );
      if (unitCheck.rows.length === 0) {
        return next(new AppError('Unit not found in your complex', 403));
      }
    }

    const { rows } = await query(
      `INSERT INTO invoices (unit_id, type, amount, due_date, status, created_by, period_start, period_end)
       VALUES ($1, $2, $3, $4, 'sent', $5, $6, $7) RETURNING *`,
      [unit_id, type, amount, due_date, admin_id, period_start, period_end]
    );

    // Fire-and-forget: notify residents of this unit
    const { notifyMany } = require('../services/notification.service');
    const io = req.app.get('io');
    query(`SELECT user_id FROM user_units WHERE unit_id = $1 AND moved_out_at IS NULL`, [unit_id])
      .then(result => {
        const userIds = result.rows.map(r => r.user_id);
        if (userIds.length > 0) {
          notifyMany(io, userIds, 'payment_reminder',
            `New ${type} bill: ₹${amount}`,
            `A ${type} invoice of ₹${amount} is due on ${due_date}. Please pay before the due date.`,
            { invoice_id: rows[0].id, amount, due_date }
          );
        }
      }).catch(() => {});

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.listMyInvoices = async (req, res, next) => {
  try {
    const user_id = req.user.id;

    // Step 1: Get all active unit IDs for this user
    const unitRes = await query(
      `SELECT unit_id FROM user_units WHERE user_id = $1 AND moved_out_at IS NULL`,
      [user_id]
    );

    if (unitRes.rows.length === 0) {
      // User not assigned to any unit yet — return empty list
      return res.status(200).json({ success: true, data: [] });
    }

    const unitIds = unitRes.rows.map(r => r.unit_id);

    // Step 2: Fetch all invoices for those units
    const placeholders = unitIds.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await query(
      `SELECT i.*, u.unit_number, b.name as building_name
       FROM invoices i
       JOIN units u ON i.unit_id = u.id
       JOIN buildings b ON u.building_id = b.id
       WHERE i.unit_id IN (${placeholders})
       ORDER BY i.due_date DESC`,
      unitIds
    );

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.createOrder = async (req, res, next) => {
  let client;
  try {
    if (!instance) {
      return next(new AppError('Payments are unavailable because the payment provider is not configured', 503));
    }

    const { invoice_id } = req.body;
    const user_id = req.user.id;
    const complexId = req.user.complex_id;

    // Verify invoice exists AND belongs to user's complex
    const invoiceCheck = await query(
      `SELECT i.id, i.amount, i.status
       FROM invoices i
       JOIN units un ON i.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       JOIN user_units uu ON uu.unit_id = un.id AND uu.moved_out_at IS NULL
       WHERE i.id = $1 AND uu.user_id = $2 AND b.complex_id = $3`,
      [invoice_id, user_id, complexId]
    );
    if (invoiceCheck.rows.length === 0) return next(new AppError('Invoice not found or not yours', 404));

    const invoice = invoiceCheck.rows[0];
    if (['paid', 'waived'].includes(invoice.status)) {
      return next(new AppError('Invoice is already paid or waived', 400));
    }

    // Convert amount to paisa
    const amountInPaisa = Math.round(parseFloat(invoice.amount) * 100);

    const options = {
      amount: amountInPaisa,
      currency: 'INR',
      receipt: invoice_id.substring(0, 40)
    };

    const order = await instance.orders.create(options);

    client = await getClient();
    await client.query('BEGIN');

    const paymentResult = await client.query(
      `INSERT INTO payments (invoice_id, user_id, amount, method, status)
       VALUES ($1, $2, $3, 'razorpay', 'initiated') RETURNING id`,
      [invoice_id, user_id, invoice.amount]
    );

    await client.query(
      `INSERT INTO razorpay_txns (payment_id, rz_order_id)
       VALUES ($1, $2)`,
      [paymentResult.rows[0].id, order.id]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: razorpayKeyId
      }
    });

  } catch (err) {
    if (client) await client.query('ROLLBACK');
    
    next(err);
  } finally {
    if (client) client.release();
  }
};

exports.verifyPayment = async (req, res, next) => {
  let client;
  try {
    if (!razorpayKeySecret) {
      return next(new AppError('Payments are unavailable because the payment provider is not configured', 503));
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const user_id = req.user.id;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac('sha256', razorpayKeySecret)
      .update(body.toString())
      .digest('hex');

    const providedSignature = Buffer.from(razorpay_signature, 'hex');
    const expectedSignatureBuffer = Buffer.from(expectedSignature, 'hex');
    const isAuthentic = providedSignature.length === expectedSignatureBuffer.length
      && crypto.timingSafeEqual(providedSignature, expectedSignatureBuffer);

    if (!isAuthentic) {
      return next(new AppError('Payment verification failed', 400));
    }

    client = await getClient();
    await client.query('BEGIN');

    // 1. Lock the transaction row to prevent race conditions
    const txnCheck = await client.query(
      `SELECT rt.id, rt.rz_payment_id, p.user_id, p.id as payment_id
       FROM razorpay_txns rt 
       JOIN payments p ON rt.payment_id = p.id 
       WHERE rt.rz_order_id = $1 FOR UPDATE`, 
       [razorpay_order_id]
    );

    if (txnCheck.rows.length === 0) {
       await client.query('ROLLBACK');
       return next(new AppError('Payment not found', 404));
    }

    if (txnCheck.rows[0].user_id !== user_id) {
       await client.query('ROLLBACK');
       return next(new AppError('Payment not found or unauthorized', 403));
    }

    // 2. Idempotency check inside the lock
    if (txnCheck.rows[0].rz_payment_id) {
       await client.query('ROLLBACK');
       return res.status(200).json({ success: true, message: 'Payment already verified' });
    }

    const payment_id = txnCheck.rows[0].payment_id;

    // 3. Update razorpay_txn
    await client.query(
      `UPDATE razorpay_txns SET rz_payment_id = $1, rz_signature = $2 
       WHERE rz_order_id = $3`,
      [razorpay_payment_id, razorpay_signature, razorpay_order_id]
    );

    // 4. Update payments
    const paymentUpdate = await client.query(
      `UPDATE payments SET status = 'captured', paid_at = now() WHERE id = $1 RETURNING invoice_id`,
      [payment_id]
    );

    const invoice_id = paymentUpdate.rows[0].invoice_id;

    // 5. Update invoice
    await client.query(
      `UPDATE invoices SET status = 'paid' WHERE id = $1`,
      [invoice_id]
    );

    await client.query('COMMIT');

    res.status(200).json({ success: true, message: 'Payment verified successfully' });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (rbErr) { /* ignore */ }
    }
    // Gracefully handle duplicate payment ID constraint
    if (err.code === '23505') {
       return res.status(200).json({ success: true, message: 'Payment already verified (concurrent)' });
    }
    next(err);
  } finally {
    if (client) client.release();
  }
};
