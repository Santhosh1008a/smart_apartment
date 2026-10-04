const { query, getClient } = require('../config/db');
const { AppError } = require('../middlewares/error.middleware');

const PERIODS = {
  '7d': { interval: '7 days', bucket: 'day', step: '1 day', label: 'DD Mon' },
  '30d': { interval: '30 days', bucket: 'day', step: '1 day', label: 'DD Mon' },
  '3m': { interval: '3 months', bucket: 'week', step: '1 week', label: 'DD Mon' },
  '6m': { interval: '6 months', bucket: 'week', step: '1 week', label: 'DD Mon' },
  '1y': { interval: '1 year', bucket: 'month', step: '1 month', label: 'Mon YY' },
};

const SORT_COLUMNS = {
  complex: 'c.name',
  plan: 'p.name',
  amount: 's.amount',
  status: 's.status',
  started: 's.started_at',
  renewal: 's.renewal_at',
};

const periodFor = (value) => PERIODS[value] || PERIODS['30d'];
const asNumber = (value) => Number(value || 0);
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');

function subscriptionFilters(queryParams, { paginated = true } = {}) {
  const period = periodFor(queryParams.range);
  const params = [period.interval, queryParams.complex_id || null];
  const clauses = ['s.started_at >= now() - $1::interval', '($2::uuid IS NULL OR s.complex_id = $2)'];

  if (queryParams.status) {
    params.push(queryParams.status);
    clauses.push(`s.status = $${params.length}`);
  }
  if (queryParams.plan_id) {
    params.push(queryParams.plan_id);
    clauses.push(`s.plan_id = $${params.length}`);
  }
  if (queryParams.search) {
    params.push(`%${queryParams.search.trim()}%`);
    clauses.push(`(c.name ILIKE $${params.length} OR p.name ILIKE $${params.length})`);
  }

  const sort = SORT_COLUMNS[queryParams.sort] || SORT_COLUMNS.started;
  const direction = queryParams.order === 'asc' ? 'ASC' : 'DESC';
  let pageSql = '';
  if (paginated) {
    const page = Math.max(1, Number(queryParams.page || 1));
    const pageSize = Math.min(100, Math.max(10, Number(queryParams.page_size || 10)));
    params.push(pageSize, (page - 1) * pageSize);
    pageSql = `LIMIT $${params.length - 1} OFFSET $${params.length}`;
  } else {
    params.push(5000);
    pageSql = `LIMIT $${params.length}`;
  }

  return {
    where: clauses.join(' AND '),
    params,
    page: Math.max(1, Number(queryParams.page || 1)),
    pageSize: Math.min(100, Math.max(10, Number(queryParams.page_size || 10))),
    orderBy: `${sort} ${direction} NULLS LAST`,
    pageSql,
  };
}

async function getSubscriptionRows(queryParams, { paginated = true } = {}) {
  const filters = subscriptionFilters(queryParams, { paginated });
  const countParams = filters.params.slice(0, filters.params.length - (paginated ? 2 : 1));
  const [rowsResult, countResult] = await Promise.all([
    query(
      `SELECT s.id, s.complex_id, c.name AS complex_name, s.plan_id, p.name AS plan_name,
              s.billing_cycle, s.amount, s.status, s.started_at, s.renewal_at, s.ended_at,
              s.notes, s.created_at,
              COALESCE(last_tx.status, 'unpaid') AS payment_status,
              last_tx.paid_at AS last_paid_at
       FROM community_subscriptions s
       JOIN complexes c ON c.id = s.complex_id
       JOIN subscription_plans p ON p.id = s.plan_id
       LEFT JOIN LATERAL (
         SELECT t.status, t.paid_at
         FROM platform_payment_transactions t
         WHERE t.subscription_id = s.id
         ORDER BY t.created_at DESC
         LIMIT 1
       ) last_tx ON TRUE
       WHERE ${filters.where}
       ORDER BY ${filters.orderBy}
       ${filters.pageSql}`,
      filters.params
    ),
    query(
      `SELECT COUNT(*)::int AS total
       FROM community_subscriptions s
       JOIN complexes c ON c.id = s.complex_id
       JOIN subscription_plans p ON p.id = s.plan_id
       WHERE ${filters.where}`,
      countParams
    ),
  ]);
  return {
    rows: rowsResult.rows,
    total: Number(countResult.rows[0]?.total || 0),
    page: filters.page,
    page_size: filters.pageSize,
    page_count: Math.ceil(Number(countResult.rows[0]?.total || 0) / filters.pageSize),
  };
}

