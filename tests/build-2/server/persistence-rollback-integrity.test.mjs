import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const migration=name=>readFileSync(new URL(`../../../migrations/${name}`,import.meta.url),'utf8');
test('failure after archive insertion and live deletion rolls back source, mirrors, archive and audit together',()=>{
  const db=new DatabaseSync(':memory:');
  db.exec('CREATE TABLE records(id TEXT PRIMARY KEY,type TEXT NOT NULL,week_group TEXT,data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)');
  db.exec(migration('0003_gate_persistence_foundation.sql'));
  db.exec(migration('0004_gate_record_audit_triggers.sql'));
  const stamp='2026-09-21T00:00:00Z';
  const insert=db.prepare('INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)');
  const seed=(id,type,wg)=>insert.run(id,type,wg,JSON.stringify({type,week_group:wg,id,notes:'retain source'}),stamp,stamp);
  seed('dorm','dorm','WG26050');seed('bus','bus','WG26050');seed('sound','sound_event','WG26050');
  const source=db.prepare('SELECT id,type,week_group,data,created_at,updated_at FROM records ORDER BY id').all();
  const auditBefore=db.prepare('SELECT COUNT(*) AS n FROM gate_audit_events').get().n;
  db.exec('BEGIN');
  try {
    seed('new-archive','archive','WG26050');
    db.prepare("DELETE FROM records WHERE type IN ('bus','dorm','sound_event') AND week_group='WG26050'").run();
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM records WHERE type=\'dorm\'').get().n,0);
    db.prepare("SELECT json_extract('invalid-json','$')").get();
    db.exec('COMMIT');
    assert.fail('A deliberately invalid post-deletion step must abort.');
  } catch(error) {
    db.exec('ROLLBACK');
    assert.match(error.message,/malformed JSON|JSON|invalid/i);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(db.prepare('SELECT id,type,week_group,data,created_at,updated_at FROM records ORDER BY id').all())),JSON.parse(JSON.stringify(source)));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM gate_v2_buses').get().n,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM gate_v2_dorms').get().n,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM gate_v2_sound_events').get().n,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM gate_v2_archives').get().n,0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM gate_audit_events').get().n,auditBefore);
});
