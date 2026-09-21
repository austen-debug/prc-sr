import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequestGet, onRequestPost } from '../../../functions/api/persistence.js';
import { normalizeDraft, validateInitialization, PersistenceValidationError } from '../../../functions/api/persistence-core.mjs';

const schema = readFileSync(new URL('../../../migrations/0003_gate_persistence_foundation.sql', import.meta.url), 'utf8');
function fixture() {
  const native = new DatabaseSync(':memory:');
  native.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE records (id TEXT PRIMARY KEY,type TEXT NOT NULL,week_group TEXT,data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);`);
  native.exec(schema);
  let rejectNext = false;
  const prepared = sql => {
    let parameters = [];
    return {
      bind(...values) { parameters = values; return this; },
      async first() { return native.prepare(sql).get(...parameters) ?? null; },
      async all() { return { results: native.prepare(sql).all(...parameters) }; },
      async run() {
        if (rejectNext) { rejectNext = false; throw new Error('Injected database failure.'); }
        const result = native.prepare(sql).run(...parameters);
        return { meta: { changes: Number(result.changes) } };
      },
      async execute() {
        if (/^\s*(?:SELECT|WITH|PRAGMA)\b/i.test(sql)) return this.all();
        return this.run();
      }
    };
  };
  const DB = {
    prepare: prepared,
    async batch(statements) {
      native.exec('BEGIN');
      try {
        const output = [];
        for (const statement of statements) output.push(await statement.execute());
        native.exec('COMMIT');
        return output;
      } catch (error) {
        native.exec('ROLLBACK');
        throw error;
      }
    }
  };
  const env = { DB, GATE_PERSISTENCE_ENABLED: 'true' };
  const role = { session: { role: 'instructor' } };
  const post = async body => {
    const request = new Request('https://gate.example/api/persistence', {
      method: 'POST', headers: { 'Content-Type':'application/json', Origin: 'https://gate.example' }, body: JSON.stringify(body)
    });
    const reply = await onRequestPost({ request, env, data: role });
    return { status: reply.status, body: await reply.json() };
  };
  const get = async (mode = 'health') => {
    const reply = await onRequestGet({ request: new Request(`https://gate.example/api/persistence?mode=${mode}`), env, data: role });
    return { status: reply.status, body: await reply.json() };
  };
  return { native, env, DB, post, get, failNextWrite() { rejectNext = true; } };
}
const stamp = '2026-09-21T01:00:00.000Z';
function addRecord(db, id, type, weekGroup, extra = {}) {
  const data = JSON.stringify({ __backendId: id, type, week_group: weekGroup, ...extra });
  db.prepare('INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)')
    .run(id, type, weekGroup, data, stamp, stamp);
}
const draft = {
  action: 'save_draft', proposed_week_group: 'WG26051',
  rows: [
    { sdq: '321 TRS', sec: '01', inter_sec: '02', dorm_name: 'A01', sex:'female', band:true, space_force:false, load:42 },
    { sdq: '322 TRS', sec:'03', dorm_name:'B02', sex:'male', band:false, space_force:true, load:48 }
  ],
  receiving_windows: { receiving_day_one_start:'2026-09-22T17:00', receiving_day_one_end:'2026-09-22T21:00' },
  import_review: { published_total:90, band_decision:'some' }
};

