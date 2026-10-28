import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {onRequestGet,onRequestPost} from '../../../functions/api/persistence.js';
import {onRequestGet as archiveGet} from '../../../functions/api/archives.js';
import {onRequestPost as legacyCloseoutPost} from '../../../functions/api/legacy-closeout.js';
import {normalizeDraft,validateInitialization} from '../../../functions/api/persistence-core.mjs';
const migration = name => readFileSync(new URL(`../../../migrations/${name}`,import.meta.url),'utf8');
const stamp='2026-09-21T01:00:00.000Z';
const draft={action:'save_draft',proposed_week_group:'WG26051',rows:[
  {sdq:'321 TRS',sec:'01',inter_sec:'02',dorm_name:'A01',sex:'female',band:true,space_force:false,load:42},
  {sdq:'322 TRS',sec:'03',dorm_name:'B02',sex:'male',band:false,space_force:true,load:48}
],receiving_windows:{receiving_day_one_start:'2026-09-22T17:00',receiving_day_one_end:'2026-09-22T21:00'},import_review:{published_total:90,band_decision:'some'}};
function fixture({migrate=true}={}){
  const native=new DatabaseSync(':memory:');
  native.exec('PRAGMA foreign_keys=ON;CREATE TABLE records(id TEXT PRIMARY KEY,type TEXT NOT NULL,week_group TEXT,data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);');
  if(migrate){
    native.exec(migration('0003_gate_persistence_foundation.sql'));
    native.exec(migration('0004_gate_record_audit_triggers.sql'));
  }
  let failWrite=false;
  const DB={prepare(sql){let args=[];return {
    bind(...values){args=values;return this;},
    async first(){return native.prepare(sql).get(...args)??null;},
    async all(){return {results:native.prepare(sql).all(...args)};},
    async run(){if(failWrite){failWrite=false;throw new Error('Injected write failure');}const result=native.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)}};},
    async execute(){return /^\s*(SELECT|WITH|PRAGMA)\b/i.test(sql)?this.all():this.run();}
  };},async batch(statements){native.exec('BEGIN');try{const results=[];for(const item of statements)results.push(await item.execute());native.exec('COMMIT');return results;}catch(e){native.exec('ROLLBACK');throw e;}}};
  const env={DB,GATE_PERSISTENCE_ENABLED:'true',GATE_PERSISTENCE_CUTOVER_READY:'true',AUTH_SECRET:'fixture-only'},data={session:{role:'instructor'}};
  async function post(body){const request=new Request('https://gate.example/api/persistence',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://gate.example'},body:JSON.stringify(body)});const response=await onRequestPost({request,env,data});return {status:response.status,body:await response.json()};}
  async function get(mode='health'){const response=await onRequestGet({request:new Request(`https://gate.example/api/persistence?mode=${mode}`),env,data});return {status:response.status,body:await response.json()};}
  return {native,env,post,get,failNextWrite(){failWrite=true;}};
}
function addRecord(db,id,type,wg,extra={}){const data=JSON.stringify({__backendId:id,type,week_group:wg,...extra});db.prepare('INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(id,type,wg,data,stamp,stamp);}
async function startCycle(f){const saved=await f.post(draft);assert.equal(saved.status,201);const started=await f.post({action:'initialize',draft_id:saved.body.draft.draft_id,revision:1});assert.equal(started.status,200,JSON.stringify(started.body));return {saved,started};}
test('exact ten tables and twelve triggers; health requires parity and both migrations',async()=>{const f=fixture();assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name LIKE 'gate_%'").get().n,10);assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger'").get().n,12);assert.equal((await f.get()).body.ready,true);});
test('legacy writes mirror without deleting source data',()=>{const f=fixture();addRecord(f.native,'bus1','bus','WG26050',{status:'active'});addRecord(f.native,'dorm1','dorm','WG26050',{state:'empty'});addRecord(f.native,'cfg','config','',{key:'week_group',value:'WG26050'});assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM records').get().n,3);assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM gate_v2_buses').get().n,1);const payload=JSON.stringify({type:'bus',week_group:'WG26050',status:'arrived'});f.native.prepare('UPDATE records SET data=? WHERE id=?').run(payload,'bus1');assert.equal(f.native.prepare('SELECT data FROM gate_v2_buses WHERE id=?').get('bus1').data,payload);f.native.prepare('DELETE FROM records WHERE id=?').run('bus1');assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM gate_v2_buses').get().n,0);assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM records').get().n,2);});
test('one active cycle and append-only audit/amendment protections',()=>{const f=fixture();f.native.prepare("INSERT INTO gate_week_groups(cycle_id,week_group,state) VALUES('one','WG26050','active')").run();assert.throws(()=>f.native.prepare("INSERT INTO gate_week_groups(cycle_id,week_group,state) VALUES('two','WG26051','active')").run(),/UNIQUE/);f.native.prepare("INSERT INTO gate_audit_events(event_id,entity_type,entity_id,event_type,actor_role) VALUES('audit','bus','id','created','instructor')").run();assert.throws(()=>f.native.prepare("DELETE FROM gate_audit_events WHERE event_id='audit'").run(),/append-only/);f.native.prepare("INSERT INTO gate_archive_amendments(amendment_id,archive_id,amendment_number,amendment_type,reason,changes_json,actor_role) VALUES('amend','archive',1,'correction','Valid reason','{}','instructor')").run();assert.throws(()=>f.native.prepare("UPDATE gate_archive_amendments SET reason='wrong' WHERE amendment_id='amend'").run(),/append-only/);});
test('draft revision conflict does not overwrite current save',async()=>{const f=fixture(),saved=await f.post(draft);assert.equal(saved.status,201);const id=saved.body.draft.draft_id;const changed=await f.post({...draft,draft_id:id,revision:1,rows:[{...draft.rows[0],load:43}]});assert.equal(changed.status,200);assert.equal(changed.body.draft.revision,2);assert.equal((await f.post({...draft,draft_id:id,revision:1})).status,409);assert.equal((await f.get('draft')).body.draft.rows[0].load,43);});
test('invalid input fails rather than truncate, discard, or coerce',()=>{assert.throws(()=>normalizeDraft({...draft,proposed_week_group:'WG'+'1'.repeat(30)}),/exceeds/);assert.throws(()=>normalizeDraft({...draft,rows:[{...draft.rows[0],sdq:'x'.repeat(49)}]}),/exceeds/);assert.throws(()=>normalizeDraft({...draft,rows:[{...draft.rows[0],extra:'retain'}]}),/silently discarded/);assert.throws(()=>normalizeDraft({...draft,rows:[{...draft.rows[0],sex:'invalid'}]}),/Invalid sex/);assert.throws(()=>normalizeDraft({...draft,rows:[{...draft.rows[0],band:true,space_force:true}]}),/Band and Space Force/);assert.throws(()=>validateInitialization(normalizeDraft({...draft,receiving_windows:{receiving_day_one_start:'2026-09-22T21:00',receiving_day_one_end:'2026-09-22T17:00'}})),/Receiving window/);assert.throws(()=>validateInitialization(normalizeDraft({...draft,rows:[draft.rows[0],draft.rows[0]]})),/Duplicate/);});
test('sparse source indices retain original Input slots and reject ambiguous ordering',()=>{
  const rows=[{...draft.rows[0],rowIndex:3},{...draft.rows[1],rowIndex:7}];
  const normalized=normalizeDraft({...draft,rows});
  assert.deepEqual(normalized.rows.map(row=>row.rowIndex),[3,7]);
  assert.equal(validateInitialization(normalized).length,2);
  for(const invalid of [
    [{...rows[0],rowIndex:-1},rows[1]],
    [rows[0],{...rows[1],rowIndex:3}],
    [{...rows[0],rowIndex:8},{...rows[1],rowIndex:7}],
    [{...rows[0],rowIndex:100},rows[1]],
    [{...rows[0],rowIndex:2.5},rows[1]],
    [{...rows[0],rowIndex:'3'},rows[1]]
  ]) assert.throws(()=>normalizeDraft({...draft,rows:invalid}),/source index/);
});
test('transactional initialization preserves sparse source positions and original attributes',async()=>{
  const f=fixture();
  const rows=[{...draft.rows[0],rowIndex:3},{...draft.rows[1],rowIndex:7}];
  const saved=await f.post({...draft,rows});assert.equal(saved.status,201,JSON.stringify(saved.body));
  const started=await f.post({action:'initialize',draft_id:saved.body.draft.draft_id,revision:saved.body.draft.revision});
  assert.equal(started.status,200,JSON.stringify(started.body));
  const dorms=f.native.prepare("SELECT data FROM records WHERE type='dorm' ORDER BY json_extract(data,'$.display_order')").all().map(row=>JSON.parse(row.data));
  assert.deepEqual(dorms.map(row=>[row.display_order,row.input_order,row.source_row_index]),[[4,4,3],[8,8,7]]);
  assert.deepEqual(dorms.map(row=>row.dorm_name),['A01','B02']);
  assert.deepEqual(dorms.map(row=>row.space_force),['false','true']);
  assert.equal(dorms[0].receiving_day_one_start,draft.receiving_windows.receiving_day_one_start);
  assert.equal((await f.get()).body.ready,true);
});
test('a partially entered receiving window is persisted and recovered but cannot initialize',async()=>{const f=fixture(),partial={...draft,receiving_windows:{receiving_day_one_start:'2026-09-22T17:00'}};const saved=await f.post(partial);assert.equal(saved.status,201);const recovered=(await f.get('draft')).body.draft;assert.equal(recovered.receiving_windows.receiving_day_one_start,'2026-09-22T17:00');assert.equal(recovered.receiving_windows.receiving_day_one_end,'');assert.equal((await f.post({action:'initialize',draft_id:recovered.draft_id,revision:recovered.revision})).status,400);const completed=await f.post({...draft,draft_id:recovered.draft_id,revision:recovered.revision});assert.equal(completed.status,200);assert.equal((await f.post({action:'initialize',draft_id:recovered.draft_id,revision:completed.body.draft.revision})).status,200);});
test('initialization creates only one active cycle and consumes one draft',async()=>{const f=fixture(),{saved,started}=await startCycle(f);const repeat=await f.post({action:'initialize',draft_id:saved.body.draft.draft_id,revision:1});assert.equal(repeat.status,200);assert.equal(repeat.body.idempotent,true);assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='dorm'").get().n,2);assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM gate_v2_dorms').get().n,2);assert.equal(f.native.prepare('SELECT status FROM gate_input_drafts').get().status,'consumed');assert.equal((await f.post(draft)).status,409);assert.equal((await f.get()).body.ready,true);assert.ok(started.body.cycle_id);});
test('closeout preserves byte-exact source records including sound events and custom fields; replay is idempotent even after next cycle starts',async()=>{const f=fixture(),{started}=await startCycle(f);const dorm=f.native.prepare("SELECT id,data FROM records WHERE type='dorm' ORDER BY id LIMIT 1").get();f.native.prepare('UPDATE records SET data=? WHERE id=?').run(JSON.stringify({...JSON.parse(dorm.data),custom_dorm_field:'preserve',notes:'original notes'}),dorm.id);addRecord(f.native,'bus1','bus','WG26051',{status:'arrived',otw_count:23,custom_bus_field:'keep'});addRecord(f.native,'sound1','sound_event','WG26051',{event:'alert',custom_sound_field:'keep'});const original=f.native.prepare("SELECT id,type,week_group,data,created_at,updated_at FROM records WHERE week_group='WG26051' AND type IN ('dorm','bus','sound_event') ORDER BY created_at,id").all();const close=await f.post({action:'closeout',cycle_id:started.body.cycle_id});assert.equal(close.status,200,JSON.stringify(close.body));const archive=JSON.parse(f.native.prepare("SELECT data FROM records WHERE type='archive'").get().data);assert.deepEqual(JSON.parse(archive.source_records_json),JSON.parse(JSON.stringify(original)));assert.equal(archive.source_record_count,original.length);assert.equal(archive.source_snapshot_format,'lossless-record-rows-v1');assert.equal(JSON.parse(archive.dorm_data).length,2);assert.equal(archive.total_expected,90);assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type IN ('dorm','bus','sound_event')").get().n,0);assert.equal(f.native.prepare('SELECT state FROM gate_week_groups WHERE cycle_id=?').get(started.body.cycle_id).state,'closed');const retry=await f.post({action:'closeout',cycle_id:started.body.cycle_id});assert.equal(retry.status,200);assert.equal(retry.body.idempotent,true);assert.equal(retry.body.archive_id,close.body.archive_id);const next=await f.post({...draft,proposed_week_group:'WG26052'});assert.equal(next.status,201);const newCycle=await f.post({action:'initialize',draft_id:next.body.draft.draft_id,revision:1});assert.equal(newCycle.status,200);assert.equal((await f.post({action:'closeout',cycle_id:started.body.cycle_id})).body.archive_id,close.body.archive_id);assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='dorm'").get().n,2);assert.equal((await f.post({action:'closeout',cycle_id:'wrong-cycle'})).status,409);});
test('injected archive insert failure rolls back without deleting or consuming current state',async()=>{const f=fixture(),{started}=await startCycle(f),before=f.native.prepare("SELECT id,data FROM records WHERE type='dorm' ORDER BY id").all();f.failNextWrite();assert.equal((await f.post({action:'closeout',cycle_id:started.body.cycle_id})).status,409);assert.deepEqual(f.native.prepare("SELECT id,data FROM records WHERE type='dorm' ORDER BY id").all(),before);assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='archive'").get().n,0);assert.equal(f.native.prepare('SELECT state FROM gate_week_groups').get().state,'active');});
test('oversized archive fails closed without truncation or deleting sources',async()=>{const f=fixture(),{started}=await startCycle(f);addRecord(f.native,'large-bus','bus','WG26051',{status:'active',custom_payload:'x'.repeat(1850000)});const failed=await f.post({action:'closeout',cycle_id:started.body.cycle_id});assert.equal(failed.status,409);assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='bus'").get().n,1);assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='archive'").get().n,0);assert.equal(f.native.prepare('SELECT state FROM gate_week_groups').get().state,'active');});
test('injected initialization failure retains original state and unconsumed draft',async()=>{const f=fixture(),saved=await f.post(draft);f.failNextWrite();assert.equal((await f.post({action:'initialize',draft_id:saved.body.draft.draft_id,revision:1})).status,409);assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM records').get().n,0);assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM gate_week_groups').get().n,0);assert.equal(f.native.prepare('SELECT status FROM gate_input_drafts').get().status,'draft');});
test('legacy active-cycle adoption does not duplicate live records or cycles',async()=>{const f=fixture();addRecord(f.native,'dorm','dorm','WG26050',{dorm_name:'A01',max_load:48});addRecord(f.native,'config','config','',{key:'week_group',value:'WG26050'});assert.equal((await f.get()).body.adoption_required,true);const adopted=await f.post({action:'adopt'});assert.equal(adopted.status,200,JSON.stringify(adopted.body));assert.equal((await f.post({action:'adopt'})).body.adopted,false);assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM gate_week_groups').get().n,1);assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='dorm'").get().n,1);});


const LEGACY_REQUEST='28ec3c1f-9c5a-4acd-9e39-b136f3d36d7f';
const SECOND_REQUEST='d4892abb-35b8-41da-a8ea-384c87829122';
const legacyInput=(request_id=LEGACY_REQUEST)=>({
  action:'initialize_legacy',request_id,week_group:draft.proposed_week_group,
  rows:draft.rows,receiving_windows:draft.receiving_windows
});

test('legacy Input initializes all dorms and Week Group in one records-only D1 transaction',async()=>{
  const f=fixture({migrate:false});
  f.env.GATE_PERSISTENCE_ENABLED='false';
  const initialized=await f.post(legacyInput());
  assert.equal(initialized.status,200,JSON.stringify(initialized.body));
  assert.equal(initialized.body.dorm_count,2);
  const config=f.native.prepare("SELECT data FROM records WHERE type='config'").get();
  const active=JSON.parse(config.data);
  assert.equal(active.value,'WG26051');
  assert.equal(active.initialization_request_id,LEGACY_REQUEST);
  assert.equal(active.initialization_dorm_count,2);
  const dorms=f.native.prepare("SELECT data FROM records WHERE type='dorm' ORDER BY json_extract(data,'$.display_order')").all().map(row=>JSON.parse(row.data));
  assert.equal(dorms.length,2);
  assert.deepEqual(dorms.map(d=>d.display_order),[1,2]);
  assert.deepEqual(dorms.map(d=>d.dorm_name),['A01','B02']);
  assert.deepEqual(dorms.map(d=>d.space_force),['false','true']);
  assert.deepEqual(dorms.map(d=>d.band),['true','false']);
  assert.ok(dorms.every(d=>d.initialization_request_id===LEGACY_REQUEST && !Object.hasOwn(d,'cycle_id')));
  assert.equal(dorms[0].receiving_day_one_start,draft.receiving_windows.receiving_day_one_start);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='archive'").get().n,0);
});

test('legacy initialization preserves sparse Input positions, row attributes and recovery',async()=>{
  const f=fixture({migrate:false});f.env.GATE_PERSISTENCE_ENABLED='false';
  const rows=[{...draft.rows[0],rowIndex:3},{...draft.rows[1],rowIndex:7}];
  const request= {...legacyInput(),rows};
  const started=await f.post(request);
  assert.equal(started.status,200,JSON.stringify(started.body));
  const dorms=f.native.prepare("SELECT data FROM records WHERE type='dorm' ORDER BY json_extract(data,'$.display_order')").all().map(row=>JSON.parse(row.data));
  assert.deepEqual(dorms.map(row=>[row.display_order,row.input_order,row.source_row_index]),[[4,4,3],[8,8,7]]);
  assert.deepEqual(dorms.map(row=>row.dorm_name),['A01','B02']);
  assert.equal(dorms[0].band,'true');
  assert.equal(dorms[1].space_force,'true');
  assert.equal(dorms[1].receiving_day_one_end,draft.receiving_windows.receiving_day_one_end);
  const status=await f.get('legacy_initialization&request_id='+LEGACY_REQUEST);
  assert.equal(status.body.initialized,true);
  assert.equal((await f.post(request)).body.idempotent,true);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='dorm'").get().n,2);
});
test('injected legacy initialization failure rolls back dorms and config together without migrations',async()=>{
  const f=fixture({migrate:false});f.env.GATE_PERSISTENCE_ENABLED='false';
  f.failNextWrite();
  const failed=await f.post(legacyInput());
  assert.equal(failed.status,409);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records").get().n,0);
  const recovered=await f.get('legacy_initialization&request_id='+LEGACY_REQUEST);
  assert.equal(recovered.body.initialized,false);
  assert.equal((await f.post(legacyInput())).status,200);
});

test('legacy initialization is idempotent and recovered by request ID without a second dorm insert',async()=>{
  const f=fixture({migrate:false});f.env.GATE_PERSISTENCE_ENABLED='false';
  const first=await f.post(legacyInput());
  assert.equal(first.status,200);
  const status=await f.get('legacy_initialization&request_id='+LEGACY_REQUEST);
  assert.equal(status.body.initialized,true);
  assert.equal(status.body.dorm_count,2);
  const retried=await f.post(legacyInput());
  assert.equal(retried.body.idempotent,true);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='dorm'").get().n,2);
  const conflicting=await f.post(legacyInput(SECOND_REQUEST));
  assert.equal(conflicting.status,409);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='config'").get().n,1);
});

test('legacy initialization refuses residual records, malformed rows, and a registered cycle',async()=>{
  const f=fixture();f.env.GATE_PERSISTENCE_ENABLED='false';
  addRecord(f.native,'leftover','dorm','WG26049',{dorm_name:'A01'});
  assert.equal((await f.post(legacyInput())).status,409);
  f.native.prepare("DELETE FROM records WHERE id='leftover'").run();
  assert.equal((await f.post({...legacyInput(),rows:[{...draft.rows[0],sdq:''}]})).status,400);
  assert.equal((await f.post({...legacyInput(),rows:[{...draft.rows[0],dorm_name:'INVALID'}]})).status,400);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records").get().n,0);
  f.native.prepare("INSERT INTO gate_week_groups(cycle_id,week_group,state) VALUES('cycle','WG26048','active')").run();
  assert.equal((await f.post(legacyInput())).status,409);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records").get().n,0);
});

test('gated transactional persistence cannot be bypassed with the legacy initialization action',async()=>{
  const f=fixture();
  const denied=await f.post(legacyInput());
  assert.equal(denied.status,409);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records").get().n,0);
});


const AMEND_REQUEST='92dbef18-6ccf-4c6b-9aa2-ad86f9b3e653';
const AMEND_NEXT='9c47c5ea-9d48-4555-a8a6-288a4c9b11e1';
const correction=(request_id=AMEND_REQUEST,expected_amendment_count=0,changes={total_arrived:39})=>({
  action:'amend_archive',request_id,archive_id:'historical-archive',
  expected_amendment_count,reason:'Verified arrival discrepancy against signed movement log.',changes
});
function archivedFixture({migrate=true}={}){
  const f=fixture({migrate});
  f.env.GATE_PERSISTENCE_ENABLED='false';
  addRecord(f.native,'historical-archive','archive','WG26040',{
    archived_at:stamp,total_arrived:41,total_expected:44,total_loaded:40,
    source_records_json:'[{"id":"immutable-source"}]',source_snapshot_format:'lossless-record-rows-v1'
  });
  return f;
}

test('flag-off archive amendment appends correction and audit without changing a single source archive byte',async()=>{
  const f=archivedFixture(),original=f.native.prepare("SELECT data FROM records WHERE id='historical-archive'").get().data;
  const saved=await f.post(correction());
  assert.equal(saved.status,201,JSON.stringify(saved.body));
  assert.equal(saved.body.amendment_number,1);
  assert.equal(f.native.prepare("SELECT data FROM records WHERE id='historical-archive'").get().data,original);
  const row=f.native.prepare("SELECT * FROM gate_archive_amendments WHERE archive_id='historical-archive'").get();
  assert.equal(row.amendment_id,AMEND_REQUEST);
  assert.equal(row.actor_role,'instructor');
  assert.equal(row.reason,correction().reason);
  assert.deepEqual(JSON.parse(row.changes_json),{total_arrived:39});
  const audit=f.native.prepare("SELECT * FROM gate_audit_events WHERE entity_id='historical-archive' AND event_type='archive_amended'").get();
  assert.equal(audit.prior_version,0);
  assert.equal(audit.resulting_version,1);
  const resp=await archiveGet({request:new Request('https://gate.example/api/archives?id=historical-archive'),env:f.env,data:{session:{role:'instructor'}}});
  const body=await resp.json();
  assert.equal(body.archive.total_arrived,39);
  assert.equal(body.amendments[0].amendment_id,AMEND_REQUEST);
  assert.doesNotMatch(JSON.stringify(body),/immutable-source/);
  assert.equal(f.native.prepare("SELECT data FROM records WHERE id='historical-archive'").get().data,original);
});

test('append-only amendment is idempotent, enforces revision CAS and cannot rewrite existing history',async()=>{
  const f=archivedFixture();
  const first=await f.post(correction());
  assert.equal(first.status,201);
  const replay=await f.post(correction());
  assert.equal(replay.status,200);
  assert.equal(replay.body.idempotent,true);
  assert.equal((await f.post(correction(AMEND_REQUEST,0,{total_arrived:38}))).status,409);
  assert.equal((await f.post(correction(AMEND_NEXT,0,{total_arrived:38}))).status,409);
  const next=await f.post(correction(AMEND_NEXT,1,{total_arrived:38}));
  assert.equal(next.status,201);
  assert.equal(next.body.amendment_number,2);
  assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM gate_archive_amendments').get().n,2);
  assert.throws(()=>f.native.prepare("UPDATE gate_archive_amendments SET reason='tampered' WHERE amendment_id=?").run(AMEND_REQUEST),/append-only/);
  assert.throws(()=>f.native.prepare("DELETE FROM gate_archive_amendments WHERE amendment_id=?").run(AMEND_REQUEST),/append-only/);
});

test('amendment batch failure rolls back correction and its audit while preserving immutable archive',async()=>{
  const f=archivedFixture(),original=f.native.prepare("SELECT data FROM records WHERE id='historical-archive'").get().data;
  const priorAudits=f.native.prepare('SELECT COUNT(*) AS n FROM gate_audit_events').get().n;
  f.failNextWrite();
  assert.equal((await f.post(correction())).status,409);
  assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM gate_archive_amendments').get().n,0);
  assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM gate_audit_events').get().n,priorAudits);
  assert.equal(f.native.prepare("SELECT data FROM records WHERE id='historical-archive'").get().data,original);
  assert.equal((await f.post(correction())).status,201);
});

test('amendment fails closed on missing D1 safeguards, disallowed fields, malformed values and non-instructor actor',async()=>{
  const old=archivedFixture({migrate:false});
  assert.equal((await old.post(correction())).status,503);
  assert.equal(old.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='archive'").get().n,1);
  const f=archivedFixture();
  assert.equal((await f.post(correction(AMEND_REQUEST,0,{source_records_json:'tamper'}))).status,400);
  assert.equal((await f.post(correction(AMEND_REQUEST,0,{total_arrived:-2}))).status,400);
  assert.equal((await f.post(correction(AMEND_REQUEST,0,{week_group:'FAKE'}))).status,400);
  assert.equal((await f.post({...correction(),reason:'bad'})).status,400);
  assert.equal((await f.post({...correction(),expected_amendment_count:null})).status,400);
  const response=await onRequestPost({
    request:new Request('https://gate.example/api/persistence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(correction())}),
    env:f.env,data:{session:{role:'admin'}}
  });
  assert.equal(response.status,503,'Admin amendment requires the 0007 provenance migration.');
  assert.equal(f.native.prepare('SELECT COUNT(*) AS n FROM gate_archive_amendments').get().n,0);
});


test('single persistence flag cannot disable legacy initialization and closeout before cutover authorization',async()=>{
  const f=fixture();delete f.env.GATE_PERSISTENCE_CUTOVER_READY;
  const health=await f.get();
  assert.equal(health.body.enabled,false);
  const prereq=await f.get('cutover_preflight');
  assert.equal(prereq.body.ready,true);
  assert.equal(prereq.body.cutover_authorized,false);
  const started=await f.post(legacyInput());
  assert.equal(started.status,200,JSON.stringify(started.body));
  const legacy=await legacyCloseoutPost({request:new Request('https://gate.example/api/legacy-closeout',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({week_group:draft.proposed_week_group,request_id:'01234567-89ab-4cde-8fab-0123456789ab'})
  }),env:f.env,data:{session:{role:'instructor'}}});
  const closed=await legacy.json();
  assert.equal(legacy.status,200,JSON.stringify(closed));
  assert.equal(closed.closed,true);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='archive'").get().n,1);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='dorm'").get().n,0);
  assert.equal((await f.post(draft)).status,503,'staged draft writes must remain disabled until authorized cutover');
});

test('cutover preflight remains read-only and reports absent schema before turning on either flag',async()=>{
  const f=fixture({migrate:false});f.env.GATE_PERSISTENCE_ENABLED='false';
  const status=await f.get('cutover_preflight');
  assert.equal(status.status,200);
  assert.equal(status.body.ready,false);
  assert.ok(status.body.missing_tables.includes('gate_week_groups'));
  assert.ok(status.body.missing_triggers.includes('gate_mirror_records_insert'));
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records").get().n,0);
  f.env.GATE_PERSISTENCE_ENABLED='true';
  assert.equal((await f.post(draft)).status,503);
});

test('cutover refuses source/mirror divergence, inert triggers and lifecycle mismatches without clearing records',async()=>{
  const f=fixture();
  assert.equal((await f.get('cutover_preflight')).body.ready,true);
  addRecord(f.native,'orphan','dorm','WG26041',{dorm_name:'A01'});
  let check=await f.get('cutover_preflight');
  assert.equal(check.body.ready,false,'live records must be scoped to active configuration');
  assert.equal((await f.post(draft)).status,503);
  f.native.prepare("DELETE FROM records WHERE id='orphan'").run();
  f.native.exec('DROP TRIGGER gate_mirror_records_update; CREATE TRIGGER gate_mirror_records_update AFTER UPDATE ON records BEGIN SELECT 1; END;');
  check=await f.get('cutover_preflight');
  assert.equal(check.body.ready,false);
  assert.ok(check.body.invalid_triggers.includes('gate_mirror_records_update'));
  assert.equal((await f.post(draft)).status,503);
});

test('cutover preflight detects a valid mirror with lifecycle/config drift before closeout mutation',async()=>{
  const f=fixture(),{started}=await startCycle(f);
  f.native.prepare("UPDATE records SET data=json_set(data,'$.value','WG26099') WHERE type='config' AND json_extract(data,'$.key')='week_group'").run();
  const check=await f.get('cutover_preflight');
  assert.equal(check.body.ready,false);
  const before=f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='dorm'").get().n;
  assert.equal((await f.post({action:'closeout',cycle_id:started.body.cycle_id})).status,503);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='dorm'").get().n,before);
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='archive'").get().n,0);
});
