const { query, getClient } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');

const activeAssignmentClause = "pa.status = 'active' AND pa.assigned_until IS NULL";
const activeAssignmentWhere = "status = 'active' AND assigned_until IS NULL";

const normalizeVehicleNumber = (value) => String(value || '').trim().toUpperCase();

const getResidentUnit = async (userId, complexId) => {
  const { rows } = await query(
    `SELECT un.id AS unit_id, un.unit_number, b.name AS building_name, b.complex_id
     FROM user_units uu
     JOIN units un ON uu.unit_id = un.id
     JOIN buildings b ON un.building_id = b.id
     WHERE uu.user_id = $1
       AND uu.moved_out_at IS NULL
       AND b.complex_id = $2
     ORDER BY uu.moved_in_at DESC NULLS LAST
     LIMIT 1`,
    [userId, complexId]
  );
  return rows[0] || null;
};

const ensureUnitInComplex = async (unitId, complexId) => {
  const { rows } = await query(
    `SELECT un.id, un.unit_number, b.name AS building_name
     FROM units un
     JOIN buildings b ON un.building_id = b.id
     WHERE un.id = $1 AND b.complex_id = $2`,
    [unitId, complexId]
  );
  return rows[0] || null;
};

const ensureSlotInComplex = async (slotId, complexId) => {
  const { rows } = await query(
    `SELECT id, display_name, status, slot_kind
     FROM parking_slots
     WHERE id = $1 AND complex_id = $2`,
    [slotId, complexId]
  );
  return rows[0] || null;
};

