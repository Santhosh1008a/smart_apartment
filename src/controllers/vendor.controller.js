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
// Validates state machine: pending → assigned → in_progress → completed
exports.updateRequestStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const vendorId = req.user.id;
    const complexId = req.user.complex_id;
    const vendorCategory = req.user.vendor_category;

    const validTransitions = {
      'pending': ['assigned'],
      'assigned': ['in_progress'],
      'in_progress': ['completed'],
    };

    // First verify the request belongs to this vendor AND this complex, OR is unassigned and matches category
    const verifyResult = await query(
      `SELECT vr.id, vr.status, vr.user_id, vr.category
       FROM vendor_requests vr
       JOIN units un ON vr.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       WHERE vr.id = $1
         AND b.complex_id = $2
         AND (
           vr.assigned_vendor_id = $3
           OR
           (vr.assigned_vendor_id IS NULL AND vr.status = 'pending' AND vr.category = $4)
         )`,
      [id, complexId, vendorId, vendorCategory]
    );

    if (verifyResult.rows.length === 0) {
      return next(new AppError('Request not found, not assigned to you, or category mismatch', 404));
    }

    const currentStatus = verifyResult.rows[0].status;
    const allowedNext = validTransitions[currentStatus];

    if (!allowedNext || !allowedNext.includes(status)) {
      return next(new AppError(
        `Cannot transition from '${currentStatus}' to '${status}'. Allowed: ${allowedNext ? allowedNext.join(', ') : 'none (already completed)'}`,
        400
      ));
    }

    let updateQuery = `UPDATE vendor_requests SET status = $1 WHERE id = $2 RETURNING *`;
    let queryParams = [status, id];

    if (currentStatus === 'pending' && status === 'assigned') {
      updateQuery = `UPDATE vendor_requests SET status = $1, assigned_vendor_id = $3 WHERE id = $2 RETURNING *`;
      queryParams = [status, id, vendorId];
    }

    const { rows } = await query(updateQuery, queryParams);

    // Emit real-time update scoped to complex room
    const io = req.app.get('io');
    if (io && complexId) {
      io.to(`complex:${complexId}`).emit('vendor_request_update', rows[0]);
    } else if (io) {
      io.emit('vendor_request_update', rows[0]); // fallback
    }

    // Notify the requester about status changes
    const { notify } = require('../services/notification.service');
    const requesterId = verifyResult.rows[0].user_id;
    const category = verifyResult.rows[0].category || rows[0].category;

    if (status === 'assigned') {
      notify(io, requesterId, 'job_accepted',
        'Service Request Accepted',
        `Your ${category} service request has been accepted and assigned to a vendor.`,
        { request_id: rows[0].id, category }
      ).catch(() => {});
      
      // Also notify the vendor just in case they expect a confirmation notification
      notify(io, vendorId, 'job_assigned',
        'Job Accepted',
        `You have successfully assigned yourself to the ${category} request.`,
        { request_id: rows[0].id, category }
      ).catch(() => {});
    } else if (status === 'in_progress') {
      notify(io, requesterId, 'job_started',
        'Service Request Started',
        `The vendor has started working on your ${category} service request.`,
        { request_id: rows[0].id, category }
      ).catch(() => {});
    } else if (status === 'completed') {
      notify(io, requesterId, 'service_completed',
        'Service Request Completed',
        `Your ${category} service request has been completed.`,
        { request_id: rows[0].id, category }
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
