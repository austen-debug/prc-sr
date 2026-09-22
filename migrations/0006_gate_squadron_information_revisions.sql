-- Squadron Information: global standing instructions, versioned and append-only.
-- Instructor writes are also able to self-bootstrap this exact additive schema when an environment missed migration execution.
CREATE TABLE IF NOT EXISTS gate_squadron_information_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instructions_json TEXT NOT NULL CHECK (
    json_valid(instructions_json)
    AND json_type(instructions_json) = 'array'
    AND length(instructions_json) <= 4096
  ),
  published_at TEXT NOT NULL,
  published_by_role TEXT NOT NULL CHECK (published_by_role = 'instructor')
);
CREATE TRIGGER IF NOT EXISTS trg_gate_squadron_information_no_update
BEFORE UPDATE ON gate_squadron_information_revisions
BEGIN
  SELECT RAISE(ABORT, 'Squadron information is append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_gate_squadron_information_no_delete
BEFORE DELETE ON gate_squadron_information_revisions
BEGIN
  SELECT RAISE(ABORT, 'Squadron information is append-only');
END;
