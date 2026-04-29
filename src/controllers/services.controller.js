const { query, getClient } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');
const { sendSMS, sendEmail } = require('../utils/notifications');

// --- EMERGENCY ---
exports.triggerEmergency = async (req, res, next) => {
  try {
    const { unit_id, type, severity, description, location_lat, location_lng } = req.body;
    const user_id = req.user.id;

    const { rows } = await query(
      `INSERT INTO emergency_alerts (user_id, unit_id, type, severity, description, location_lat, location_lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [user_id, unit_id, type, severity || 'high', description, location_lat, location_lng]
    );

    const alert = rows[0];

    // Emit real-time WebSocket event
    const io = req.app.get('io');
    if (io) {
      io.emit('emergency_alert', {
        ...alert,
        triggered_by: req.user.full_name || req.user.email
      });
    }

    // Fire Notifications to Admins via centralized notification service
    const { notifyMany } = require('../services/notification.service');
    query('SELECT id, phone, email FROM users WHERE role = $1 OR role = $2', ['admin', 'super_admin'])
      .then(admins => {
        const adminIds = admins.rows.map(a => a.id);
        if (adminIds.length > 0) {
          notifyMany(io, adminIds, 'emergency_alert',
            `🚨 Emergency: ${type} (${severity || 'high'})`,
            `An emergency of type ${type} (Severity: ${severity || 'high'}) was triggered. Please check the dashboard immediately.`,
            { alert_id: alert.id, type, severity }
          );
        }
        // Legacy email/SMS (redundant but kept for backward compat)
        admins.rows.forEach(admin => {
           if (admin.phone) sendSMS(admin.phone, `🚨 EMERGENCY ALERT: ${type}. Severity: ${severity}. Please check dashboard immediately.`);
           if (admin.email) sendEmail(admin.email, 'URGENT: Emergency Alert', `<p>An emergency of type <b>${type}</b> (Severity: ${severity}) was triggered.</p>`);
        });
      }).catch(err => require('../utils/logger').error('Error dispatching notifications', err));

    res.status(201).json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
};

exports.listEmergencies = async (req, res, next) => {
  try {
    const { complexId } = req;
    let sql = `
       SELECT e.*, u.full_name, un.unit_number 
       FROM emergency_alerts e
       JOIN users u ON e.user_id = u.id
       LEFT JOIN units un ON e.unit_id = un.id
       LEFT JOIN buildings b ON un.building_id = b.id
    `;
    const params = [];

    if (complexId) {
      sql += ` WHERE (b.complex_id = $1 OR e.unit_id IS NULL)`;
      params.push(complexId);
    }

    sql += ` ORDER BY e.created_at DESC LIMIT 50`;

    const { rows } = await query(sql, params);
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

    const { rows } = await query(
      `INSERT INTO vendor_requests (user_id, unit_id, category, description, priority)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user_id, unit_id, category, description, priority || 'medium']
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.listMyVendorRequests = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM vendor_requests WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};
