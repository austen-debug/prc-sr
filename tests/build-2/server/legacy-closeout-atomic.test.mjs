import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequestPost, onRequestGet } from '../../../functions/api/legacy-closeout.js';
import { buildArchivePayload, parseOperationalRow } from '../../../functions/api/persistence-core.mjs';

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

function seedLosslessArchive(f) {
  const rows=f.db.prepare("SELECT id,type,week_group,data,created_at,updated_at FROM records WHERE week_group='WG26053' AND type IN ('dorm','bus','sound_event') ORDER BY created_at,id").all();
  const archive=buildArchivePayload({
    cycleId:'',weekGroup:'WG26053',
    dorms:rows.filter(row=>row.type==='dorm').map(parseOperationalRow),
    buses:rows.filter(row=>row.type==='bus').map(parseOperationalRow),
    sourceRecords:rows,windows:{},now:'2026-10-28T10:00:00.000Z'
  });
  f.db.prepare("INSERT INTO records VALUES(?,?,?,?,?,?)").run(
    'old-complete-archive','archive','WG26053',JSON.stringify(archive),
    '2026-10-28T10:00:00.000Z','2026-10-28T10:00:00.000Z'
  );
  return archive;
}

test('Recovery requires complete exact archive provenance and clears only verified residual rows',async()=>{
  const f=setup();
  seedLosslessArchive(f);
  // Simulate an interrupted old closeout where one source record was already deleted.
  f.db.prepare("DELETE FROM records WHERE id='dorm-one'").run();
  const response=await f.close();
  assert.equal(response.status,200,await response.clone().text());
  const payload=await response.json();
  assert.equal(payload.recovered,true);
  assert.equal(payload.archive_id,'old-complete-archive');
  assert.equal(count(f.db,'archive','WG26053'),1);
  for(const type of ['bus','dorm','sound_event'])assert.equal(count(f.db,type,'WG26053'),0);
  assert.equal(JSON.parse(f.db.prepare("SELECT data FROM records WHERE id='active-wg'").get().data).value,'');
});

test('Recovery can retire remaining sound events after all live buses and dorms were already removed',async()=>{
  const f=setup();
  seedLosslessArchive(f);
  f.db.prepare("DELETE FROM records WHERE id IN ('bus-one','dorm-one')").run();
  const response=await f.close();
  assert.equal(response.status,200,await response.clone().text());
  assert.equal((await response.json()).recovered,true);
  assert.equal(count(f.db,'sound_event','WG26053'),0);
  assert.equal(count(f.db,'archive','WG26053'),1);
});

test('Recovery refuses modified live records even with a complete archived source snapshot',async()=>{
  const f=setup();
  seedLosslessArchive(f);
  f.db.prepare("UPDATE records SET updated_at='2026-10-29T10:00:00.000Z' WHERE id='bus-one'").run();
  const response=await f.close();
  assert.equal(response.status,409);
  assert.equal((await response.json()).code,'existing_archive');
  assert.equal(count(f.db,'bus','WG26053'),1);
  assert.equal(count(f.db,'archive','WG26053'),1);
});

test('Existing older archive is detected even when surviving records have newer creation timestamps',async()=>{
  const f=setup();
  // A reporting-only legacy archive must NEVER be bypassed because of age.
  const archive=JSON.stringify({type:'archive',week_group:'WG26053',archived_at:'2026-10-20T10:00:00.000Z'});
  f.db.prepare("INSERT INTO records VALUES(?,?,?,?,?,?)").run('older-archive','archive','WG26053',archive,f.stamp,f.stamp);
  f.db.prepare("UPDATE records SET created_at='2026-10-29T10:00:00.000Z' WHERE type IN ('bus','dorm','sound_event')").run();
  const response=await f.close();
  assert.equal(response.status,409);
  assert.equal((await response.json()).code,'existing_archive');
  assert.equal(count(f.db,'archive','WG26053'),1);
});

test('Duplicate archive candidates refuse recovery without changing residual records',async()=>{
  const f=setup();
  const saved=seedLosslessArchive(f);
  f.db.prepare("INSERT INTO records VALUES(?,?,?,?,?,?)").run(
    'second-archive','archive','WG26053',JSON.stringify(saved),
    '2026-10-28T11:00:00.000Z','2026-10-28T11:00:00.000Z');
  const response=await f.close();
  assert.equal(response.status,409);
  assert.equal(count(f.db,'archive','WG26053'),2);
  assert.equal(count(f.db,'dorm','WG26053'),1);
});

test('Tampered source-count or format cannot authorize recovery',async()=>{
  for(const mutate of [
    archive=>{archive.source_record_count=archive.source_record_count-1;},
    archive=>{archive.source_snapshot_format='unknown';},
    archive=>{archive.dorm_count=0;}
  ]){
    const f=setup();
    const archive=seedLosslessArchive(f);
    mutate(archive);
    f.db.prepare("UPDATE records SET data=? WHERE id='old-complete-archive'").run(JSON.stringify(archive));
    const response=await f.close();
    assert.equal(response.status,409);
    assert.equal(count(f.db,'dorm','WG26053'),1);
    assert.equal(count(f.db,'archive','WG26053'),1);
  }
});
