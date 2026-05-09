const { GoogleGenerativeAI } = require('@google/generative-ai');
const { query } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');
const auditLogger = require('../utils/auditLogger');
const logger = require('../utils/logger');

const FALLBACK_MESSAGE = 'I could not find matching society information for that request.';
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const MAX_ROWS = 8;
const ASSISTANT_DEBUG = process.env.ASSISTANT_DEBUG === 'true';
const CHAT_HISTORY_LIMIT = 6;
const CHAT_HISTORY_TTL_MS = 30 * 60 * 1000;
const chatSessions = new Map();

console.log('Gemini initialized');

const ROLE_LABELS = {
  resident: 'Resident',
  admin: 'Admin',
  security: 'Security Guard',
  vendor: 'Vendor',
  super_admin: 'Super Admin',
};

const sanitizePrompt = (value) => String(value || '')
  .replace(/[\u0000-\u001f\u007f]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 500);

const isSuspiciousPrompt = (prompt) => {
  return /\b(ignore|bypass|override|system prompt|developer message|sql|select|insert|update|delete|drop|truncate|alter|cross tenant|all tenants)\b/i.test(prompt);
};

const count = (value) => Number.parseInt(value || 0, 10) || 0;
const hasRows = (value) => Array.isArray(value) && value.length > 0;
const hasGeminiKey = () => {
  const key = process.env.GEMINI_API_KEY;
  return key && key !== 'replace_with_your_gemini_api_key';
};
const getGeminiModel = (systemInstruction, maxOutputTokens = 220) => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens,
    },
  });
};
const getChatHistory = (userId) => {
  const current = chatSessions.get(userId);
  if (!current || Date.now() - current.updatedAt > CHAT_HISTORY_TTL_MS) return [];
  return current.history;
};
const saveChatTurn = (userId, userMessage, assistantMessage) => {
  const history = [
    ...getChatHistory(userId),
    { role: 'user', parts: [{ text: userMessage }] },
    { role: 'model', parts: [{ text: assistantMessage }] },
  ].slice(-CHAT_HISTORY_LIMIT * 2);
  chatSessions.set(userId, { updatedAt: Date.now(), history });
};

const requireComplex = (role, complexId) => {
  if (role !== 'super_admin' && !complexId) {
    throw new AppError('You must be assigned to a society to use the assistant.', 403);
  }
};

const resolveAssistantContext = async (user, complexId) => {
  if (user.role === 'super_admin') {
    return {
      userId: user.id,
      role: user.role,
      complexId: complexId || null,
      residentId: null,
      unitIds: [],
      buildingIds: [],
    };
  }

  const resolvedComplexId = complexId || user.complex_id || null;
  const { rows } = await query(
    `SELECT un.id AS unit_id, un.unit_number, b.id AS building_id, b.name AS building_name, b.complex_id
     FROM user_units uu
     JOIN units un ON uu.unit_id = un.id
     JOIN buildings b ON un.building_id = b.id
     WHERE uu.user_id = $1
       AND uu.moved_out_at IS NULL
       AND ($2::uuid IS NULL OR b.complex_id = $2)
     ORDER BY uu.moved_in_at DESC NULLS LAST`,
    [user.id, resolvedComplexId]
  );

  return {
    userId: user.id,
    role: user.role,
    complexId: resolvedComplexId || rows[0]?.complex_id || null,
    residentId: user.role === 'resident' ? user.id : null,
    unitIds: rows.map((row) => row.unit_id),
    buildingIds: [...new Set(rows.map((row) => row.building_id).filter(Boolean))],
    primaryUnitId: rows[0]?.unit_id || null,
    primaryBuildingId: rows[0]?.building_id || null,
  };
};

const getResultCount = (result) => {
  if (!result) return 0;
  if (Array.isArray(result.data)) return result.data.length;
  if (result.data?.my_assignments) return result.data.my_assignments.length;
  return result.empty ? 0 : 1;
};

const getResultPreview = (result) => {
  if (!result) return null;
  if (Array.isArray(result.data)) return result.data.slice(0, 3);
  return result.data || result.summary || null;
};

const isNonEmptyValue = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  if (!value || typeof value !== 'object') return value !== null && value !== undefined && value !== '';
  return Object.values(value).some((item) => {
    if (Array.isArray(item)) return item.length > 0;
    if (item && typeof item === 'object') return isNonEmptyValue(item);
    if (typeof item === 'number') return true;
    return item !== null && item !== undefined && item !== '';
  });
};

const hasPositiveMetric = (value) => {
  if (Array.isArray(value)) return value.some(hasPositiveMetric);
  if (!value || typeof value !== 'object') return Number(value) > 0;
  return Object.values(value).some(hasPositiveMetric);
};

const makeResult = ({ title, service, queryName, data, summary = null, empty = null }) => {
  const resultData = data === undefined ? [] : data;
  const rowCount = Array.isArray(resultData) ? resultData.length : (isNonEmptyValue(resultData) ? 1 : 0);
  return {
    title,
    service,
    queryName,
    empty: empty === null ? rowCount === 0 : empty,
    rows: rowCount,
    data: resultData,
    summary,
  };
};

