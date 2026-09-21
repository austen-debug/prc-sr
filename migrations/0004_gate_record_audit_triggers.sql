-- Record-level audit events are appended in the same transaction as legacy CRUD.
-- Only new mutations are logged; never invent historical audit events from the 206-row backfill.
-- No raw operational JSON, trainee details, or orders data are copied into audit metadata.
-- The database cannot identify the authenticated actor of DELETE from OLD.data: updated_by_role
-- identifies the prior editor, NOT the person initiating deletion. The delete trigger therefore
-- records its own system-level observation and explicitly marks actor attribution unverified.
-- A later authenticated API event may carry a verified deleting role; never infer it here.
CREATE TRIGGER IF NOT EXISTS gate_record_audit_insert
AFTER INSERT ON records
WHEN NEW.type IN ('bus','dorm','archive','config','sound_event')
BEGIN
  INSERT INTO gate_audit_events(event_id,cycle_id,entity_type,entity_id,event_type,actor_role,prior_version,resulting_version,metadata_json,occurred_at)
  VALUES(
    lower(hex(randomblob(16))),
    (SELECT cycle_id FROM gate_week_groups WHERE state <> 'closed' AND week_group = NEW.week_group LIMIT 1),
    NEW.type, NEW.id, 'record_created',
    CASE WHEN json_extract(NEW.data,'$.created_by_role') IN ('instructor','airman','squadron','system')
      THEN json_extract(NEW.data,'$.created_by_role') ELSE 'system' END,
    0,
    MAX(0,CAST(COALESCE(json_extract(NEW.data,'$.record_version'),0) AS INTEGER)),
    '{}',
    NEW.created_at
  );
END;

CREATE TRIGGER IF NOT EXISTS gate_record_audit_update
AFTER UPDATE ON records
WHEN NEW.type IN ('bus','dorm','archive','config','sound_event')
BEGIN
  INSERT INTO gate_audit_events(event_id,cycle_id,entity_type,entity_id,event_type,actor_role,prior_version,resulting_version,metadata_json,occurred_at)
  VALUES(
    lower(hex(randomblob(16))),
    (SELECT cycle_id FROM gate_week_groups WHERE state <> 'closed' AND week_group = NEW.week_group LIMIT 1),
    NEW.type, NEW.id, 'record_updated',
    CASE WHEN json_extract(NEW.data,'$.updated_by_role') IN ('instructor','airman','squadron','system')
      THEN json_extract(NEW.data,'$.updated_by_role') ELSE 'system' END,
    MAX(0,CAST(COALESCE(json_extract(OLD.data,'$.record_version'),0) AS INTEGER)),
    MAX(MAX(0,CAST(COALESCE(json_extract(OLD.data,'$.record_version'),0) AS INTEGER)),
        CAST(COALESCE(json_extract(NEW.data,'$.record_version'),0) AS INTEGER)),
    '{}',
    NEW.updated_at
  );
END;

CREATE TRIGGER IF NOT EXISTS gate_record_audit_delete
AFTER DELETE ON records
WHEN OLD.type IN ('bus','dorm','archive','config','sound_event')
BEGIN
  INSERT INTO gate_audit_events(event_id,cycle_id,entity_type,entity_id,event_type,actor_role,prior_version,resulting_version,metadata_json,occurred_at)
  VALUES(
    lower(hex(randomblob(16))),
    (SELECT cycle_id FROM gate_week_groups WHERE state <> 'closed' AND week_group = OLD.week_group LIMIT 1),
    OLD.type, OLD.id, 'record_deleted',
    'system',
    MAX(0,CAST(COALESCE(json_extract(OLD.data,'$.record_version'),0) AS INTEGER)),
    MAX(0,CAST(COALESCE(json_extract(OLD.data,'$.record_version'),0) AS INTEGER)),
    '{"actor_attribution":"unverified","recorded_by":"database_trigger"}',
    strftime('%Y-%m-%dT%H:%M:%fZ','now')
  );
END;
