import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { onRequestGet } from '../../../functions/api/records.js';

function setup({ initialized='2026-10-26T10:00:00.000Z', archivedAt='2026-10-27T11:09:00.000Z', dorms=0, buses=2, initId='', busCreatedAt=initialized }={}) {
  const db=new DatabaseSync(':memory:');
  db.exec('CREATE TABLE records (id TEXT PRIMARY KEY,type TEXT,week_group TEXT,data TEXT,created_at TEXT,updated_at TEXT)');
  const insert=(id,type,weekGroup,data,createdAt,updatedAt=createdAt)=>
    db.prepare('INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)')
      .run(id,type,weekGroup,JSON.stringify({type,week_group:weekGroup,created_at:createdAt,updated_at:updatedAt,...data}),createdAt,updatedAt);
  insert('config','config','',{key:'week_group',value:'WG27003',initialization_request_id:initId},initialized,initialized);
  if(archivedAt)insert('archive','archive','WG27003',{archived_at:archivedAt,total_arrived:893},archivedAt);
  for(let i=0;i<buses;i++) insert('bus-'+i,'bus','WG27003',{status:'arrived',otw_count:40},busCreatedAt);
  for(let i=0;i<dorms;i++) insert('dorm-'+i,'dorm','WG27003',{dorm_name:String(i),initialization_request_id:initId},initialized);
  const DB={prepare(sql){let values=[];return {
    bind(...args){values=args;return this;},
    async all(){return {results:db.prepare(sql).all(...values)};},
    async first(){return db.prepare(sql).get(...values)||null;}
  };}};
  return {db,DB};
}

async function live(options) {
  const context=setup(options);
  try {
    const response=await onRequestGet({
      request:new Request('https://gate.example/api/records?scope=live'),
      env:{DB:context.DB},data:{session:{role:'instructor'}}
    });
    assert.equal(response.status,200);
    return await response.json();
  } finally { context.db.close(); }
}

test('live API flags archival closeout with missing dorms and surviving bus data',async()=>{
  const body=await live();
  assert.equal(body.closeout_recovery.recovery_required,true);
  assert.equal(body.closeout_recovery.week_group,'WG27003');
  assert.equal(body.closeout_recovery.residual_buses,2);
  assert.equal(body.closeout_recovery.archive_id,'archive');
  assert.equal(body.records.some(row=>row.type==='archive'),false);
  assert.equal(body.records.some(row=>row.type==='bus'),false,'stranded buses must not reach any live page');
  assert.equal(body.records.find(row=>row.type==='config' && row.key==='week_group').value,'');
  assert.equal(body.live_state.status,'recovery_required');
});

test('live API shows dorms and buses when new operations have no historical archive',async()=>{
  const body=await live({dorms:1,archivedAt:null});
  assert.equal(body.closeout_recovery,null);
  assert.equal(body.records.filter(row=>row.type==='bus').length,2);
  assert.equal(body.live_state.week_group,'WG27003');
});

test('new cycle with reused label is not suppressed by historical archive',async()=>{
  const body=await live({initialized:'2026-11-10T10:00:00.000Z',initId:'verified-reinitialize',dorms:1});
  assert.equal(body.closeout_recovery,null);
});

test('reused label fails closed if pre-archive bus source rows coexist with the new manifest',async()=>{
  const body=await live({
    initialized:'2026-11-10T10:00:00.000Z',initId:'verified-reinitialize',dorms:1,buses:2,
    busCreatedAt:'2026-10-26T10:00:00.000Z'
  });
  assert.equal(body.live_state.status,'recovery_required');
  assert.equal(body.closeout_recovery.reason,'cross_cycle_source_records');
  assert.equal(body.closeout_recovery.suspect_source_count,2);
  assert.equal(body.records.filter(row=>['bus','dorm','sound_event'].includes(row.type)).length,0,
    'The live API must withhold even otherwise current dorms rather than mixing cycles');
  assert.equal(body.records.find(row=>row.type==='config'&&row.key==='week_group').value,'');
});

test('an operational source from an unrelated Week Group also prevents a verified live snapshot',async()=>{
  const f=setup({archivedAt:null,dorms:1,buses:0});
  f.db.prepare("INSERT INTO records VALUES(?,?,?,?,?,?)").run(
    'stranded','sound_event','OLDER',
    JSON.stringify({type:'sound_event',week_group:'OLDER'}),
    '2026-10-01T00:00:00.000Z','2026-10-01T00:00:00.000Z');
  const response=await onRequestGet({
    request:new Request('https://gate.example/api/records?scope=live'),
    env:{DB:f.DB},data:{session:{role:'instructor'}}
  });
  assert.equal(response.status,200);
  assert.equal((await response.json()).closeout_recovery.reason,'cross_cycle_source_records');
  f.db.close();
});

test('live API does not invent recovery status when active dorms exist and no archive exists',async()=>{
  const body=await live({archivedAt:null,dorms:1});
  assert.equal(body.closeout_recovery,null);
});

test('a historical archive suppresses a bogus reused label without initialization proof',async()=>{
  const body=await live({initialized:'2026-11-10T10:00:00.000Z',dorms:1});
  assert.equal(body.live_state.week_group,'');
  assert.equal(body.closeout_recovery.recovery_required,true);
  assert.equal(body.records.filter(row=>row.type==='bus').length,0);
});

test('no dormant manifest means a configured Week Group is not verified live',async()=>{
  const body=await live({archivedAt:null,dorms:0});
  assert.equal(body.live_state.status,'recovery_required');
  assert.equal(body.closeout_recovery.reason,'missing_active_dorm_manifest');
  assert.equal(body.records.some(row=>row.type==='bus'),false);
});
