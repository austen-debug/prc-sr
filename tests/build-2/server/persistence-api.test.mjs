import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequestGet, onRequestPost } from '../../../functions/api/persistence.js';
import { normalizeDraft, validateInitialization, buildArchivePayload, PersistenceValidationError } from '../../../functions/api/persistence-core.mjs';

const migration = name => readFileSync(new URL(`../../../migrations/${name}`, import.meta.url),'utf8');
function fixture() {
  const native = new DatabaseSync(':memory:');
  native.exec('PRAGMA foreign_keys=ON; CREATE TABLE records(id TEXT PRIMARY KEY,type TEXT NOT NULL,week_group TEXT,data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);');
  native.exec(migration('0003_gate_persistence_foundation.sql'));
  native.exec(migration('0004_gate_record_audit_triggers.sql'));
  let failWrite = false;
  const DB = {
    prepare(sql) {
      let args=[];
      const statement={
        bind(...values) { args=values; return this; },
        async first() { return native.prepare(sql).get(...args)??null; },
        async all() { return {results:native.prepare(sql).all(...args)}; },
        async run() {
          if (failWrite) { failWrite=false; throw new Error('Injected D1 write failure'); }
          const result=native.prepare(sql).run(...args);
          return {meta:{changes:Number(result.changes)}};
        },
        async execute() { return /^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql)?this.all():this.run(); }
      };
      return statement;
    },
    async batch(statements) {
      native.exec('BEGIN');
      try {
        const output=[];
        for (const statement of statements) output.push(await statement.execute());
        native.exec('COMMIT');
        return output;
      } catch(e) { native.exec('ROLLBACK'); throw e; }
    }
  };
  const env={DB,GATE_PERSISTENCE_ENABLED:'true',AUTH_SECRET:'fixture-only'};
  const data={session:{role:'instructor'}};
  async function post(body) {
    const request=new Request('https://gate.example/api/persistence',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://gate.example'},body:JSON.stringify(body)});
    const response=await onRequestPost({request,env,data});
    return {status:response.status,body:await response.json()};
  }
  async function get(mode='health') {
    const response=await onRequestGet({request:new Request(`https://gate.example/api/persistence?mode=${mode}`),env,data});
    return {status:response.status,body:await response.json()};
  }
  return {native,DB,env,post,get,failNextWrite(){failWrite=true;}};
}
const stamp='2026-09-21T01:00:00.000Z';
function addRecord(db,id,type,group,extra={}) {
  const data=JSON.stringify({__backendId:id,type,week_group:group,...extra});
  db.prepare('INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(id,type,group,data,stamp,stamp);
}
const draft={
  action:'save_draft',proposed_week_group:'WG26051',
  rows:[
    {sdq:'321 TRS',sec:'01',inter_sec:'02',dorm_name:'A01',sex:'female',band:true,space_force:false,load:42},
    {sdq:'322 TRS',sec:'03',dorm_name:'B02',sex:'male',band:false,space_force:true,load:48}
  ],
  receiving_windows:{receiving_day_one_start:'2026-09-22T17:00',receiving_day_one_end:'2026-09-22T21:00'},
  import_review:{published_total:90,band_decision:'some'}
};

test('all ten tables and the twelve exact protection/mirroring/audit triggers are installed in the fixture',async()=>{
  const f=fixture();
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name LIKE 'gate_%'").get().n,10);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger'").get().n,12);
  assert.equal((await f.get()).body.ready,true);
});

test('typed records mirror legacy inserts, updates, deletes; no original data is reorganized',()=>{
  const f=fixture();
  addRecord(f.native,'bus1','bus','WG26050',{status:'active',departed_at:stamp});
  addRecord(f.native,'dorm1','dorm','WG26050',{state:'empty',max_load:50});
  addRecord(f.native,'cfg','config','',{key:'week_group',value:'WG26050'});
  assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM records').get().n,3);
  assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM gate_v2_buses').get().n,1);
  const updated=JSON.stringify({type:'bus',week_group:'WG26050',status:'arrived',otw_count:22});
  f.native.prepare('UPDATE records SET data=? WHERE id=?').run(updated,'bus1');
  assert.equal(f.native.prepare('SELECT data FROM gate_v2_buses WHERE id=?').get('bus1').data,updated);
  f.native.prepare('DELETE FROM records WHERE id=?').run('bus1');
  assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM gate_v2_buses').get().n,0);
  assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM records').get().n,2);
});

