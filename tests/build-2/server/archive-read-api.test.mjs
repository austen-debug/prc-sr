import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  onRequestGet as archiveGet,
  onRequestPost as archivePost
} from '../../../functions/api/archives.js';
import { onRequestGet as recordsGet } from '../../../functions/api/records.js';

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
  assert.equal(result.body.lifecycle.state,'closed');
  assert.doesNotMatch(JSON.stringify(result.body),/source_records_json/);
  assert.doesNotMatch(JSON.stringify(result.body),/secret-source-row/);
  const after = f.native.prepare("SELECT data FROM records WHERE id='archive-1'").get().data;
  assert.equal(after,before,'read/presentation must not mutate archive bytes');
  assert.equal(JSON.parse(after).total_arrived,41,'baseline archive remains unchanged beneath amendment presentation');
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
