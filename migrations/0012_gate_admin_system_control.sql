-- GATE Admin System Control. Apply only after production schema review,
-- independent D1 backup and an isolated staging rehearsal.
-- Additive; creates no active lock, reset, or operational record mutation.
CREATE TABLE IF NOT EXISTS gate_admin_system_control (
  id INTEGER PRIMARY KEY CHECK(id=1),
  locked INTEGER NOT NULL DEFAULT 0 CHECK(locked IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
  reason TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_by_role TEXT NOT NULL DEFAULT 'system' CHECK(updated_by_role IN ('admin','system'))
);
INSERT OR IGNORE INTO gate_admin_system_control(id,locked,revision,reason,updated_by_role)
VALUES(1,0,0,'','system');

CREATE TABLE IF NOT EXISTS gate_admin_system_events (
  operation_id TEXT PRIMARY KEY,
  action TEXT NOT NULL CHECK(action IN ('lock','unlock','reset_week_group','archive_and_zero')),
  actor_role TEXT NOT NULL CHECK(actor_role='admin'),
  reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 1000),
  week_group TEXT NOT NULL DEFAULT '',
  cycle_id TEXT NOT NULL DEFAULT '',
  revision_before INTEGER NOT NULL DEFAULT 0,
  revision_after INTEGER NOT NULL DEFAULT 0,
  evidence_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TRIGGER IF NOT EXISTS trg_gate_admin_system_events_immutable_update
BEFORE UPDATE ON gate_admin_system_events
BEGIN SELECT RAISE(ABORT,'Admin system events are immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_gate_admin_system_events_immutable_delete
BEFORE DELETE ON gate_admin_system_events
BEGIN SELECT RAISE(ABORT,'Admin system events are immutable'); END;

-- Each reset must retain the full original source record identities and raw
-- payloads prior to removal; no normal archive is created by reset_week_group.
CREATE TABLE IF NOT EXISTS gate_admin_reset_evidence (
  evidence_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL CHECK(action IN ('reset_week_group','archive_and_zero')),
  week_group TEXT NOT NULL,
  cycle_id TEXT NOT NULL DEFAULT '',
  manifest_json TEXT NOT NULL CHECK(json_valid(manifest_json)),
  source_records_json TEXT NOT NULL CHECK(json_valid(source_records_json)),
  source_record_count INTEGER NOT NULL CHECK(source_record_count>=0),
  archive_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TRIGGER IF NOT EXISTS trg_gate_admin_reset_evidence_immutable_update
BEFORE UPDATE ON gate_admin_reset_evidence
BEGIN SELECT RAISE(ABORT,'Admin recovery evidence is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_gate_admin_reset_evidence_immutable_delete
BEFORE DELETE ON gate_admin_reset_evidence
BEGIN SELECT RAISE(ABORT,'Admin recovery evidence is immutable'); END;

-- Immutable initialization source for reset_week_group. A live dorm row is NOT
-- an acceptable substitute for the originally approved Input configuration.
CREATE TABLE IF NOT EXISTS gate_admin_input_manifests (
  initialization_id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL DEFAULT '',
  week_group TEXT NOT NULL,
  manifest_json TEXT NOT NULL CHECK(json_valid(manifest_json) AND json_type(manifest_json)='object'),
  created_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS trg_gate_admin_input_manifests_no_update
BEFORE UPDATE ON gate_admin_input_manifests
BEGIN SELECT RAISE(ABORT,'original Input manifest is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_gate_admin_input_manifests_no_delete
BEFORE DELETE ON gate_admin_input_manifests
BEGIN SELECT RAISE(ABORT,'original Input manifest is immutable'); END;