const classifyIntent = (message, role) => {
  const text = message.toLowerCase();

  if (/\b(complaint|complaints|grievance|issue ticket)\b/.test(text)) return 'complaints';
  if (/\b(unpaid|due|dues|pending bill|outstanding|owe|invoice)\b/.test(text)) {
    logger.info('AI intent route: dues -> invoices intent');
    return role === 'admin' || role === 'super_admin' ? 'overdue_payments' : 'my_unpaid_invoices';
  }
  if (/\b(overdue|defaulter|late payment|pending payment)\b/.test(text)) return 'overdue_payments';
  if (/\b(visitor|visitors|guest|guests)\b/.test(text)) {
    logger.info('AI intent route: visitors -> visitors intent');
    return 'today_visitors';
  }
  if (/\b(parking|slot|slots|vacant|available)\b/.test(text)) {
    logger.info('AI intent route: parking -> parking intent');
    return 'parking_status';
  }
  if (/\b(emergency|emergencies|alert|alerts|sos)\b/.test(text)) {
    logger.info('AI intent route: emergency -> emergency intent');
    return 'active_emergencies';
  }
  if (/\b(job|jobs|work order|service request|vendor request|assigned to me)\b/.test(text)) return 'jobs';
  if (/\b(notification|notifications|unread|message|messages)\b/.test(text)) return 'notifications';
  if (/\b(analytics|dashboard|stats|statistics|insights|summary|overview|revenue|society|societies|users|residents|units|how many)\b/.test(text)) return 'analytics';

  return 'unknown';
};

// Returns true for simple factual queries that don't need Gemini formatting
const isFactualIntent = (intent, message) => {
  const text = message.toLowerCase();
  // Exact count / status questions → use deterministic humanFallbackResponse directly
  const factualPatterns = [
    /^how many\b/,
    /\bhow many (residents|users|units|visitors|slots|jobs)\b/,
    /\b(count|total|number of)\b/,
    /\b(do i have|is there|are there)\b.*\b(due|dues|invoice|visitor|parking|job|notification)\b/,
    /\bmy (dues|invoices|parking|visitors|jobs|notifications)\b/,
    /\bshow (my|today|current|active)\b/,
    /\blist\b/,
  ];
  const insightPatterns = [
    /\b(insight|recommend|suggest|analyse|analyze|what should|advice|trend|why|explain|tell me about)\b/,
    /\b(summary of|give me a|overview of|breakdown|compare)\b/,
  ];
  // If the message explicitly asks for insight/analysis → always use Gemini
  if (insightPatterns.some((p) => p.test(text))) return false;
  // If the intent is resolved and the message matches a factual pattern → skip Gemini
  if (intent !== 'unknown' && factualPatterns.some((p) => p.test(text))) return true;
  return false;
};

const getMyUnpaidInvoices = async ({ user, complexId, context }) => {
  requireComplex(user.role, complexId);
  if (!context.unitIds.length) {
    return {
      title: 'Unpaid Dues',
      empty: true,
      data: [],
      summary: { unpaid_count: 0, total_due: 0 },
    };
  }

  const { rows } = await query(
    `SELECT i.id, i.type, i.amount, i.due_date, i.status, un.unit_number, b.name AS building_name
     FROM invoices i
     JOIN units un ON i.unit_id = un.id
     JOIN buildings b ON un.building_id = b.id
     WHERE i.unit_id = ANY($1::uuid[])
       AND b.complex_id = $2
       AND i.status NOT IN ('paid', 'waived', 'cancelled')
     ORDER BY i.due_date ASC
     LIMIT ${MAX_ROWS}`,
    [context.unitIds, complexId]
  );

  return {
    title: 'Unpaid Dues',
    empty: !hasRows(rows),
    data: rows,
    summary: {
      unpaid_count: rows.length,
      total_due: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    },
  };
};

const getOverduePayments = async ({ user, complexId }) => {
  if (!['admin', 'super_admin'].includes(user.role)) throw new AppError('Forbidden', 403);
  const params = [];
  const filters = ["i.status NOT IN ('paid', 'waived')", 'i.due_date < CURRENT_DATE'];

  if (user.role === 'admin') {
    requireComplex(user.role, complexId);
    params.push(complexId);
    filters.push(`b.complex_id = $${params.length}`);
  }

  const { rows } = await query(
    `SELECT i.id, i.type, i.amount, i.due_date, i.status,
            u.full_name AS resident_name, un.unit_number, b.name AS building_name, c.name AS complex_name
     FROM invoices i
     JOIN units un ON i.unit_id = un.id
     JOIN buildings b ON un.building_id = b.id
     JOIN complexes c ON b.complex_id = c.id
     LEFT JOIN user_units uu ON uu.unit_id = un.id AND uu.moved_out_at IS NULL
     LEFT JOIN users u ON uu.user_id = u.id AND u.role = 'resident'
     WHERE ${filters.join(' AND ')}
     ORDER BY i.due_date ASC
     LIMIT ${MAX_ROWS}`,
    params
  );

  return {
    title: 'Overdue Payments',
    empty: !hasRows(rows),
    data: rows,
    summary: {
      overdue_count: rows.length,
      overdue_total: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    },
  };
};

const getTodaysVisitors = async ({ user, complexId, context }) => {
  const params = [];
  // Include passes valid today OR currently checked-in (pass may be for tomorrow but guard checked in early)
  const filters = [
    "(vp.valid_from < CURRENT_DATE + INTERVAL '1 day' AND COALESCE(vp.valid_until, vp.valid_from) >= CURRENT_DATE OR vp.status = 'checked_in')"
  ];

  if (user.role === 'resident') {
    requireComplex(user.role, complexId);
    if (!context.unitIds.length) {
      return {
        title: "Today's Visitors",
        empty: true,
        data: [],
        summary: { total_today: 0, checked_in: 0, pending: 0 },
      };
    }
    params.push(user.id, complexId, context.unitIds);
    filters.push('vp.host_user_id = $1');
    filters.push('b.complex_id = $2');
    filters.push('un.id = ANY($3::uuid[])');
  } else if (['admin', 'security'].includes(user.role)) {
    requireComplex(user.role, complexId);
    params.push(complexId);
    filters.push('b.complex_id = $1');
  } else if (user.role !== 'super_admin') {
    throw new AppError('Forbidden', 403);
  }

  const { rows } = await query(
    `SELECT vp.id, vp.visitor_name, vp.purpose, vp.status, vp.valid_from, vp.checked_in_at,
            host.full_name AS host_name, un.unit_number, b.name AS building_name, c.name AS complex_name
     FROM visitor_passes vp
     JOIN users host ON vp.host_user_id = host.id
     JOIN user_units uu ON uu.user_id = host.id AND uu.moved_out_at IS NULL
     JOIN units un ON uu.unit_id = un.id
     JOIN buildings b ON un.building_id = b.id
     JOIN complexes c ON b.complex_id = c.id
     WHERE ${filters.join(' AND ')}
     ORDER BY vp.valid_from ASC
     LIMIT ${MAX_ROWS}`,
    params
  );

  return {
    title: "Today's Visitors",
    empty: !hasRows(rows),
    data: rows,
    summary: {
      total_today: rows.length,
      checked_in: rows.filter((row) => row.status === 'checked_in').length,
      pending: rows.filter((row) => row.status === 'pending').length,
    },
  };
};

