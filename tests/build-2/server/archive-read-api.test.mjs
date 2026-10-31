import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  onRequestGet as archiveGet,
  onRequestPost as archivePost
} from '../../../functions/api/archives.js';
import { onRequestGet as recordsGet, onRequestPost as recordsPost, onRequestPut as recordsPut, onRequestDelete as recordsDelete } from '../../../functions/api/records.js';

const stamp = '2026-09-21T22:00:00.000Z';

function fixture() {
  const native = new DatabaseSync(':memory:');
  native.exec(`
    CREATE TABLE records(
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      week_group TEXT,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE gate_archive_amendments(
      amendment_id TEXT PRIMARY KEY,
      archive_id TEXT NOT NULL,
      cycle_id TEXT,
      amendment_number INTEGER NOT NULL,
      amendment_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      changes_json TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE gate_week_groups(
      cycle_id TEXT PRIMARY KEY,
      week_group TEXT NOT NULL,
      state TEXT NOT NULL,
      archive_id TEXT,
      activated_at TEXT,
      closed_at TEXT,
      revision INTEGER DEFAULT 1
    );
  `);

  const DB = {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() { return native.prepare(sql).get(...args) ?? null; },
        async all() { return { results: native.prepare(sql).all(...args) }; },
        async run() {
          const result = native.prepare(sql).run(...args);
          return { meta: { changes: Number(result.changes) } };
        }
      };
    }
  };

  const archive = {
    __backendId: 'archive-1',
    type: 'archive',
    week_group: 'WG26051',
    archived_at: stamp,
    dorm_count: 1,
    bus_count: 2,
    total_arrived: 41,
    total_loaded: 41,
    total_expected: 44,
    female_total: 7,
    nat_total: 2,
    space_force_total: 4,
    receiving_day_one_start: '2026-09-21T17:00:00.000Z',
    receiving_day_one_end: '2026-09-21T23:00:00.000Z',
    dorm_data: JSON.stringify([{ dorm_name: 'A01', max_load: 44, current_load: 41 }]),
    bus_data: JSON.stringify([
      { bus_id: '1', status: 'arrived', otw_count: 21, female_count: 3 },
      { bus_id: '2', status: 'arrived', otw_count: 20, female_count: 4 }
    ]),
    source_records_json: JSON.stringify([{ id: 'secret-source-row', data: '{"preserve":"exact"}' }]),
    source_record_count: 3,
    source_snapshot_format: 'lossless-record-rows-v1',
    archive_schema_version: 'gate-archive-schema-v3-canonical'
  };

  native.prepare('INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)')
    .run('archive-1', 'archive', 'WG26051', JSON.stringify(archive), stamp, stamp);
  native.prepare('INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)')
    .run('live-dorm', 'dorm', 'WG26052', JSON.stringify({ type:'dorm', week_group:'WG26052', dorm_name:'B01' }), stamp, stamp);
  native.prepare(`INSERT INTO gate_archive_amendments(
      amendment_id,archive_id,cycle_id,amendment_number,amendment_type,reason,changes_json,actor_role,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?)`)
    .run('amend-1','archive-1','cycle-1',1,'correction','Correct duplicate movement count.',JSON.stringify({ total_arrived:40 }),'instructor',stamp);
  native.prepare('INSERT INTO gate_week_groups(cycle_id,week_group,state,archive_id,activated_at,closed_at,revision) VALUES(?,?,?,?,?,?,?)')
    .run('cycle-1','WG26051','closed','archive-1',stamp,stamp,2);

  return { native, env:{ DB } };
}

async function json(response) {
  return { status:response.status, body:await response.json() };
}