exports.getDashboard = async (req, res, next) => {
  try {
    const period = periodFor(req.query.range);
    const complexId = req.query.complex_id || null;
    const commonParams = [period.interval, period.bucket, period.step, period.label, complexId];

    const [metricsRes, usageRes, revenueTrendRes, complexRevenueRes, planRevenueRes,
      cycleRevenueRes, planDistributionRes, subscriptionGrowthRes, usageTrendRes,
      lifecycleRes, subscriptionPage, plansRes, complexesRes] = await Promise.all([
      query(
        `SELECT
           (SELECT COUNT(*)::int FROM complexes WHERE ($1::uuid IS NULL OR id = $1)) AS total_complexes,
           (SELECT COUNT(*)::int FROM users WHERE role = 'resident' AND ($1::uuid IS NULL OR complex_id = $1)) AS total_residents,
           (SELECT COUNT(*)::int FROM community_subscriptions WHERE status = 'active' AND ($1::uuid IS NULL OR complex_id = $1)) AS active_subscriptions,
           (SELECT COUNT(*)::int FROM community_subscriptions WHERE status = 'trial' AND ($1::uuid IS NULL OR complex_id = $1)) AS trial_subscriptions,
           (SELECT COUNT(*)::int FROM community_subscriptions WHERE status = 'cancelled' AND ($1::uuid IS NULL OR complex_id = $1)) AS cancelled_subscriptions,
           (SELECT COALESCE(SUM(CASE WHEN billing_cycle = 'monthly' THEN amount WHEN billing_cycle = 'yearly' THEN amount / 12 ELSE 0 END), 0)::numeric(14,2)
              FROM community_subscriptions WHERE status = 'active' AND ($1::uuid IS NULL OR complex_id = $1)) AS mrr,
           (SELECT COUNT(*)::int FROM community_subscriptions
              WHERE (status = 'active' OR (status IN ('cancelled', 'expired') AND ended_at > now() - $2::interval))
                AND started_at <= now() - $2::interval
                AND (ended_at IS NULL OR ended_at > now() - $2::interval)
                AND ($1::uuid IS NULL OR complex_id = $1)) AS active_at_period_start,
           (SELECT COALESCE(SUM(amount) FILTER (WHERE status IN ('captured', 'refunded')), 0)::numeric(14,2)
              FROM platform_payment_transactions
             WHERE paid_at >= now() - $2::interval AND status IN ('captured', 'refunded')
               AND ($1::uuid IS NULL OR complex_id = $1)) AS period_gross,
           (SELECT COALESCE(SUM(refund_amount), 0)::numeric(14,2)
              FROM platform_payment_transactions
             WHERE paid_at >= now() - $2::interval AND status IN ('captured', 'refunded')
               AND ($1::uuid IS NULL OR complex_id = $1)) AS period_refunds,
           (SELECT COUNT(*)::int FROM platform_payment_transactions
             WHERE paid_at >= now() - $2::interval AND status IN ('captured', 'refunded')
               AND ($1::uuid IS NULL OR complex_id = $1)) AS period_transaction_count`,
        [complexId, period.interval]
      ),
      query(
        `SELECT
           COALESCE(SUM(event_count) FILTER (WHERE event_type = 'visitor_pass_generated'), 0)::int AS visitor_passes,
           COALESCE(SUM(event_count) FILTER (WHERE event_type = 'qr_code_scanned'), 0)::int AS qr_scans,
           COALESCE(SUM(event_count) FILTER (WHERE event_type = 'visitor_checkin'), 0)::int AS visitor_checkins,
           COALESCE(SUM(event_count) FILTER (WHERE event_type = 'visitor_checkout'), 0)::int AS visitor_checkouts,
           COALESCE(SUM(event_count) FILTER (WHERE event_type IN ('visitor_checkin', 'visitor_checkout', 'security_alert_created')), 0)::int AS security_activity,
           COUNT(DISTINCT actor_user_id) FILTER (WHERE u.role = 'resident')::int AS engaged_residents
         FROM platform_usage_events e
         LEFT JOIN users u ON u.id = e.actor_user_id
         WHERE e.occurred_at >= now() - $1::interval AND ($2::uuid IS NULL OR e.complex_id = $2)`,
        [period.interval, complexId]
      ),
      query(
        `WITH buckets AS (
           SELECT generate_series(
             date_trunc($2, now() - $1::interval), date_trunc($2, now()), $3::interval
           ) AS bucket
         )
         SELECT to_char(b.bucket, $4) AS label,
                COALESCE(SUM(t.amount) FILTER (WHERE t.status IN ('captured', 'refunded')), 0)::numeric(14,2) AS gross,
                COALESCE(SUM(t.refund_amount), 0)::numeric(14,2) AS refunds,
                (COALESCE(SUM(t.amount) FILTER (WHERE t.status IN ('captured', 'refunded')), 0) - COALESCE(SUM(t.refund_amount), 0))::numeric(14,2) AS net
         FROM buckets b
         LEFT JOIN platform_payment_transactions t
           ON date_trunc($2, t.paid_at) = b.bucket
          AND t.paid_at >= now() - $1::interval
          AND t.status IN ('captured', 'refunded')
          AND ($5::uuid IS NULL OR t.complex_id = $5)
         GROUP BY b.bucket ORDER BY b.bucket`,
        commonParams
      ),
      query(
        `SELECT c.id AS complex_id, c.name AS complex_name,
                COALESCE(SUM(t.amount) FILTER (WHERE t.status IN ('captured', 'refunded')), 0)::numeric(14,2) AS gross,
                COALESCE(SUM(t.refund_amount), 0)::numeric(14,2) AS refunds,
                (COALESCE(SUM(t.amount) FILTER (WHERE t.status IN ('captured', 'refunded')), 0) - COALESCE(SUM(t.refund_amount), 0))::numeric(14,2) AS net
         FROM complexes c
         LEFT JOIN platform_payment_transactions t ON t.complex_id = c.id
           AND t.paid_at >= now() - $1::interval AND t.status IN ('captured', 'refunded')
         WHERE ($2::uuid IS NULL OR c.id = $2)
         GROUP BY c.id, c.name ORDER BY net DESC, c.name LIMIT 8`,
        [period.interval, complexId]
      ),
      query(
        `SELECT t.plan_name_snapshot AS plan_name,
                COALESCE(SUM(t.amount) FILTER (WHERE t.status IN ('captured', 'refunded')), 0)::numeric(14,2) AS gross,
                COALESCE(SUM(t.refund_amount), 0)::numeric(14,2) AS refunds,
                (COALESCE(SUM(t.amount) FILTER (WHERE t.status IN ('captured', 'refunded')), 0) - COALESCE(SUM(t.refund_amount), 0))::numeric(14,2) AS net
         FROM platform_payment_transactions t
         WHERE t.paid_at >= now() - $1::interval AND t.status IN ('captured', 'refunded')
           AND ($2::uuid IS NULL OR t.complex_id = $2)
         GROUP BY t.plan_name_snapshot ORDER BY net DESC, t.plan_name_snapshot`,
        [period.interval, complexId]
      ),
      query(
        `SELECT t.billing_cycle,
                COALESCE(SUM(t.amount) FILTER (WHERE t.status IN ('captured', 'refunded')), 0)::numeric(14,2) AS gross,
                COALESCE(SUM(t.refund_amount), 0)::numeric(14,2) AS refunds,
                (COALESCE(SUM(t.amount) FILTER (WHERE t.status IN ('captured', 'refunded')), 0) - COALESCE(SUM(t.refund_amount), 0))::numeric(14,2) AS net
         FROM platform_payment_transactions t
         WHERE t.paid_at >= now() - $1::interval AND t.status IN ('captured', 'refunded')
           AND ($2::uuid IS NULL OR t.complex_id = $2)
         GROUP BY t.billing_cycle`,
        [period.interval, complexId]
      ),
      query(
        `SELECT p.id, p.name, p.monthly_price, p.yearly_price,
                COUNT(s.id) FILTER (WHERE s.status = 'active')::int AS active_subscriptions,
                COUNT(s.id) FILTER (WHERE s.status = 'trial')::int AS trials
         FROM subscription_plans p
         LEFT JOIN community_subscriptions s ON s.plan_id = p.id
           AND ($1::uuid IS NULL OR s.complex_id = $1)
         WHERE p.is_active = TRUE
         GROUP BY p.id, p.name, p.monthly_price, p.yearly_price
         ORDER BY active_subscriptions DESC, p.name`,
        [complexId]
      ),
      query(
        `WITH buckets AS (
           SELECT generate_series(
             date_trunc($2, now() - $1::interval), date_trunc($2, now()), $3::interval
           ) AS bucket
         )
         SELECT to_char(b.bucket, $4) AS label,
                COUNT(s.id) FILTER (
                  WHERE s.started_at < b.bucket + $3::interval
                    AND (s.ended_at IS NULL OR s.ended_at >= b.bucket + $3::interval)
                    AND (s.status IN ('active', 'trial') OR s.ended_at >= b.bucket + $3::interval)
                )::int AS active_subscriptions
         FROM buckets b
         LEFT JOIN community_subscriptions s ON ($5::uuid IS NULL OR s.complex_id = $5)
         GROUP BY b.bucket ORDER BY b.bucket`,
        commonParams
      ),
      query(
        `WITH buckets AS (
           SELECT generate_series(
             date_trunc($2, now() - $1::interval), date_trunc($2, now()), $3::interval
           ) AS bucket
         )
         SELECT to_char(b.bucket, $4) AS label,
                COALESCE(SUM(e.event_count) FILTER (WHERE e.event_type = 'visitor_pass_generated'), 0)::int AS passes,
                COALESCE(SUM(e.event_count) FILTER (WHERE e.event_type = 'qr_code_scanned'), 0)::int AS qr_scans,
                COALESCE(SUM(e.event_count) FILTER (WHERE e.event_type = 'visitor_checkin'), 0)::int AS checkins,
                COALESCE(SUM(e.event_count) FILTER (WHERE e.event_type = 'visitor_checkout'), 0)::int AS checkouts,
                COALESCE(SUM(e.event_count) FILTER (WHERE e.event_type = 'security_alert_created'), 0)::int AS security_alerts
         FROM buckets b
         LEFT JOIN platform_usage_events e ON date_trunc($2, e.occurred_at) = b.bucket
           AND e.occurred_at >= now() - $1::interval
           AND ($5::uuid IS NULL OR e.complex_id = $5)
         GROUP BY b.bucket ORDER BY b.bucket`,
        commonParams
      ),
      query(
        `SELECT COUNT(*) FILTER (WHERE event_type = 'started')::int AS started,
                COUNT(*) FILTER (WHERE event_type = 'upgraded')::int AS upgrades,
                COUNT(*) FILTER (WHERE event_type = 'downgraded')::int AS downgrades,
                COUNT(*) FILTER (WHERE event_type = 'cancelled')::int AS cancellations,
                COUNT(*) FILTER (WHERE event_type = 'renewed')::int AS renewals
         FROM subscription_events
         WHERE occurred_at >= now() - $1::interval AND ($2::uuid IS NULL OR complex_id = $2)`,
        [period.interval, complexId]
      ),
      getSubscriptionRows({ ...req.query, page: req.query.page || 1, page_size: 10 }, { paginated: true }),
      query(
        `SELECT p.id, p.name, p.description, p.monthly_price, p.yearly_price,
                p.max_units, p.max_residents, p.max_admins, p.features, p.is_active, p.created_at,
                COUNT(s.id) FILTER (WHERE s.status = 'active')::int AS active_subscriptions,
                COUNT(s.id) FILTER (WHERE s.status = 'trial')::int AS trials
         FROM subscription_plans p
         LEFT JOIN community_subscriptions s ON s.plan_id = p.id
           AND ($1::uuid IS NULL OR s.complex_id = $1)
         GROUP BY p.id ORDER BY p.is_active DESC, p.name`,
        [complexId]
      ),
      query('SELECT id, name FROM complexes ORDER BY name'),
    ]);

    const allTimeRevenue = await query(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE status IN ('captured', 'refunded')), 0)::numeric(14,2) AS gross,
              COALESCE(SUM(refund_amount), 0)::numeric(14,2) AS refunds
       FROM platform_payment_transactions
       WHERE status IN ('captured', 'refunded') AND ($1::uuid IS NULL OR complex_id = $1)`,
      [complexId]
    );

    const metrics = metricsRes.rows[0] || {};
    const grossRevenue = asNumber(allTimeRevenue.rows[0]?.gross);
    const refundRevenue = asNumber(allTimeRevenue.rows[0]?.refunds);
    const activeCurrent = asNumber(metrics.active_subscriptions);
    const activePrevious = asNumber(metrics.active_at_period_start);

    res.status(200).json({
      success: true,
      data: {
        range: req.query.range || '30d',
        metrics: {
          total_revenue: grossRevenue - refundRevenue,
          gross_revenue: grossRevenue,
          refunds: refundRevenue,
          mrr: asNumber(metrics.mrr),
          active_subscriptions: activeCurrent,
          trial_subscriptions: asNumber(metrics.trial_subscriptions),
          total_residents: asNumber(metrics.total_residents),
          total_complexes: asNumber(metrics.total_complexes),
          subscription_growth_rate: activePrevious > 0 ? ((activeCurrent - activePrevious) / activePrevious) * 100 : null,
          growth_comparison_available: activePrevious > 0,
          period_gross_revenue: asNumber(metrics.period_gross),
          period_refunds: asNumber(metrics.period_refunds),
          period_net_revenue: asNumber(metrics.period_gross) - asNumber(metrics.period_refunds),
          period_transaction_count: asNumber(metrics.period_transaction_count),
        },
        usage: usageRes.rows[0] || {},
        revenue_trend: revenueTrendRes.rows,
        revenue_by_complex: complexRevenueRes.rows,
        revenue_by_plan: planRevenueRes.rows,
        revenue_by_cycle: cycleRevenueRes.rows,
        plan_distribution: planDistributionRes.rows,
        subscription_growth: subscriptionGrowthRes.rows,
        usage_trend: usageTrendRes.rows,
        subscription_activity: lifecycleRes.rows[0] || {},
        subscriptions: subscriptionPage,
        plans: plansRes.rows,
        complexes: complexesRes.rows,
        has_financial_records: grossRevenue > 0 || refundRevenue > 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.listSubscriptions = async (req, res, next) => {
  try {
    const data = await getSubscriptionRows(req.query, { paginated: true });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.getSubscription = async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return next(new AppError('Invalid subscription id', 400));
    const { rows } = await query(
      `SELECT s.*, c.name AS complex_name, p.name AS plan_name,
              COALESCE(last_tx.status, 'unpaid') AS payment_status,
              last_tx.paid_at AS last_paid_at
       FROM community_subscriptions s
       JOIN complexes c ON c.id = s.complex_id
       JOIN subscription_plans p ON p.id = s.plan_id
       LEFT JOIN LATERAL (
         SELECT t.status, t.paid_at FROM platform_payment_transactions t
         WHERE t.subscription_id = s.id ORDER BY t.created_at DESC LIMIT 1
       ) last_tx ON TRUE
       WHERE s.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return next(new AppError('Subscription not found', 404));
    const [transactions, events] = await Promise.all([
      query(
        `SELECT id, plan_name_snapshot, billing_cycle, amount, refund_amount, currency,
                status, provider, provider_reference, paid_at, created_at
         FROM platform_payment_transactions WHERE subscription_id = $1
         ORDER BY created_at DESC LIMIT 20`,
        [req.params.id]
      ),
      query(
        `SELECT id, event_type, from_status, to_status, occurred_at, metadata
         FROM subscription_events WHERE subscription_id = $1
         ORDER BY occurred_at DESC LIMIT 30`,
        [req.params.id]
      ),
    ]);
    res.status(200).json({ success: true, data: { ...rows[0], transactions: transactions.rows, events: events.rows } });
  } catch (err) {
    next(err);
  }
};

