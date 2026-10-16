-- GATE Admin provenance compatibility (operator-controlled, OFF until installed).
-- Deploy ONLY after comparing this source-defined schema with the actual remote D1 schema.
-- The approved migration runner MUST execute this as one atomic unit during a write-quiet window.
-- No existing operational records, archives, actor values or timestamps are updated.
-- Do not apply to live D1 merely by merging the PR.

DROP TRIGGER IF EXISTS gate_record_audit_insert;
DROP TRIGGER IF EXISTS gate_record_audit_update;
DROP TRIGGER IF EXISTS gate_record_audit_delete;

CREATE TABLE gate_audit_events_admin_v1 (
  event_id TEXT NOT NULL PRIMARY KEY,
  cycle_id TEXT REFERENCES gate_week_groups(cycle_id) ON DELETE RESTRICT,
  operation_id TEXT REFERENCES gate_workflow_operations(operation_id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL CHECK(length(trim(entity_type))>0),
  entity_id TEXT NOT NULL CHECK(length(trim(entity_id))>0),
  event_type TEXT NOT NULL CHECK(length(trim(event_type))>0),
  actor_role TEXT NOT NULL CHECK(actor_role IN ('admin','instructor','airman','squadron','system')),
  prior_version INTEGER NOT NULL DEFAULT 0 CHECK(prior_version>=0),
  resulting_version INTEGER NOT NULL DEFAULT 0 CHECK(resulting_version>=prior_version),
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata_json) AND json_type(metadata_json)='object'),
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO gate_audit_events_admin_v1
 SELECT event_id,cycle_id,operation_id,entity_type,entity_id,event_type,actor_role,prior_version,resulting_version,metadata_json,occurred_at FROM gate_audit_events;
DROP TABLE gate_audit_events;
ALTER TABLE gate_audit_events_admin_v1 RENAME TO gate_audit_events;
CREATE INDEX idx_gate_audit_cycle_time ON gate_audit_events(cycle_id,occurred_at DESC);
CREATE INDEX idx_gate_audit_entity_time ON gate_audit_events(entity_type,entity_id,occurred_at DESC);
CREATE TRIGGER trg_gate_audit_no_update BEFORE UPDATE ON gate_audit_events BEGIN SELECT RAISE(ABORT,'audit events are append-only'); END;
CREATE TRIGGER trg_gate_audit_no_delete BEFORE DELETE ON gate_audit_events BEGIN SELECT RAISE(ABORT,'audit events are append-only'); END;

CREATE TABLE gate_archive_amendments_admin_v1 (
  amendment_id TEXT NOT NULL PRIMARY KEY,
  archive_id TEXT NOT NULL CHECK(length(trim(archive_id))>0),
  cycle_id TEXT REFERENCES gate_week_groups(cycle_id) ON DELETE RESTRICT,
  amendment_number INTEGER NOT NULL CHECK(amendment_number>0),
  amendment_type TEXT NOT NULL CHECK(length(trim(amendment_type))>0),
  reason TEXT NOT NULL CHECK(length(trim(reason))>0),
  changes_json TEXT NOT NULL CHECK(json_valid(changes_json) AND json_type(changes_json)='object'),
  actor_role TEXT NOT NULL CHECK(actor_role IN ('admin','instructor','system')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(archive_id,amendment_number)
);
INSERT INTO gate_archive_amendments_admin_v1
 SELECT amendment_id,archive_id,cycle_id,amendment_number,amendment_type,reason,changes_json,actor_role,created_at FROM gate_archive_amendments;
DROP TABLE gate_archive_amendments;
ALTER TABLE gate_archive_amendments_admin_v1 RENAME TO gate_archive_amendments;
CREATE INDEX idx_gate_amend_archive_time ON gate_archive_amendments(archive_id,created_at DESC);
CREATE TRIGGER trg_gate_amend_no_update BEFORE UPDATE ON gate_archive_amendments BEGIN SELECT RAISE(ABORT,'archive amendments are append-only'); END;
CREATE TRIGGER trg_gate_amend_no_delete BEFORE DELETE ON gate_archive_amendments BEGIN SELECT RAISE(ABORT,'archive amendments are append-only'); END;

CREATE TABLE gate_squadron_notices_admin_v1 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_group TEXT NOT NULL,
  message TEXT NOT NULL CHECK(length(trim(message)) BETWEEN 1 AND 1000),
  published_at TEXT NOT NULL,
  published_by_role TEXT NOT NULL CHECK(published_by_role IN ('admin','instructor'))
);
INSERT INTO gate_squadron_notices_admin_v1 SELECT id,week_group,message,published_at,published_by_role FROM gate_squadron_notices;
DROP TABLE gate_squadron_notices;
ALTER TABLE gate_squadron_notices_admin_v1 RENAME TO gate_squadron_notices;
CREATE INDEX idx_gate_squadron_notices_week_latest ON gate_squadron_notices(week_group,id DESC);
CREATE TRIGGER trg_gate_squadron_notices_no_update BEFORE UPDATE ON gate_squadron_notices BEGIN SELECT RAISE(ABORT,'Squadron notices are append-only'); END;
CREATE TRIGGER trg_gate_squadron_notices_no_delete BEFORE DELETE ON gate_squadron_notices BEGIN SELECT RAISE(ABORT,'Squadron notices are append-only'); END;

