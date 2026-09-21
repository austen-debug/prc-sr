import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const migration = number => readFileSync(new URL(`../../../migrations/${number}`, import.meta.url), 'utf8');

test('record-level events persist atomically with mirrored CRUD and retain no operational payload', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE records(id TEXT PRIMARY KEY,type TEXT NOT NULL,week_group TEXT,data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)');
  db.exec(migration('0003_gate_persistence_foundation.sql'));
  db.exec(migration('0004_gate_record_audit_triggers.sql'));
  const timestamp = '2026-09-21T00:00:00Z';
  const bus = JSON.stringify({type:'bus',week_group:'WG26050',record_version:1,created_by_role:'instructor',updated_by_role:'instructor',notes:'do not copy these notes to audit'});
  db.prepare('INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('bus1','bus','WG26050',bus,timestamp,timestamp);
  const changed = JSON.stringify({type:'bus',week_group:'WG26050',record_version:2,updated_by_role:'airman',notes:'updated sensitive operational payload'});
  db.prepare('UPDATE records SET data=?,updated_at=? WHERE id=?').run(changed,timestamp,'bus1');
  db.prepare('DELETE FROM records WHERE id=?').run('bus1');
  const audit = db.prepare("SELECT event_type,actor_role,prior_version,resulting_version,metadata_json FROM gate_audit_events WHERE entity_id='bus1' ORDER BY rowid").all();
  assert.deepEqual(audit.map(record => record.event_type), ['record_created','record_updated','record_deleted']);
  assert.equal(audit[0].actor_role,'instructor');
  assert.equal(audit[1].actor_role,'airman');
  assert.equal(audit[0].resulting_version,1);
  assert.equal(audit[1].prior_version,1);
  assert.equal(audit[1].resulting_version,2);
  assert.equal(audit[2].resulting_version,2);
  assert.ok(audit.every(record => record.metadata_json === '{}'));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM gate_v2_buses').get().n,0);
  assert.throws(() => db.prepare('DELETE FROM gate_audit_events').run(),/append-only/);
});

test('migration scripts are additive and idempotent for an existing manually created schema', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE records(id TEXT PRIMARY KEY,type TEXT NOT NULL,week_group TEXT,data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)');
  db.exec(migration('0003_gate_persistence_foundation.sql'));
  db.exec(migration('0004_gate_record_audit_triggers.sql'));
  db.prepare('INSERT INTO gate_input_drafts(draft_id) VALUES(?)').run('original-draft');
  db.exec(migration('0003_gate_persistence_foundation.sql'));
  db.exec(migration('0004_gate_record_audit_triggers.sql'));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM gate_input_drafts').get().n,1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger' AND name LIKE 'gate_record_audit_%'").get().n,3);
});
