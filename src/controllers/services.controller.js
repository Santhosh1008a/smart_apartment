const { query, getClient } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');
const { sendSMS, sendEmail } = require('../utils/notifications');

// --- EMERGENCY ---
exports.triggerEmergency = async (req, res, next) => {
  try {
    const { unit_id, type, severity, description, location_lat, location_lng } = req.body;
    const user_id = req.user.id;
    const complexId = req.complexId;

    const { rows } = await query(
      `INSERT INTO emergency_alerts (user_id, unit_id, type, severity, description, location_lat, location_lng, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active') RETURNING *`,
      [user_id, unit_id, type, severity || 'high', description, location_lat, location_lng]
    );

    const alert = rows[0];

    // Emit real-time to the complex room (scoped, not global)
    const io = req.app.get('io');
    if (io) {
      const room = complexId ? `complex:${complexId}` : 'all';
      io.to(room).emit('emergency_alert', {
        ...alert,
        triggered_by: req.user.full_name || req.user.email
      });
    }

    // Notify admins and security in same complex
    const { notifyMany } = require('../services/notification.service');
    let adminQuery, adminParams;
    if (complexId) {
      adminQuery = `SELECT id FROM users WHERE (role = 'admin' OR role = 'security') AND complex_id = $1 AND is_active = true`;
      adminParams = [complexId];
    } else {
      adminQuery = `SELECT id FROM users WHERE role = 'admin' OR role = 'security'`;
      adminParams = [];
    }
    query(adminQuery, adminParams)
      .then(admins => {
        const adminIds = admins.rows.map(a => a.id);
        if (adminIds.length > 0) {
          notifyMany(io, adminIds, 'emergency_alert',
            `🚨 Emergency: ${type} (${severity || 'high'})`,
            `An emergency of type ${type} was triggered. Please respond immediately.`,
            { alert_id: alert.id, type, severity }
          );
        }
      }).catch(err => require('../utils/logger').error('Error dispatching emergency notifications', err));

    res.status(201).json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
};

exports.resolveEmergency = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'resolved' or 'false_alarm'
    const user_id = req.user.id;

    if (!['resolved', 'false_alarm'].includes(status)) {
      return next(new AppError("status must be 'resolved' or 'false_alarm'", 400));
    }

    // Only the original reporter or admin/security can resolve
    const { rows } = await query(
      `UPDATE emergency_alerts
       SET status = $1
       WHERE id = $2
         AND (user_id = $3 OR $4 IN ('admin','security','super_admin'))
       RETURNING *`,
      [status, id, user_id, req.user.role]
    );

    if (rows.length === 0) {
      return next(new AppError('Alert not found or permission denied', 404));
    }

    const alert = rows[0];
    const io = req.app.get('io');
    const complexId = req.complexId;
    if (io) {
      const room = complexId ? `complex:${complexId}` : 'all';
      io.to(room).emit('emergency_resolved', { id: alert.id, status: alert.status });
    }

    res.status(200).json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
};

