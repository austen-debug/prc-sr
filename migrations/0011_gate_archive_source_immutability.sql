-- GATE historical source defense-in-depth. Additive; no existing record is rewritten.
-- This must be a new migration: editing 0003 after deployment cannot protect existing D1.
-- Closeout INSERTs new archives; correction and Admin withdrawal use separate append-only tables.
CREATE TRIGGER IF NOT EXISTS trg_gate_archive_source_no_update
BEFORE UPDATE ON records
WHEN OLD.type='archive' OR NEW.type='archive'
BEGIN
  SELECT RAISE(ABORT,'archive source records are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_gate_archive_source_no_delete
BEFORE DELETE ON records
WHEN OLD.type='archive'
BEGIN
  SELECT RAISE(ABORT,'archive source records are immutable');
END;

-- SQLite REPLACE can bypass delete triggers when recursive_triggers is off.
-- Guard replacement attempts at INSERT time without blocking new closeout archives.
CREATE TRIGGER IF NOT EXISTS trg_gate_archive_source_no_replace
BEFORE INSERT ON records
WHEN EXISTS(SELECT 1 FROM records WHERE id=NEW.id AND type='archive')
BEGIN
  SELECT RAISE(ABORT,'archive source records are immutable');
END;
