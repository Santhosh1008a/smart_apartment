const { query, getClient } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');
const logger = require('../utils/logger');

// --- GET today's visitors (multi-tenant scoped) ---
exports.getVisitorsToday = async (req, res, next) => {
  try {
    const complexId = req.user.complex_id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { rows } = await query(
      `SELECT vp.*, u.full_name AS host_name, u.phone AS host_phone,
              un.unit_number, b.name AS building_name
       FROM visitor_passes vp
       JOIN users u ON vp.host_user_id = u.id
       JOIN user_units uu ON uu.user_id = u.id AND uu.moved_out_at IS NULL
       JOIN units un ON uu.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       WHERE vp.valid_from >= $1
         AND b.complex_id = $2
       ORDER BY vp.created_at DESC`,
      [todayStart.toISOString(), complexId]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// --- CHECK-IN visitor (complex-scoped) ---
exports.checkinVisitor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const complexId = req.user.complex_id;

    // Verify the visitor pass belongs to this complex before updating
    const verifyResult = await query(
      `SELECT vp.id, vp.status
       FROM visitor_passes vp
       JOIN users u ON vp.host_user_id = u.id
       JOIN user_units uu ON uu.user_id = u.id AND uu.moved_out_at IS NULL
       JOIN units un ON uu.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       WHERE vp.id = $1 AND b.complex_id = $2`,
      [id, complexId]
    );

    if (verifyResult.rows.length === 0) {
      return next(new AppError('Visitor pass not found in your complex', 404));
    }

    if (verifyResult.rows[0].status !== 'pending') {
      return next(new AppError('Visitor pass is not in pending status', 400));
    }

    const { rows } = await query(
      `UPDATE visitor_passes
       SET status = 'checked_in', checked_in_at = now()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      return next(new AppError('Failed to check in visitor', 500));
    }

    // Emit real-time event
    const io = req.app.get('io');
    if (io) {
      io.emit('visitor_checkin', {
        visitor: rows[0],
        checked_in_by: req.user.id,
      });
    }

    // Notify the host that their visitor has arrived
    const { notify } = require('../services/notification.service');
    const visitor = rows[0];
    notify(io, visitor.host_user_id, 'visitor_arrival',
      `${visitor.visitor_name} has arrived`,
      `Your visitor ${visitor.visitor_name} has been checked in at the gate.`,
      { visitor_pass_id: visitor.id, visitor_name: visitor.visitor_name }
    ).catch(() => {});

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// --- CHECK-OUT visitor (complex-scoped) ---
exports.checkoutVisitor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const complexId = req.user.complex_id;

    // Verify the visitor pass belongs to this complex
    const verifyResult = await query(
      `SELECT vp.id, vp.status
       FROM visitor_passes vp
       JOIN users u ON vp.host_user_id = u.id
       JOIN user_units uu ON uu.user_id = u.id AND uu.moved_out_at IS NULL
       JOIN units un ON uu.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       WHERE vp.id = $1 AND b.complex_id = $2`,
      [id, complexId]
    );

    if (verifyResult.rows.length === 0) {
      return next(new AppError('Visitor pass not found in your complex', 404));
    }

    if (verifyResult.rows[0].status !== 'checked_in') {
      return next(new AppError('Visitor is not checked in', 400));
    }

    const { rows } = await query(
      `UPDATE visitor_passes
       SET status = 'checked_out'
       WHERE id = $1 AND status = 'checked_in'
       RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      return next(new AppError('Failed to check out visitor', 500));
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('visitor_checkout', {
        visitor: rows[0],
        checked_out_by: req.user.id,
      });
    }

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// --- GET dashboard stats for security guard ---
exports.getDashboardStats = async (req, res, next) => {
  try {
    const complexId = req.user.complex_id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { rows } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE vp.status = 'pending') AS expected,
         COUNT(*) FILTER (WHERE vp.status = 'checked_in') AS inside,
         COUNT(*) FILTER (WHERE vp.status = 'checked_out') AS left_today,
         COUNT(*) AS total_today
       FROM visitor_passes vp
       JOIN users u ON vp.host_user_id = u.id
       JOIN user_units uu ON uu.user_id = u.id AND uu.moved_out_at IS NULL
       JOIN units un ON uu.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       WHERE vp.valid_from >= $1
         AND b.complex_id = $2`,
      [todayStart.toISOString(), complexId]
    );

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};
