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
      logger.error('[CRON] Due reminder job failed:', err);
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

    const defaultAmount = parseFloat(process.env.MONTHLY_MAINTENANCE_AMOUNT) || 2000;

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
            [unit.unit_id, defaultAmount, dueDateStr]
          );
          created++;
        }
      }

      logger.info(`[CRON] Monthly invoice generation completed. Created ${created} invoice(s) for ${units.length} occupied unit(s).`);
    } catch (err) {
      logger.error('[CRON] Monthly invoice generation failed:', err);
    }
  }, {
    timezone: 'Asia/Kolkata',
  });

  logger.info('[CRON] Monthly invoice generation job scheduled (1st of month, 6:00 AM IST).');
}

module.exports = { startDueReminderJob, startMonthlyInvoiceJob };