const getParkingStatus = async ({ user, complexId, context }) => {
  if (user.role === 'vendor') throw new AppError('Forbidden', 403);
  if (user.role !== 'super_admin') requireComplex(user.role, complexId);

  const params = [];
  const filters = [];
  if (user.role !== 'super_admin') {
    params.push(complexId);
    filters.push('complex_id = $1');
  }

  const { rows } = await query(
    `SELECT
       COUNT(*)::int AS total_slots,
       COUNT(*) FILTER (WHERE status = 'available')::int AS available_slots,
       COUNT(*) FILTER (WHERE status IN ('occupied', 'assigned'))::int AS occupied_slots,
       0::int AS visitor_slots
     FROM parking_slots
     ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}`,
    params
  );

  let residentParking = null;
  if (user.role === 'resident') {
    if (context.unitIds.length) {
      const own = await query(
        `SELECT ps.display_name, ps.parking_area, ps.parking_type,
                COALESCE(pv.vehicle_number, pa.vehicle_number) AS vehicle_number
         FROM parking_assignments pa
         JOIN parking_slots ps ON pa.slot_id = ps.id
         LEFT JOIN parking_vehicles pv ON pa.vehicle_id = pv.id
         WHERE pa.complex_id = $1
           AND pa.unit_id = ANY($2::uuid[])
           AND pa.status = 'active'
           AND pa.assigned_until IS NULL
         ORDER BY pa.assigned_from DESC
         LIMIT ${MAX_ROWS}`,
        [complexId, context.unitIds]
      );
      residentParking = own.rows;
    } else {
      residentParking = [];
    }
  }

  const data = {
    overview: rows[0] || {},
    my_assignments: residentParking,
  };

  return {
    title: 'Parking Status',
    empty: Number(data.overview.total_slots || 0) === 0 && !hasRows(residentParking),
    data,
  };
};

const getActiveEmergencies = async ({ user, complexId }) => {
  const params = [];
  const filters = ["e.status = 'active'"];

  if (user.role === 'resident') {
    params.push(user.id);
    filters.push(`e.user_id = $${params.length}`);
  } else if (['admin', 'security'].includes(user.role)) {
    requireComplex(user.role, complexId);
    params.push(complexId);
    filters.push(`(b.complex_id = $${params.length} OR e.unit_id IS NULL)`);
  } else if (user.role !== 'super_admin') {
    throw new AppError('Forbidden', 403);
  }

  const { rows } = await query(
    `SELECT e.id, e.type, e.severity, e.description, e.created_at,
            reporter.full_name AS reported_by, un.unit_number, b.name AS building_name, c.name AS complex_name
     FROM emergency_alerts e
     JOIN users reporter ON e.user_id = reporter.id
     LEFT JOIN units un ON e.unit_id = un.id
     LEFT JOIN buildings b ON un.building_id = b.id
     LEFT JOIN complexes c ON b.complex_id = c.id
     WHERE ${filters.join(' AND ')}
     ORDER BY e.created_at DESC
     LIMIT ${MAX_ROWS}`,
    params
  );

  return {
    title: 'Active Emergencies',
    empty: !hasRows(rows),
    data: rows,
    summary: {
      active_count: rows.length,
      critical_count: rows.filter((row) => row.severity === 'critical').length,
    },
  };
};

const getJobs = async ({ user, complexId }) => {
  if (user.role === 'vendor') {
    requireComplex(user.role, complexId);
    const { rows } = await query(
      `SELECT vr.id, vr.category, vr.description, vr.priority, vr.status, vr.created_at,
              requester.full_name AS resident_name, un.unit_number, b.name AS building_name
       FROM vendor_requests vr
       JOIN users requester ON vr.user_id = requester.id
       JOIN units un ON vr.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       WHERE b.complex_id = $1
         AND vr.assigned_vendor_id = $2
         AND vr.status IN ('assigned', 'in_progress')
       ORDER BY CASE vr.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
                vr.created_at DESC
       LIMIT ${MAX_ROWS}`,
      [complexId, user.id]
    );
    return { title: 'Assigned Jobs', empty: !hasRows(rows), data: rows };
  }

  if (user.role === 'resident') {
    requireComplex(user.role, complexId);
    const { rows } = await query(
      `SELECT vr.id, vr.category, vr.description, vr.priority, vr.status, vr.created_at,
              vendor.full_name AS vendor_name, un.unit_number, b.name AS building_name
       FROM vendor_requests vr
       JOIN units un ON vr.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       LEFT JOIN users vendor ON vr.assigned_vendor_id = vendor.id
       WHERE vr.user_id = $1
         AND b.complex_id = $2
       ORDER BY vr.created_at DESC
       LIMIT ${MAX_ROWS}`,
      [user.id, complexId]
    );
    return { title: 'My Service Requests', empty: !hasRows(rows), data: rows };
  }

  if (['admin', 'super_admin'].includes(user.role)) {
    const params = [];
    const filters = [];
    if (user.role === 'admin') {
      requireComplex(user.role, complexId);
      params.push(complexId);
      filters.push('b.complex_id = $1');
    }
    const { rows } = await query(
      `SELECT vr.id, vr.category, vr.priority, vr.status, vr.created_at,
              requester.full_name AS resident_name, vendor.full_name AS vendor_name,
              un.unit_number, b.name AS building_name, c.name AS complex_name
       FROM vendor_requests vr
       JOIN users requester ON vr.user_id = requester.id
       JOIN units un ON vr.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       JOIN complexes c ON b.complex_id = c.id
       LEFT JOIN users vendor ON vr.assigned_vendor_id = vendor.id
       ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
       ORDER BY vr.created_at DESC
       LIMIT ${MAX_ROWS}`,
      params
    );
    return { title: 'Vendor Requests', empty: !hasRows(rows), data: rows };
  }

  throw new AppError('Forbidden', 403);
};

