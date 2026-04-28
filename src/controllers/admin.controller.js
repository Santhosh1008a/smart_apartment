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
      SELECT u.id, u.email, u.phone, u.full_name, u.role, u.is_active, u.created_at
      FROM users u
    `;

    if (role) {
      params.push(role);
      conditions.push(`u.role = $${params.length}`);
    }
    if (complexId) {
      params.push(complexId);
      conditions.push(`u.complex_id = $${params.length}`);
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
    const { complexId } = req;
    
    let sql = 'SELECT id, email, phone, full_name, role, is_active, avatar_url, created_at FROM users WHERE id = $1';
    const params = [id];
    
    if (complexId) {
      sql += ' AND complex_id = $2';
      params.push(complexId);
    }
    
    const { rows } = await query(sql, params);

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
    const { role, is_active, vendor_category } = req.body;
    const { complexId } = req;

    // Prevent assigning super_admin role
    if (role === 'super_admin') {
      return next(new AppError('Cannot assign super_admin role', 403));
    }

    // vendor role requires a category
    if (role === 'vendor' && !vendor_category) {
      return next(new AppError('vendor_category is required when assigning vendor role', 400));
    }

    const updates = [];
    const params = [];

    if (role !== undefined) {
      params.push(role);
      updates.push(`role = $${params.length}`);

      if (role === 'vendor' && vendor_category) {
        params.push(vendor_category);
        updates.push(`vendor_category = $${params.length}`);
        // Scope vendor to admin's complex
        if (complexId) {
          params.push(complexId);
          updates.push(`complex_id = $${params.length}`);
        }
      } else {
        // Clear vendor_category when switching away from vendor
        updates.push(`vendor_category = NULL`);
      }
    }

    if (is_active !== undefined) {
      params.push(is_active);
      updates.push(`is_active = $${params.length}`);
    }

    if (updates.length === 0) {
      return next(new AppError('No valid fields to update', 400));
    }

    params.push(id);
    const { rows } = await query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = now()
       WHERE id = $${params.length}
       RETURNING id, email, full_name, role, is_active, vendor_category, complex_id`,
      params
    );

    if (rows.length === 0) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};


