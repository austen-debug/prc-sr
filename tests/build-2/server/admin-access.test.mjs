import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequestPost as login } from '../../../functions/api/login.js';
import { verifyRequestSession } from '../../../functions/api/session-contract.mjs';
import { onRequestPost as dispose, onRequestGet as dispositionHistory } from '../../../functions/api/admin-archives.js';
import { onRequestPost as retiredArchiveDelete } from '../../../functions/api/archive-delete.js';
import { onRequestDelete as deleteRecord } from '../../../functions/api/records.js';
import { normalizeActorRole } from '../../../public/app/data/canonical-entity.mjs';
import { stampUpdatedRecord } from '../../../functions/api/records-contract.mjs';

const sql=name=>readFileSync(new URL('../../../migrations/'+name,import.meta.url),'utf8');
function fixture(){
  const native=new DatabaseSync(':memory:');
  native.exec('PRAGMA foreign_keys=ON');
  native.exec('CREATE TABLE records(id TEXT PRIMARY KEY,type TEXT NOT NULL,week_group TEXT,data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)');
  for(const name of ['0003_gate_persistence_foundation.sql','0004_gate_record_audit_triggers.sql','0005_gate_squadron_notices.sql','0006_gate_squadron_information_revisions.sql'])native.exec(sql(name));
  return native;
}
function cloudflare(native){
  function statement(sql){
    const prepared=native.prepare(sql);let args=[];
    return {
      bind(...values){args=values;return this;},
      async first(){return prepared.get(...args)||null;},
      async all(){return {results:prepared.all(...args)};},
      async run(){if(prepared.columns().length)return {results:prepared.all(...args),meta:{changes:0}};const result=prepared.run(...args);return {meta:{changes:result.changes,last_row_id:Number(result.lastInsertRowid||0)}};}
    };
  }
  return {prepare:statement,async batch(statements){
    native.exec('BEGIN');try{const result=[];for(const item of statements)result.push(await item.run());native.exec('COMMIT');return result;}
    catch(error){native.exec('ROLLBACK');throw error;}
  }};
}
function seedArchive(db){
  const now='2026-10-15T19:00:00Z',id='archive_fixture_001';
  const data=JSON.stringify({type:'archive',week_group:'WG26100',record_version:1,created_by_role:'instructor',updated_by_role:'instructor'});
  db.prepare('INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(id,'archive','WG26100',data,now,now);
  db.prepare("INSERT INTO gate_week_groups(cycle_id,week_group,state,archive_id,closed_at) VALUES('cycle-fixture','WG26100','closed',?,?)").run(id,now);
  return id;
}
test('Admin credentials authenticate independently and old roles retain their signature contracts',async()=>{
  const env={AUTH_SECRET:'fixture-master',ADMIN_USERNAME:'admin-test',ADMIN_PASSWORD:'pass-admin',
    MTI_USERNAME:'instructor-test',MTI_PASSWORD:'pass-instructor',AIRMAN_USERNAME:'airman-test',AIRMAN_PASSWORD:'pass-airman',
    SQUADRON_USERNAME:'squadron-test',SQUADRON_PASSWORD:'pass-squadron'};
  for(const [role,username,password] of [['admin','admin-test','pass-admin'],['instructor','instructor-test','pass-instructor'],['airman','airman-test','pass-airman'],['squadron','squadron-test','pass-squadron']]){
    const response=await login({env,request:new Request('https://gate.example/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})})});
    assert.equal(response.status,200,role);
    assert.equal((await response.json()).role,role);
    const cookie=response.headers.get('set-cookie').split(';')[0];
    const session=await verifyRequestSession(new Request('https://gate.example/',{headers:{Cookie:cookie}}),env);
    assert.equal(session.role,role);
    assert.ok(session.exp-session.iat <=(role==='admin'?1800000:43200000));
  }
  const conflict={...env,ADMIN_USERNAME:env.MTI_USERNAME,ADMIN_PASSWORD:env.MTI_PASSWORD};
  const response=await login({env:conflict,request:new Request('https://gate.example/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:env.MTI_USERNAME,password:env.MTI_PASSWORD})})});
  assert.equal(response.status,503);
  assert.equal((await response.json()).code,'configuration_conflict');
});
test('Admin provenance preserves a legacy creator and does not fabricate missing creators',()=>{
  assert.equal(normalizeActorRole('admin'),'admin');
  const updated=stampUpdatedRecord({record_version:4,created_by_role:'instructor'},{type:'dorm'},{role:'admin',now:'2026-10-15T00:00:00Z'});
  assert.equal(updated.created_by_role,'instructor');assert.equal(updated.updated_by_role,'admin');assert.equal(updated.record_version,5);
  assert.equal(stampUpdatedRecord({record_version:0},{type:'dorm'},{role:'admin',now:'2026-10-15T00:00:00Z'}).created_by_role,'unknown');
});
test('D1 Admin migration preserves historical rows, expands valid actor constraints and maintains immutability',()=>{
  const db=fixture();
  db.prepare("INSERT INTO gate_audit_events(event_id,entity_type,entity_id,event_type,actor_role) VALUES('original-audit','archive','old','record_created','instructor')").run();
  db.prepare("INSERT INTO gate_archive_amendments(amendment_id,archive_id,amendment_number,amendment_type,reason,changes_json,actor_role) VALUES('amend1','archive-old',1,'correction','Original correction','{}','instructor')").run();
  db.prepare("INSERT INTO gate_squadron_notices(week_group,message,published_at,published_by_role) VALUES('WG26100','Original','2026-10-15T00:00:00Z','instructor')").run();
  db.prepare("INSERT INTO gate_squadron_information_revisions(instructions_json,published_at,published_by_role) VALUES('[]','2026-10-15T00:00:00Z','instructor')").run();
  const auditBefore=db.prepare("SELECT * FROM gate_audit_events WHERE event_id='original-audit'").get();
  const amendBefore=db.prepare("SELECT * FROM gate_archive_amendments WHERE amendment_id='amend1'").get();
  db.exec(sql('0007_gate_admin_provenance.sql'));
  assert.deepEqual(db.prepare("SELECT * FROM gate_audit_events WHERE event_id='original-audit'").get(),auditBefore);
  assert.deepEqual(db.prepare("SELECT * FROM gate_archive_amendments WHERE amendment_id='amend1'").get(),amendBefore);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM gate_squadron_notices").get().n,1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM gate_squadron_information_revisions").get().n,1);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  assert.doesNotThrow(()=>db.prepare("INSERT INTO gate_archive_amendments(amendment_id,archive_id,amendment_number,amendment_type,reason,changes_json,actor_role) VALUES('amend2','archive-old',2,'correction','Admin correction','{}','admin')").run());
  assert.throws(()=>db.prepare("UPDATE gate_archive_amendments SET reason='changed' WHERE amendment_id='amend1'").run(),/append-only/);
  assert.throws(()=>db.prepare("DELETE FROM gate_audit_events WHERE event_id='original-audit'").run(),/append-only/);
  assert.doesNotThrow(()=>db.prepare("INSERT INTO gate_squadron_notices(week_group,message,published_at,published_by_role) VALUES('WG26101','Admin','2026-10-15T00:00:00Z','admin')").run());
  assert.doesNotThrow(()=>db.prepare("INSERT INTO gate_squadron_information_revisions(instructions_json,published_at,published_by_role) VALUES('[]','2026-10-15T00:00:00Z','admin')").run());
  const now='2026-10-15T10:00:00Z';
  db.prepare('INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('bus-admin','bus','WG26100',JSON.stringify({type:'bus',created_by_role:'admin',record_version:1}),now,now);
  assert.equal(db.prepare("SELECT actor_role FROM gate_audit_events WHERE entity_id='bus-admin'").get().actor_role,'admin');
  assert.throws(()=>db.prepare("INSERT INTO gate_audit_events(event_id,entity_type,entity_id,event_type,actor_role) VALUES('bad-role','bus','x','test','invalid')").run(),/CHECK constraint/);
});
test('Archive withdrawal and restoration preserve original bytes and are Admin-only',async()=>{
  const db=fixture();const id=seedArchive(db),original=db.prepare('SELECT * FROM records WHERE id=?').get(id);
  db.exec(sql('0007_gate_admin_provenance.sql'));
  const env={DB:cloudflare(db),GATE_ADMIN_WRITES_ENABLED:'true'};
  const input=(role,action,revision,operationId)=>dispose({env,data:{session:{role,iat:Date.now()}},request:new Request('https://gate.example/api/admin-archives',{method:'POST',headers:{Origin:'https://gate.example','Content-Type':'application/json'},body:JSON.stringify({archiveId:id,confirmArchiveId:id,action,expectedRevision:revision,operationId,reason:'Administrative historical record correction'})})});
  assert.equal((await input('instructor','withdraw',0,'op_instructor_001')).status,403);
  const withdraw=await input('admin','withdraw',0,'op_admin_0001');
  assert.equal(withdraw.status,200,JSON.stringify(await withdraw.clone().json()));
  assert.equal((await withdraw.json()).revision,1);
  assert.deepEqual(db.prepare('SELECT * FROM records WHERE id=?').get(id),original);
  assert.equal(db.prepare("SELECT actor_role FROM gate_audit_events WHERE event_type='archive_withdrawn'").get().actor_role,'admin');
  assert.equal((await input('admin','restore',0,'op_admin_0002')).status,409);
  assert.equal((await input('admin','restore',1,'op_admin_0003')).status,200);
  assert.deepEqual(db.prepare('SELECT * FROM records WHERE id=?').get(id),original);
  const events=db.prepare('SELECT action,revision FROM gate_admin_archive_dispositions ORDER BY revision').all();
  assert.deepEqual(events.map(x=>x.action),['withdraw','restore']);
  const history=await dispositionHistory({env,data:{session:{role:'admin'}},request:new Request('https://gate.example/api/admin-archives?archive_id='+id)});
  assert.equal((await history.json()).dispositions.length,2);
  assert.equal((await retiredArchiveDelete()).status,410);
});

test('Admin operational deletions retain database SYSTEM observation plus verified authenticated actor',async()=>{
  const db=fixture();db.exec(sql('0007_gate_admin_provenance.sql'));
  const timestamp='2026-10-15T11:00:00Z';
  db.prepare('INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('config-delete-1','config','',JSON.stringify({type:'config',key:'last_airport',value:'',record_version:1,created_by_role:'instructor',updated_by_role:'instructor'}),timestamp,timestamp);
  const result=await deleteRecord({env:{DB:cloudflare(db)},data:{session:{role:'admin'}},
    request:new Request('https://gate.example/api/records',{method:'DELETE',headers:{'Content-Type':'application/json','If-Match':'"1"'},body:JSON.stringify({id:'config-delete-1'})})});
  assert.equal(result.status,200,JSON.stringify(await result.clone().json()));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM records WHERE id='config-delete-1'").get().n,0);
  const events=db.prepare("SELECT event_type,actor_role FROM gate_audit_events WHERE entity_id='config-delete-1' ORDER BY rowid").all();
  assert.equal(events.filter(row=>row.event_type==='record_deleted'&&row.actor_role==='system').length,1);
  assert.equal(events.filter(row=>row.event_type==='record_delete_authorized'&&row.actor_role==='admin').length,1);
});
