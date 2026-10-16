-- GATE Admin session/device visibility. Additive; independent from Admin archive migration 0007.
-- Existing signed cookies with no sid are legacy/untracked and expire naturally (up to 12 hours).
CREATE TABLE IF NOT EXISTS gate_auth_sessions (
 session_id TEXT PRIMARY KEY,
 username TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','instructor','airman','squadron')),
 device_label TEXT NOT NULL,
 browser_label TEXT NOT NULL,
 issued_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 last_seen_at INTEGER NOT NULL,
 revoked_at INTEGER,
 revoked_by_role TEXT CHECK(revoked_by_role IN ('admin','self')),
 revoke_reason TEXT,
 CHECK(expires_at>issued_at),
 CHECK(revoked_at IS NULL OR revoked_at>=issued_at)
);
CREATE INDEX IF NOT EXISTS idx_gate_auth_active ON gate_auth_sessions(expires_at,revoked_at,last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_gate_auth_role ON gate_auth_sessions(role,expires_at);
CREATE TABLE IF NOT EXISTS gate_auth_session_events (
 event_id TEXT PRIMARY KEY,
 session_id TEXT NOT NULL,
 event_type TEXT NOT NULL CHECK(event_type IN ('login','revoke','logout')),
 target_role TEXT NOT NULL CHECK(target_role IN ('admin','instructor','airman','squadron')),
 actor_role TEXT NOT NULL CHECK(actor_role IN ('admin','instructor','airman','squadron')),
 reason TEXT NOT NULL DEFAULT '',
 occurred_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gate_auth_session_events ON gate_auth_session_events(occurred_at DESC);
CREATE TRIGGER IF NOT EXISTS trg_gate_auth_events_no_update BEFORE UPDATE ON gate_auth_session_events
 BEGIN SELECT RAISE(ABORT,'session events are append-only'); END;
CREATE TRIGGER IF NOT EXISTS trg_gate_auth_events_no_delete BEFORE DELETE ON gate_auth_session_events
 BEGIN SELECT RAISE(ABORT,'session events are append-only'); END;
