-- Package 05: rare Squadron SITREP notices. Additive, no existing record changes.
-- Apply to verified D1 after the prerequisite persistence migrations; never backfill notices.
CREATE TABLE IF NOT EXISTS gate_squadron_notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_group TEXT NOT NULL,
  message TEXT NOT NULL CHECK (length(trim(message)) BETWEEN 1 AND 1000),
  published_at TEXT NOT NULL,
  published_by_role TEXT NOT NULL CHECK (published_by_role = 'instructor')
);
CREATE INDEX IF NOT EXISTS idx_gate_squadron_notices_week_latest
  ON gate_squadron_notices(week_group, id DESC);
CREATE TRIGGER IF NOT EXISTS trg_gate_squadron_notices_no_update
BEFORE UPDATE ON gate_squadron_notices
BEGIN
  SELECT RAISE(ABORT, 'Squadron notices are append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_gate_squadron_notices_no_delete
BEFORE DELETE ON gate_squadron_notices
BEGIN
  SELECT RAISE(ABORT, 'Squadron notices are append-only');
END;
