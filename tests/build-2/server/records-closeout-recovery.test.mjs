import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { onRequestGet } from '../../../functions/api/records.js';

function setup({ initialized='2026-10-26T10:00:00.000Z', archivedAt='2026-10-27T11:09:00.000Z', dorms=0, buses=2 }={}) {
  const db=new DatabaseSync(':memory:');
  db.exec('CREATE TABLE records (id TEXT PRIMARY KEY,type TEXT,week_group TEXT,data TEXT,created_at TEXT,updated_at TEXT)');
  const insert=(id,type,weekGroup,data,createdAt,updatedAt=createdAt)=>
    db.prepare('INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)')
      .run(id,type,weekGroup,JSON.stringify({type,week_group:weekGroup,created_at:createdAt,updated_at:updatedAt,...data}),createdAt,updatedAt);
  insert('config','config','',{key:'week_group',value:'WG27003'},initialized,initialized);
  if(archivedAt)insert('archive','archive','WG27003',{archived_at:archivedAt,total_arrived:893},archivedAt);
  for(let i=0;i<buses;i++) insert('bus-'+i,'bus','WG27003',{status:'arrived',otw_count:40},initialized);
  for(let i=0;i<dorms;i++) insert('dorm-'+i,'dorm','WG27003',{dorm_name:String(i)},initialized);
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
});

test('live API does not flag current operations while any dorm remains',async()=>{
  const body=await live({dorms:1});
  assert.equal(body.closeout_recovery,null);
});

test('new cycle with reused label is not suppressed by historical archive',async()=>{
  const body=await live({initialized:'2026-11-10T10:00:00.000Z'});
  assert.equal(body.closeout_recovery,null);
});

test('live API does not invent recovery status when no archive exists',async()=>{
  const body=await live({archivedAt:null});
  assert.equal(body.closeout_recovery,null);
});
