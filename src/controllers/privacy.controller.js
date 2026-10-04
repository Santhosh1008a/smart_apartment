const { query } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');

exports.createRequest = async (req, res, next) => {
  try {
    const { request_type, details } = req.body;
    const { rows } = await query(
      `INSERT INTO privacy_requests (user_id, request_type, details)
       VALUES ($1, $2, NULLIF($3, ''))
       RETURNING id, request_type, status, submitted_at`,
      [req.user.id, request_type, details || '']
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.listMyRequests = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, request_type, status, details, resolution_note, submitted_at, updated_at, resolved_at
       FROM privacy_requests
       WHERE user_id = $1
       ORDER BY submitted_at DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.listAdminRequests = async (req, res, next) => {
  try {
    const params = [];
    const statusClause = req.query.status ? `WHERE pr.status = $1` : '';
    if (req.query.status) params.push(req.query.status);
    const { rows } = await query(
      `SELECT pr.id, pr.user_id, u.email AS requester_email, u.full_name AS requester_name,
              pr.request_type, pr.details, pr.status, pr.resolution_note,
              pr.submitted_at, pr.updated_at, pr.resolved_at
       FROM privacy_requests pr
       LEFT JOIN users u ON u.id = pr.user_id
       ${statusClause}
       ORDER BY pr.submitted_at ASC
       LIMIT 200`,
      params
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.updateAdminRequest = async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return next(new AppError('Invalid privacy request id', 400));
    const { status, resolution_note } = req.body;
    const { rows } = await query(
      `UPDATE privacy_requests
       SET status = COALESCE($1, status),
           resolution_note = CASE WHEN $2::boolean THEN NULLIF($3, '') ELSE resolution_note END,
           handled_by = $4,
           updated_at = now(),
           resolved_at = CASE
             WHEN COALESCE($1, status) = 'completed' THEN COALESCE(resolved_at, now())
             WHEN COALESCE($1, status) IN ('received', 'in_review', 'needs_information') THEN NULL
             ELSE resolved_at
           END
       WHERE id = $5
       RETURNING id, request_type, status, resolution_note, updated_at, resolved_at`,
      [status || null, resolution_note !== undefined, resolution_note || '', req.user.id, req.params.id]
    );
    if (!rows.length) return next(new AppError('Privacy request not found', 404));
    res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};
