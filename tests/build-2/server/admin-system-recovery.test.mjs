import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {onRequestGet as siteGet,onRequestPost as sitePost} from '../../../functions/api/admin-system.js';
import {onRequestGet as recoveryGet,onRequestPost as recoveryPost} from '../../../functions/api/admin-recovery.js';
import {readSiteLock,siteMaintenancePage} from '../../../functions/api/site-lock-core.mjs';
import {buildDormRows,normalizeDraft} from '../../../functions/api/persistence-core.mjs';

const iso='2026-11-01T20:00:00.000Z';
const group='WG27004',cycleId='cycle-admin-test';
const draft=normalizeDraft({proposed_week_group:group,rows:[
  {sdq:'321 TRS',sec:'01',dorm_name:'A01',sex:'female',load:42},
  {sdq:'322 TRS',sec:'02',dorm_name:'B02',sex:'male',load:48}
],receiving_windows:{receiving_day_one_start:'2026-11-03T17:00',receiving_day_one_end:'2026-11-03T21:00'}});
function setup(){
  const db=new DatabaseSync(':memory:');
  db.exec(
    "CREATE TABLE records(id TEXT PRIMARY KEY,type TEXT,week_group TEXT,data TEXT,created_at TEXT,updated_at TEXT);"+
    "CREATE TABLE gate_week_groups(cycle_id TEXT PRIMARY KEY,week_group TEXT,state TEXT,revision INTEGER,source_draft_id TEXT,receiving_windows_json TEXT,updated_at TEXT,archive_id TEXT,closed_at TEXT);"+
    "CREATE TABLE gate_audit_events(event_id TEXT PRIMARY KEY,cycle_id TEXT,operation_id TEXT,entity_type TEXT,entity_id TEXT,event_type TEXT,actor_role TEXT,prior_version INTEGER,resulting_version INTEGER,metadata_json TEXT,occurred_at TEXT);"
  );
  db.exec(readFileSync(new URL('../../../migrations/0012_gate_admin_system_control.sql',import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../../../migrations/0011_gate_archive_source_immutability.sql',import.meta.url),'utf8'));

  function record(id,type,week_group,data){
    db.prepare("INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)")
      .run(id,type,week_group,JSON.stringify(data),iso,iso);
  }
  record('config-week','config','',{type:'config',key:'week_group',value:group,record_version:1});
  record('config-airport','config','',{type:'config',key:'last_airport',value:'01:45',record_version:1});
  db.prepare("INSERT INTO gate_week_groups(cycle_id,week_group,state,revision,source_draft_id,receiving_windows_json,updated_at) VALUES(?,?,'active',1,?,?,?)")
    .run(cycleId,group,'draft-id',JSON.stringify(draft.receiving_windows),iso);
  db.prepare("INSERT INTO gate_admin_input_manifests(initialization_id,cycle_id,week_group,manifest_json,created_at) VALUES(?,?,?,?,?)")
    .run(cycleId,cycleId,group,JSON.stringify(draft),iso);
  const dorms=buildDormRows(draft,cycleId,iso,()=>crypto.randomUUID(),'instructor');
  for(const dorm of dorms)db.prepare("INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)")
    .run(dorm.id,dorm.type,dorm.week_group,dorm.data,dorm.created_at,dorm.updated_at);
  record('bus-test','bus',group,{type:'bus',week_group:group,bus_id:'01',status:'arrived',otw_count:28});
  record('sound-test','sound_event',group,{type:'sound_event',week_group:group,event:'dorm_open'});
  const DB={
    prepare(sql){let bindings=[];return {
      bind(...values){bindings=values;return this;},
      async first(){return db.prepare(sql).get(...bindings)||null;},
      async all(){return {results:db.prepare(sql).all(...bindings)};},
      async run(){const meta=db.prepare(sql).run(...bindings);return {meta:{changes:Number(meta.changes)}};},
      async execute(){return /^\s*SELECT/i.test(sql)?this.first():this.run();}
    };},
    async batch(statements){
      db.exec('BEGIN');
      try{const all=[];for(const stmt of statements)all.push(await stmt.execute());db.exec('COMMIT');return all;}
      catch(error){db.exec('ROLLBACK');throw error;}
    }
  };
  const env={DB,GATE_ADMIN_SYSTEM_CONTROL_ENABLED:'true',GATE_ADMIN_WRITES_ENABLED:'true'};
  const data={session:{role:'admin',iat:Date.now()}};
  const request=(path,body)=>new Request('https://gate.example'+path,{
    method:'POST',headers:{Origin:'https://gate.example','Content-Type':'application/json'},body:JSON.stringify(body)});
  const postSite=async(action,revision,operationId=crypto.randomUUID())=>{
    const result=await sitePost({env,data,request:request('/api/admin-system',{
      action,operationId,expectedRevision:revision,reason:'Incident stabilization exercise',confirmation:action==='lock'?'LOCK SITE':'UNLOCK SITE'
    })});
    return {status:result.status,body:await result.json()};
  };
  const postRecovery=async(action,revision=1,operationId=crypto.randomUUID())=>{
    const result=await recoveryPost({env,data,request:request('/api/admin-recovery',{
      action,operationId,expectedWeekGroup:group,expectedCycleId:cycleId,expectedRevision:revision,
      reason:'Approved emergency receiving recovery',
      confirmation:(action==='reset_week_group'?'RESET ':'ARCHIVE ')+group
    })});
    return {status:result.status,body:await result.json()};
  };
  return {db,env,data,record,postSite,postRecovery};
}
const count=(db,type)=>db.prepare('SELECT COUNT(*) AS n FROM records WHERE type=?').get(type).n;

test('Site Lock starts unlocked, requires Admin, and records immutable lock/unlock revisions',async()=>{
  const f=setup();
  assert.equal((await readSiteLock(f.env)).locked,false);
  const denied=await sitePost({env:f.env,data:{session:{role:'instructor'}},request:new Request('https://gate.example/api/admin-system',{method:'POST'})});
  assert.equal(denied.status,403);
  const locked=await f.postSite('lock',0);
  assert.equal(locked.status,200,JSON.stringify(locked.body));
  assert.equal((await readSiteLock(f.env)).locked,true);
  assert.match(await siteMaintenancePage().text(),/GATE is currently down for maintenance/);
  const stale=await f.postSite('unlock',0);
  assert.equal(stale.status,409);
  const unlocked=await f.postSite('unlock',1);
  assert.equal(unlocked.status,200,JSON.stringify(unlocked.body));
  assert.equal((await readSiteLock(f.env)).locked,false);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM gate_admin_system_events').get().n,2);
  assert.throws(()=>f.db.exec('DELETE FROM gate_admin_system_events'),/immutable/);
  f.db.close();
});

test('reset requires lock, verifies original Input manifest, and preserves all pre-reset records',async()=>{
  const f=setup();
  const blocked=await f.postRecovery('reset_week_group');
  assert.equal(blocked.status,503,'Unlocked operation must fail closed');
  assert.equal(count(f.db,'bus'),1);
  assert.equal((await f.postSite('lock',0)).status,200);
  const preview=await recoveryGet({env:f.env,data:f.data});
  assert.equal(preview.status,200);
  const summary=await preview.json();
  assert.equal(summary.reset_available,true);
  assert.equal(summary.source_record_count,4);
  const result=await f.postRecovery('reset_week_group');
  assert.equal(result.status,200,JSON.stringify(result.body));
  assert.equal(count(f.db,'bus'),0);
  assert.equal(count(f.db,'sound_event'),0);
  assert.equal(count(f.db,'dorm'),2);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM gate_admin_reset_evidence').get().n,1);
  const evidence=f.db.prepare('SELECT source_records_json,source_record_count FROM gate_admin_reset_evidence').get();
  assert.equal(evidence.source_record_count,4);
  assert.equal(JSON.parse(evidence.source_records_json).length,4);
  assert.equal(f.db.prepare('SELECT revision,state FROM gate_week_groups').get().revision,2);
  assert.equal(JSON.parse(f.db.prepare("SELECT data FROM records WHERE id='config-week'").get().data).value,group);
  assert.throws(()=>f.db.exec('DELETE FROM gate_admin_reset_evidence'),/immutable/);
  f.db.close();
});

test('Archive & Zero commits current source, clears configuration and returns idle with immutable evidence',async()=>{
  const f=setup();
  assert.equal((await f.postSite('lock',0)).status,200);
  const result=await f.postRecovery('archive_and_zero');
  assert.equal(result.status,200,JSON.stringify(result.body));
  for(const type of ['bus','sound_event','dorm'])assert.equal(count(f.db,type),0);
  assert.equal(count(f.db,'archive'),1);
  const payload=JSON.parse(f.db.prepare("SELECT data FROM records WHERE type='archive'").get().data);
  assert.equal(payload.admin_emergency_action,'archive_and_zero');
  assert.equal(payload.source_record_count,4);
  assert.equal(JSON.parse(payload.source_records_json).length,4);
  assert.equal(f.db.prepare('SELECT state FROM gate_week_groups').get().state,'closed');
  assert.equal(JSON.parse(f.db.prepare("SELECT data FROM records WHERE id='config-week'").get().data).value,'');
  assert.equal(JSON.parse(f.db.prepare("SELECT data FROM records WHERE id='config-airport'").get().data).value,'');
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM gate_admin_reset_evidence').get().n,1);
  assert.equal((await readSiteLock(f.env)).locked,true,'Recovery may not unlock site');
  f.db.close();
});

test('no original Input manifest means reset is rejected without record mutations',async()=>{
  const f=setup();
  assert.equal((await f.postSite('lock',0)).status,200);
  f.db.exec('DROP TRIGGER trg_gate_admin_input_manifests_no_delete;DELETE FROM gate_admin_input_manifests');
  const result=await f.postRecovery('reset_week_group');
  assert.equal(result.status,503);
  assert.equal(count(f.db,'bus'),1);
  assert.equal(count(f.db,'dorm'),2);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM gate_admin_reset_evidence').get().n,0);
  f.db.close();
});