// --- BUILDINGS ---
exports.createBuilding = async (req, res, next) => {
  try {
    const { name, total_floors } = req.body;
    const { complexId } = req;

    if (!complexId) return next(new AppError('Complex ID is required', 400));

    const { rows } = await query(
      'INSERT INTO buildings (complex_id, name, total_floors) VALUES ($1, $2, $3) RETURNING *',
      [complexId, name, total_floors || 1]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.listBuildings = async (req, res, next) => {
  try {
    const { complexId } = req;
    const { rows } = await query(
      `SELECT id, name, total_floors, created_at FROM buildings WHERE complex_id = $1 ORDER BY name ASC`,
      [complexId]
    );
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// --- UNITS ---
exports.createUnit = async (req, res, next) => {
  try {
    const { building_id, unit_number, floor, type, status } = req.body;
    const { complexId } = req;

    // Verify building belongs to admin's complex
    const buildingCheck = await query(
      'SELECT id FROM buildings WHERE id = $1 AND complex_id = $2',
      [building_id, complexId]
    );
    if (buildingCheck.rows.length === 0) {
      return next(new AppError('Building not found in your complex', 404));
    }

    const { rows } = await query(
      'INSERT INTO units (building_id, unit_number, floor, type, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [building_id, unit_number, floor, type, status || 'vacant']
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.bulkCreateUnits = async (req, res, next) => {
  let client;
  try {
    const { building_id, prefix, start, end, floor } = req.body;
    const { complexId } = req;

    // Verify building belongs to admin's complex
    const buildingCheck = await query(
      'SELECT id FROM buildings WHERE id = $1 AND complex_id = $2',
      [building_id, complexId]
    );
    if (buildingCheck.rows.length === 0) {
      return next(new AppError('Building not found in your complex', 404));
    }

    if (end - start > 100) {
      return next(new AppError('Cannot create more than 100 units at once', 400));
    }

    client = await getClient();
    await client.query('BEGIN');

    const created = [];
    for (let i = start; i <= end; i++) {
      const unitNumber = `${prefix}-${i}`;
      const { rows } = await client.query(
        `INSERT INTO units (building_id, unit_number, floor, type, status)
         VALUES ($1, $2, $3, 'apartment', 'vacant')
         ON CONFLICT (building_id, unit_number) DO NOTHING
         RETURNING *`,
        [building_id, unitNumber, floor || null]
      );
      if (rows.length > 0) created.push(rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: created, count: created.length });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    next(err);
  } finally {
    if (client) client.release();
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

// First definition removed — the full implementation is below (line ~667).
// exports.assignUserToUnit is defined once at the bottom of this file.

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
        `SELECT COUNT(u.id)
         FROM users u
         WHERE u.role = 'resident' AND u.complex_id = $1`, [complexId]
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
         WHERE vp.status = 'checked_in' AND u.complex_id = $1`, [complexId]
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
      JOIN user_units uu   ON uu.unit_id  = un.id
      JOIN users u         ON uu.user_id  = u.id
      LEFT JOIN payments p ON p.invoice_id = i.id
      WHERE u.role = 'resident'${complexId ? ' AND u.complex_id = $1' : ''}
      ORDER BY i.due_date DESC
    `, complexId ? [complexId] : []);

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

// --- ASSIGN vendor to a service request (admin only, complex-scoped) ---
exports.assignVendorToRequest = async (req, res, next) => {
  try {
    const { id } = req.params; // vendor_request id
    const { vendor_id } = req.body;
    const { complexId } = req;

    if (!vendor_id) {
      return next(new AppError('vendor_id is required', 400));
    }

    // Verify the vendor belongs to this complex and has vendor role
    const vendorCheck = await query(
      `SELECT id, full_name FROM users WHERE id = $1 AND role = 'vendor' AND complex_id = $2 AND is_active = true`,
      [vendor_id, complexId]
    );
    if (vendorCheck.rows.length === 0) {
      return next(new AppError('Vendor not found in your complex', 404));
    }

    // Verify the request belongs to this complex
    const requestCheck = await query(
      `SELECT vr.id, vr.status
       FROM vendor_requests vr
       JOIN units un ON vr.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       WHERE vr.id = $1 AND b.complex_id = $2`,
      [id, complexId]
    );
    if (requestCheck.rows.length === 0) {
      return next(new AppError('Service request not found in your complex', 404));
    }

    // Assign the vendor and update status to 'assigned'
    const { rows } = await query(
      `UPDATE vendor_requests
       SET assigned_vendor_id = $1, status = 'assigned'
       WHERE id = $2
       RETURNING *`,
      [vendor_id, id]
    );

    // Notify the vendor about the new assignment
    const io = req.app.get('io');
    const { notify } = require('../services/notification.service');
    notify(io, vendor_id, 'job_assigned',
      'New Job Assigned',
      `You have been assigned a new ${rows[0].category} job.`,
      { request_id: rows[0].id, category: rows[0].category, priority: rows[0].priority }
    ).catch(() => {});

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// --- LIST vendors in admin's complex ---
exports.listVendorsInComplex = async (req, res, next) => {
  try {
    const { complexId } = req;

    const { rows } = await query(
      `SELECT id, full_name, email, phone
       FROM users
       WHERE role = 'vendor' AND complex_id = $1 AND is_active = true
       ORDER BY full_name`,
      [complexId]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// --- LIST security personnel in admin's complex ---
exports.listSecurityInComplex = async (req, res, next) => {
  try {
    const { complexId } = req;

    const { rows } = await query(
      `SELECT id, full_name, email, phone
       FROM users
       WHERE role = 'security' AND complex_id = $1 AND is_active = true
       ORDER BY full_name`,
      [complexId]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// --- UPDATE unit status (admin) ---
exports.updateUnitStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { complexId } = req;

    // Verify unit belongs to admin's complex
    const unitCheck = await query(
      `SELECT un.id FROM units un
       JOIN buildings b ON un.building_id = b.id
       WHERE un.id = $1 AND b.complex_id = $2`,
      [id, complexId]
    );
    if (unitCheck.rows.length === 0) {
      return next(new AppError('Unit not found in your complex', 404));
    }

    const { rows } = await query(
      `UPDATE units SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// --- LIST vendor users scoped to admin's complex ---
exports.listVendorsInComplex = async (req, res, next) => {
  try {
    const { complexId } = req;
    let sql = `SELECT id, full_name, email, phone, vendor_category, is_active
               FROM users
               WHERE role = 'vendor' AND is_active = true`;
    const params = [];
    if (complexId) {
      sql += ` AND complex_id = $1`;
      params.push(complexId);
    }
    sql += ` ORDER BY vendor_category, full_name`;
    const { rows } = await query(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// --- ASSIGN a vendor user to a vendor_request ---
exports.assignVendorToRequest = async (req, res, next) => {
  try {
    const { id } = req.params;          // vendor_request id
    const { vendor_id } = req.body;
    const { complexId } = req;

    if (!vendor_id) {
      return next(new AppError('vendor_id is required', 400));
    }

    // Verify user has vendor role and is active (no complex restriction — vendors can serve any complex)
    const vendorCheck = await query(
      `SELECT id, full_name, vendor_category FROM users WHERE id = $1 AND role = 'vendor' AND is_active = true`,
      [vendor_id]
    );
    if (vendorCheck.rows.length === 0) {
      return next(new AppError('Vendor not found', 404));
    }

    const { rows } = await query(
      `UPDATE vendor_requests 
       SET assigned_vendor_id = $1, status = 'assigned'
       WHERE id = $2 RETURNING *`,
      [vendor_id, id]
    );

    if (rows.length === 0) {
      return next(new AppError('Vendor request not found', 404));
    }

    // Notify the assigned vendor
    const io = req.app.get('io');
    const { notify } = require('../services/notification.service');
    notify(io, vendor_id, 'job_assigned',
      'New Job Assigned',
      `You have been assigned a ${rows[0].category} service request.`,
      { request_id: rows[0].id, category: rows[0].category }
    ).catch(() => {});

    res.status(200).json({
      success: true,
      message: `Request assigned to ${vendorCheck.rows[0].full_name}`,
      data: rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// --- ASSIGN user to unit (admin) ---
exports.assignUserToUnit = async (req, res, next) => {
  const client = await getClient();
  try {
    const unitId = req.params.id;
    const { user_id, relation, moved_in_at } = req.body;
    const { complexId } = req;

    // 1. Verify unit belongs to admin's complex
    let unitSql, unitParams;
    if (complexId) {
      unitSql = `SELECT un.id, un.unit_number, un.status, b.name AS building_name
                 FROM units un
                 JOIN buildings b ON un.building_id = b.id
                 WHERE un.id = $1 AND b.complex_id = $2`;
      unitParams = [unitId, complexId];
    } else {
      unitSql = `SELECT un.id, un.unit_number, un.status, b.name AS building_name
                 FROM units un
                 JOIN buildings b ON un.building_id = b.id
                 WHERE un.id = $1`;
      unitParams = [unitId];
    }
    const unitCheck = await query(unitSql, unitParams);
    if (unitCheck.rows.length === 0) {
      return next(new AppError('Unit not found in your complex', 404));
    }

    // 2. Verify user exists (and is in the same complex if complexId is available)
    let userSql, userParams;
    if (complexId) {
      userSql = `SELECT id, full_name, role FROM users WHERE id = $1 AND complex_id = $2 AND is_active = true`;
      userParams = [user_id, complexId];
    } else {
      userSql = `SELECT id, full_name, role FROM users WHERE id = $1 AND is_active = true`;
      userParams = [user_id];
    }
    const userCheck = await query(userSql, userParams);
    if (userCheck.rows.length === 0) {
      return next(new AppError('User not found in your complex', 404));
    }

    await client.query('BEGIN');

    // 3. If user already has an active mapping, move them out first
    await client.query(
      `UPDATE user_units SET moved_out_at = now()
       WHERE user_id = $1 AND moved_out_at IS NULL`,
      [user_id]
    );

    // 4. Insert new mapping
    const mappingResult = await client.query(
      `INSERT INTO user_units (user_id, unit_id, relation, moved_in_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, unitId, relation || 'owner', moved_in_at || new Date()]
    );

    // 5. Mark new unit as occupied
    await client.query(
      `UPDATE units SET status = 'occupied' WHERE id = $1`,
      [unitId]
    );

    await client.query('COMMIT');

    const unit = unitCheck.rows[0];
    const user = userCheck.rows[0];

    res.status(201).json({
      success: true,
      message: `${user.full_name} assigned to ${unit.building_name} - ${unit.unit_number}`,
      data: mappingResult.rows[0],
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    next(err);
  } finally {
    if (client) client.release();
  }
};
