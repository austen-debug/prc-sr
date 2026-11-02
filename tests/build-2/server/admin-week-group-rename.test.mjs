import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {onRequestGet,onRequestPost} from '../../../functions/api/admin-week-group.js';
import {onRequestPost as lockPost} from '../../../functions/api/admin-system.js';

const old='EG27005',target='WG27005',init='3ce3a7c8-da1b-4331-b92a-0c451ba470d2';
const iso='2026-11-02T17:00:00.000Z';
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec(`
 CREATE TABLE records(id TEXT PRIMARY KEY,type TEXT,week_group TEXT,data TEXT,created_at TEXT,updated_at TEXT);
 CREATE TABLE gate_week_groups(cycle_id TEXT PRIMARY KEY,week_group TEXT,state TEXT);
 CREATE TABLE gate_squadron_notices(id INTEGER PRIMARY KEY,week_group TEXT);
 CREATE TABLE gate_audit_events(event_id TEXT PRIMARY KEY,cycle_id TEXT,operation_id TEXT,entity_type TEXT,entity_id TEXT,event_type TEXT,actor_role TEXT,prior_version INTEGER,resulting_version INTEGER,metadata_json TEXT,occurred_at TEXT);
 CREATE TABLE gate_v2_buses(id TEXT PRIMARY KEY,week_group TEXT,data TEXT,created_at TEXT,updated_at TEXT);
 CREATE TABLE gate_v2_dorms(id TEXT PRIMARY KEY,week_group TEXT,data TEXT,created_at TEXT,updated_at TEXT);
 CREATE TABLE gate_v2_sound_events(id TEXT PRIMARY KEY,week_group TEXT,data TEXT,created_at TEXT,updated_at TEXT);
 CREATE TRIGGER gate_mirror_records_update AFTER UPDATE ON records
 BEGIN
   UPDATE gate_v2_buses SET week_group=NEW.week_group,data=NEW.data,updated_at=NEW.updated_at WHERE id=NEW.id AND NEW.type='bus';
   UPDATE gate_v2_dorms SET week_group=NEW.week_group,data=NEW.data,updated_at=NEW.updated_at WHERE id=NEW.id AND NEW.type='dorm';
   UPDATE gate_v2_sound_events SET week_group=NEW.week_group,data=NEW.data,updated_at=NEW.updated_at WHERE id=NEW.id AND NEW.type='sound_event';
 END;
 CREATE TRIGGER gate_record_audit_update AFTER UPDATE ON records
 BEGIN
 INSERT INTO gate_audit_events(event_id,entity_type,entity_id,event_type,actor_role,prior_version,resulting_version,metadata_json,occurred_at)
 VALUES(lower(hex(randomblob(16))),NEW.type,NEW.id,'record_updated',
 CASE WHEN json_extract(NEW.data,'$.updated_by_role')='admin' THEN 'admin' ELSE 'system' END,
 0,1,'{}',NEW.updated_at);
 END;`);
 for(const migration of ['0012_gate_admin_system_control.sql','0013_gate_admin_week_group_rename.sql'])
   db.exec(readFileSync(new URL('../../../migrations/'+migration,import.meta.url),'utf8'));
 function insert(id,type,week_group,data){
   const s=JSON.stringify({...data,type,week_group});
   db.prepare('INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)')
     .run(id,type,week_group,s,iso,iso);
   const table={bus:'gate_v2_buses',dorm:'gate_v2_dorms',sound_event:'gate_v2_sound_events'}[type];
   if(table)db.prepare('INSERT INTO '+table+'(id,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?)')
     .run(id,week_group,s,iso,iso);
 }
 insert('config-week','config','',{key:'week_group',value:old,initialization_request_id:init,
   initialization_dorm_count:16,record_version:1,
   admin_reset_manifest:{proposed_week_group:old,rows:[],receiving_windows:{}}});
 for(let i=0;i<16;i++)insert('dorm-'+i,'dorm',old,{
   initialization_request_id:init,dorm_identity:old+'::321TRS::A'+String(i).padStart(2,'0'),
   dorm_name:'A'+String(i).padStart(2,'0'),current_load:i,record_version:1});
 for(let i=0;i<4;i++)insert('bus-'+i,'bus',old,{status:'arrived',otw_count:12+i,record_version:1});
 db.prepare('INSERT INTO gate_admin_input_manifests(initialization_id,cycle_id,week_group,manifest_json,created_at) VALUES(?,?,?,?,?)')
   .run(init,'',old,JSON.stringify({proposed_week_group:old,rows:[],receiving_windows:{}}),iso);
 const DB={
   prepare(sql){let args=[];return {
     bind(...values){args=values;return this;},
     async first(){return db.prepare(sql).get(...args)||null;},
     async all(){return {results:db.prepare(sql).all(...args)};},
     async run(){const meta=db.prepare(sql).run(...args);return {meta:{changes:Number(meta.changes)}};},
     async execute(){return /^\\s*SELECT/i.test(sql)?this.first():this.run();}
   };},
   async batch(statements){
     db.exec('BEGIN');
     try{for(const statement of statements)await statement.execute();db.exec('COMMIT');}
     catch(error){db.exec('ROLLBACK');throw error;}
   }
 };
 const env={DB,GATE_ADMIN_SYSTEM_CONTROL_ENABLED:'true',GATE_ADMIN_WEEK_GROUP_EDIT_ENABLED:'true',GATE_ADMIN_WRITES_ENABLED:'true'};
 const data={session:{role:'admin',iat:Date.now()}};
 const request=(endpoint,body)=>new Request('https://gate.example'+endpoint,{
   method:'POST',headers:{Origin:'https://gate.example','Content-Type':'application/json'},body:JSON.stringify(body)});
 const preview=async()=>{
   const r=await onRequestGet({env,data});return {status:r.status,body:await r.json()};
 };
 const lock=async()=>{
   const r=await lockPost({env,data,request:request('/api/admin-system',{
     action:'lock',operationId:crypto.randomUUID(),expectedRevision:0,
     reason:'Authorized emergency identity correction',confirmation:'LOCK SITE'
   })});return {status:r.status,body:await r.json()};
 };
 const rename=async(p,updates={})=>{
   const r=await onRequestPost({env,data,request:request('/api/admin-week-group',{
     operationId:crypto.randomUUID(),expectedWeekGroup:old,expectedInitializationId:init,
     expectedLockRevision:p.lock_revision,expectedSnapshotToken:p.snapshot_token,
     newWeekGroup:target,reason:'Fix initialization Week Group typographical error',
     confirmation:'RENAME EG27005 TO WG27005',...updates
   })});
   return {status:r.status,body:await r.json()};
 };
 return {db,DB,env,data,preview,lock,rename};
}
const n=(db,type,group)=>db.prepare('SELECT COUNT(*) AS n FROM records WHERE type=? AND week_group=?').get(type,group).n;

