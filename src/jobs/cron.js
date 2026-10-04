const cron = require('node-cron');
const { query } = require('../config/db');
const { notify } = require('../services/notification.service');
const logger = require('../utils/logger');

/**
 * Daily Due Reminder — runs every day at 9:00 AM IST.
 *
 * Finds invoices that are:
 *   - upcoming (due in 2 days)
 *   - overdue (past due date)
 * and sends notifications to the residents occupying those units.
 */
function startDueReminderJob(io) {
  // '0 9 * * *' = every day at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    logger.info('[CRON] Running daily due reminder job...');

    try {
      const { rows } = await query(`
        SELECT i.id AS invoice_id, i.amount, i.due_date, i.type,
               u.id AS user_id, u.email,
               c.name AS complex_name
        FROM invoices i
        JOIN units un ON i.unit_id = un.id
        JOIN user_units uu ON uu.unit_id = un.id AND uu.moved_out_at IS NULL
        JOIN users u ON uu.user_id = u.id
        JOIN buildings b ON un.building_id = b.id
        JOIN complexes c ON b.complex_id = c.id
        WHERE i.status IN ('sent', 'draft')
          AND b.complex_id = u.complex_id
          AND (
            i.due_date = CURRENT_DATE + INTERVAL '2 days'
            OR i.due_date < CURRENT_DATE
          )
      `);

      logger.info(`[CRON] Found ${rows.length} reminder(s) to send.`);

      for (const row of rows) {
        const isOverdue = new Date(row.due_date) < new Date();
        const dueDateStr = new Date(row.due_date).toLocaleDateString('en-IN');

        const title = isOverdue
          ? `⚠️ Overdue: ${row.type} bill`
          : `📅 Upcoming: ${row.type} bill`;

        const message = isOverdue
          ? `Your ${row.type} payment of ₹${row.amount} was due on ${dueDateStr}. Please pay immediately to avoid penalties.`
          : `Your ${row.type} bill of ₹${row.amount} is due in 2 days (${dueDateStr}). Please pay before the due date.`;

        await notify(io, row.user_id, 'payment_reminder', title, message, {
          invoice_id: row.invoice_id,
          amount: row.amount,
          due_date: row.due_date,
          is_overdue: isOverdue,
        });
      }

      logger.info(`[CRON] Due reminder job completed. Sent ${rows.length} notification(s).`);
    } catch (err) {
      logger.error('[CRON] Due reminder job failed', { errorName: err.name, errorCode: err.code });
    }
  }, {
    timezone: 'Asia/Kolkata',
  });

  logger.info('[CRON] Daily due reminder job scheduled (9:00 AM IST).');
}

/**
 * Monthly Invoice Generation — runs on the 1st of every month at 6:00 AM IST.
 *
 * Creates a "maintenance" invoice for every occupied unit.
 * The default amount is configurable via MONTHLY_MAINTENANCE_AMOUNT env var.
 */
function startMonthlyInvoiceJob() {
  cron.schedule('0 6 1 * *', async () => {
    logger.info('[CRON] Running monthly invoice generation...');

    if (process.env.ENABLE_UNIFORM_MONTHLY_MAINTENANCE_INVOICES !== 'true') {
      logger.warn('[CRON] Monthly invoice generation skipped: explicit uniform-invoice opt-in is disabled.');
      return;
    }

    const configuredAmount = Number(process.env.MONTHLY_MAINTENANCE_AMOUNT);
    if (!Number.isFinite(configuredAmount) || configuredAmount <= 0) {
      logger.warn('[CRON] Monthly invoice generation skipped: MONTHLY_MAINTENANCE_AMOUNT is not configured with a positive value.');
      return;
    }

    try {
      // Find all occupied units
      const { rows: units } = await query(`
        SELECT un.id AS unit_id, b.complex_id
        FROM units un
        JOIN buildings b ON un.building_id = b.id
        WHERE un.status = 'occupied'
      `);

      const dueDate = new Date();
      dueDate.setDate(15); // Due on the 15th of the month
      const dueDateStr = dueDate.toISOString().split('T')[0];

      let created = 0;
      for (const unit of units) {
        // Check if invoice already exists for this month
        const existing = await query(
          `SELECT id FROM invoices
           WHERE unit_id = $1
             AND type = 'maintenance'
             AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)`,
          [unit.unit_id]
        );

        if (existing.rows.length === 0) {
          await query(
            `INSERT INTO invoices (unit_id, type, amount, due_date, status, created_by)
             VALUES ($1, 'maintenance', $2, $3, 'sent', NULL)`,
            [unit.unit_id, configuredAmount, dueDateStr]
          );
          created++;
        }
      }

      logger.info(`[CRON] Monthly invoice generation completed. Created ${created} invoice(s) for ${units.length} occupied unit(s).`);
    } catch (err) {
      logger.error('[CRON] Monthly invoice generation failed', { errorName: err.name, errorCode: err.code });
    }
  }, {
    timezone: 'Asia/Kolkata',
  });

  logger.info('[CRON] Monthly invoice generation job scheduled (1st of month, 6:00 AM IST).');
}

/**
 * Visitor Cleanup — runs every 5 minutes
 *
 * Marks expired visitors as overdue or expired.
 */
function startVisitorCleanupJob(io) {
  cron.schedule('*/5 * * * *', async () => {
    try {
      // 1. Mark checked_in visitors as overdue if their valid_until has passed
      const overdueRes = await query(`
        UPDATE visitor_passes
        SET status = 'overdue'
        WHERE status = 'checked_in' AND valid_until < NOW()
        RETURNING *
      `);

      for (const row of overdueRes.rows) {
        await notify(io, row.host_user_id, 'visitor_overdue',
          'Visitor Checkout Overdue',
          `Your visitor ${row.visitor_name} is still marked inside beyond the approved visit duration.`,
          { visitor_pass_id: row.id, visitor_name: row.visitor_name }
        ).catch(() => {});
      }

      // 2. Mark pending visitors as expired if their valid_until has passed
      const expiredRes = await query(`
        UPDATE visitor_passes
        SET status = 'expired'
        WHERE status = 'pending' AND valid_until < NOW()
        RETURNING *
      `);

    } catch (err) {
      logger.error('[CRON] Visitor cleanup job failed', { errorName: err.name, errorCode: err.code });
    }
  });

  logger.info('[CRON] Visitor cleanup job scheduled (Every 5 minutes).');
}

module.exports = { startDueReminderJob, startMonthlyInvoiceJob, startVisitorCleanupJob };