const getNotifications = async ({ user }) => {
  const { rows } = await query(
    `SELECT id, type, title, message, is_read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT ${MAX_ROWS}`,
    [user.id]
  );

  return {
    title: 'Notifications',
    empty: !hasRows(rows),
    data: rows,
    summary: {
      unread_count: rows.filter((row) => !row.is_read).length,
    },
  };
};

const getAnalytics = async ({ user, complexId, context }) => {
  if (user.role === 'super_admin') {
    const [complexes, users, invoices, emergencies] = await Promise.all([
      query('SELECT COUNT(*) FROM complexes'),
      query('SELECT COUNT(*) FROM users'),
      query("SELECT COUNT(*) AS pending, COALESCE(SUM(amount), 0) AS pending_amount FROM invoices WHERE status NOT IN ('paid', 'waived')"),
      query("SELECT COUNT(*) FROM emergency_alerts WHERE status = 'active'"),
    ]);

    const data = {
      total_complexes: count(complexes.rows[0]?.count),
      total_users: count(users.rows[0]?.count),
      pending_invoices: count(invoices.rows[0]?.pending),
      pending_invoice_amount: Number(invoices.rows[0]?.pending_amount || 0),
      active_emergencies: count(emergencies.rows[0]?.count),
    };

    return {
      title: 'Platform Insights',
      empty: !hasPositiveMetric(data),
      data,
    };
  }

  requireComplex(user.role, complexId);

  if (user.role === 'admin') {
    const [residents, units, revenue, pending, visitors, emergencies] = await Promise.all([
      query("SELECT COUNT(*) FROM users WHERE role = 'resident' AND complex_id = $1", [complexId]),
      query('SELECT COUNT(*) FROM units un JOIN buildings b ON un.building_id = b.id WHERE b.complex_id = $1', [complexId]),
      query(
        `SELECT COALESCE(SUM(p.amount), 0) AS total
         FROM payments p
         JOIN invoices i ON p.invoice_id = i.id
         JOIN units un ON i.unit_id = un.id
         JOIN buildings b ON un.building_id = b.id
         WHERE p.status = 'captured' AND b.complex_id = $1`,
        [complexId]
      ),
      query(
        `SELECT COUNT(*) AS count, COALESCE(SUM(i.amount), 0) AS amount
         FROM invoices i
         JOIN units un ON i.unit_id = un.id
         JOIN buildings b ON un.building_id = b.id
         WHERE i.status NOT IN ('paid', 'waived') AND b.complex_id = $1`,
        [complexId]
      ),
      query(
        `SELECT COUNT(*) FROM visitor_passes vp
         JOIN users u ON vp.host_user_id = u.id
         WHERE vp.status = 'checked_in' AND u.complex_id = $1`,
        [complexId]
      ),
      query(
        `SELECT COUNT(*) FROM emergency_alerts e
         LEFT JOIN units un ON e.unit_id = un.id
         LEFT JOIN buildings b ON un.building_id = b.id
         WHERE e.status = 'active' AND (b.complex_id = $1 OR e.unit_id IS NULL)`,
        [complexId]
      ),
    ]);

    const data = {
      residents: count(residents.rows[0]?.count),
      units: count(units.rows[0]?.count),
      captured_revenue: Number(revenue.rows[0]?.total || 0),
      pending_invoices: count(pending.rows[0]?.count),
      pending_invoice_amount: Number(pending.rows[0]?.amount || 0),
      active_visitors: count(visitors.rows[0]?.count),
      active_emergencies: count(emergencies.rows[0]?.count),
    };

    return {
      title: 'Society Analytics',
      empty: !hasPositiveMetric(data),
      data,
    };
  }

  if (user.role === 'security') {
    const [visitors, emergencies] = await Promise.all([
      query(
        `SELECT
           COUNT(*) FILTER (WHERE vp.status = 'pending') AS expected,
           COUNT(*) FILTER (WHERE vp.status = 'checked_in') AS inside,
           COUNT(*) AS total_today
         FROM visitor_passes vp
         JOIN users u ON vp.host_user_id = u.id
         WHERE (
           (vp.valid_from < CURRENT_DATE + INTERVAL '1 day' AND COALESCE(vp.valid_until, vp.valid_from) >= CURRENT_DATE)
           OR vp.status = 'checked_in'
         )
           AND u.complex_id = $1`,
        [complexId]
      ),
      query(
        `SELECT COUNT(*) FROM emergency_alerts e
         LEFT JOIN units un ON e.unit_id = un.id
         LEFT JOIN buildings b ON un.building_id = b.id
         WHERE e.status = 'active' AND (b.complex_id = $1 OR e.unit_id IS NULL)`,
        [complexId]
      ),
    ]);
    const data = { visitors: visitors.rows[0], active_emergencies: count(emergencies.rows[0]?.count) };
    return { title: 'Security Overview', empty: !hasPositiveMetric(data), data };
  }

  if (user.role === 'vendor') {
    const { rows } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'assigned') AS assigned,
         COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed
       FROM vendor_requests
       WHERE assigned_vendor_id = $1`,
      [user.id]
    );
    const data = rows[0] || {};
    return { title: 'Vendor Overview', empty: !hasPositiveMetric(data), data };
  }

  if (!context.unitIds.length) {
    const data = {
      unpaid_invoices: 0,
      unpaid_amount: 0,
      visitors_today: 0,
      service_requests: 0,
    };
    return { title: 'My Overview', empty: true, data };
  }

  const [invoices, visitors, requests] = await Promise.all([
    query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(i.amount), 0) AS amount
       FROM invoices i
       JOIN units un ON i.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       WHERE i.unit_id = ANY($1::uuid[])
         AND b.complex_id = $2
         AND i.status NOT IN ('paid', 'waived', 'cancelled')`,
      [context.unitIds, complexId]
    ),
    query(
      `SELECT COUNT(*)
       FROM visitor_passes vp
       JOIN users host ON vp.host_user_id = host.id
       JOIN user_units uu ON uu.user_id = host.id AND uu.moved_out_at IS NULL
       JOIN units un ON uu.unit_id = un.id
       JOIN buildings b ON un.building_id = b.id
       WHERE vp.host_user_id = $1
         AND b.complex_id = $2
         AND un.id = ANY($3::uuid[])
         AND vp.valid_from < CURRENT_DATE + INTERVAL '1 day'
         AND COALESCE(vp.valid_until, vp.valid_from) >= CURRENT_DATE`,
      [user.id, complexId, context.unitIds]
    ),
    query('SELECT COUNT(*) FROM vendor_requests WHERE user_id = $1', [user.id]),
  ]);

  const data = {
    unpaid_invoices: count(invoices.rows[0]?.count),
    unpaid_amount: Number(invoices.rows[0]?.amount || 0),
    visitors_today: count(visitors.rows[0]?.count),
    service_requests: count(requests.rows[0]?.count),
  };

  return {
    title: 'My Overview',
    empty: !hasPositiveMetric(data),
    data,
  };
};

