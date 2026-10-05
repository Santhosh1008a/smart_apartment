-- Society notices are stored separately from delivery records. The Node API is
-- the only business-data access path; Data API roles receive no table access.
CREATE TABLE IF NOT EXISTS notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  complex_id UUID NOT NULL REFERENCES complexes(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  category VARCHAR(32) NOT NULL CHECK (category IN (
    'maintenance', 'water_supply', 'electricity', 'safety', 'events', 'general'
  )),
  priority VARCHAR(16) NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  status VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'cancelled')),
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notices_end_after_start CHECK (ends_at IS NULL OR ends_at >= starts_at),
  CONSTRAINT notices_sent_has_timestamp CHECK (status <> 'sent' OR sent_at IS NOT NULL),
  CONSTRAINT notices_draft_has_no_send_timestamps
    CHECK (status <> 'draft' OR (sent_at IS NULL AND cancelled_at IS NULL)),
  CONSTRAINT notices_cancelled_has_timestamp CHECK (status <> 'cancelled' OR cancelled_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_notices_complex_status_start
  ON notices (complex_id, status, starts_at);
CREATE INDEX IF NOT EXISTS idx_notices_creator_created
  ON notices (created_by, created_at DESC);

-- One persistent notification per resident and notice. This makes delivery
-- idempotent across retries and resident-list refreshes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_society_notice_delivery
  ON notifications (user_id, (metadata ->> 'notice_id'))
  WHERE type = 'society_notice' AND metadata ? 'notice_id';
CREATE INDEX IF NOT EXISTS idx_notifications_society_notice_id
  ON notifications ((metadata ->> 'notice_id'))
  WHERE type = 'society_notice' AND metadata ? 'notice_id';

COMMENT ON TABLE notices IS
  'Node API only: request handlers enforce complex scope from the authenticated users row; Supabase Data API roles have no table privileges.';

-- Business-data access is performed by the trusted API, not browser roles.
-- service_role bypasses RLS in Supabase; no client-facing RLS policy is needed.
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
-- Remove the creator's default table grants as well, then grant service_role
-- only the four operations used by the trusted API.
REVOKE ALL PRIVILEGES ON TABLE notices FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notices TO service_role;