test('preview is read-only while unlocked and rejects mutation until audited Site Lock',async()=>{
 const f=fixture();
 const p=await f.preview();
 assert.equal(p.status,200);
 assert.equal(p.body.ready,true,p.body.reason);
 assert.equal(p.body.locked,false);
 assert.equal(p.body.dorm_count,16);
 assert.equal(p.body.bus_count,4);
 assert.equal((await f.rename(p.body)).status,409);
 assert.equal(n(f.db,'dorm',old),16);
 assert.equal((await f.lock()).status,200);
 f.db.close();
});

test('renames live source and mirrors atomically, preserving payload counts, IDs, and immutable original Input',async()=>{
 const f=fixture();
 assert.equal((await f.lock()).status,200);
 const p=(await f.preview()).body;
 assert.equal(p.locked,true);
 const before=f.db.prepare("SELECT id,json_extract(data,'$.current_load') AS loaded FROM records WHERE type='dorm' ORDER BY id").all();
 const result=await f.rename(p);
 assert.equal(result.status,200,JSON.stringify(result.body));
 assert.equal(n(f.db,'dorm',target),16);
 assert.equal(n(f.db,'bus',target),4);
 assert.equal(n(f.db,'dorm',old),0);
 assert.deepEqual(f.db.prepare("SELECT id,json_extract(data,'$.current_load') AS loaded FROM records WHERE type='dorm' ORDER BY id").all(),before);
 assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM gate_v2_buses WHERE week_group=?").get(target).n,4);
 assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM gate_v2_dorms WHERE week_group=?").get(target).n,16);
 assert.equal(JSON.parse(f.db.prepare("SELECT data FROM records WHERE type='config' AND json_extract(data,'$.key')='week_group'").get().data).value,target);
 assert.equal(f.db.prepare('SELECT week_group FROM gate_admin_input_manifests').get().week_group,old);
 const ledger=f.db.prepare('SELECT old_week_group,new_week_group,source_record_count,snapshot_json FROM gate_admin_week_group_renames').get();
 assert.equal(ledger.old_week_group,old);assert.equal(ledger.new_week_group,target);
 assert.equal(ledger.source_record_count,20);
 assert.equal(JSON.parse(ledger.snapshot_json).length,21);
 assert.throws(()=>f.db.exec('DELETE FROM gate_admin_week_group_renames'),/immutable/);
 assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM gate_audit_events WHERE event_type='admin_week_group_renamed'").get().n,1);
 f.db.close();
});

test('rechecks the preview snapshot and rejects a concurrent bus change without partial rename',async()=>{
 const f=fixture();
 assert.equal((await f.lock()).status,200);
 const p=(await f.preview()).body;
 f.db.exec("UPDATE records SET data=json_set(data,'$.otw_count',99),updated_at='2026-11-02T17:01:00Z' WHERE id='bus-0'");
 const response=await f.rename(p);
 assert.equal(response.status,409);
 assert.equal(n(f.db,'dorm',old),16);
 assert.equal(n(f.db,'bus',old),4);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM gate_admin_week_group_renames').get().n,0);
 f.db.close();
});

test('blocks collisions, disabled feature flags and non-Admin access',async()=>{
 const f=fixture();
 assert.equal((await f.lock()).status,200);
 const p=(await f.preview()).body;
 f.env.GATE_ADMIN_WEEK_GROUP_EDIT_ENABLED='false';
 assert.equal((await f.rename(p)).status,503);
 f.env.GATE_ADMIN_WEEK_GROUP_EDIT_ENABLED='true';
 const denied=await onRequestGet({env:f.env,data:{session:{role:'instructor'}}});
 assert.equal(denied.status,403);
 f.db.prepare("INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES('old-archive','archive',?,'{}',?,?)").run(target,iso,iso);
 const r=await f.rename(p);
 assert.equal(r.status,409);
 assert.equal(n(f.db,'dorm',old),16);
 f.db.close();
});