test('single active Week Group and append-only audit and amendments are database-enforced',()=>{
  const f=fixture();
  f.native.prepare("INSERT INTO gate_week_groups(cycle_id,week_group,state) VALUES('cycle1','WG26050','active')").run();
  assert.throws(()=>f.native.prepare("INSERT INTO gate_week_groups(cycle_id,week_group,state) VALUES('cycle2','WG26051','active')").run(),/UNIQUE/);
  f.native.prepare("INSERT INTO gate_audit_events(event_id,entity_type,entity_id,event_type,actor_role) VALUES('audit','bus','bus1','created','instructor')").run();
  assert.throws(()=>f.native.prepare("DELETE FROM gate_audit_events WHERE event_id='audit'").run(),/append-only/);
  f.native.prepare("INSERT INTO gate_archive_amendments(amendment_id,archive_id,amendment_number,amendment_type,reason,changes_json,actor_role) VALUES('a1','archive',1,'correction','Reason recorded','{}','instructor')").run();
  assert.throws(()=>f.native.prepare("UPDATE gate_archive_amendments SET reason='changed' WHERE amendment_id='a1'").run(),/append-only/);
});

test('Input draft optimistic revisions preserve the latest successful save',async()=>{
  const f=fixture(),saved=await f.post(draft);
  assert.equal(saved.status,201);
  const changed=await f.post({...draft,draft_id:saved.body.draft.draft_id,revision:1,rows:[{...draft.rows[0],load:43}]});
  assert.equal(changed.status,200);
  assert.equal(changed.body.draft.revision,2);
  const stale=await f.post({...draft,draft_id:saved.body.draft.draft_id,revision:1});
  assert.equal(stale.status,409);
  assert.equal((await f.get('draft')).body.draft.rows[0].load,43);
});

test('draft normalization rejects overlong, unknown, invalid data instead of silently truncating or replacing it',()=>{
  assert.throws(()=>normalizeDraft({...draft,proposed_week_group:'WG'+'1'.repeat(30)}),/exceeds/);
  assert.throws(()=>normalizeDraft({...draft,rows:[{...draft.rows[0],sdq:'x'.repeat(49)}]}),/exceeds/);
  assert.throws(()=>normalizeDraft({...draft,rows:[{...draft.rows[0],unknown_field:'do not discard'}]}),/silently discarded/);
  assert.throws(()=>normalizeDraft({...draft,rows:[{...draft.rows[0],sex:'unexpected'}]}),/Invalid sex/);
  assert.throws(()=>normalizeDraft({...draft,rows:[{...draft.rows[0],band:true,space_force:true}]}),/Band and Space Force/);
  assert.throws(()=>normalizeDraft({...draft,receiving_windows:{receiving_day_one_start:'2026-09-22T21:00',receiving_day_one_end:'2026-09-22T17:00'}}),/Receiving window/);
  assert.throws(()=>validateInitialization(normalizeDraft({...draft,rows:[draft.rows[0],draft.rows[0]]})),/Duplicate/);
});

test('initialization is atomic, single-use and consumes exactly the saved draft',async()=>{
  const f=fixture(),saved=await f.post(draft);
  const id=saved.body.draft.draft_id;
  const start=await f.post({action:'initialize',draft_id:id,revision:1});
  assert.equal(start.status,200,JSON.stringify(start.body));
  const again=await f.post({action:'initialize',draft_id:id,revision:1});
  assert.equal(again.status,200);
  assert.equal(again.body.idempotent,true);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='dorm'").get().n,2);
  assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM gate_v2_dorms').get().n,2);
  assert.equal(f.native.prepare("SELECT status FROM gate_input_drafts WHERE draft_id=?").get(id).status,'consumed');
  assert.equal((await f.post(draft)).status,409);
  assert.equal((await f.get()).body.ready,true);
});

