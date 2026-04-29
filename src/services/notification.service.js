const { query } = require('../config/db');
const { sendEmail, sendSMS } = require('../utils/notifications');
const logger = require('../utils/logger');

/**
 * Central notification service.
 * Inserts a notification into the DB, emits via Socket.IO, and optionally sends email/SMS.
 *
 * @param {object} io - Socket.IO server instance (can be null)
 * @param {string} userId - target user UUID
 * @param {string} type - 'payment_reminder' | 'visitor_arrival' | 'emergency_alert'
 * @param {string} title - notification headline
 * @param {string} message - notification body
 * @param {object} [metadata] - optional JSON metadata
 */
async function notify(io, userId, type, title, message, metadata = {}) {
  try {
    // 1. Insert into DB
    const { rows } = await query(
      `INSERT INTO notifications (user_id, type, title, message, metadata)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, type, title, message, JSON.stringify(metadata)]
    );

    const notification = rows[0];

    // 2. Emit via Socket.IO (user-specific room)
    if (io) {
      io.to(`user:${userId}`).emit('notification', notification);
    }

    // 3. Fire-and-forget email/SMS
    const userRes = await query('SELECT email, phone FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      if (user.email) sendEmail(user.email, title, `<p>${message}</p>`).catch(() => {});
      if (user.phone) sendSMS(user.phone, `${title}: ${message}`).catch(() => {});
    }

    return notification;
  } catch (err) {
    logger.error('Notification service error:', err);
    // Don't throw — notifications should never crash the main flow
    return null;
  }
}

/**
 * Bulk notify multiple users (fire-and-forget).
 */
async function notifyMany(io, userIds, type, title, message, metadata = {}) {
  return Promise.allSettled(
    userIds.map(uid => notify(io, uid, type, title, message, metadata))
  );
}

module.exports = { notify, notifyMany };
