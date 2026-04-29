const { query, getClient } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');
const redis = require('../config/redis');

// Helper: builds a complex_id filter clause for queries that JOIN through buildings
const complexFilter = (complexId, params, alias = 'b') => {
  if (!complexId) return { clause: '', params };
  params.push(complexId);
  return { clause: ` AND ${alias}.complex_id = $${params.length}`, params };
};

// --- USERS ---
exports.listUsers = async (req, res, next) => {
  try {
    const { role } = req.query;
    const { complexId } = req;
    const params = [];
    const conditions = [];

    let sql = `
      SELECT DISTINCT u.id, u.email, u.phone, u.full_name, u.role, u.is_active, u.created_at
      FROM users u
      LEFT JOIN user_units uu ON uu.user_id = u.id AND uu.moved_out_at IS NULL
      LEFT JOIN units un ON uu.unit_id = un.id
      LEFT JOIN buildings b ON un.building_id = b.id
    `;

    if (role) {
      params.push(role);
      conditions.push(`u.role = $${params.length}`);
    }
    if (complexId) {
      params.push(complexId);
      conditions.push(`b.complex_id = $${params.length}`);
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY u.created_at DESC';

    const { rows } = await query(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.getUserDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(
      'SELECT id, email, phone, full_name, role, is_active, avatar_url, created_at FROM users WHERE id = $1',
      [id]
    );

    if (rows.length === 0) return next(new AppError('User not found', 404));

    const unitsData = await query(
      `SELECT u.id, u.unit_number, uu.relation, uu.moved_in_at 
       FROM user_units uu 
       JOIN units u ON uu.unit_id = u.id 
       WHERE uu.user_id = $1 AND uu.moved_out_at IS NULL`,
      [id]
    );

    res.status(200).json({
      success: true,
      data: {
        ...rows[0],
        units: unitsData.rows
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, is_active } = req.body;

    let updates = [];
    let params = [];
    let queryIdx = 1;

    if (role) {
      updates.push(`role = $${queryIdx++}`);
      params.push(role);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${queryIdx++}`);
      params.push(is_active);
    }

    if (updates.length === 0) return next(new AppError('No valid fields to update', 400));
    params.push(id);

    const { rows } = await query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = now() WHERE id = $${queryIdx} RETURNING id, role, is_active`,
      params
    );

    if (rows.length === 0) return next(new AppError('User not found', 404));

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// --- COMPLEXES ---
exports.createComplex = async (req, res, next) => {
  try {
    const { name, address } = req.body;
    const { rows } = await query(
      'INSERT INTO complexes (name, address) VALUES ($1, $2) RETURNING *',
      [name, address]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// --- BUILDINGS ---
exports.createBuilding = async (req, res, next) => {
  try {
    const { complex_id, name, total_floors } = req.body;
    const { rows } = await query(
      'INSERT INTO buildings (complex_id, name, total_floors) VALUES ($1, $2, $3) RETURNING *',
      [complex_id, name, total_floors]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// --- UNITS ---
exports.createUnit = async (req, res, next) => {
  try {
    const { building_id, unit_number, floor, type, status } = req.body;
    const { rows } = await query(
      'INSERT INTO units (building_id, unit_number, floor, type, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [building_id, unit_number, floor, type, status || 'vacant']
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.listUnits = async (req, res, next) => {
  try {
    const { complexId } = req;
    let sql = `
      SELECT u.id, u.unit_number, u.type, u.status, b.name as building_name 
      FROM units u 
      JOIN buildings b ON u.building_id = b.id
    `;
    const params = [];

    if (complexId) {
      sql += ` WHERE b.complex_id = $1`;
      params.push(complexId);
    }
    
    sql += ` ORDER BY b.name, u.unit_number`;

    const { rows } = await query(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.updateUnitStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { complexId } = req;
    if (!status) return next(new AppError('Status is required', 400));

    // Verify unit belongs to admin's complex
    let sql = `UPDATE units SET status = $1 WHERE id = $2`;
    const params = [status, id];

    if (complexId) {
      sql += ` AND building_id IN (SELECT id FROM buildings WHERE complex_id = $3)`;
      params.push(complexId);
    }
    sql += ' RETURNING *';

    const { rows } = await query(sql, params);
    if (rows.length === 0) return next(new AppError('Unit not found or not in your complex', 404));

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.assignUserToUnit = async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params; // unit_id
    const { user_id, relation, moved_in_at } = req.body;

    await client.query('BEGIN');
    
    await client.query(
      `INSERT INTO user_units (user_id, unit_id, relation, moved_in_at)
       VALUES ($1, $2, $3, $4)`,
      [user_id, id, relation, moved_in_at || new Date()]
    );

    await client.query(`UPDATE units SET status = 'occupied' WHERE id = $1`, [id]);
    
    await client.query('COMMIT');

    res.status(200).json({ success: true, message: 'User assigned to unit successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// --- DASHBOARD STATS (multi-tenant scoped) ---
exports.getDashboardStats = async (req, res, next) => {
  try {
    const { complexId } = req;
    const cacheKey = `dashboard_stats_${complexId || 'global'}`;

    const cachedStats = await redis.getCache(cacheKey);
    if (cachedStats) {
      return res.status(200).json({ success: true, data: cachedStats, cached: true });
    }

    let residentsSQL, unitsSQL, revenueSQL, pendingSQL, visitorsSQL;

    if (complexId) {
      residentsSQL = query(
        `SELECT COUNT(DISTINCT u.id)
         FROM users u
         JOIN user_units uu ON uu.user_id = u.id AND uu.moved_out_at IS NULL
         JOIN units un ON uu.unit_id = un.id
         JOIN buildings b ON un.building_id = b.id
         WHERE u.role = 'resident' AND b.complex_id = $1`, [complexId]
      );
      unitsSQL = query(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN un.status = 'occupied' THEN 1 ELSE 0 END) AS occupied,
                SUM(CASE WHEN un.status = 'vacant' THEN 1 ELSE 0 END) AS vacant
         FROM units un
         JOIN buildings b ON un.building_id = b.id
         WHERE b.complex_id = $1`, [complexId]
      );
      revenueSQL = query(
        `SELECT COALESCE(SUM(p.amount), 0) AS total_revenue
         FROM payments p
         JOIN invoices i ON p.invoice_id = i.id
         JOIN units un ON i.unit_id = un.id
         JOIN buildings b ON un.building_id = b.id
         WHERE p.status = 'captured' AND b.complex_id = $1`, [complexId]
      );
      pendingSQL = query(
        `SELECT COUNT(*) AS pending
         FROM invoices i
         JOIN units un ON i.unit_id = un.id
         JOIN buildings b ON un.building_id = b.id
         WHERE i.status IN ('sent','draft') AND b.complex_id = $1`, [complexId]
      );
      visitorsSQL = query(
        `SELECT COUNT(*) FROM visitor_passes vp
         JOIN users u ON vp.host_user_id = u.id
         JOIN user_units uu ON uu.user_id = u.id AND uu.moved_out_at IS NULL
         JOIN units un ON uu.unit_id = un.id
         JOIN buildings b ON un.building_id = b.id
         WHERE vp.status = 'checked_in' AND b.complex_id = $1`, [complexId]
      );
    } else {
      residentsSQL = query("SELECT COUNT(*) FROM users WHERE role = 'resident'");
      unitsSQL = query(`SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) AS occupied,
                SUM(CASE WHEN status = 'vacant' THEN 1 ELSE 0 END) AS vacant FROM units`);
      revenueSQL = query("SELECT COALESCE(SUM(amount), 0) AS total_revenue FROM payments WHERE status = 'captured'");
      pendingSQL = query(`SELECT COUNT(*) AS pending FROM invoices WHERE status IN ('sent','draft')`);
      visitorsSQL = query("SELECT COUNT(*) FROM visitor_passes WHERE status = 'checked_in'");
    }

    const [residentsCount, unitsCount, revenueData, pendingData, visitorsCount] = await Promise.all([
      residentsSQL, unitsSQL, revenueSQL, pendingSQL, visitorsSQL
    ]);

    const stats = {
      total_residents: parseInt(residentsCount.rows[0].count),
      total_units: parseInt(unitsCount.rows[0].total) || 0,
      occupied_units: parseInt(unitsCount.rows[0].occupied) || 0,
      vacant_units: parseInt(unitsCount.rows[0].vacant) || 0,
      total_revenue: parseFloat(revenueData.rows[0].total_revenue) || 0,
      pending_invoices: parseInt(pendingData.rows[0].pending) || 0,
      active_visitors: parseInt(visitorsCount.rows[0].count),
    };

    await redis.setCache(cacheKey, stats, 60);
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};

// --- PAYMENT STATUS (multi-tenant scoped) ---
exports.getPaymentStatus = async (req, res, next) => {
  try {
    const { complexId } = req;
    const cacheKey = `payment_status_${complexId || 'global'}`;
    const cached = await redis.getCache(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const params = [];
    let complexClause = '';
    if (complexId) {
      params.push(complexId);
      complexClause = ` AND b.complex_id = $${params.length}`;
    }

    const { rows } = await query(`
      SELECT
        u.full_name,
        u.email,
        i.id          AS invoice_id,
        i.amount,
        i.status      AS invoice_status,
        i.due_date,
        p.status      AS payment_status
      FROM invoices i
      JOIN units un        ON i.unit_id   = un.id
      JOIN buildings b     ON un.building_id = b.id
      JOIN user_units uu   ON uu.unit_id  = un.id
      JOIN users u         ON uu.user_id  = u.id
      LEFT JOIN payments p ON p.invoice_id = i.id
      WHERE u.role = 'resident'${complexClause}
      ORDER BY i.due_date DESC
    `, params);

    const now = new Date();
    const paid = [];
    const unpaid = [];
    const overdue = [];

    rows.forEach((row) => {
      if (row.invoice_status === 'paid' || row.payment_status === 'captured') {
        paid.push(row);
      } else if (new Date(row.due_date) < now) {
        overdue.push(row);
      } else {
        unpaid.push(row);
      }
    });

    const data = { paid, unpaid, overdue };
    await redis.setCache(cacheKey, data, 60);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// --- ANALYTICS TRENDS (monthly revenue, payment counts, occupancy) ---
exports.getAnalyticsTrends = async (req, res, next) => {
  try {
    const { complexId } = req;
    const cacheKey = `analytics_trends_${complexId || 'global'}`;
    const cached = await redis.getCache(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached, cached: true });

    const params = [];
    let revenueJoin = '';
    let invoiceJoin = '';
    let revenueWhere = '';
    let invoiceWhere = '';

    if (complexId) {
      params.push(complexId);
      revenueJoin = `JOIN invoices inv ON p.invoice_id = inv.id
                     JOIN units un ON inv.unit_id = un.id
                     JOIN buildings b ON un.building_id = b.id`;
      revenueWhere = ` AND b.complex_id = $1`;
      invoiceJoin = `JOIN units un ON i.unit_id = un.id
                     JOIN buildings b ON un.building_id = b.id`;
      invoiceWhere = ` AND b.complex_id = $1`;
    }

    const [revenueRes, paymentCountsRes, occupancyRes] = await Promise.all([
      // Monthly revenue (last 12 months)
      query(`
        SELECT DATE_TRUNC('month', p.paid_at) AS month, COALESCE(SUM(p.amount), 0) AS revenue
        FROM payments p
        ${revenueJoin}
        WHERE p.status = 'captured' AND p.paid_at >= NOW() - INTERVAL '12 months'${revenueWhere}
        GROUP BY month ORDER BY month
      `, complexId ? [complexId] : []),

      // Monthly paid vs unpaid counts (last 12 months)
      query(`
        SELECT DATE_TRUNC('month', i.created_at) AS month,
          COUNT(*) FILTER (WHERE i.status = 'paid') AS paid_count,
          COUNT(*) FILTER (WHERE i.status IN ('sent','draft','overdue')) AS unpaid_count
        FROM invoices i
        ${invoiceJoin}
        WHERE i.created_at >= NOW() - INTERVAL '12 months'${invoiceWhere}
        GROUP BY month ORDER BY month
      `, complexId ? [complexId] : []),

      // Current occupancy
      query(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN un.status = 'occupied' THEN 1 ELSE 0 END) AS occupied,
          SUM(CASE WHEN un.status = 'vacant' THEN 1 ELSE 0 END) AS vacant
        FROM units un
        ${complexId ? 'JOIN buildings b ON un.building_id = b.id WHERE b.complex_id = $1' : ''}
      `, complexId ? [complexId] : []),
    ]);

    const total = parseInt(occupancyRes.rows[0].total) || 1;
    const occupied = parseInt(occupancyRes.rows[0].occupied) || 0;

    const data = {
      monthly_revenue: revenueRes.rows.map(r => ({
        month: r.month,
        revenue: parseFloat(r.revenue)
      })),
      payment_trends: paymentCountsRes.rows.map(r => ({
        month: r.month,
        paid: parseInt(r.paid_count),
        unpaid: parseInt(r.unpaid_count),
      })),
      occupancy: {
        total,
        occupied,
        vacant: parseInt(occupancyRes.rows[0].vacant) || 0,
        occupancy_pct: Math.round((occupied / total) * 100),
      },
    };

    await redis.setCache(cacheKey, data, 120);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