exports.getAdminOverview = async (req, res, next) => {
  try {
    const { complexId } = req;
    const { rows } = await query(
      `SELECT
         COUNT(*)::int AS total_slots,
         COUNT(*) FILTER (WHERE status = 'available')::int AS available_slots,
         COUNT(*) FILTER (WHERE status IN ('occupied', 'assigned'))::int AS occupied_slots,
         COUNT(*) FILTER (WHERE slot_kind = 'visitor')::int AS visitor_slots,
         (SELECT COUNT(*)::int FROM parking_requests WHERE complex_id = $1 AND status = 'pending') AS pending_requests,
         (SELECT COUNT(*)::int FROM parking_vehicles WHERE complex_id = $1 AND is_active = true) AS registered_vehicles
       FROM parking_slots
       WHERE complex_id = $1`,
      [complexId]
    );

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.listSlots = async (req, res, next) => {
  try {
    const { complexId } = req;
    const { status, slot_kind } = req.query;
    const params = [complexId];
    const filters = ['ps.complex_id = $1'];

    if (status) {
      params.push(status);
      filters.push(`ps.status = $${params.length}`);
    }

    if (slot_kind) {
      params.push(slot_kind);
      filters.push(`ps.slot_kind = $${params.length}`);
    }

    const { rows } = await query(
      `SELECT ps.id, ps.display_name, ps.parking_area, ps.slot_label, ps.parking_type,
              ps.slot_kind, ps.status, ps.notes, ps.created_at, b.name AS building_name,
              pa.id AS assignment_id, pa.unit_id, pa.vehicle_id,
              un.unit_number, ub.name AS unit_building_name,
              COALESCE(pv.vehicle_number, pa.vehicle_number) AS vehicle_number,
              COALESCE(pv.vehicle_type, pa.vehicle_type) AS vehicle_type,
              resident.full_name AS resident_name
       FROM parking_slots ps
       LEFT JOIN buildings b ON ps.building_id = b.id
       LEFT JOIN parking_assignments pa ON pa.slot_id = ps.id AND ${activeAssignmentClause}
       LEFT JOIN units un ON pa.unit_id = un.id
       LEFT JOIN buildings ub ON un.building_id = ub.id
       LEFT JOIN parking_vehicles pv ON pa.vehicle_id = pv.id
       LEFT JOIN users resident ON pv.resident_id = resident.id
       WHERE ${filters.join(' AND ')}
       ORDER BY ps.slot_kind, ps.parking_area, ps.display_name`,
      params
    );

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.createSlot = async (req, res, next) => {
  try {
    const { complexId } = req;
    const {
      display_name,
      parking_area,
      slot_label,
      building_id,
      parking_type,
      slot_kind,
      status,
      notes,
    } = req.body;

    if (building_id) {
      const { rows } = await query('SELECT id FROM buildings WHERE id = $1 AND complex_id = $2', [building_id, complexId]);
      if (rows.length === 0) return next(new AppError('Building not found in your society', 404));
    }

    const friendlyName = display_name || [parking_area, slot_label ? `Slot ${slot_label}` : null].filter(Boolean).join(' - ');
    if (!friendlyName) return next(new AppError('A clear parking name is required', 400));
    const legacySlotNumber = String(slot_label || friendlyName).trim().slice(0, 10);

    const { rows } = await query(
      `INSERT INTO parking_slots
         (complex_id, building_id, display_name, parking_area, slot_label, slot_number,
          parking_type, slot_kind, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, display_name, parking_area, slot_label, parking_type, slot_kind, status, notes`,
      [
        complexId,
        building_id || null,
        friendlyName.trim(),
        parking_area || null,
        slot_label || null,
        legacySlotNumber,
        parking_type || 'car',
        slot_kind || 'resident',
        status || 'available',
        notes || null,
      ]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return next(new AppError('A parking slot with this name already exists in your society', 409));
    next(err);
  }
};

exports.updateSlot = async (req, res, next) => {
  try {
    const { complexId } = req;
    const { id } = req.params;
    const updates = [];
    const params = [];
    const allowed = ['display_name', 'parking_area', 'slot_label', 'parking_type', 'slot_kind', 'status', 'notes'];

    const slot = await ensureSlotInComplex(id, complexId);
    if (!slot) return next(new AppError('Parking slot not found in your society', 404));

    if (req.body.status === 'available') {
      const active = await query(
        `SELECT id FROM parking_assignments WHERE slot_id = $1 AND ${activeAssignmentWhere} LIMIT 1`,
        [id]
      );
      if (active.rows.length > 0) {
        return next(new AppError('Release the active assignment before marking this slot available', 400));
      }
    }

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        params.push(req.body[field]);
        updates.push(`${field} = $${params.length}`);
      }
    });

    if (updates.length === 0) return next(new AppError('No valid fields to update', 400));

    params.push(id, complexId);
    const { rows } = await query(
      `UPDATE parking_slots
       SET ${updates.join(', ')}, updated_at = now()
       WHERE id = $${params.length - 1} AND complex_id = $${params.length}
       RETURNING id, display_name, parking_area, slot_label, parking_type, slot_kind, status, notes`,
      params
    );

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return next(new AppError('A parking slot with this name already exists in your society', 409));
    next(err);
  }
};

exports.listVehicles = async (req, res, next) => {
  try {
    const { complexId } = req;
    const { unit_id } = req.query;
    const params = [complexId];
    const filters = ['pv.complex_id = $1', 'pv.is_active = true'];

    if (unit_id) {
      params.push(unit_id);
      filters.push(`pv.unit_id = $${params.length}`);
    }

    const { rows } = await query(
      `SELECT pv.*, un.unit_number, b.name AS building_name, u.full_name AS resident_name
       FROM parking_vehicles pv
       JOIN units un ON pv.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       JOIN users u ON pv.resident_id = u.id
       WHERE ${filters.join(' AND ')}
       ORDER BY b.name, un.unit_number, pv.vehicle_number`,
      params
    );

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.createVehicle = async (req, res, next) => {
  try {
    const { complexId } = req;
    const residentUnit = await getResidentUnit(req.user.id, complexId);
    if (!residentUnit) return next(new AppError('Your account is not linked to a unit in this society', 403));

    const { vehicle_number, vehicle_type, make_model, color } = req.body;
    const { rows } = await query(
      `INSERT INTO parking_vehicles
         (complex_id, unit_id, resident_id, vehicle_number, vehicle_type, make_model, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        complexId,
        residentUnit.unit_id,
        req.user.id,
        normalizeVehicleNumber(vehicle_number),
        vehicle_type || 'car',
        make_model || null,
        color || null,
      ]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return next(new AppError('This vehicle is already registered in your society', 409));
    next(err);
  }
};

exports.assignSlot = async (req, res, next) => {
  const client = await getClient();
  try {
    const { complexId } = req;
    const { slot_id, unit_id, vehicle_id, notes } = req.body;

    const [slot, unit] = await Promise.all([
      ensureSlotInComplex(slot_id, complexId),
      ensureUnitInComplex(unit_id, complexId),
    ]);

    if (!slot) return next(new AppError('Parking slot not found in your society', 404));
    if (!unit) return next(new AppError('Unit not found in your society', 404));
    if (!['available', 'reserved'].includes(slot.status)) {
      return next(new AppError('This parking slot is not available for assignment', 400));
    }

    let vehicle = null;
    if (vehicle_id) {
      const vehicleRes = await query(
        `SELECT id, vehicle_number, vehicle_type FROM parking_vehicles
         WHERE id = $1 AND complex_id = $2 AND unit_id = $3 AND is_active = true`,
        [vehicle_id, complexId, unit_id]
      );
      vehicle = vehicleRes.rows[0] || null;
      if (!vehicle) return next(new AppError('Vehicle not found for this unit in your society', 404));
    }

    await client.query('BEGIN');
    const activeSlot = await client.query(
      `SELECT id FROM parking_assignments WHERE slot_id = $1 AND ${activeAssignmentWhere} FOR UPDATE`,
      [slot_id]
    );
    if (activeSlot.rows.length > 0) {
      await client.query('ROLLBACK');
      return next(new AppError('This parking slot already has an active assignment', 409));
    }

    const { rows } = await client.query(
      `INSERT INTO parking_assignments
         (complex_id, slot_id, unit_id, vehicle_id, vehicle_number, vehicle_type,
          assigned_from, assigned_by, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, now(), $7, $8, 'active')
       RETURNING *`,
      [
        complexId,
        slot_id,
        unit_id,
        vehicle_id || null,
        vehicle?.vehicle_number || null,
        vehicle?.vehicle_type || null,
        req.user.id,
        notes || null,
      ]
    );

    await client.query(
      `UPDATE parking_slots SET status = 'occupied', updated_at = now() WHERE id = $1 AND complex_id = $2`,
      [slot_id, complexId]
    );
    await client.query('COMMIT');

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};

exports.releaseAssignment = async (req, res, next) => {
  const client = await getClient();
  try {
    const { complexId } = req;
    const { id } = req.params;

    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE parking_assignments
       SET status = 'released', assigned_until = now(), updated_at = now()
       WHERE id = $1 AND complex_id = $2 AND ${activeAssignmentWhere}
       RETURNING slot_id`,
      [id, complexId]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return next(new AppError('Active parking assignment not found in your society', 404));
    }

    await client.query(
      `UPDATE parking_slots SET status = 'available', updated_at = now() WHERE id = $1 AND complex_id = $2`,
      [rows[0].slot_id, complexId]
    );
    await client.query('COMMIT');

    res.status(200).json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};

exports.getMyParking = async (req, res, next) => {
  try {
    const { complexId } = req;
    const residentUnit = await getResidentUnit(req.user.id, complexId);
    if (!residentUnit) {
      return res.status(200).json({ success: true, data: { unit: null, vehicles: [], assignments: [], requests: [] } });
    }

    const [vehicles, assignments, requests] = await Promise.all([
      query(
        `SELECT * FROM parking_vehicles
         WHERE complex_id = $1 AND unit_id = $2 AND resident_id = $3 AND is_active = true
         ORDER BY created_at DESC`,
        [complexId, residentUnit.unit_id, req.user.id]
      ),
      query(
        `SELECT pa.id, pa.assigned_from, ps.display_name, ps.parking_area, ps.parking_type,
                COALESCE(pv.vehicle_number, pa.vehicle_number) AS vehicle_number,
                COALESCE(pv.vehicle_type, pa.vehicle_type) AS vehicle_type,
                pv.make_model, pv.color
         FROM parking_assignments pa
         JOIN parking_slots ps ON pa.slot_id = ps.id
         LEFT JOIN parking_vehicles pv ON pa.vehicle_id = pv.id
         WHERE pa.complex_id = $1
           AND pa.unit_id = $2
           AND pa.status = 'active' AND pa.assigned_until IS NULL
         ORDER BY pa.assigned_from DESC`,
        [complexId, residentUnit.unit_id]
      ),
      query(
        `SELECT pr.*, pv.vehicle_number
         FROM parking_requests pr
         LEFT JOIN parking_vehicles pv ON pr.vehicle_id = pv.id
         WHERE pr.complex_id = $1 AND pr.unit_id = $2 AND pr.resident_id = $3
         ORDER BY pr.created_at DESC`,
        [complexId, residentUnit.unit_id, req.user.id]
      ),
    ]);

    res.status(200).json({
      success: true,
      data: {
        unit: residentUnit,
        vehicles: vehicles.rows,
        assignments: assignments.rows,
        requests: requests.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.createRequest = async (req, res, next) => {
  try {
    const { complexId } = req;
    const residentUnit = await getResidentUnit(req.user.id, complexId);
    if (!residentUnit) return next(new AppError('Your account is not linked to a unit in this society', 403));

    const { vehicle_id, request_type, reason } = req.body;
    if (vehicle_id) {
      const vehicle = await query(
        `SELECT id FROM parking_vehicles
         WHERE id = $1 AND complex_id = $2 AND unit_id = $3 AND resident_id = $4 AND is_active = true`,
        [vehicle_id, complexId, residentUnit.unit_id, req.user.id]
      );
      if (vehicle.rows.length === 0) return next(new AppError('Vehicle not found for your unit', 404));
    }

    const { rows } = await query(
      `INSERT INTO parking_requests
         (complex_id, unit_id, resident_id, vehicle_id, request_type, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [complexId, residentUnit.unit_id, req.user.id, vehicle_id || null, request_type || 'extra_parking', reason || null]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.listRequests = async (req, res, next) => {
  try {
    const { complexId } = req;
    const { status } = req.query;
    const params = [complexId];
    const filters = ['pr.complex_id = $1'];

    if (status) {
      params.push(status);
      filters.push(`pr.status = $${params.length}`);
    }

    const { rows } = await query(
      `SELECT pr.*, pv.vehicle_number, u.full_name AS resident_name,
              un.unit_number, b.name AS building_name
       FROM parking_requests pr
       JOIN users u ON pr.resident_id = u.id
       JOIN units un ON pr.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       LEFT JOIN parking_vehicles pv ON pr.vehicle_id = pv.id
       WHERE ${filters.join(' AND ')}
       ORDER BY CASE pr.status WHEN 'pending' THEN 1 WHEN 'approved' THEN 2 ELSE 3 END,
                pr.created_at DESC`,
      params
    );

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.reviewRequest = async (req, res, next) => {
  try {
    const { complexId } = req;
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const { rows } = await query(
      `UPDATE parking_requests
       SET status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now()
       WHERE id = $4 AND complex_id = $5 AND status = 'pending'
       RETURNING *`,
      [status, admin_notes || null, req.user.id, id, complexId]
    );

    if (rows.length === 0) return next(new AppError('Pending parking request not found in your society', 404));

    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.createVisitorSession = async (req, res, next) => {
  const client = await getClient();
  try {
    const { complexId } = req;
    const { slot_id, visitor_name, visitor_phone, vehicle_number, host_unit_id, visitor_pass_id, notes } = req.body;

    if (host_unit_id) {
      const unit = await ensureUnitInComplex(host_unit_id, complexId);
      if (!unit) return next(new AppError('Host unit not found in your society', 404));
    }

    if (slot_id) {
      const slot = await ensureSlotInComplex(slot_id, complexId);
      if (!slot) return next(new AppError('Visitor parking slot not found in your society', 404));
      if (!['available', 'reserved'].includes(slot.status)) {
        return next(new AppError('Selected visitor parking slot is not available', 400));
      }
    }

    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO visitor_parking_sessions
         (complex_id, slot_id, visitor_pass_id, visitor_name, visitor_phone, vehicle_number,
          host_unit_id, checked_in_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        complexId,
        slot_id || null,
        visitor_pass_id || null,
        visitor_name,
        visitor_phone || null,
        normalizeVehicleNumber(vehicle_number),
        host_unit_id || null,
        req.user.id,
        notes || null,
      ]
    );

    if (slot_id) {
      await client.query(`UPDATE parking_slots SET status = 'occupied', updated_at = now() WHERE id = $1`, [slot_id]);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};

exports.releaseVisitorSession = async (req, res, next) => {
  const client = await getClient();
  try {
    const { complexId } = req;
    const { id } = req.params;

    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE visitor_parking_sessions
       SET status = 'released', released_by = $1, released_at = now()
       WHERE id = $2 AND complex_id = $3 AND status = 'active'
       RETURNING slot_id`,
      [req.user.id, id, complexId]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return next(new AppError('Active visitor parking session not found in your society', 404));
    }

    if (rows[0].slot_id) {
      await client.query(`UPDATE parking_slots SET status = 'available', updated_at = now() WHERE id = $1`, [rows[0].slot_id]);
    }

    await client.query('COMMIT');
    res.status(200).json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
};

exports.listVisitorSessions = async (req, res, next) => {
  try {
    const { complexId } = req;
    const { status = 'active' } = req.query;
    const { rows } = await query(
      `SELECT vps.*, ps.display_name, un.unit_number, b.name AS building_name
       FROM visitor_parking_sessions vps
       LEFT JOIN parking_slots ps ON vps.slot_id = ps.id
       LEFT JOIN units un ON vps.host_unit_id = un.id
       LEFT JOIN buildings b ON un.building_id = b.id
       WHERE vps.complex_id = $1 AND vps.status = $2
       ORDER BY vps.checked_in_at DESC`,
      [complexId, status]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.verifyVehicle = async (req, res, next) => {
  try {
    const { complexId } = req;
    const vehicleNumber = normalizeVehicleNumber(req.query.vehicle_number);
    if (!vehicleNumber) return next(new AppError('Vehicle number is required', 400));

    const residentVehicle = await query(
      `SELECT pv.vehicle_number, pv.vehicle_type, pv.make_model, pv.color,
              u.full_name AS resident_name, un.unit_number, b.name AS building_name,
              ps.display_name AS parking_slot, ps.parking_area
       FROM parking_vehicles pv
       JOIN users u ON pv.resident_id = u.id
       JOIN units un ON pv.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       LEFT JOIN parking_assignments pa ON pa.vehicle_id = pv.id AND ${activeAssignmentClause}
       LEFT JOIN parking_slots ps ON pa.slot_id = ps.id
       WHERE pv.complex_id = $1
         AND UPPER(pv.vehicle_number) = $2
         AND pv.is_active = true
       LIMIT 1`,
      [complexId, vehicleNumber]
    );

    if (residentVehicle.rows.length > 0) {
      return res.status(200).json({
        success: true,
        data: { type: 'resident', found: true, vehicle: residentVehicle.rows[0] },
      });
    }

    const assignedVehicle = await query(
      `SELECT pa.vehicle_number, pa.vehicle_type,
              un.unit_number, b.name AS building_name,
              ps.display_name AS parking_slot, ps.parking_area
       FROM parking_assignments pa
       JOIN units un ON pa.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       JOIN parking_slots ps ON pa.slot_id = ps.id
       WHERE pa.complex_id = $1
         AND UPPER(pa.vehicle_number) = $2
         AND ${activeAssignmentWhere}
       LIMIT 1`,
      [complexId, vehicleNumber]
    );

    if (assignedVehicle.rows.length > 0) {
      return res.status(200).json({
        success: true,
        data: { type: 'resident', found: true, vehicle: assignedVehicle.rows[0] },
      });
    }

    const visitorVehicle = await query(
      `SELECT vps.vehicle_number, vps.visitor_name, vps.visitor_phone, vps.checked_in_at,
              ps.display_name AS parking_slot, un.unit_number, b.name AS building_name
       FROM visitor_parking_sessions vps
       LEFT JOIN parking_slots ps ON vps.slot_id = ps.id
       LEFT JOIN units un ON vps.host_unit_id = un.id
       LEFT JOIN buildings b ON un.building_id = b.id
       WHERE vps.complex_id = $1
         AND UPPER(vps.vehicle_number) = $2
         AND vps.status = 'active'
       LIMIT 1`,
      [complexId, vehicleNumber]
    );

    if (visitorVehicle.rows.length > 0) {
      return res.status(200).json({
        success: true,
        data: { type: 'visitor', found: true, vehicle: visitorVehicle.rows[0] },
      });
    }

    res.status(200).json({ success: true, data: { found: false } });
  } catch (err) {
    next(err);
  }
};