const INTENT_HANDLERS = {
  my_unpaid_invoices: getMyUnpaidInvoices,
  overdue_payments: getOverduePayments,
  today_visitors: getTodaysVisitors,
  parking_status: getParkingStatus,
  active_emergencies: getActiveEmergencies,
  jobs: getJobs,
  notifications: getNotifications,
  analytics: getAnalytics,
};
const INTENT_NAMES = [...Object.keys(INTENT_HANDLERS), 'complaints', 'unknown'];
const INTENT_SYSTEM_INSTRUCTION = [
  'Classify one apartment assistant message into exactly one intent.',
  `Allowed intents: ${INTENT_NAMES.join(', ')}.`,
  'Use analytics for dashboard, summary, overview, stats, platform, society/societies, users, residents, units, revenue, and "how many" count questions.',
  'Use my_unpaid_invoices for resident dues. Use overdue_payments for admin overdue/defaulter questions.',
  'Use today_visitors for visitors/guests today, parking_status for parking/slots/vacant, active_emergencies for emergencies/alerts, jobs for service/vendor work, notifications for notifications, complaints for complaints/grievances.',
  'Return only compact JSON: {"intent":"analytics"}',
].join('\n');

const parseIntent = (value) => {
  const raw = String(value || '').replace(/```json|```/g, '').trim();
  try {
    const parsed = JSON.parse(raw);
    return INTENT_NAMES.includes(parsed.intent) ? parsed.intent : null;
  } catch {
    const match = raw.match(/"intent"\s*:\s*"([^"]+)"/);
    return match && INTENT_NAMES.includes(match[1]) ? match[1] : null;
  }
};

const classifyIntentWithGemini = async ({ message, role, history }) => {
  // Step 1: try fast regex classification first
  const regexIntent = classifyIntent(message, role);
  if (regexIntent !== 'unknown') {
    logger.info('AI intent resolved via regex (Gemini skipped)', { intent: regexIntent });
    return regexIntent;
  }
  // Step 2: only call Gemini for truly ambiguous messages
  if (!hasGeminiKey()) return 'unknown';
  try {
    const model = getGeminiModel(INTENT_SYSTEM_INSTRUCTION, 40);
    const chat = model.startChat({ history: history.slice(-4) });
    const result = await chat.sendMessage(`Role: ${role}\nMessage: ${message}`);
    return parseIntent(result.response.text()) || 'unknown';
  } catch (err) {
    logger.warn('Gemini intent classification failed', { message: err.message });
    return 'unknown';
  }
};

