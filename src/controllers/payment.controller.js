const Razorpay = require('razorpay');
const crypto = require('crypto');
const { query, getClient } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
});

exports.generateInvoice = async (req, res, next) => {
  try {
    const { unit_id, type, amount, due_date, period_start, period_end } = req.body;
    const admin_id = req.user.id;
    const { complexId } = req;

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
    // Get invoices for the units this user occupies
    const { rows } = await query(`
      SELECT i.*, u.unit_number, b.name as building_name
      FROM invoices i
      JOIN units u ON i.unit_id = u.id
      JOIN buildings b ON u.building_id = b.id
      JOIN user_units uu ON uu.unit_id = u.id
      WHERE uu.user_id = $1 AND uu.moved_out_at IS NULL
      ORDER BY i.due_date DESC
    `, [user_id]);

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.createOrder = async (req, res, next) => {
  let client;
  try {
    const { invoice_id } = req.body;
    const user_id = req.user.id;

    const invoiceCheck = await query('SELECT id, amount, status FROM invoices WHERE id = $1', [invoice_id]);
    if (invoiceCheck.rows.length === 0) return next(new AppError('Invoice not found', 404));

    const invoice = invoiceCheck.rows[0];
    if (['paid', 'waived'].includes(invoice.status)) {
      return next(new AppError('Invoice is already paid or waived', 400));
    }

    // Convert amount to paisa
    const amountInPaisa = Math.round(parseFloat(invoice.amount) * 100);

    const options = {
      amount: amountInPaisa,
      currency: 'INR',
      receipt: `receipt_${invoice_id}`
    };

    let order;
    if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'dummy_key') {
      order = {
        id: 'mock_order_' + crypto.randomBytes(7).toString('hex'),
        amount: options.amount,
        currency: options.currency
      };
    } else {
      order = await instance.orders.create(options);
    }

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
        key_id: process.env.RAZORPAY_KEY_ID
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const user_id = req.user.id;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'dummy_secret')
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return next(new AppError('Payment verification failed', 400));
    }

    // Verify invoice ownership
    const txnCheck = await query(
      `SELECT p.user_id FROM razorpay_txns rt 
       JOIN payments p ON rt.payment_id = p.id 
       WHERE rt.rz_order_id = $1`, 
       [razorpay_order_id]
    );
    if (txnCheck.rows.length === 0 || txnCheck.rows[0].user_id !== user_id) {
       return next(new AppError('Payment not found or unauthorized', 403));
    }

    client = await getClient();
    await client.query('BEGIN');

    // Update razorpay_txn
    const txnUpdate = await client.query(
      `UPDATE razorpay_txns SET rz_payment_id = $1, rz_signature = $2 
       WHERE rz_order_id = $3 RETURNING payment_id`,
      [razorpay_payment_id, razorpay_signature, razorpay_order_id]
    );

    const payment_id = txnUpdate.rows[0].payment_id;

    // Update payments
    const paymentUpdate = await client.query(
      `UPDATE payments SET status = 'captured', paid_at = now() WHERE id = $1 RETURNING invoice_id`,
      [payment_id]
    );

    const invoice_id = paymentUpdate.rows[0].invoice_id;

    // Update invoice
    await client.query(
      `UPDATE invoices SET status = 'paid' WHERE id = $1`,
      [invoice_id]
    );

    await client.query('COMMIT');

    res.status(200).json({ success: true, message: 'Payment verified successfully' });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    next(err);
  } finally {
    if (client) client.release();
  }
};