exports.createSubscription = async (req, res, next) => {
  let client;
  try {
    client = await getClient();
    const { complex_id, plan_id, billing_cycle, status, amount, renewal_at, started_at, notes } = req.body;
    await client.query('BEGIN');
    const planResult = await client.query(
      'SELECT id, name, monthly_price, yearly_price, is_active FROM subscription_plans WHERE id = $1 FOR SHARE',
      [plan_id]
    );
    const plan = planResult.rows[0];
    if (!plan || !plan.is_active) throw new AppError('Select an active subscription plan', 400);
    const configuredPrice = billing_cycle === 'monthly' ? plan.monthly_price : plan.yearly_price;
    if (amount === undefined && configuredPrice === null && status === 'active') {
      throw new AppError('Set a plan price or enter a negotiated amount before activating this subscription', 400);
    }
    const subscriptionAmount = amount === undefined ? (configuredPrice ?? 0) : amount;
    const { rows } = await client.query(
      `INSERT INTO community_subscriptions
         (complex_id, plan_id, billing_cycle, amount, status, started_at, renewal_at, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()), $7, $8, $9)
       RETURNING id, complex_id, plan_id, billing_cycle, amount, status, started_at, renewal_at, created_at`,
      [complex_id, plan_id, billing_cycle, subscriptionAmount, status || 'trial', started_at || null, renewal_at || null, notes || null, req.user.id]
    );
    await client.query(
      `INSERT INTO subscription_events (subscription_id, complex_id, event_type, to_plan_id, to_status, actor_user_id)
       VALUES ($1, $2, 'started', $3, $4, $5)`,
      [rows[0].id, complex_id, plan_id, status || 'trial', req.user.id]
    );
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    next(err);
  } finally {
    if (client) client.release();
  }
};

