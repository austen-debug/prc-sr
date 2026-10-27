import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequestPost, onRequestGet } from '../../../functions/api/legacy-closeout.js';

const migration=name=>readFileSync(new URL('../../../migrations/'+name,import.meta.url),'utf8');
function setup(){
  const db=new DatabaseSync(':memory:');
  db.exec("PRAGMA foreign_keys=ON; CREATE TABLE records(id TEXT PRIMARY KEY,type TEXT NOT NULL,week_group TEXT,data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)");
  for(const name of ['0003_gate_persistence_foundation.sql','0004_gate_record_audit_triggers.sql'])db.exec(migration(name));
  const stamp='2026-10-27T10:00:00.000Z';
  function insert(id,type,wg,data){
    db.prepare('INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)')
      .run(id,type,wg,JSON.stringify({type,week_group:wg,record_version:1,created_by_role:'instructor',updated_by_role:'instructor',...data}),stamp,stamp);
  }
  insert('active-wg','config','',{key:'week_group',value:'WG26053'});
  insert('last-airport','config','',{key:'last_airport',value:'1030'});
  insert('dorm-one','dorm','WG26053',{dorm_name:'331',current_load:5,max_load:50});
  insert('bus-one','bus','WG26053',{bus_id:'1',status:'arrived',otw_count:5});
  insert('sound-one','sound_event','WG26053',{sound_key:'arrival'});
  const DB={
    prepare(sql){
      let args=[];
      return {
        bind(...values){args=values;return this;},
        async first(){return db.prepare(sql).get(...args)||null;},
        async all(){return {results:db.prepare(sql).all(...args)};},
        async run(){const p=db.prepare(sql);return p.columns().length?{results:p.all(...args)}:{meta:{changes:p.run(...args).changes}};}
      };
    },
    async batch(statements){
      db.exec('BEGIN');
      try{
        const results=[];
        for(const s of statements)results.push(await s.run());
        db.exec('COMMIT');
        return results;
      }catch(error){
        db.exec('ROLLBACK');
        throw error;
      }
    }
  };
  const env={DB,GATE_PERSISTENCE_ENABLED:'false'};
  const data={session:{role:'instructor'}};
  async function close(request_id='01234567-89ab-4cde-8fab-0123456789ab',week_group='WG26053'){
    const request=new Request('https://gate.example/api/legacy-closeout',{
      method:'POST',headers:{'Content-Type':'application/json','Origin':'https://gate.example'},
      body:JSON.stringify({request_id,week_group})});
    return onRequestPost({request,env,data});
  }
  return {db,env,data,close,stamp};
}
const count=(db,type,wg)=>db.prepare("SELECT COUNT(*) AS n FROM records WHERE type=? AND week_group=?").get(type,wg).n;

test('One D1 transaction stores a complete lossless archive and clears source and config',async()=>{
  const f=setup();
  const response=await f.close();
  assert.equal(response.status,200);
  const json=await response.json();
  assert.equal(json.closed,true);
  assert.equal(json.source_record_count,3);
  const result=f.db.prepare("SELECT data FROM records WHERE type='archive' AND week_group='WG26053'").get();
  const archive=JSON.parse(result.data);
  assert.equal(archive.source_record_count,3);
  assert.equal(JSON.parse(archive.source_records_json).length,3);
  assert.equal(archive.legacy_closeout_request_id,'01234567-89ab-4cde-8fab-0123456789ab');
  for(const type of ['bus','dorm','sound_event'])assert.equal(count(f.db,type,'WG26053'),0);
  for(const type of ['bus','dorm','sound_event'])assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM gate_v2_'+(type==='bus'?'buses':type==='dorm'?'dorms':'sound_events')).get().n,0);
  assert.equal(JSON.parse(f.db.prepare("SELECT data FROM records WHERE id='active-wg'").get().data).value,'');
  assert.equal(JSON.parse(f.db.prepare("SELECT data FROM records WHERE id='last-airport'").get().data).value,'');
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM gate_audit_events").get().n>0,true);
  const again=await f.close();
  assert.equal(again.status,200);
  assert.equal((await again.json()).idempotent,true);
  assert.equal(count(f.db,'archive','WG26053'),1);
  const request=new Request('https://gate.example/api/legacy-closeout?request_id=01234567-89ab-4cde-8fab-0123456789ab');
  const check=await onRequestGet({request,env:f.env,data:f.data});
  assert.equal((await check.json()).closed,true);
});

test('D1 rollback leaves the entire live Week Group untouched when clearing fails',async()=>{
  const f=setup();
  f.db.exec("CREATE TRIGGER refuse_dorm_clear BEFORE DELETE ON records WHEN OLD.type='dorm' BEGIN SELECT RAISE(ABORT,'simulated interruption'); END;");
  const response=await f.close();
  assert.equal(response.status,503);
  assert.equal(count(f.db,'archive','WG26053'),0);
  assert.equal(count(f.db,'dorm','WG26053'),1);
  assert.equal(count(f.db,'bus','WG26053'),1);
  assert.equal(count(f.db,'sound_event','WG26053'),1);
  assert.equal(JSON.parse(f.db.prepare("SELECT data FROM records WHERE id='active-wg'").get().data).value,'WG26053');
});

test('Existing partial legacy archive blocks duplicate archiving or clearing',async()=>{
  const f=setup();
  const archive=JSON.stringify({type:'archive',week_group:'WG26053',archived_at:'2026-10-27T10:05:00.000Z',archive_schema_version:'gate-archive-schema-v3-canonical'});
  f.db.prepare("INSERT INTO records VALUES(?,?,?,?,?,?)").run('old-archive','archive','WG26053',archive,f.stamp,f.stamp);
  const r=await f.close();
  assert.equal(r.status,409);
  assert.equal((await r.json()).code,'existing_archive');
  assert.equal(count(f.db,'archive','WG26053'),1);
  assert.equal(count(f.db,'dorm','WG26053'),1);
});

test('Registered transactional cycles cannot pass through legacy closeout',async()=>{
  const f=setup();
  f.db.prepare("INSERT INTO gate_week_groups(cycle_id,week_group,state) VALUES('active','WG26053','active')").run();
  const response=await f.close();
  assert.equal(response.status,409);
  assert.equal((await response.json()).code,'transactional_required');
  assert.equal(count(f.db,'dorm','WG26053'),1);
  assert.equal(count(f.db,'archive','WG26053'),0);
});

test('Admin or Airman role cannot use Instructor legacy closeout',async()=>{
  const f=setup();
  const req=new Request('https://gate.example/api/legacy-closeout',{method:'POST',body:'{}'});
  const response=await onRequestPost({request:req,env:f.env,data:{session:{role:'admin'}}});
  assert.equal(response.status,403);
  assert.equal(count(f.db,'dorm','WG26053'),1);
});