test('lossless closeout snapshots all exact source rows, including custom bus and dorm JSON, sound events and timestamps',async()=>{
  const f=fixture(),saved=await f.post(draft);
  const start=await f.post({action:'initialize',draft_id:saved.body.draft.draft_id,revision:1});
  assert.equal(start.status,200);
  const dorm=f.native.prepare("SELECT id,data FROM records WHERE type='dorm' ORDER BY id LIMIT 1").get();
  const extended=JSON.stringify({...JSON.parse(dorm.data),unmodeled_operational_field:'preserve-me',notes:'original notes unchanged'});
  f.native.prepare('UPDATE records SET data=? WHERE id=?').run(extended,dorm.id);
  addRecord(f.native,'bus1','bus','WG26051',{status:'arrived',otw_count:23,custom_bus_value:'preserve-bus',created_by_role:'airman'});
  addRecord(f.native,'sound1','sound_event','WG26051',{event:'alert',custom_sound_value:'retain sound context'});
  const original=f.native.prepare("SELECT id,type,week_group,data,created_at,updated_at FROM records WHERE week_group='WG26051' AND type IN ('dorm','bus','sound_event') ORDER BY created_at,id").all();
  const closed=await f.post({action:'closeout',cycle_id:start.body.cycle_id});
  assert.equal(closed.status,200,JSON.stringify(closed.body));
  assert.equal(closed.body.source_record_count,original.length);
  const archive=JSON.parse(f.native.prepare("SELECT data FROM records WHERE type='archive'").get().data);
  assert.deepEqual(JSON.parse(archive.source_records_json),original);
  assert.equal(archive.source_record_count,original.length);
  assert.equal(archive.source_snapshot_format,'lossless-record-rows-v1');
  assert.equal(JSON.parse(archive.dorm_data).length,2);
  assert.equal(archive.total_expected,90);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type IN ('dorm','bus','sound_event')").get().n,0);
  assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM gate_v2_buses').get().n,0);
  assert.equal(f.native.prepare("SELECT state FROM gate_week_groups WHERE cycle_id=?").get(start.body.cycle_id).state,'closed');
  assert.equal(f.native.prepare("SELECT json_extract(data,'$.value') AS wg FROM records WHERE type='config' AND json_extract(data,'$.key')='week_group'").get().wg,'');
  assert.equal((await f.get()).body.ready,true);
  const repeated=await f.post({action:'closeout',cycle_id:start.body.cycle_id});
  assert.equal(repeated.status,200);
  assert.equal(repeated.body.idempotent,true);
  assert.equal(repeated.body.archive_id,closed.body.archive_id);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='archive'").get().n,1);
  // Completed closeout retries must not target a newly active, different Week Group.
  const next=await f.post({...draft,proposed_week_group:'WG26052'});
  assert.equal(next.status,201);
  const nextStart=await f.post({action:'initialize',draft_id:next.body.draft.draft_id,revision:1});
  assert.equal(nextStart.status,200);
  assert.equal((await f.post({action:'closeout',cycle_id:start.body.cycle_id})).body.archive_id,closed.body.archive_id);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='dorm'").get().n,2);
  assert.equal((await f.post({action:'closeout',cycle_id:'unknown-cycle'})).status,409);
});

test('failure while inserting the archive rolls back and retains all source records',async()=>{
  const f=fixture(),saved=await f.post(draft),started=await f.post({action:'initialize',draft_id:saved.body.draft.draft_id,revision:1});
  const before=f.native.prepare("SELECT id,data FROM records WHERE type='dorm' ORDER BY id").all();
  f.failNextWrite();
  const failed=await f.post({action:'closeout',cycle_id:started.body.cycle_id});
  assert.equal(failed.status,409);
  assert.deepEqual(f.native.prepare("SELECT id,data FROM records WHERE type='dorm' ORDER BY id").all(),before);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='archive'").get().n,0);
  assert.equal(f.native.prepare("SELECT state FROM gate_week_groups").get().state,'active');
});

test('oversized lossless archive fails closed with no live deletion or truncated archive',async()=>{
  const f=fixture(),saved=await f.post(draft),started=await f.post({action:'initialize',draft_id:saved.body.draft.draft_id,revision:1});
  addRecord(f.native,'giant-bus','bus','WG26051',{status:'active',custom_payload:'x'.repeat(1100000)});
  const result=await f.post({action:'closeout',cycle_id:started.body.cycle_id});
  assert.equal(result.status,409);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='bus'").get().n,1);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='archive'").get().n,0);
  assert.equal(f.native.prepare("SELECT state FROM gate_week_groups").get().state,'active');
});

test('injected initialization failure rolls back every record, consumption and cycle',async()=>{
  const f=fixture(),saved=await f.post(draft);
  f.failNextWrite();
  assert.equal((await f.post({action:'initialize',draft_id:saved.body.draft.draft_id,revision:1})).status,409);
  assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM records').get().n,0);
  assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM gate_week_groups').get().n,0);
  assert.equal(f.native.prepare('SELECT status FROM gate_input_drafts').get().status,'draft');
});

test('legacy active-cycle adoption preserves existing records without duplicate creation',async()=>{
  const f=fixture();
  addRecord(f.native,'legacy-dorm','dorm','WG26050',{dorm_name:'A01',max_load:48,state:'empty'});
  addRecord(f.native,'legacy-config','config','',{key:'week_group',value:'WG26050'});
  assert.equal((await f.get()).body.adoption_required,true);
  const adopted=await f.post({action:'adopt'});
  assert.equal(adopted.status,200,JSON.stringify(adopted.body));
  assert.equal((await f.post({action:'adopt'})).body.adopted,false);
  assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM gate_week_groups').get().n,1);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='dorm'").get().n,1);
});