test('migration creates ten typed/persistence tables and critical protections', () => {
  const { native } = fixture();
  const names = native.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'gate_%'").all();
  assert.equal(names.length, 10);
  const triggers = native.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'gate_mirror_records_%'").all();
  assert.equal(triggers.length, 3);
  assert.equal(native.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger' AND name IN ('trg_gate_audit_no_update','trg_gate_audit_no_delete','trg_gate_amend_no_update','trg_gate_amend_no_delete')").get().n, 4);
});

test('legacy writes mirror atomically; old records are not lost by schema setup', () => {
  const { native } = fixture();
  addRecord(native, 'bus1', 'bus', 'WG26050', { status:'active', departed_at:stamp });
  addRecord(native, 'dorm1', 'dorm', 'WG26050', { state:'empty', max_load:50 });
  addRecord(native, 'cfg', 'config', '', { key:'week_group', value:'WG26050' });
  assert.equal(native.prepare('SELECT COUNT(*) AS n FROM records').get().n, 3);
  assert.equal(native.prepare('SELECT COUNT(*) AS n FROM gate_v2_buses').get().n, 1);
  assert.equal(native.prepare('SELECT COUNT(*) AS n FROM gate_v2_dorms').get().n, 1);
  const next = JSON.stringify({ type:'bus', week_group:'WG26050', status:'arrived', otw_count:22 });
  native.prepare('UPDATE records SET data=? WHERE id=?').run(next, 'bus1');
  assert.equal(native.prepare('SELECT status FROM gate_v2_buses WHERE id=?').get('bus1').status, 'arrived');
  assert.equal(native.prepare('SELECT data FROM gate_v2_buses WHERE id=?').get('bus1').data, next);
  native.prepare('DELETE FROM records WHERE id=?').run('bus1');
  assert.equal(native.prepare('SELECT COUNT(*) AS n FROM gate_v2_buses').get().n, 0);
  assert.equal(native.prepare('SELECT COUNT(*) AS n FROM records').get().n, 2);
});

test('single active cycle and immutable audit/amendments are enforced in the database', () => {
  const { native } = fixture();
  native.prepare("INSERT INTO gate_week_groups(cycle_id,week_group,state) VALUES('cycle1','WG26050','active')").run();
  assert.throws(() => native.prepare("INSERT INTO gate_week_groups(cycle_id,week_group,state) VALUES('cycle2','WG26051','initializing')").run(), /UNIQUE/);
  native.prepare("INSERT INTO gate_audit_events(event_id,entity_type,entity_id,event_type,actor_role) VALUES('event1','bus','bus1','created','instructor')").run();
  assert.throws(() => native.prepare("DELETE FROM gate_audit_events WHERE event_id='event1'").run(), /append-only/);
  native.prepare("INSERT INTO gate_archive_amendments(amendment_id,archive_id,amendment_number,amendment_type,reason,changes_json,actor_role) VALUES('a1','archive1',1,'correction','Reason goes here','{}','instructor')").run();
  assert.throws(() => native.prepare("UPDATE gate_archive_amendments SET reason='Changed' WHERE amendment_id='a1'").run(), /append-only/);
});

test('Input drafts persist and stale revisions fail without overwriting newer data', async () => {
  const f = fixture();
  const initial = await f.post(draft);
  assert.equal(initial.status, 201);
  assert.equal(initial.body.draft.revision, 1);
  assert.equal(initial.body.draft.rows[0].dorm_name, 'A01');
  const modified = await f.post({ ...draft, draft_id:initial.body.draft.draft_id, revision:1, rows:[{...draft.rows[0], load:43}] });
  assert.equal(modified.status, 200);
  assert.equal(modified.body.draft.revision, 2);
  const stale = await f.post({ ...draft, draft_id:initial.body.draft.draft_id, revision:1 });
  assert.equal(stale.status, 409);
  const recovered = await f.get('draft');
  assert.equal(recovered.body.draft.rows[0].load, 43);
});

test('initialization and closeout atomically populate and clear live typed data while preserving an archive', async () => {
  const f = fixture();
  const health = await f.get();
  assert.equal(health.body.ready, true);
  const saved = await f.post(draft);
  const draftId = saved.body.draft.draft_id;
  const initiated = await f.post({action:'initialize',draft_id:draftId,revision:1});
  assert.equal(initiated.status, 200, JSON.stringify(initiated.body));
  const repeated = await f.post({action:'initialize',draft_id:draftId,revision:1});
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.idempotent, true);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='dorm'").get().n, 2);
  assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM gate_v2_dorms').get().n, 2);
  assert.equal(f.native.prepare("SELECT value FROM json_each('{}')").all().length, 0);
  assert.equal(f.native.prepare("SELECT json_extract(data,'$.value') AS wg FROM gate_v2_config WHERE config_key='week_group'").get().wg, 'WG26051');
  assert.equal(f.native.prepare("SELECT status FROM gate_input_drafts WHERE draft_id=?").get(draftId).status, 'consumed');
  const closed = await f.post({action:'closeout',cycle_id:initiated.body.cycle_id});
  assert.equal(closed.status, 200, JSON.stringify(closed.body));
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='dorm'").get().n, 0);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM gate_v2_dorms").get().n, 0);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='archive'").get().n, 1);
  const archive = JSON.parse(f.native.prepare("SELECT data FROM records WHERE type='archive'").get().data);
  assert.equal(archive.dorm_count, 2);
  assert.equal(archive.total_expected, 90);
  assert.equal(JSON.parse(archive.dorm_data).length, 2);
  assert.equal(f.native.prepare("SELECT state FROM gate_week_groups WHERE cycle_id=?").get(initiated.body.cycle_id).state, 'closed');
  assert.equal(f.native.prepare("SELECT json_extract(data,'$.value') AS wg FROM records WHERE type='config'").get().wg, '');
  assert.equal((await f.get()).body.ready, true);
});

test('failed atomic initialization rolls back all records, draft consumption and lifecycle state', async () => {
  const f = fixture();
  const saved = await f.post(draft);
  f.failNextWrite();
  const result = await f.post({action:'initialize',draft_id:saved.body.draft.draft_id,revision:1});
  assert.equal(result.status, 409);
  assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM records').get().n, 0);
  assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM gate_week_groups').get().n, 0);
  assert.equal(f.native.prepare('SELECT status FROM gate_input_drafts').get().status, 'draft');
});

test('active WG adoption preserves existing operational rows and does not create duplicate cycles', async () => {
  const f = fixture();
  addRecord(f.native, 'legacy-dorm','dorm','WG26050',{dorm_name:'A01',max_load:48,state:'empty'});
  addRecord(f.native, 'legacy-config','config','',{key:'week_group',value:'WG26050'});
  const initialHealth = await f.get();
  assert.equal(initialHealth.body.adoption_required, true);
  const first = await f.post({action:'adopt'});
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.week_group, 'WG26050');
  const second = await f.post({action:'adopt'});
  assert.equal(second.body.adopted, false);
  assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM gate_week_groups').get().n, 1);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='dorm'").get().n, 1);
});

test('sensitive and invalid draft states are rejected before initialization', () => {
  assert.throws(() => normalizeDraft({...draft, rows:[{...draft.rows[0],band:true,space_force:true}]}), PersistenceValidationError);
  assert.throws(() => validateInitialization(normalizeDraft({...draft,rows:[draft.rows[0],draft.rows[0]]})), /Duplicate/);
  assert.throws(() => normalizeDraft({...draft,receiving_windows:{receiving_day_one_start:'2026-09-22T21:00',receiving_day_one_end:'2026-09-22T17:00'}}), /Receiving window/);
});
