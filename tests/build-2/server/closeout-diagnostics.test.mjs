import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {onRequestGet, onRequestPost} from '../../../functions/api/closeout-diagnostics.js';

function fixture(){
  const db=new DatabaseSync(':memory:');
  db.exec("CREATE TABLE records(id TEXT PRIMARY KEY,type TEXT,week_group TEXT,data TEXT,created_at TEXT,updated_at TEXT)");
  const stamp='2026-10-27T10:00:00.000Z';
  function insert(id,type,week_group,data,at=stamp){
    db.prepare("INSERT INTO records VALUES(?,?,?,?,?,?)").run(id,type,week_group,JSON.stringify(data),at,at);
  }
  const env={DB:{prepare(sql){
    let args=[];return {
      bind(...values){args=values;return this;},
      async all(){return {results:db.prepare(sql).all(...args)};},
      async first(){return db.prepare(sql).get(...args)||null;}
    };
  }}};
  const data={session:{role:'instructor'}};
  async function get(weekGroup='WG27003',session=data){
    const request=new Request('https://gate.example/api/closeout-diagnostics?week_group='+weekGroup);
    const response=await onRequestGet({request,env,data:session});
    return {status:response.status,body:await response.json()};
  }
  return {db,env,data,get,insert,stamp};
}

test('read-only diagnostic identifies reporting-only archive with orphaned operational data',async()=>{
  const f=fixture();
  f.insert('config','config','',{key:'week_group',value:'WG27003'});
  f.insert('bus-one','bus','WG27003',{type:'bus',status:'arrived',otw_count:25});
  f.insert('event-one','sound_event','WG27003',{type:'sound_event',sound_key:'one'});
  f.insert('archive','archive','WG27003',{type:'archive',week_group:'WG27003',
    archived_at:'2026-10-27T11:00:00.000Z',dorm_count:16,bus_count:29,
    total_arrived:893,total_expected:903,total_loaded:893});
  const before=f.db.prepare('SELECT COUNT(*) AS n FROM records').get().n;
  const response=await f.get();
  assert.equal(response.status,200);
  assert.equal(response.body.active_week_group,'WG27003');
  assert.equal(response.body.live_counts.dorm,0);
  assert.equal(response.body.live_counts.bus,1);
  assert.equal(response.body.live_counts.sound_event,1);
  assert.equal(response.body.live_arrived,25);
  assert.equal(response.body.archives[0].source_record_count,null);
  assert.match(response.body.recovery_guidance,/Manual operator reconciliation/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM records').get().n,before);
});
test('diagnostic reports exact snapshot match without returning any source JSON',async()=>{
  const f=fixture();
  const bus={type:'bus',week_group:'WG27003',status:'arrived',otw_count:10};
  f.insert('bus-one','bus','WG27003',bus);
  const row=f.db.prepare("SELECT * FROM records WHERE id='bus-one'").get();
  const source=[row];
  f.insert('archive','archive','WG27003',{type:'archive',week_group:'WG27003',
    archived_at:'2026-10-27T11:00:00.000Z',source_snapshot_format:'lossless-record-rows-v1',
    source_record_count:1,source_records_json:JSON.stringify(source),dorm_count:0,bus_count:1});
  const response=await f.get();
  assert.equal(response.body.archives[0].unchanged_remaining_records,1);
  assert.equal(response.body.archives[0].modified_since_snapshot,0);
  assert.equal(response.body.archives[0].missing_from_snapshot,0);
  assert.doesNotMatch(JSON.stringify(response.body),/source_records_json/);
  assert.doesNotMatch(JSON.stringify(response.body),/sound_key/);
});
test('diagnostics are instructor-only and prohibit writes',async()=>{
  const f=fixture();
  assert.equal((await f.get('WG27003',{session:{role:'airman'}})).status,403);
  const response=await onRequestPost();
  assert.equal(response.status,405);
});
