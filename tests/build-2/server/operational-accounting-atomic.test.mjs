import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { onRequestPut } from '../../../functions/api/records.js';

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE records(
    id TEXT PRIMARY KEY,type TEXT NOT NULL,week_group TEXT NOT NULL,
    data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
  )`);
  const stamp = '2026-10-30T12:00:00Z';
  for(const record of [
    {__backendId:'bus',type:'bus',week_group:'26003',status:'arrived',otw_count:40,record_version:1},
    {__backendId:'dorm-a',type:'dorm',week_group:'26003',current_load:0,max_load:40,record_version:1},
    {__backendId:'dorm-b',type:'dorm',week_group:'26003',current_load:0,max_load:40,record_version:1}
  ]) db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?)')
    .run(record.__backendId,record.type,record.week_group,JSON.stringify(record),stamp,stamp);
  return {db,env:{DB:{prepare(sql){
    let args=[];
    return {
      bind(...values){args=values;return this;},
      async first(){return db.prepare(sql).get(...args)||null;},
      async all(){return {results:db.prepare(sql).all(...args)};},
      async run(){const result=db.prepare(sql).run(...args);return {meta:{changes:result.changes}};}
    };
  }}}};
}

test('separate dorm assignments cannot cumulatively exceed the same arrived pool',async()=>{
  const {db,env}=setup();
  const put=id=>onRequestPut({
    env,data:{session:{role:'instructor'}},
    request:new Request('https://gate.example/api/records',{
      method:'PUT',
      headers:{'If-Match':'1','Content-Type':'application/json'},
      body:JSON.stringify({__backendId:id,type:'dorm',week_group:'26003',current_load:30,max_load:40})
    })
  });
  const results=await Promise.all([put('dorm-a'),put('dorm-b')]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const loads=db.prepare("SELECT CAST(json_extract(data,'$.current_load') AS INTEGER) AS n FROM records WHERE type='dorm'").all();
  assert.equal(loads.reduce((total,row)=>total+row.n,0),30);
});

test('per-record capacity and total arrival accounting remain independent',async()=>{
  const {db,env}=setup();
  const result=await onRequestPut({env,data:{session:{role:'instructor'}},
    request:new Request('https://gate.example/api/records',{
      method:'PUT',headers:{'If-Match':'1','Content-Type':'application/json'},
      body:JSON.stringify({__backendId:'dorm-a',type:'dorm',week_group:'26003',current_load:41,max_load:40})
    })
  });
  assert.equal(result.status,409);
  assert.equal(db.prepare("SELECT json_extract(data,'$.current_load') AS n FROM records WHERE id='dorm-a'").get().n,0);
});

test('malformed bus totals cannot enter or corrupt authoritative arrival accounting',async()=>{
  const {db,env}=setup();
  const {onRequestPost}=await import('../../../functions/api/records.js');
  const response=await onRequestPost({env,data:{session:{role:'instructor'}},
    request:new Request('https://gate.example/api/records',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({type:'bus',week_group:'26003',status:'arrived',
        otw_count:12,female_count:13,arrived_at:'2026-10-30T13:00:00Z'})
    })
  });
  assert.equal(response.status,400);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM records WHERE type='bus'").get().n,1);
});

test('deleting arrived bus cannot strand an already assigned dorm',async()=>{
  const {db,env}=setup();
  const record=JSON.parse(db.prepare("SELECT data FROM records WHERE id='dorm-a'").get().data);
  record.current_load=25;
  db.prepare("UPDATE records SET data=? WHERE id='dorm-a'").run(JSON.stringify(record));
  const {onRequestDelete}=await import('../../../functions/api/records.js');
  const response=await onRequestDelete({env,data:{session:{role:'instructor'}},
    request:new Request('https://gate.example/api/records',{
      method:'DELETE',headers:{'Content-Type':'application/json','If-Match':'1'},
      body:JSON.stringify({__backendId:'bus'})
    })
  });
  assert.equal(response.status,409);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM records WHERE id='bus'").get().n,1);
});