test('archive presentation API returns lightweight summaries without lossless or detail payloads', async () => {
  const f = fixture();
  const before = f.native.prepare("SELECT data FROM records WHERE id='archive-1'").get().data;
  const response = await archiveGet({
    request:new Request('https://gate.example/api/archives'),
    env:f.env,
    data:{session:{role:'instructor'}}
  });
  const result = await json(response);
  assert.equal(result.status,200);
  assert.equal(result.body.count,1);
  assert.equal(result.body.archives[0].week_group,'WG26051');
  assert.equal(result.body.archives[0].integrity,'lossless');
  assert.equal(result.body.archives[0].total_arrived,40,'summary presentation applies recorded amendments');
  assert.equal(result.body.archives[0].amendment_count,1);
  const serialized = JSON.stringify(result.body);
  assert.doesNotMatch(serialized,/source_records_json/);
  assert.doesNotMatch(serialized,/dorm_data/);
  assert.doesNotMatch(serialized,/bus_data/);
  assert.equal(f.native.prepare("SELECT data FROM records WHERE id='archive-1'").get().data,before);
});

test('archive detail is read-only, strips recovery snapshot, parses presentation rows, and overlays amendments without rewriting D1', async () => {
  const f = fixture();
  const before = f.native.prepare("SELECT data FROM records WHERE id='archive-1'").get().data;
  const response = await archiveGet({
    request:new Request('https://gate.example/api/archives?id=archive-1'),
    env:f.env,
    data:{session:{role:'instructor'}}
  });
  const result = await json(response);
  assert.equal(result.status,200);
  assert.equal(result.body.archive.week_group,'WG26051');
  assert.equal(result.body.archive.total_arrived,40,'presentation must apply the recorded amendment');
  assert.equal(result.body.dorms.length,1);
  assert.equal(result.body.buses.length,2);
  assert.equal(result.body.amendments.length,1);
  assert.equal(result.body.amendments[0].previous_values.total_arrived,41);
  assert.equal(result.body.amendments[0].changes.total_arrived,40);
  assert.equal(result.body.amendments[0].actor_role,'instructor');
  assert.equal(result.body.lifecycle.state,'closed');
  assert.doesNotMatch(JSON.stringify(result.body),/source_records_json/);
  assert.doesNotMatch(JSON.stringify(result.body),/secret-source-row/);
  const after = f.native.prepare("SELECT data FROM records WHERE id='archive-1'").get().data;
  assert.equal(after,before,'read/presentation must not mutate archive bytes');
  assert.equal(JSON.parse(after).total_arrived,41,'baseline archive remains unchanged beneath amendment presentation');
});

