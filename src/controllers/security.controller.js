const { query, getClient } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');
const logger = require('../utils/logger');

// --- GET today's visitors (multi-tenant scoped) ---
exports.getVisitorsToday = async (req, res, next) => {
  try {
    const { complexId } = req;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const params = [todayStart.toISOString()];
    let complexClause = '';

    if (complexId) {
      params.push(complexId);
      complexClause = ` AND b.complex_id = $${params.length}`;
    }

    const { rows } = await query(
      `SELECT vp.*, u.full_name AS host_name, u.phone AS host_phone
       FROM visitor_passes vp
       JOIN users u ON vp.host_user_id = u.id
       JOIN user_units uu ON uu.user_id = u.id AND uu.moved_out_at IS NULL
       JOIN units un ON uu.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       WHERE vp.valid_from >= $1${complexClause}
       ORDER BY vp.created_at DESC`,
      params
    );

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// --- CHECK-IN visitor ---
exports.checkinVisitor = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { rows } = await query(
      `UPDATE visitor_passes
       SET status = 'checked_in', checked_in_at = now()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      return next(new AppError('Visitor pass not found or already checked-in', 404));
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

// --- CHECK-OUT visitor ---
exports.checkoutVisitor = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { rows } = await query(
      `UPDATE visitor_passes
       SET status = 'checked_out'
       WHERE id = $1 AND status = 'checked_in'
       RETURNING *`,
      [id]
    );

    if (rows.length === 0) {
      return next(new AppError('Visitor pass not found or not checked-in', 404));
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
