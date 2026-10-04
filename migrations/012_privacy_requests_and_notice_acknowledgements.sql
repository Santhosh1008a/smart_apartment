-- Privacy request handling and signup notice acknowledgements.
-- Apply to a reviewed development/staging database before enabling these routes.

CREATE TABLE IF NOT EXISTS user_notice_acknowledgements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notice_type VARCHAR(16) NOT NULL CHECK (notice_type IN ('terms', 'privacy')),
  notice_version VARCHAR(80) NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source VARCHAR(24) NOT NULL DEFAULT 'registration' CHECK (source = 'registration'),
  UNIQUE (user_id, notice_type, notice_version)
);

CREATE INDEX IF NOT EXISTS user_notice_acknowledgements_user_date_idx
  ON user_notice_acknowledgements (user_id, acknowledged_at DESC);

CREATE TABLE IF NOT EXISTS privacy_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  request_type VARCHAR(24) NOT NULL CHECK (request_type IN ('access', 'correction', 'deletion', 'withdraw_consent', 'other')),
  details TEXT CHECK (details IS NULL OR char_length(details) <= 2000),
  status VARCHAR(24) NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'in_review', 'needs_information', 'completed', 'rejected')),
  resolution_note TEXT CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 2000),
  handled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS privacy_requests_user_submitted_idx
  ON privacy_requests (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS privacy_requests_status_submitted_idx
  ON privacy_requests (status, submitted_at ASC);

ALTER TABLE user_notice_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE user_notice_acknowledgements, privacy_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_notice_acknowledgements, privacy_requests TO service_role;