const getQuickSuggestions = (role) => {
  const suggestions = {
    resident: ['Do I have unpaid dues?', "Show today's visitors", 'What is my parking status?', 'Show my notifications'],
    admin: ['Which residents have overdue payments?', 'How many parking slots are vacant?', 'Show active emergencies', 'Give me society analytics'],
    security: ["Show today's visitors", 'Show active emergencies', 'How many parking slots are vacant?', 'Give me security stats'],
    vendor: ['What jobs are assigned to me?', 'Show my notifications', 'Give me my job summary'],
    super_admin: ['Show platform analytics', 'Show society insights', 'Show active emergencies', 'Show overdue payments'],
  };
  return suggestions[role] || suggestions.resident;
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return `INR ${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const ANALYTICS_FOCUS = [
  { key: 'total_complexes', patterns: [/\bsociet(y|ies)\b/, /\bcomplex(es)?\b/], label: 'societies', template: (value) => `Currently, there ${value === 1 ? 'is' : 'are'} ${value} ${value === 1 ? 'society' : 'societies'} on the platform.` },
  { key: 'total_users', patterns: [/\busers?\b/, /\bregistered users?\b/, /\baccounts?\b/], label: 'registered users', template: (value) => `There ${value === 1 ? 'is' : 'are'} currently ${value} registered user${value === 1 ? '' : 's'}.` },
  { key: 'residents', patterns: [/\bresidents?\b/], label: 'residents', template: (value) => `There ${value === 1 ? 'is' : 'are'} currently ${value} resident${value === 1 ? '' : 's'}.` },
  { key: 'units', patterns: [/\bunits?\b/, /\bflats?\b/, /\bapartments?\b/], label: 'units', template: (value) => `There ${value === 1 ? 'is' : 'are'} currently ${value} unit${value === 1 ? '' : 's'}.` },
  { key: 'captured_revenue', patterns: [/\brevenue\b/, /\bcollection(s)?\b/, /\bcollected\b/], label: 'revenue', template: (value) => `Total captured revenue is ${formatCurrency(value)}.` },
  { key: 'pending_invoices', patterns: [/\bpending invoices?\b/, /\bunpaid invoices?\b/], label: 'pending invoices', template: (value) => `There ${value === 1 ? 'is' : 'are'} currently ${value} pending invoice${value === 1 ? '' : 's'}.` },
  { key: 'active_visitors', patterns: [/\bactive visitors?\b/, /\bvisitors?\b/], label: 'active visitors', template: (value) => `There ${value === 1 ? 'is' : 'are'} currently ${value} active visitor${value === 1 ? '' : 's'}.` },
  { key: 'active_emergencies', patterns: [/\bactive emergencies?\b/, /\bemergenc(y|ies)\b/, /\balerts?\b/], label: 'active emergencies', template: (value) => `There ${value === 1 ? 'is' : 'are'} currently ${value} active emergenc${value === 1 ? 'y' : 'ies'}.` },
  { key: 'unpaid_invoices', patterns: [/\bunpaid invoices?\b/, /\bpending dues?\b/, /\bdues?\b/], label: 'unpaid invoices', template: (value) => `You currently have ${value} unpaid invoice${value === 1 ? '' : 's'}.` },
  { key: 'service_requests', patterns: [/\bservice requests?\b/, /\brequests?\b/], label: 'service requests', template: (value) => `You currently have ${value} service request${value === 1 ? '' : 's'}.` },
  { key: 'visitors_today', patterns: [/\bvisitors? today\b/, /\bguests? today\b/], label: 'visitors today', template: (value) => `You have ${value} visitor${value === 1 ? '' : 's'} today.` },
];

const extractAnalyticsFocus = (message, data = {}) => {
  const text = message.toLowerCase();
  return ANALYTICS_FOCUS.find((item) => data[item.key] !== undefined && item.patterns.some((pattern) => pattern.test(text))) || null;
};

const humanFallbackResponse = ({ intent, intentResult }) => {
  const data = intentResult.data;
  const summary = intentResult.summary || {};

  switch (intent) {
    case 'my_unpaid_invoices':
      if (intentResult.empty) return 'You currently have no pending dues.';
      return `You currently have ${summary.unpaid_count} unpaid invoice${summary.unpaid_count === 1 ? '' : 's'} totaling ${formatCurrency(summary.total_due)}.`;

    case 'overdue_payments':
      if (intentResult.empty) return 'I could not find any overdue payments.';
      return `There are ${summary.overdue_count} overdue invoice${summary.overdue_count === 1 ? '' : 's'} totaling ${formatCurrency(summary.overdue_total)}.`;

    case 'today_visitors':
      if (intentResult.empty) return 'You currently do not have any active visitors today.';
      return `You have ${summary.total_today} visitor${summary.total_today === 1 ? '' : 's'} scheduled today. ${summary.checked_in} checked in, ${summary.pending} pending.`;

    case 'parking_status': {
      const assignment = data?.my_assignments?.[0];
      if (assignment) {
        const slot = [assignment.parking_area, assignment.display_name].filter(Boolean).join(' - ');
        return `Your assigned parking slot is ${slot || assignment.display_name || 'available in your parking details'}.`;
      }
      const overview = data?.overview || {};
      if (Number(overview.total_slots || 0) === 0) {
        return 'No parking slots have been set up for your society yet.';
      }
      if (overview.total_slots !== undefined) {
        return `There are ${overview.available_slots || 0} vacant parking slots out of ${overview.total_slots || 0}.`;
      }
      return 'I could not find an active parking assignment for you.';
    }

    case 'active_emergencies':
      if (intentResult.empty) return 'There are no active emergencies right now.';
      return `There ${summary.active_count === 1 ? 'is' : 'are'} ${summary.active_count} active emergenc${summary.active_count === 1 ? 'y' : 'ies'} right now.`;

    case 'jobs':
      if (intentResult.empty) return 'I could not find any active jobs right now.';
      return `I found ${intentResult.rows || data.length} job${(intentResult.rows || data.length) === 1 ? '' : 's'} for you.`;

    case 'notifications':
      if (intentResult.empty) return 'You do not have any recent notifications.';
      return `You have ${summary.unread_count || 0} unread notification${summary.unread_count === 1 ? '' : 's'} in your recent notifications.`;

    case 'analytics':
      if (intentResult.empty) return 'Your dashboard is empty right now. Once residents, dues, visitors, requests, or alerts are added, I can summarize them here.';
      if (intentResult.focus && data[intentResult.focus.key] !== undefined) {
        return intentResult.focus.template(Number(data[intentResult.focus.key] || 0));
      }
      if (data.unpaid_invoices !== undefined) {
        if (!hasPositiveMetric(data)) return 'Your dashboard is clear right now: no pending dues, visitors, service requests, or alerts to report.';
        return `Your overview shows ${data.unpaid_invoices} unpaid invoice${data.unpaid_invoices === 1 ? '' : 's'}, ${data.visitors_today} visitor${data.visitors_today === 1 ? '' : 's'} today, and ${data.service_requests} service request${data.service_requests === 1 ? '' : 's'}.`;
      }
      if (data.residents !== undefined) {
        if (!hasPositiveMetric(data)) return 'Your society dashboard is empty right now: no residents, units, revenue, pending dues, visitors, or alerts have been recorded yet.';
        return `Your society overview has ${data.residents} resident${data.residents === 1 ? '' : 's'}, ${data.units} unit${data.units === 1 ? '' : 's'}, ${data.pending_invoices} pending invoice${data.pending_invoices === 1 ? '' : 's'} totaling ${formatCurrency(data.pending_invoice_amount)}, ${data.active_visitors} active visitor${data.active_visitors === 1 ? '' : 's'}, and ${data.active_emergencies} active emergenc${data.active_emergencies === 1 ? 'y' : 'ies'}.`;
      }
      if (data.total_complexes !== undefined) {
        if (!hasPositiveMetric(data)) return 'The platform dashboard is empty right now: no societies, users, invoices, or active emergencies are recorded yet.';
        return `Platform overview: ${data.total_complexes} societ${data.total_complexes === 1 ? 'y' : 'ies'}, ${data.total_users} user${data.total_users === 1 ? '' : 's'}, ${data.pending_invoices} pending invoice${data.pending_invoices === 1 ? '' : 's'} totaling ${formatCurrency(data.pending_invoice_amount)}, and ${data.active_emergencies} active emergenc${data.active_emergencies === 1 ? 'y' : 'ies'}.`;
      }
      if (data.visitors !== undefined) {
        if (!hasPositiveMetric(data)) return 'Security is quiet right now: no visitors are expected or checked in, and there are no active emergencies.';
        return `Security overview: ${data.visitors.total_today || 0} visitor${data.visitors.total_today === 1 ? '' : 's'} expected today, ${data.visitors.inside || 0} currently inside, and ${data.active_emergencies || 0} active emergenc${data.active_emergencies === 1 ? 'y' : 'ies'}.`;
      }
      if (data.assigned !== undefined) {
        if (!hasPositiveMetric(data)) return 'You do not have any assigned, in-progress, or completed jobs yet.';
        return `Your job overview shows ${data.assigned || 0} assigned, ${data.in_progress || 0} in progress, and ${data.completed || 0} completed job${data.completed === 1 ? '' : 's'}.`;
      }
      if (data.pending_invoices !== undefined) {
        return `The current overview shows ${data.pending_invoices} pending invoice${data.pending_invoices === 1 ? '' : 's'} and ${data.active_emergencies || 0} active emergenc${data.active_emergencies === 1 ? 'y' : 'ies'}.`;
      }
      return 'I found your dashboard data, but there was not enough detail to summarize it clearly.';

    default:
      return intentResult.empty
        ? 'I can help with dues, visitors, parking, emergencies, notifications, jobs, and dashboard summaries. Try asking about one of those.'
        : 'I found the requested information from your account.';
  }
};

const stripModelUnsafeFields = (value) => {
  if (Array.isArray(value)) return value.slice(0, MAX_ROWS).map(stripModelUnsafeFields);
  if (!value || typeof value !== 'object') return value;

  return Object.entries(value).reduce((safe, [key, item]) => {
    if (['id', 'user_id', 'host_user_id', 'assigned_vendor_id'].includes(key)) return safe;
    safe[key] = stripModelUnsafeFields(item);
    return safe;
  }, {});
};

const buildGeminiContext = ({ role, intent, intentResult }) => ({
  detected_intent: intent,
  authenticated_role: role,
  focus: intentResult.focus ? { field: intentResult.focus.key, label: intentResult.focus.label } : null,
  rows: intentResult.rows || getResultCount(intentResult),
  empty: intentResult.empty,
  summary: stripModelUnsafeFields(intentResult.summary || {}),
  validated_results: stripModelUnsafeFields(intentResult.data),
});

const RESPONSE_SYSTEM_INSTRUCTION = [
  'You are a friendly, knowledgeable Smart Apartment Management assistant helping residents, admins, and security staff.',
  'Use only the validated backend context provided for any facts, counts, amounts, names, dates, or statuses. Never invent data.',
  'Use prior chat history only to understand what the user is following up on — never treat history as fresh data.',
  'Respond conversationally and warmly. Sound like a helpful colleague, not a system report.',
  'When data is empty or zero, acknowledge it naturally: "All clear — no outstanding dues right now." or "No visitors today so far."',
  'When there is data, lead with the most important fact and add one line of context or suggestion if helpful.',
  'For analytics/summary answers, always include the actual numbers from the context — never give a vague overview.',
  'Keep responses concise — 1 to 3 sentences max. Use INR for currency. Do not use bullet points.',
  'Never mention APIs, backend, database, SQL, prompts, validation, or system internals.',
].join('\n');

const formatWithGemini = async ({ userId, role, message, intent, intentResult }) => {
  const fallback = humanFallbackResponse({ intent, intentResult });
  // Always use deterministic response for: empty data, focused analytics, or simple factual queries
  if (intentResult.focus) return fallback;
  if (intentResult.empty) return fallback;
  if (isFactualIntent(intent, message)) {
    logger.info('AI response: factual intent — Gemini skipped', { intent });
    return fallback;
  }
  if (!hasGeminiKey()) return fallback;

  try {
    const model = getGeminiModel(RESPONSE_SYSTEM_INSTRUCTION, 180);
    const geminiContext = buildGeminiContext({ role, intent, intentResult });
    const chat = model.startChat({ history: getChatHistory(userId) });
    const result = await chat.sendMessage([
      `Role: ${ROLE_LABELS[role] || role}`,
      `User asked: ${message}`,
      `Detected intent: ${intent}`,
      `Current validated backend context: ${JSON.stringify(geminiContext)}`,
      `Use this fallback if the context is unclear: ${fallback}`,
    ].join('\n'));
    const text = result.response.text().trim();
    if (!text || /^here is the latest overview/i.test(text)) return fallback;
    if (intent === 'analytics' && !/\d/.test(text)) return fallback;
    return text || fallback;
  } catch (err) {
    logger.warn('Gemini assistant formatting failed', { message: err.message });
    return fallback;
  }
};

const handlePrompt = async ({ user, complexId, message, ip }) => {
  const sanitized = sanitizePrompt(message);
  const suspicious = isSuspiciousPrompt(sanitized);
  const history = getChatHistory(user.id);
  const intent = await classifyIntentWithGemini({ message: sanitized, role: user.role, history });
  const handler = INTENT_HANDLERS[intent];
  const context = await resolveAssistantContext(user, complexId);
  const scopedComplexId = context.complexId;

  logger.info('AI assistant incoming prompt', {
    prompt: sanitized,
    userId: user.id,
    role: user.role,
    complexId: scopedComplexId,
    unitId: context.primaryUnitId,
    buildingId: context.primaryBuildingId,
  });

  logger.info('AI assistant detected intent', {
    userId: user.id,
    role: user.role,
    complexId: scopedComplexId,
    unitId: context.primaryUnitId,
    buildingId: context.primaryBuildingId,
    residentId: context.residentId,
    intent,
    suspicious,
  });

  if (!handler || intent === 'complaints') {
    auditLogger.info({
      action: 'ai_assistant_prompt',
      userId: user.id,
      userRole: user.role,
      complexId: scopedComplexId,
      intent,
      allowed: false,
      suspicious,
      ip,
    });
    const fallbackReply = humanFallbackResponse({ intent, intentResult: { empty: true, data: [], summary: null, rows: 0 } });
    saveChatTurn(user.id, sanitized, fallbackReply);
    const result = {
      intent,
      rows: 0,
      data: [],
      summary: null,
      ai_response: fallbackReply,
      response: {
        message: fallbackReply,
      },
      suggestions: getQuickSuggestions(user.role),
    };

    if (ASSISTANT_DEBUG) {
      result.debug = {
        prompt: sanitized,
        apiStatus: 200,
        geminiBypassed: false,
        userId: user.id,
        role: user.role,
        complexId: scopedComplexId,
        unitId: context.primaryUnitId || null,
        buildingId: context.primaryBuildingId || null,
        residentId: context.residentId,
        intent,
        service: null,
        query: null,
        rows: 0,
        empty: true,
      };
    }

    return {
      ...result,
    };
  }

  logger.info('AI assistant executing service', {
    userId: user.id,
    role: user.role,
    complexId: scopedComplexId,
    intent,
    service: handler.name,
    query: intent,
  });

  const rawIntentResult = await handler({ user, complexId: scopedComplexId, context });
  const focus = intent === 'analytics' ? extractAnalyticsFocus(sanitized, rawIntentResult.data) : null;
  const intentResult = focus ? { ...rawIntentResult, focus } : rawIntentResult;
  const rows = getResultCount(intentResult);
  const executedQuery = intentResult.queryName || intent;

  logger.info('AI assistant query results', {
    userId: user.id,
    role: user.role,
    complexId: scopedComplexId,
    intent,
    service: handler.name,
    query: executedQuery,
    focus: focus?.key || null,
    empty: intentResult.empty,
    rowsReturned: rows,
    preview: getResultPreview(intentResult),
  });

  const replyMessage = await formatWithGemini({
    userId: user.id,
    role: user.role,
    message: sanitized,
    intent,
    intentResult: {
      ...intentResult,
      rows,
    },
  });
  saveChatTurn(user.id, sanitized, replyMessage);

  logger.info('AI assistant final generated response', {
    userId: user.id,
    role: user.role,
    complexId: scopedComplexId,
    intent,
    rowsReturned: rows,
    response: replyMessage,
  });

  auditLogger.info({
    action: 'ai_assistant_prompt',
    userId: user.id,
    userRole: user.role,
    complexId: scopedComplexId,
    intent,
    allowed: true,
    suspicious,
    ip,
  });

  const result = {
    intent,
    rows,
    data: intentResult.data,
    summary: intentResult.summary || null,
    ai_response: replyMessage,
    response: {
      message: replyMessage,
    },
    source: intentResult.title,
    service: handler.name,
    query: executedQuery,
    focus: focus?.key || null,
    suggestions: getQuickSuggestions(user.role),
  };

  if (ASSISTANT_DEBUG) {
    result.debug = {
      prompt: sanitized,
      apiStatus: 200,
      geminiBypassed: false,
      userId: user.id,
      role: user.role,
      complexId: scopedComplexId,
      unitId: context.primaryUnitId || null,
      unitIds: context.unitIds,
      buildingId: context.primaryBuildingId || null,
      buildingIds: context.buildingIds,
      residentId: context.residentId,
      intent,
      service: handler.name,
      query: executedQuery,
      focus: focus?.key || null,
      rows,
      empty: intentResult.empty,
    };
  }

  return result;
};

module.exports = {
  handlePrompt,
  sanitizePrompt,
  classifyIntent,
  getQuickSuggestions,
  FALLBACK_MESSAGE,
};