exports.updateSubscription = async (req, res, next) => {
  if (!isUuid(req.params.id)) return next(new AppError('Invalid subscription id', 400));
  let client;
  try {
    client = await getClient();
    await client.query('BEGIN');
    const currentResult = await client.query(
      `SELECT s.*, p.monthly_price, p.yearly_price
       FROM community_subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
       WHERE s.id = $1 FOR UPDATE OF s`,
      [req.params.id]
    );
    const current = currentResult.rows[0];
    if (!current) throw new AppError('Subscription not found', 404);

    const nextPlanId = req.body.plan_id || current.plan_id;
    const nextCycle = req.body.billing_cycle || current.billing_cycle;
    let nextAmount = req.body.amount === undefined ? current.amount : req.body.amount;
    if (req.body.plan_id || req.body.billing_cycle || req.body.amount !== undefined) {
      const planResult = await client.query(
        'SELECT id, name, monthly_price, yearly_price, is_active FROM subscription_plans WHERE id = $1 FOR SHARE',
        [nextPlanId]
      );
      const nextPlan = planResult.rows[0];
      if (!nextPlan || !nextPlan.is_active) throw new AppError('Select an active subscription plan', 400);
      const configuredPrice = nextCycle === 'monthly' ? nextPlan.monthly_price : nextPlan.yearly_price;
      if (req.body.amount === undefined && configuredPrice !== null) nextAmount = configuredPrice;
      if (req.body.status === 'active' && nextAmount === null) {
        throw new AppError('Set a plan price or enter a negotiated amount before activating this subscription', 400);
      }
    }

    const nextStatus = req.body.status || current.status;
    const renewalChanged = Boolean(req.body.renewal_at)
      && new Date(req.body.renewal_at).getTime() !== new Date(current.renewal_at || 0).getTime();
    const endedAt = ['cancelled', 'expired'].includes(nextStatus)
      ? (current.ended_at || new Date().toISOString())
      : null;
    const { rows } = await client.query(
      `UPDATE community_subscriptions
       SET plan_id = $2, billing_cycle = $3, amount = $4, status = $5,
           renewal_at = COALESCE($6::timestamptz, renewal_at), ended_at = $7,
           notes = COALESCE($8, notes), updated_at = now()
       WHERE id = $1
       RETURNING id, complex_id, plan_id, billing_cycle, amount, status, started_at, renewal_at, ended_at, updated_at`,
      [req.params.id, nextPlanId, nextCycle, nextAmount, nextStatus, req.body.renewal_at || null, endedAt, req.body.notes || null]
    );

    let eventType = 'status_changed';
    if (current.status !== nextStatus && nextStatus === 'cancelled') {
      eventType = 'cancelled';
    } else if (current.status !== nextStatus && nextStatus === 'expired') {
      eventType = 'expired';
    } else if (renewalChanged) {
      eventType = 'renewed';
    } else if (current.plan_id !== nextPlanId || current.billing_cycle !== nextCycle || Number(current.amount) !== Number(nextAmount)) {
      const currentMrr = Number(current.amount) / (current.billing_cycle === 'yearly' ? 12 : 1);
      const nextMrr = Number(nextAmount) / (nextCycle === 'yearly' ? 12 : 1);
      if (nextMrr > currentMrr) eventType = 'upgraded';
      else if (nextMrr < currentMrr) eventType = 'downgraded';
    }
    await client.query(
      `INSERT INTO subscription_events
         (subscription_id, complex_id, event_type, from_plan_id, to_plan_id, from_status, to_status, actor_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [req.params.id, current.complex_id, eventType, current.plan_id, nextPlanId, current.status, nextStatus, req.user.id]
    );
    await client.query('COMMIT');
    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    next(err);
  } finally {
    if (client) client.release();
  }
};

exports.listPlans = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*, COUNT(s.id) FILTER (WHERE s.status = 'active')::int AS active_subscriptions,
              COUNT(s.id) FILTER (WHERE s.status = 'trial')::int AS trials
       FROM subscription_plans p
       LEFT JOIN community_subscriptions s ON s.plan_id = p.id
       GROUP BY p.id ORDER BY p.is_active DESC, p.name`
    );
    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.createPlan = async (req, res, next) => {
  try {
    const { name, description, monthly_price, yearly_price, max_units, max_residents, max_admins, features } = req.body;
    const { rows } = await query(
      `INSERT INTO subscription_plans
         (name, description, monthly_price, yearly_price, max_units, max_residents, max_admins, features, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
       RETURNING *`,
      [name, description || null, monthly_price ?? null, yearly_price ?? null, max_units ?? null,
        max_residents ?? null, max_admins ?? null, JSON.stringify(features || []), req.user.id]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return next(new AppError('An active plan already uses this name', 409));
    next(err);
  }
};

exports.updatePlan = async (req, res, next) => {
  if (!isUuid(req.params.id)) return next(new AppError('Invalid plan id', 400));
  try {
    const fields = {
      name: 'name', description: 'description', monthly_price: 'monthly_price', yearly_price: 'yearly_price',
      max_units: 'max_units', max_residents: 'max_residents', max_admins: 'max_admins', is_active: 'is_active',
    };
    const setters = [];
    const values = [];
    for (const [key, column] of Object.entries(fields)) {
      if (req.body[key] !== undefined) {
        values.push(req.body[key] === '' && ['description'].includes(key) ? null : req.body[key]);
        setters.push(`${column} = $${values.length}`);
      }
    }
    if (req.body.features !== undefined) {
      values.push(JSON.stringify(req.body.features));
      setters.push(`features = $${values.length}::jsonb`);
    }
    if (setters.length === 0) return next(new AppError('No plan fields supplied', 400));
    values.push(req.params.id);
    const { rows } = await query(
      `UPDATE subscription_plans SET ${setters.join(', ')}, updated_at = now()
       WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!rows.length) return next(new AppError('Plan not found', 404));
    res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return next(new AppError('An active plan already uses this name', 409));
    next(err);
  }
};

exports.getReport = async (req, res, next) => {
  try {
    const period = periodFor(req.query.range);
    const complexId = req.query.complex_id || null;
    let rows = [];
    const type = req.query.type;

    if (type === 'revenue' || type === 'transactions') {
      const params = [period.interval, complexId];
      const clauses = ["t.paid_at >= now() - $1::interval", '($2::uuid IS NULL OR t.complex_id = $2)'];
      if (type === 'transactions' && req.query.status) {
        params.push(req.query.status);
        clauses.push(`t.status = $${params.length}`);
      }
      const result = await query(
        `SELECT t.id, t.paid_at, c.name AS complex_name, t.plan_name_snapshot AS plan_name,
                t.billing_cycle, t.amount AS gross_amount, t.refund_amount,
                (t.amount - t.refund_amount)::numeric(14,2) AS net_amount,
                t.currency, t.status, t.provider, t.provider_reference
         FROM platform_payment_transactions t
         JOIN complexes c ON c.id = t.complex_id
         WHERE ${clauses.join(' AND ')}
         ORDER BY t.paid_at DESC NULLS LAST, t.created_at DESC LIMIT 5000`,
        params
      );
      rows = result.rows;
    } else if (type === 'subscriptions') {
      const result = await getSubscriptionRows(req.query, { paginated: false });
      rows = result.rows;
    } else if (type === 'usage') {
      const result = await query(
        `SELECT date_trunc($2, e.occurred_at) AS occurred_at, c.name AS complex_name,
                e.event_type, SUM(e.event_count)::int AS event_count
         FROM platform_usage_events e
         LEFT JOIN complexes c ON c.id = e.complex_id
         WHERE e.occurred_at >= now() - $1::interval
           AND ($3::uuid IS NULL OR e.complex_id = $3)
         GROUP BY date_trunc($2, e.occurred_at), c.name, e.event_type
         ORDER BY occurred_at DESC, complex_name, e.event_type LIMIT 5000`,
        [period.interval, period.bucket, complexId]
      );
      rows = result.rows;
    } else {
      throw new AppError('Unsupported report type', 400);
    }

    res.status(200).json({ success: true, data: rows, row_count: rows.length, truncated: rows.length === 5000 });
  } catch (err) {
    next(err);
  }
};
