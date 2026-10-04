-- Store only a hash of each refresh token so logout, expiry, and rotation can
-- revoke sessions server-side without retaining bearer credentials.
CREATE TABLE IF NOT EXISTS auth_refresh_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  replaced_by UUID REFERENCES auth_refresh_sessions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS auth_refresh_sessions_user_expiry_idx
  ON auth_refresh_sessions (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS auth_refresh_sessions_active_expiry_idx
  ON auth_refresh_sessions (expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE auth_refresh_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE auth_refresh_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE auth_refresh_sessions TO service_role;
