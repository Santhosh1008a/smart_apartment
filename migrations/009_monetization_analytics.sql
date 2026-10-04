-- Platform monetization data is kept separate from resident maintenance invoices/payments.

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(120) NOT NULL,
  description TEXT,
  monthly_price NUMERIC(12, 2) CHECK (monthly_price IS NULL OR monthly_price >= 0),
  yearly_price NUMERIC(12, 2) CHECK (yearly_price IS NULL OR yearly_price >= 0),
  max_units INTEGER CHECK (max_units IS NULL OR max_units >= 0),
  max_residents INTEGER CHECK (max_residents IS NULL OR max_residents >= 0),
  max_admins INTEGER CHECK (max_admins IS NULL OR max_admins >= 0),
  features JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(features) = 'array'),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_active_name_unique
  ON subscription_plans (lower(name)) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS subscription_plans_created_by_idx
  ON subscription_plans (created_by);

CREATE TABLE IF NOT EXISTS community_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complex_id UUID NOT NULL REFERENCES complexes(id) ON DELETE RESTRICT,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  billing_cycle VARCHAR(12) NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  status VARCHAR(16) NOT NULL DEFAULT 'trial'
    CHECK (status IN ('active', 'trial', 'cancelled', 'expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  renewal_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_subscriptions_complex_idx
  ON community_subscriptions (complex_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS community_subscriptions_plan_idx
  ON community_subscriptions (plan_id, status);
CREATE INDEX IF NOT EXISTS community_subscriptions_status_renewal_idx
  ON community_subscriptions (status, renewal_at);
CREATE INDEX IF NOT EXISTS community_subscriptions_created_by_idx
  ON community_subscriptions (created_by);

CREATE TABLE IF NOT EXISTS platform_payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES community_subscriptions(id) ON DELETE RESTRICT,
  complex_id UUID NOT NULL REFERENCES complexes(id) ON DELETE RESTRICT,
  plan_name_snapshot VARCHAR(120) NOT NULL,
  billing_cycle VARCHAR(12) NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  refund_amount NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (refund_amount >= 0 AND refund_amount <= amount),
  currency CHAR(3) NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  status VARCHAR(12) NOT NULL CHECK (status IN ('pending', 'captured', 'failed', 'refunded')),
  provider VARCHAR(40),
  provider_reference TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('captured', 'refunded') OR paid_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_payment_provider_reference_unique
  ON platform_payment_transactions (provider, provider_reference)
  WHERE provider IS NOT NULL AND provider_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS platform_payment_paid_at_idx
  ON platform_payment_transactions (paid_at DESC);
CREATE INDEX IF NOT EXISTS platform_payment_complex_paid_at_idx
  ON platform_payment_transactions (complex_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS platform_payment_subscription_idx
  ON platform_payment_transactions (subscription_id, created_at DESC);

CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES community_subscriptions(id) ON DELETE RESTRICT,
  complex_id UUID NOT NULL REFERENCES complexes(id) ON DELETE RESTRICT,
  event_type VARCHAR(16) NOT NULL
    CHECK (event_type IN ('started', 'upgraded', 'downgraded', 'cancelled', 'expired', 'renewed', 'status_changed')),
  from_plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  to_plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  from_status VARCHAR(16),
  to_status VARCHAR(16),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS subscription_events_complex_date_idx
  ON subscription_events (complex_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS subscription_events_type_date_idx
  ON subscription_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS subscription_events_subscription_date_idx
  ON subscription_events (subscription_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS subscription_events_from_plan_idx
  ON subscription_events (from_plan_id);
CREATE INDEX IF NOT EXISTS subscription_events_to_plan_idx
  ON subscription_events (to_plan_id);
CREATE INDEX IF NOT EXISTS subscription_events_actor_idx
  ON subscription_events (actor_user_id);

CREATE TABLE IF NOT EXISTS platform_usage_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complex_id UUID REFERENCES complexes(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(32) NOT NULL CHECK (event_type IN (
    'visitor_pass_generated', 'qr_code_scanned', 'visitor_checkin',
    'visitor_checkout', 'security_alert_created'
  )),
  event_count INTEGER NOT NULL DEFAULT 1 CHECK (event_count > 0),
  source_table VARCHAR(40),
  source_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS platform_usage_complex_date_idx
  ON platform_usage_events (complex_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS platform_usage_type_date_idx
  ON platform_usage_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS platform_usage_actor_date_idx
  ON platform_usage_events (actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;

-- Backfill only events with trustworthy source timestamps. Historical QR scan totals
-- are not backfilled because qr_codes.scanned_count does not retain scan timestamps.
INSERT INTO platform_usage_events (complex_id, actor_user_id, event_type, source_table, source_id, occurred_at)
SELECT u.complex_id, vp.host_user_id, 'visitor_pass_generated', 'visitor_passes', vp.id, vp.created_at
FROM visitor_passes vp
JOIN users u ON u.id = vp.host_user_id
WHERE u.complex_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM platform_usage_events e
    WHERE e.event_type = 'visitor_pass_generated' AND e.source_table = 'visitor_passes' AND e.source_id = vp.id
  );

INSERT INTO platform_usage_events (complex_id, event_type, source_table, source_id, occurred_at)
SELECT u.complex_id, 'visitor_checkin', 'visitor_passes', vp.id, vp.checked_in_at
FROM visitor_passes vp
JOIN users u ON u.id = vp.host_user_id
WHERE u.complex_id IS NOT NULL AND vp.checked_in_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM platform_usage_events e
    WHERE e.event_type = 'visitor_checkin' AND e.source_table = 'visitor_passes' AND e.source_id = vp.id
  );

INSERT INTO platform_usage_events (complex_id, event_type, source_table, source_id, occurred_at)
SELECT u.complex_id, 'visitor_checkout', 'visitor_passes', vp.id, vp.checked_out_at
FROM visitor_passes vp
JOIN users u ON u.id = vp.host_user_id
WHERE u.complex_id IS NOT NULL AND vp.checked_out_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM platform_usage_events e
    WHERE e.event_type = 'visitor_checkout' AND e.source_table = 'visitor_passes' AND e.source_id = vp.id
  );

INSERT INTO platform_usage_events (complex_id, actor_user_id, event_type, source_table, source_id, occurred_at)
SELECT COALESCE(u.complex_id, b.complex_id), ea.user_id, 'security_alert_created', 'emergency_alerts', ea.id, ea.created_at
FROM emergency_alerts ea
JOIN users u ON u.id = ea.user_id
LEFT JOIN units un ON un.id = ea.unit_id
LEFT JOIN buildings b ON b.id = un.building_id
WHERE COALESCE(u.complex_id, b.complex_id) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM platform_usage_events e
    WHERE e.event_type = 'security_alert_created' AND e.source_table = 'emergency_alerts' AND e.source_id = ea.id
  );

CREATE OR REPLACE FUNCTION capture_visitor_platform_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_complex_id UUID;
BEGIN
  SELECT complex_id INTO target_complex_id FROM users WHERE id = NEW.host_user_id;

  IF target_complex_id IS NOT NULL AND TG_OP = 'INSERT' THEN
    INSERT INTO platform_usage_events (complex_id, actor_user_id, event_type, source_table, source_id, occurred_at)
    VALUES (target_complex_id, NEW.host_user_id, 'visitor_pass_generated', 'visitor_passes', NEW.id, NEW.created_at);
  END IF;

  IF target_complex_id IS NOT NULL AND TG_OP = 'UPDATE' THEN
    IF OLD.checked_in_at IS NULL AND NEW.checked_in_at IS NOT NULL THEN
      INSERT INTO platform_usage_events (complex_id, event_type, source_table, source_id, occurred_at)
      VALUES (target_complex_id, 'visitor_checkin', 'visitor_passes', NEW.id, NEW.checked_in_at);
    END IF;
    IF OLD.checked_out_at IS NULL AND NEW.checked_out_at IS NOT NULL THEN
      INSERT INTO platform_usage_events (complex_id, event_type, source_table, source_id, occurred_at)
      VALUES (target_complex_id, 'visitor_checkout', 'visitor_passes', NEW.id, NEW.checked_out_at);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION capture_qr_platform_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_complex_id UUID;
  target_user_id UUID;
BEGIN
  IF NEW.scanned_count > OLD.scanned_count THEN
    SELECT u.complex_id, vp.host_user_id INTO target_complex_id, target_user_id
    FROM visitor_passes vp
    JOIN users u ON u.id = vp.host_user_id
    WHERE vp.id = NEW.visitor_pass_id;

    IF target_complex_id IS NOT NULL THEN
      INSERT INTO platform_usage_events (complex_id, actor_user_id, event_type, event_count, source_table, source_id, occurred_at)
      VALUES (target_complex_id, target_user_id, 'qr_code_scanned', NEW.scanned_count - OLD.scanned_count, 'qr_codes', NEW.id, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION capture_security_alert_platform_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_complex_id UUID;
BEGIN
  SELECT COALESCE(u.complex_id, b.complex_id) INTO target_complex_id
  FROM users u
  LEFT JOIN units un ON un.id = NEW.unit_id
  LEFT JOIN buildings b ON b.id = un.building_id
  WHERE u.id = NEW.user_id;

  IF target_complex_id IS NOT NULL THEN
    INSERT INTO platform_usage_events (complex_id, actor_user_id, event_type, source_table, source_id, occurred_at)
    VALUES (target_complex_id, NEW.user_id, 'security_alert_created', 'emergency_alerts', NEW.id, NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS visitor_pass_platform_usage_trigger ON visitor_passes;
CREATE TRIGGER visitor_pass_platform_usage_trigger
AFTER INSERT OR UPDATE OF checked_in_at, checked_out_at ON visitor_passes
FOR EACH ROW EXECUTE FUNCTION capture_visitor_platform_usage();

DROP TRIGGER IF EXISTS qr_code_platform_usage_trigger ON qr_codes;
CREATE TRIGGER qr_code_platform_usage_trigger
AFTER UPDATE OF scanned_count ON qr_codes
FOR EACH ROW EXECUTE FUNCTION capture_qr_platform_usage();

DROP TRIGGER IF EXISTS emergency_alert_platform_usage_trigger ON emergency_alerts;
CREATE TRIGGER emergency_alert_platform_usage_trigger
AFTER INSERT ON emergency_alerts
FOR EACH ROW EXECUTE FUNCTION capture_security_alert_platform_usage();

-- Exposed-schema defense in depth: only authenticated super admins may access
-- these platform-wide records. The application API also checks req.user.role.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'subscription_plans', 'community_subscriptions', 'platform_payment_transactions',
    'subscription_events', 'platform_usage_events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_super_admin_all', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.jwt_role() = ''super_admin'') WITH CHECK (public.jwt_role() = ''super_admin'')', table_name || '_super_admin_all', table_name);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION capture_visitor_platform_usage() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION capture_qr_platform_usage() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION capture_security_alert_platform_usage() FROM PUBLIC, anon, authenticated;
