-- 0010: additive, once-only Cloudflare D1 migration for GATE session context.
-- Run AFTER 0008. No existing receiving/archival table or session identity is rebuilt.
-- Cloudflare city/region/country refer to an approximate NETWORK location at sign-in.
-- Never store raw IP, hostname, precise coordinates, User-Agent strings or fingerprints.
ALTER TABLE gate_auth_sessions ADD COLUMN os_label TEXT NOT NULL DEFAULT '';
ALTER TABLE gate_auth_sessions ADD COLUMN browser_version TEXT NOT NULL DEFAULT '';
ALTER TABLE gate_auth_sessions ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE gate_auth_sessions ADD COLUMN region TEXT NOT NULL DEFAULT '';
ALTER TABLE gate_auth_sessions ADD COLUMN country TEXT NOT NULL DEFAULT '';
ALTER TABLE gate_auth_sessions ADD COLUMN network_organization TEXT NOT NULL DEFAULT '';
ALTER TABLE gate_auth_sessions ADD COLUMN device_nickname TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS gate_auth_session_label_events (
  event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  previous_nickname TEXT NOT NULL,
  new_nickname TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK(actor_role='admin'),
  reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 300),
  occurred_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gate_auth_session_label_events
  ON gate_auth_session_label_events(session_id,occurred_at DESC);
CREATE TRIGGER IF NOT EXISTS trg_gate_auth_session_labels_no_update
  BEFORE UPDATE ON gate_auth_session_label_events
  BEGIN SELECT RAISE(ABORT,'session label events are append-only'); END;
CREATE TRIGGER IF NOT EXISTS trg_gate_auth_session_labels_no_delete
  BEFORE DELETE ON gate_auth_session_label_events
  BEGIN SELECT RAISE(ABORT,'session label events are append-only'); END;