CREATE TABLE gate_squadron_information_revisions_admin_v1 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instructions_json TEXT NOT NULL CHECK (json_valid(instructions_json) AND json_type(instructions_json)='array' AND length(instructions_json)<=4096),
  published_at TEXT NOT NULL,
  published_by_role TEXT NOT NULL CHECK(published_by_role IN ('admin','instructor'))
);
INSERT INTO gate_squadron_information_revisions_admin_v1 SELECT id,instructions_json,published_at,published_by_role FROM gate_squadron_information_revisions;
DROP TABLE gate_squadron_information_revisions;
ALTER TABLE gate_squadron_information_revisions_admin_v1 RENAME TO gate_squadron_information_revisions;
CREATE TRIGGER trg_gate_squadron_information_no_update BEFORE UPDATE ON gate_squadron_information_revisions BEGIN SELECT RAISE(ABORT,'Squadron information is append-only'); END;
CREATE TRIGGER trg_gate_squadron_information_no_delete BEFORE DELETE ON gate_squadron_information_revisions BEGIN SELECT RAISE(ABORT,'Squadron information is append-only'); END;

-- Additive journal: withdraw/restore does not mutate the historical archive row.
CREATE TABLE IF NOT EXISTS gate_admin_archive_dispositions (
  operation_id TEXT NOT NULL PRIMARY KEY,
  archive_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision>0),
  action TEXT NOT NULL CHECK(action IN ('withdraw','restore')),
  reason TEXT NOT NULL CHECK(length(trim(reason)) BETWEEN 10 AND 1000),
  actor_role TEXT NOT NULL CHECK(actor_role='admin'),
  occurred_at TEXT NOT NULL,
  UNIQUE(archive_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_gate_admin_disposition_latest ON gate_admin_archive_dispositions(archive_id,revision DESC);
CREATE TRIGGER IF NOT EXISTS trg_gate_admin_dispositions_no_update BEFORE UPDATE ON gate_admin_archive_dispositions BEGIN SELECT RAISE(ABORT,'admin archive dispositions are append-only'); END;
CREATE TRIGGER IF NOT EXISTS trg_gate_admin_dispositions_no_delete BEFORE DELETE ON gate_admin_archive_dispositions BEGIN SELECT RAISE(ABORT,'admin archive dispositions are append-only'); END;

CREATE TRIGGER gate_record_audit_insert AFTER INSERT ON records
 WHEN NEW.type IN ('bus','dorm','archive','config','sound_event')
 BEGIN INSERT INTO gate_audit_events(event_id,cycle_id,entity_type,entity_id,event_type,actor_role,prior_version,resulting_version,metadata_json,occurred_at)
 VALUES(lower(hex(randomblob(16))),(SELECT cycle_id FROM gate_week_groups WHERE state<>'closed' AND week_group=NEW.week_group LIMIT 1),
 NEW.type,NEW.id,'record_created',
 CASE WHEN json_extract(NEW.data,'$.created_by_role') IN ('admin','instructor','airman','squadron','system') THEN json_extract(NEW.data,'$.created_by_role') ELSE 'system' END,
 0,MAX(0,CAST(COALESCE(json_extract(NEW.data,'$.record_version'),0) AS INTEGER)),'{}',NEW.created_at);
 END;
CREATE TRIGGER gate_record_audit_update AFTER UPDATE ON records
 WHEN NEW.type IN ('bus','dorm','archive','config','sound_event')
 BEGIN INSERT INTO gate_audit_events(event_id,cycle_id,entity_type,entity_id,event_type,actor_role,prior_version,resulting_version,metadata_json,occurred_at)
 VALUES(lower(hex(randomblob(16))),(SELECT cycle_id FROM gate_week_groups WHERE state<>'closed' AND week_group=NEW.week_group LIMIT 1),
 NEW.type,NEW.id,'record_updated',
 CASE WHEN json_extract(NEW.data,'$.updated_by_role') IN ('admin','instructor','airman','squadron','system') THEN json_extract(NEW.data,'$.updated_by_role') ELSE 'system' END,
 MAX(0,CAST(COALESCE(json_extract(OLD.data,'$.record_version'),0) AS INTEGER)),
 MAX(MAX(0,CAST(COALESCE(json_extract(OLD.data,'$.record_version'),0) AS INTEGER)),CAST(COALESCE(json_extract(NEW.data,'$.record_version'),0) AS INTEGER)),
 '{}',NEW.updated_at);
 END;
-- Preserve the existing meaning: a database trigger observes deletion but cannot authenticate its actor.
CREATE TRIGGER gate_record_audit_delete AFTER DELETE ON records
 WHEN OLD.type IN ('bus','dorm','archive','config','sound_event')
 BEGIN INSERT INTO gate_audit_events(event_id,cycle_id,entity_type,entity_id,event_type,actor_role,prior_version,resulting_version,metadata_json,occurred_at)
 VALUES(lower(hex(randomblob(16))),(SELECT cycle_id FROM gate_week_groups WHERE state<>'closed' AND week_group=OLD.week_group LIMIT 1),
 OLD.type,OLD.id,'record_deleted','system',
 MAX(0,CAST(COALESCE(json_extract(OLD.data,'$.record_version'),0) AS INTEGER)),
 MAX(0,CAST(COALESCE(json_extract(OLD.data,'$.record_version'),0) AS INTEGER)),
 '{"actor_attribution":"unverified","recorded_by":"database_trigger"}',strftime('%Y-%m-%dT%H:%M:%fZ','now'));
 END;
