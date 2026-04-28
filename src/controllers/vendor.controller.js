const { query } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');

exports.getMyRequests = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const complexId = req.user.complex_id;
    const vendorCategory = req.user.vendor_category;

    // Show: requests assigned to me (assigned/in_progress) 
    //   OR: pending unassigned requests matching my category in my complex
    const { rows } = await query(
      `SELECT vr.*, u.full_name AS requested_by, un.unit_number, b.name AS building_name
       FROM vendor_requests vr
       JOIN users u ON vr.user_id = u.id
       JOIN units un ON vr.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       WHERE b.complex_id = $2
         AND (
           (vr.assigned_vendor_id = $1 AND vr.status IN ('assigned', 'in_progress'))
           OR
           (vr.assigned_vendor_id IS NULL AND vr.status = 'pending' AND vr.category = $3)
         )
       ORDER BY
         CASE vr.priority
           WHEN 'urgent' THEN 1
           WHEN 'high'   THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low'    THEN 4
         END,
         vr.created_at DESC`,
      [vendorId, complexId, vendorCategory]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// --- GET completed requests for vendor history ---
exports.getCompletedRequests = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const complexId = req.user.complex_id;

    const { rows } = await query(
      `SELECT vr.*, u.full_name AS requested_by, un.unit_number, b.name AS building_name
       FROM vendor_requests vr
       JOIN users u ON vr.user_id = u.id
       JOIN units un ON vr.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       WHERE vr.assigned_vendor_id = $1
         AND b.complex_id = $2
         AND vr.status = 'completed'
       ORDER BY vr.created_at DESC
       LIMIT 50`,
      [vendorId, complexId]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// --- UPDATE request status (strict ownership + complex check) ---
// Enforces: assigned_vendor_id = current user AND complex_id match
// Validates state machine: assigned → in_progress → completed
exports.updateRequestStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const vendorId = req.user.id;
    const complexId = req.user.complex_id;

    const validTransitions = {
      'assigned': ['in_progress'],
      'in_progress': ['completed'],
    };

    // First verify the request belongs to this vendor AND this complex
    const verifyResult = await query(
      `SELECT vr.id, vr.status, vr.user_id
       FROM vendor_requests vr
       JOIN units un ON vr.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       WHERE vr.id = $1
         AND vr.assigned_vendor_id = $2
         AND b.complex_id = $3`,
      [id, vendorId, complexId]
    );

    if (verifyResult.rows.length === 0) {
      return next(new AppError('Request not found or not assigned to you', 404));
    }

    const currentStatus = verifyResult.rows[0].status;
    const allowedNext = validTransitions[currentStatus];

    if (!allowedNext || !allowedNext.includes(status)) {
      return next(new AppError(
        `Cannot transition from '${currentStatus}' to '${status}'. Allowed: ${allowedNext ? allowedNext.join(', ') : 'none (already completed)'}`,
        400
      ));
    }

    const { rows } = await query(
      `UPDATE vendor_requests SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    // Emit real-time update scoped to complex room
    const io = req.app.get('io');
    if (io && complexId) {
      io.to(`complex:${complexId}`).emit('vendor_request_update', rows[0]);
    } else if (io) {
      io.emit('vendor_request_update', rows[0]); // fallback
    }

    // Notify the requester when job is completed
    if (status === 'completed') {
      const { notify } = require('../services/notification.service');
      const requesterId = verifyResult.rows[0].user_id;
      notify(io, requesterId, 'service_completed',
        'Service Request Completed',
        `Your ${rows[0].category} service request has been completed.`,
        { request_id: rows[0].id, category: rows[0].category }
      ).catch(() => {});
    }

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// --- GET dashboard stats for vendor ---
exports.getDashboardStats = async (req, res, next) => {
  try {
    const vendorId = req.user.id;
    const complexId = req.user.complex_id;

    const { rows } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE vr.status = 'assigned') AS assigned,
         COUNT(*) FILTER (WHERE vr.status = 'in_progress') AS in_progress,
         COUNT(*) FILTER (WHERE vr.status = 'completed') AS completed,
         COUNT(*) AS total
       FROM vendor_requests vr
       JOIN units un ON vr.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       WHERE vr.assigned_vendor_id = $1
         AND b.complex_id = $2`,
      [vendorId, complexId]
    );

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};
