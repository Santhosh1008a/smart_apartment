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
       WHERE (vp.valid_from >= $1 OR vp.status IN ('checked_in', 'overdue'))
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

    // Keep tenant authorization and the state transition in one statement so
    // concurrent scans cannot both check in, and no stale pre-check can race.
    const { rows } = await query(
      `UPDATE visitor_passes vp
       SET status = 'checked_in', checked_in_at = now()
       WHERE vp.id = $1
         AND vp.status = 'pending'
         AND EXISTS (
           SELECT 1
           FROM user_units uu
           JOIN units un ON uu.unit_id = un.id
           JOIN buildings b ON un.building_id = b.id
           WHERE uu.user_id = vp.host_user_id
             AND uu.moved_out_at IS NULL
             AND b.complex_id = $2
         )
       RETURNING vp.*`,
      [id, complexId]
    );

    if (rows.length === 0) {
      return next(new AppError('Visitor pass not found in your complex or is no longer pending', 404));
    }

    // Emit real-time event
    const io = req.app.get('io');
    if (io && complexId) {
      io.to(`complex:${complexId}:staff`).emit('visitor_checkin', {
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

    const { rows } = await query(
      `UPDATE visitor_passes vp
       SET status = 'checked_out', checked_out_at = now()
       WHERE vp.id = $1
         AND vp.status = 'checked_in'
         AND EXISTS (
           SELECT 1
           FROM user_units uu
           JOIN units un ON uu.unit_id = un.id
           JOIN buildings b ON un.building_id = b.id
           WHERE uu.user_id = vp.host_user_id
             AND uu.moved_out_at IS NULL
             AND b.complex_id = $2
         )
       RETURNING vp.*`,
      [id, complexId]
    );

    if (rows.length === 0) {
      return next(new AppError('Visitor pass not found in your complex or is no longer checked in', 404));
    }

    const io = req.app.get('io');
    if (io && complexId) {
      io.to(`complex:${complexId}:staff`).emit('visitor_checkout', {
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
         COUNT(*) FILTER (WHERE vp.status = 'overdue') AS overdue,
         COUNT(*) FILTER (WHERE vp.status = 'checked_out' AND vp.valid_from >= $1) AS left_today,
         COUNT(*) AS total_tracked
       FROM visitor_passes vp
       JOIN users u ON vp.host_user_id = u.id
       JOIN user_units uu ON uu.user_id = u.id AND uu.moved_out_at IS NULL
       JOIN units un ON uu.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       WHERE (vp.valid_from >= $1 OR vp.status IN ('checked_in', 'overdue'))
         AND b.complex_id = $2`,
      [todayStart.toISOString(), complexId]
    );

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// --- RESOLVE OVERDUE visitor ---
exports.resolveOverdueVisitor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const complexId = req.user.complex_id;
    const visitorService = require('../services/visitor.service');
    const data = await visitorService.resolveOverdue(id, complexId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// --- EXTEND VALIDITY ---
exports.extendVisitorValidity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const complexId = req.user.complex_id;
    const { hours } = req.body;
    const visitorService = require('../services/visitor.service');
    const data = await visitorService.extendValidity(id, complexId, hours || 24);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