test('archive read model tracks ordered before/after values without changing the original',async()=>{
  const f=fixture(),before=f.native.prepare("SELECT data FROM records WHERE id='archive-1'").get().data;
  f.native.prepare("INSERT INTO gate_archive_amendments(amendment_id,archive_id,cycle_id,amendment_number,amendment_type,reason,changes_json,actor_role,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
    .run('amend-2','archive-1','cycle-1',2,'correction','Final verified reconciliation',JSON.stringify({total_arrived:39,total_loaded:40}),'admin',stamp);
  const result=await json(await archiveGet({request:new Request('https://gate.example/api/archives?id=archive-1'),env:f.env,data:{session:{role:'admin'}}}));
  assert.equal(result.status,200);
  assert.deepEqual(result.body.amendments.map(a=>a.amendment_number),[1,2]);
  assert.deepEqual(result.body.amendments.map(a=>a.previous_values.total_arrived),[41,40]);
  assert.equal(result.body.amendments[1].previous_values.total_loaded,41);
  assert.equal(result.body.archive.total_arrived,39);
  assert.equal(result.body.archive.total_loaded,40);
  assert.equal(f.native.prepare("SELECT data FROM records WHERE id='archive-1'").get().data,before);
});
test('archive read fails closed rather than silently skipping revision gaps or malformed correction data',async()=>{
  const f=fixture();
  f.native.prepare("UPDATE gate_archive_amendments SET amendment_number=3 WHERE amendment_id='amend-1'").run();
  let result=await json(await archiveGet({request:new Request('https://gate.example/api/archives?id=archive-1'),env:f.env,data:{session:{role:'instructor'}}}));
  assert.equal(result.status,500);
  f.native.prepare("UPDATE gate_archive_amendments SET amendment_number=1,changes_json='not-json' WHERE amendment_id='amend-1'").run();
  result=await json(await archiveGet({request:new Request('https://gate.example/api/archives'),env:f.env,data:{session:{role:'instructor'}}}));
  assert.equal(result.status,500);
});
test('archive presentation endpoint rejects mutations and non-instructor reads', async () => {
  const f = fixture();
  const before = f.native.prepare("SELECT data FROM records WHERE id='archive-1'").get().data;
  const denied = await archiveGet({
    request:new Request('https://gate.example/api/archives'),
    env:f.env,
    data:{session:{role:'airman'}}
  });
  assert.equal(denied.status,403);
  const mutation = await archivePost();
  assert.equal(mutation.status,405);
  assert.equal(f.native.prepare("SELECT data FROM records WHERE id='archive-1'").get().data,before);
});

test('live record polling excludes archive payloads while the default records API remains backward compatible', async () => {
  const f = fixture();
  const live = await recordsGet({
    request:new Request('https://gate.example/api/records?scope=live'),
    env:f.env,
    data:{session:{role:'instructor'}}
  });
  const liveBody = await live.json();
  assert.equal(live.status,200);
  assert.equal(liveBody.scope,'live');
  assert.deepEqual(liveBody.records.map(record => record.type),['dorm']);

  const all = await recordsGet({
    request:new Request('https://gate.example/api/records'),
    env:f.env,
    data:{session:{role:'instructor'}}
  });
  const allBody = await all.json();
  assert.equal(allBody.scope,'all');
  assert.deepEqual(allBody.records.map(record => record.type).sort(),['archive','dorm']);
});


test('generic records mutations cannot create, spoof-overwrite or delete archive snapshots for any writer role',async()=>{
  const f=fixture();
  const baseline=f.native.prepare("SELECT data FROM records WHERE id='archive-1'").get().data;
  for(const role of ['instructor','admin','airman']){
    const data={session:{role}};
    for(const record of [{type:'archive',week_group:'WG26099'},{type:'archive_amendment',archive_id:'archive-1'}]){
      const response=await recordsPost({request:new Request('https://gate.example/api/records',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)
      }),env:f.env,data});
      assert.equal(response.status,405,'direct archive creation is reserved to server closeout');
    }
    const put=await recordsPut({request:new Request('https://gate.example/api/records',{
      method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({__backendId:'archive-1',type:'dorm',week_group:'FORGED',total_arrived:999})
    }),env:f.env,data});
    assert.equal(put.status,405,'stored archive row wins over spoofed submitted type');
    const deletion=await recordsDelete({request:new Request('https://gate.example/api/records',{
      method:'DELETE',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({__backendId:'archive-1',type:'dorm'})
    }),env:f.env,data});
    assert.equal(deletion.status,403);
    assert.equal(f.native.prepare("SELECT data FROM records WHERE id='archive-1'").get().data,baseline);
  }
  assert.equal(f.native.prepare("SELECT COUNT(*) AS n FROM records WHERE type='archive'").get().n,1);
});


test('malformed immutable archive JSON fails closed on index and detail without changing source',async()=>{
  const f=fixture();
  f.native.prepare("UPDATE records SET data='not-json' WHERE id='archive-1'").run();
  for(const url of ['https://gate.example/api/archives','https://gate.example/api/archives?id=archive-1']){
    const result=await json(await archiveGet({request:new Request(url),env:f.env,data:{session:{role:'instructor'}}}));
    assert.equal(result.status,500);
    assert.equal(result.body.code,'archive_read_failed');
  }
  assert.equal(f.native.prepare("SELECT data FROM records WHERE id='archive-1'").get().data,'not-json');
});

test('invalid archived dorm and bus snapshots cannot silently render as empty detail tables',async()=>{
  for(const field of ['dorm_data','bus_data']){
    const f=fixture();
    const previous=JSON.parse(f.native.prepare("SELECT data FROM records WHERE id='archive-1'").get().data);
    previous[field]='[invalid-json';
    const retained=JSON.stringify(previous);
    f.native.prepare("UPDATE records SET data=? WHERE id='archive-1'").run(retained);
    const result=await json(await archiveGet({request:new Request('https://gate.example/api/archives?id=archive-1'),env:f.env,data:{session:{role:'instructor'}}}));
    assert.equal(result.status,500);
    assert.equal(result.body.code,'archive_read_failed');
    assert.equal(f.native.prepare("SELECT data FROM records WHERE id='archive-1'").get().data,retained);
  }
});
