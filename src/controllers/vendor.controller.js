const { query } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');

// --- GET assigned requests for the logged-in vendor (multi-tenant scoped) ---
exports.getMyRequests = async (req, res, next) => {
  try {
    const { complexId } = req;
    const params = [];
    let complexClause = '';

    if (complexId) {
      params.push(complexId);
      complexClause = ` AND b.complex_id = $${params.length}`;
    }

    const { rows } = await query(
      `SELECT vr.*, u.full_name AS requested_by, un.unit_number
       FROM vendor_requests vr
       JOIN users u ON vr.user_id = u.id
       JOIN units un ON vr.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       WHERE vr.status IN ('assigned', 'in_progress')${complexClause}
       ORDER BY
         CASE vr.priority
           WHEN 'urgent' THEN 1
           WHEN 'high'   THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low'    THEN 4
         END,
         vr.created_at DESC`,
      params
    );

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// --- UPDATE request status ---
exports.updateRequestStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['assigned', 'in_progress', 'completed'];
    if (!validStatuses.includes(status)) {
      return next(new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400));
    }

    const { rows } = await query(
      `UPDATE vendor_requests SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (rows.length === 0) {
      return next(new AppError('Vendor request not found', 404));
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('vendor_request_update', rows[0]);
    }

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};