exports.listEmergencies = async (req, res, next) => {
  try {
    const { complexId } = req;
    const { status } = req.query; // optional: 'active', 'resolved', 'false_alarm'

    let conditions = [];
    const params = [];

    // Residents see only their own alerts; admins/security see all in complex
    if (req.user.role === 'resident') {
      params.push(req.user.id);
      conditions.push(`e.user_id = $${params.length}`);
    } else if (complexId) {
      params.push(complexId);
      conditions.push(`(b.complex_id = $${params.length} OR e.unit_id IS NULL)`);
    }

    if (status) {
      params.push(status);
      conditions.push(`e.status = $${params.length}`);
    } else {
      // Default: only active alerts
      conditions.push(`e.status = 'active'`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query(
      `SELECT e.*, u.full_name, un.unit_number
       FROM emergency_alerts e
       JOIN users u ON e.user_id = u.id
       LEFT JOIN units un ON e.unit_id = un.id
       LEFT JOIN buildings b ON un.building_id = b.id
       ${where}
       ORDER BY e.created_at DESC LIMIT 50`,
      params
    );
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// --- PARKING ---
exports.listAvailableSlots = async (req, res, next) => {
  try {
    const { complexId } = req;
    let sql = `
       SELECT s.*, b.name as building_name 
       FROM parking_slots s
       JOIN buildings b ON s.building_id = b.id
       WHERE s.status = 'available'
    `;
    const params = [];

    if (complexId) {
      sql += ` AND b.complex_id = $1`;
      params.push(complexId);
    }

    const { rows } = await query(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.assignParking = async (req, res, next) => {
  const client = await getClient();
  try {
    const { slot_id, unit_id, vehicle_number, vehicle_type } = req.body;

    await client.query('BEGIN');
    
    // Check if available
    const slotCheck = await client.query('SELECT status FROM parking_slots WHERE id = $1', [slot_id]);
    if (slotCheck.rows.length === 0 || slotCheck.rows[0].status !== 'available') {
      return next(new AppError('Slot is not available', 400));
    }

    const { rows } = await client.query(
      `INSERT INTO parking_assignments (slot_id, unit_id, vehicle_number, vehicle_type, assigned_from)
       VALUES ($1, $2, $3, $4, now()) RETURNING *`,
      [slot_id, unit_id, vehicle_number, vehicle_type]
    );

    await client.query(`UPDATE parking_slots SET status = 'assigned' WHERE id = $1`, [slot_id]);

    await client.query('COMMIT');

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

exports.listMyParkingAssignments = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT pa.*, s.slot_number, s.floor, b.name as building_name 
       FROM parking_assignments pa
       JOIN parking_slots s ON pa.slot_id = s.id
       JOIN buildings b ON s.building_id = b.id
       WHERE pa.unit_id IN (SELECT unit_id FROM user_units WHERE user_id = $1)
       AND pa.assigned_until IS NULL`,
      [req.user.id]
    );
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// --- VENDORS ---
exports.listVendors = async (req, res, next) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT * FROM vendors WHERE is_verified = true';
    const params = [];
    if (category) {
      sql += ' AND category = $1';
      params.push(category);
    }
    const { rows } = await query(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.raiseVendorRequest = async (req, res, next) => {
  try {
    const { unit_id, category, description, priority } = req.body;
    const user_id = req.user.id;
    const complexId = req.complexId;

    // Auto-assign to a vendor in the same complex whose category matches
    let assignedVendorId = null;
    if (complexId && category) {
      const vendorRes = await query(
        `SELECT id FROM users 
         WHERE role = 'vendor' 
           AND complex_id = $1 
           AND vendor_category = $2 
           AND is_active = true 
         LIMIT 1`,
        [complexId, category]
      );
      if (vendorRes.rows.length > 0) {
        assignedVendorId = vendorRes.rows[0].id;
      }
    }

    const status = assignedVendorId ? 'assigned' : 'pending';

    const { rows } = await query(
      `INSERT INTO vendor_requests (user_id, unit_id, category, description, priority, assigned_vendor_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [user_id, unit_id, category, description, priority || 'medium', assignedVendorId, status]
    );

    // Notify assigned vendor in real-time
    if (assignedVendorId) {
      const io = req.app.get('io');
      const { notify } = require('../services/notification.service');
      notify(io, assignedVendorId, 'job_assigned',
        'New Job Assigned',
        `You have a new ${category} service request.`,
        { request_id: rows[0].id, category, priority: priority || 'medium' }
      ).catch(() => {});
    }

    res.status(201).json({ 
      success: true, 
      data: rows[0],
      assigned: !!assignedVendorId
    });
  } catch (err) {
    next(err);
  }
};

exports.listMyVendorRequests = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT vr.*, un.unit_number, b.name as building_name,
              u2.full_name as vendor_name
       FROM vendor_requests vr
       JOIN units un ON vr.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       LEFT JOIN users u2 ON vr.assigned_vendor_id = u2.id
       WHERE vr.user_id = $1 
       ORDER BY vr.created_at DESC`,
      [req.user.id]
    );
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// Admin: list all vendor requests in the complex
exports.listAllVendorRequests = async (req, res, next) => {
  try {
    const { complexId } = req;
    const { status } = req.query;
    const params = [];
    let where = [];

    if (complexId) {
      params.push(complexId);
      where.push(`b.complex_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`vr.status = $${params.length}`);
    }

    const { rows } = await query(
      `SELECT vr.*, 
              u.full_name as requested_by, u.email as resident_email,
              un.unit_number, b.name as building_name,
              v.full_name as vendor_name, v.email as vendor_email
       FROM vendor_requests vr
       JOIN users u ON vr.user_id = u.id
       JOIN units un ON vr.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       LEFT JOIN users v ON vr.assigned_vendor_id = v.id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY 
         CASE vr.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
         vr.created_at DESC`,
      params
    );
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

