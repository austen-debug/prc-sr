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
