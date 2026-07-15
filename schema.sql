CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  week_group TEXT,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_records_type ON records(type);
CREATE INDEX IF NOT EXISTS idx_records_week_group ON records(week_group);
CREATE INDEX IF NOT EXISTS idx_records_type_week_group ON records(type, week_group);

CREATE TRIGGER IF NOT EXISTS prevent_audit_event_update
BEFORE UPDATE ON records
WHEN OLD.type = 'audit_event'
BEGIN
  SELECT RAISE(ABORT, 'audit events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS prevent_audit_event_delete
BEFORE DELETE ON records
WHEN OLD.type = 'audit_event'
BEGIN
  SELECT RAISE(ABORT, 'audit events are append-only');
END;
