const { query } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');
const { ensureSocietyNoticeNotifications, isMissingSocietyNoticesTable } = require('../services/notification.service');
const { noticeScopePredicate } = require('../utils/society-notice-scope');

const NOTICE_TYPE = 'society_notice';

// GET /notifications — list user's notifications
exports.listNotifications = async (req, res, next) => {
  try {
    let rows;
    try {
      await ensureSocietyNoticeNotifications(req.user);
      ({ rows } = await query(
        `SELECT nt.* FROM notifications nt
          WHERE nt.user_id = $1
            AND (nt.type <> 'society_notice' OR EXISTS (
              SELECT 1 FROM notices n
               WHERE n.id::text = nt.metadata ->> 'notice_id'
                 AND ${noticeScopePredicate(req.user.role, 'nt.user_id', '$2')}
                 AND n.status IN ('sent', 'cancelled')
            ))
          ORDER BY nt.created_at DESC LIMIT 50`,
        req.user.role === 'tenant'
          ? [req.user.id]
          : [req.user.id, req.user.complex_id]
      ));
    } catch (error) {
      if (!isMissingSocietyNoticesTable(error)) throw error;
      ({ rows } = await query(
        `SELECT nt.* FROM notifications nt
          WHERE nt.user_id = $1 AND nt.type <> $2
          ORDER BY nt.created_at DESC LIMIT 50`,
        [req.user.id, NOTICE_TYPE]
      ));
    }
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// PATCH /notifications/:id/read — mark single as read
exports.markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    let rows;
    try {
      ({ rows } = await query(
        `UPDATE notifications nt SET is_read = true
          WHERE nt.id = $1 AND nt.user_id = $2
            AND (nt.type <> 'society_notice' OR EXISTS (
              SELECT 1 FROM notices n
               WHERE n.id::text = nt.metadata ->> 'notice_id'
                 AND ${noticeScopePredicate(req.user.role, '$2', '$3')}
                 AND n.status IN ('sent', 'cancelled')
            ))
          RETURNING nt.*`,
        req.user.role === 'tenant'
          ? [id, req.user.id]
          : [id, req.user.id, req.user.complex_id]
      ));
    } catch (error) {
      if (!isMissingSocietyNoticesTable(error)) throw error;
      ({ rows } = await query(
        `UPDATE notifications nt SET is_read = true
          WHERE nt.id = $1 AND nt.user_id = $2 AND nt.type <> $3
          RETURNING nt.*`,
        [id, req.user.id, NOTICE_TYPE]
      ));
    }
    if (rows.length === 0) return next(new AppError('Notification not found', 404));
    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// PATCH /notifications/read-all — mark all as read
exports.markAllRead = async (req, res, next) => {
  try {
    try {
      await query(
        `UPDATE notifications nt SET is_read = true
          WHERE nt.user_id = $1 AND nt.is_read = false
            AND (nt.type <> 'society_notice' OR EXISTS (
              SELECT 1 FROM notices n
               WHERE n.id::text = nt.metadata ->> 'notice_id'
                 AND ${noticeScopePredicate(req.user.role, '$1', '$2')}
                 AND n.status IN ('sent', 'cancelled')
            ))`,
        req.user.role === 'tenant'
          ? [req.user.id]
          : [req.user.id, req.user.complex_id]
      );
    } catch (error) {
      if (!isMissingSocietyNoticesTable(error)) throw error;
      await query(
        `UPDATE notifications nt SET is_read = true
          WHERE nt.user_id = $1 AND nt.is_read = false AND nt.type <> $2`,
        [req.user.id, NOTICE_TYPE]
      );
    }
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

// GET /notifications/unread-count — badge count
exports.getUnreadCount = async (req, res, next) => {
  try {
    let rows;
    try {
      await ensureSocietyNoticeNotifications(req.user);
      ({ rows } = await query(
        `SELECT COUNT(*) FROM notifications nt
          WHERE nt.user_id = $1 AND nt.is_read = false
            AND (nt.type <> 'society_notice' OR EXISTS (
              SELECT 1 FROM notices n
               WHERE n.id::text = nt.metadata ->> 'notice_id'
                 AND ${noticeScopePredicate(req.user.role, '$1', '$2')}
                 AND n.status IN ('sent', 'cancelled')
            ))`,
        req.user.role === 'tenant'
          ? [req.user.id]
          : [req.user.id, req.user.complex_id]
      ));
    } catch (error) {
      if (!isMissingSocietyNoticesTable(error)) throw error;
      ({ rows } = await query(
        `SELECT COUNT(*) FROM notifications nt
          WHERE nt.user_id = $1 AND nt.is_read = false AND nt.type <> $2`,
        [req.user.id, NOTICE_TYPE]
      ));
    }
    res.status(200).json({ success: true, count: parseInt(rows[0].count) });
  } catch (err) {
    next(err);
  }
};
