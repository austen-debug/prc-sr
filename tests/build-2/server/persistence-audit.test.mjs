import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequest as apiMiddleware } from '../../../functions/api/_middleware.js';
import { onRequestPost } from '../../../functions/api/persistence.js';

const migration = number => readFileSync(new URL(`../../../migrations/${number}`, import.meta.url), 'utf8');

function database() {
  const native = new DatabaseSync(':memory:');
  native.exec('CREATE TABLE records(id TEXT PRIMARY KEY,type TEXT NOT NULL,week_group TEXT,data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)');
  native.exec(migration('0003_gate_persistence_foundation.sql'));
  native.exec(migration('0004_gate_record_audit_triggers.sql'));
  return native;
}

test('record-level events persist atomically with mirrored CRUD and retain no operational payload', () => {
  const db = database();
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
  assert.equal(audit[2].actor_role,'system');
  assert.deepEqual(JSON.parse(audit[2].metadata_json), {actor_attribution:'unverified',recorded_by:'database_trigger'});
  assert.equal(audit[0].resulting_version,1);
  assert.equal(audit[1].prior_version,1);
  assert.equal(audit[1].resulting_version,2);
  assert.equal(audit[2].resulting_version,2);
  assert.ok(audit.slice(0,2).every(record => record.metadata_json === '{}'));
  assert.ok(audit.every(record => !record.metadata_json.includes('notes')));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM gate_v2_buses').get().n,0);
  assert.throws(() => db.prepare('DELETE FROM gate_audit_events').run(),/append-only/);
});

test('migration scripts are additive and idempotent for an existing manually created schema', () => {
  const db = database();
  db.prepare('INSERT INTO gate_input_drafts(draft_id) VALUES(?)').run('original-draft');
  db.exec(migration('0003_gate_persistence_foundation.sql'));
  db.exec(migration('0004_gate_record_audit_triggers.sql'));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM gate_input_drafts').get().n,1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger' AND name LIKE 'gate_record_audit_%'").get().n,3);
});

function middlewareFixture() {
  const native = database();
  const DB = { prepare(sql) {
    let values = [];
    return {
      bind(...args) { values = args; return this; },
      async first() { return native.prepare(sql).get(...values) ?? null; },
      async all() { return { results: native.prepare(sql).all(...values) }; }
    };
  }};
  const env = { DB, GATE_PERSISTENCE_ENABLED:'true', AUTH_SECRET:'fixture-only' };
  function signedRequest(method, path, payload) {
    const body = Buffer.from(JSON.stringify({ role:'instructor', exp:Date.now()+60000 })).toString('base64url');
    const signature = createHmac('sha256', env.AUTH_SECRET).update(body).digest('base64url');
    return new Request(`https://gate.example${path}`, {
      method, headers:{ Cookie:`prc_sr_session=${body}.${signature}`, 'Content-Type':'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload)
    });
  }
  async function call(method, path, payload, next) {
    const request = signedRequest(method,path,payload);
    const context = { request, env, data:{}, next: () => next ? next(request,context.data) : new Response('passed') };
    return apiMiddleware(context);
  }
  return { native, env, call };
}

test('completed closeout is verified by its endpoint, not duplicated middleware success logic', async () => {
  const f = middlewareFixture();
  f.native.prepare("INSERT INTO gate_week_groups(cycle_id,week_group,state,archive_id,closed_at) VALUES('cycle','WG26050','closed','missing-archive','2026-09-21T01:00:00Z')").run();
  f.native.prepare("INSERT INTO gate_workflow_operations(operation_id,idempotency_key,action,status,cycle_id,request_fingerprint,archive_id) VALUES('op','closeout:cycle','closeout','completed','cycle','cycle:1','missing-archive')").run();
  const response = await f.call('POST','/api/persistence',{action:'closeout',cycle_id:'cycle'},
    (request,data) => onRequestPost({request,env:f.env,data}));
  assert.equal(response.status,503);
  const body = await response.json();
  assert.equal(body.code,'persistence_unavailable');
});

test('generic records write path permits only the registered active Week Group', async () => {
  const f = middlewareFixture();
  const post = {type:'bus',week_group:'WG26050',bus_type:'airport'};
  assert.equal((await f.call('POST','/api/records',post)).status,409);
  f.native.prepare("INSERT INTO gate_week_groups(cycle_id,week_group,state) VALUES('active-cycle','WG26050','active')").run();
  f.native.prepare('INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('cfg','config','',JSON.stringify({type:'config',key:'week_group',value:'WG26050'}),'2026-09-21T01:00:00Z','2026-09-21T01:00:00Z');
  assert.equal((await f.call('POST','/api/records',post)).status,200);
  assert.equal((await f.call('POST','/api/records',{...post,week_group:'WG26051'})).status,409);
  assert.equal((await f.call('POST','/api/records',{type:'unknown',week_group:'WG26050'})).status,400);
  assert.equal((await f.call('POST','/api/records',{type:'dorm',week_group:'WG26050'})).status,409);
  f.native.prepare("UPDATE gate_week_groups SET state='closed',archive_id='archive',closed_at='2026-09-21T02:00:00Z' WHERE cycle_id='active-cycle'").run();
  assert.equal((await f.call('POST','/api/records',post)).status,409);
});

test('generic config edits cannot spoof the active-group key', async () => {
  const f = middlewareFixture();
  const stamp = '2026-09-21T01:00:00Z';
  f.native.prepare('INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('cfg','config','',JSON.stringify({type:'config',key:'last_airport',value:''}),stamp,stamp);
  assert.equal((await f.call('POST','/api/records',{type:'config',key:'week_group',value:'WG26051'})).status,409);
  assert.equal((await f.call('PUT','/api/records',{__backendId:'cfg',type:'config',key:'week_group',value:'WG26051'})).status,409);
  assert.equal((await f.call('POST','/api/records',{type:'archive',week_group:'WG26050'})).status,409);
});
