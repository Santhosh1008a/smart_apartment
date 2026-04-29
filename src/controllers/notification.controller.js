const { query } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');

// GET /notifications — list user's notifications
exports.listNotifications = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// PATCH /notifications/:id/read — mark single as read
exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, req.user.id]
    );
    if (rows.length === 0) return next(new AppError('Notification not found', 404));
    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// PATCH /notifications/read-all — mark all as read
exports.markAllRead = async (req, res, next) => {
  try {
    await query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

// GET /notifications/unread-count — badge count
exports.getUnreadCount = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );
    res.status(200).json({ success: true, count: parseInt(rows[0].count) });
  } catch (err) {
    next(err);
  }
};
