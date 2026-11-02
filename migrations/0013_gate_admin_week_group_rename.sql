-- Additive audit evidence for Admin-only, Site-Locked Week Group identity correction.
-- Existing operational, archive and Input manifest data is not rewritten by this migration.
CREATE TABLE IF NOT EXISTS gate_admin_week_group_renames (
  operation_id TEXT PRIMARY KEY,
  initialization_id TEXT NOT NULL UNIQUE,
  old_week_group TEXT NOT NULL,
  new_week_group TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK(actor_role='admin'),
  reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 1000),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json) AND json_type(snapshot_json)='array'),
  source_record_count INTEGER NOT NULL CHECK(source_record_count>=1),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gate_admin_week_group_renames_destination
  ON gate_admin_week_group_renames(new_week_group,created_at DESC);
CREATE TRIGGER IF NOT EXISTS trg_gate_admin_week_group_renames_no_update
BEFORE UPDATE ON gate_admin_week_group_renames
BEGIN SELECT RAISE(ABORT,'Week Group rename evidence is immutable'); END;
CREATE TRIGGER IF NOT EXISTS trg_gate_admin_week_group_renames_no_delete
BEFORE DELETE ON gate_admin_week_group_renames
BEGIN SELECT RAISE(ABORT,'Week Group rename evidence is immutable'); END;
