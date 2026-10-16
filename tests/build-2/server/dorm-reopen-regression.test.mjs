import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import {onRequestPut} from '../../../functions/api/records.js';
import {onRequest as apiMiddleware} from '../../../functions/api/_middleware.js';

const root=url=>readFileSync(new URL(url,import.meta.url),'utf8');

function processingErrorMessage(){
 const source=root('../../../public/js/gate-processing-controller.js');
 const from=source.indexOf('  function dormReopenFailureMessage(result) {');
 const to=source.indexOf('\n  function showDormReopenFailure(',from);
 assert.ok(from>=0 && to>from,'Canonical Processing reopen messages remain independently verifiable');
 return new Function('return ('+source.slice(from,to).trim()+')')();
}

function sdkFixture(updateBody){
 const html=root('../../../public/index.html');
 const start=html.indexOf('  // Cloudflare Pages + D1 dataSdk replacement.');
 const end=html.indexOf('</script>',start);
 assert.ok(start>=0&&end>start,'Canonical D1 dataSdk implementation exists');
 const javascript=html.slice(start,end);
 let reads=0,writes=0;
 const warnings=[];
 const context={
  window:{},setInterval(){},console:{warn:(...args)=>warnings.push(args.map(String).join(' '))},
  fetch:async (url,opts={})=>{
   if(String(url).includes('scope=live')){
    reads++;
    if(reads>1)throw new Error('Simulated read outage after committed write');
    return {json:async()=>({isOk:true,records:[]})};
   }
   assert.equal(opts.method,'PUT');
   writes++;
   return {json:async()=>updateBody};
  }
 };
 runInNewContext(javascript,context);
 return {sdk:context.window.dataSdk,warnings,counts:()=>({reads,writes})};
}

function sqliteFixture(){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON');
 db.exec('CREATE TABLE records (id TEXT PRIMARY KEY, type TEXT NOT NULL, week_group TEXT, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)');
 db.exec(root('../../../migrations/0003_gate_persistence_foundation.sql'));
 db.exec(root('../../../migrations/0004_gate_record_audit_triggers.sql'));
 const sql=statement=>{
  const p=db.prepare(statement);let bound=[];
  return {
   bind(...args){bound=args;return this;},
   async first(){return p.get(...bound)||null;},
   async all(){return{results:p.all(...bound)};},
   async run(){const result=p.run(...bound);return{meta:{changes:result.changes}}}
  };
 };
 const now='2026-10-16T16:00:00.000Z';
 const seed=(id,type,data)=>db.prepare('INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,?,?,?,?,?)')
  .run(id,type,'WG26104',JSON.stringify({...data,type,week_group:'WG26104',record_version:3,created_by_role:'instructor'}),now,now);
 seed('bus-fixture','bus',{bus_type:'airport',otw_count:25,status:'arrived'});
 seed('dorm-fixture','dorm',{state:'closed',phase:'Closed',max_load:44,current_load:12,
  dorm_name:'B04',opened_at:'2026-10-16T15:00:00.000Z',closed_at:'2026-10-16T15:32:00.000Z',
  closed_timer:'32:00',notes:'Preserve historical operational notes'});
 return {db,DB:{prepare:sql}};
}

test('Processing shows specific Admin and Week Group errors without exposing raw database exceptions',()=>{
 const message=processingErrorMessage();
 assert.match(message({code:'admin_writes_disabled'}),/Privileged Admin changes remain disabled/);
 assert.match(message({code:'admin_schema_required'}),/Admin actor provenance schema/);
 assert.match(message({code:'lifecycle_required',error:'Register an active Week Group before changing operational records.'}),/active Week Group/);
 assert.match(message({code:'lifecycle_required',error:'Only records in the active Week Group can be modified.'}),/does not belong to the active Week Group/);
 assert.match(message({code:'integrity_error'}),/Week Group configuration and lifecycle records/);
 assert.match(message({code:'record_version_conflict'}),/changed after you opened/);
 assert.match(message({code:'unauthorized'}),/Sign in again/);
 assert.doesNotMatch(message({code:'update_failed',error:'SQLITE_CONSTRAINT: confidential metadata'}),/SQLITE|confidential/);
});

test('A committed dorm update is not falsely marked failed when follow-up refresh cannot reach the API',async()=>{
 const f=sdkFixture({isOk:true,data:{type:'dorm',__backendId:'dorm-fixture',state:'open'}});
 await f.sdk.init({onDataChanged(){}});
 const result=await f.sdk.update({type:'dorm',__backendId:'dorm-fixture',state:'open'});
 assert.equal(result.isOk,true);
 assert.deepEqual(f.counts(),{reads:2,writes:1});
 assert.equal(f.warnings.some(x=>/update committed/.test(x)),true);
});

test('A rejected update remains a rejected update and does not trigger an authoritative refresh',async()=>{
 const f=sdkFixture({isOk:false,code:'admin_writes_disabled',error:'Admin writes not enabled.'});
 await f.sdk.init({onDataChanged(){}});
 const result=await f.sdk.update({type:'dorm',__backendId:'dorm-fixture',state:'open'});
 assert.equal(result.isOk,false);
 assert.equal(result.code,'admin_writes_disabled');
 assert.deepEqual(f.counts(),{reads:1,writes:1});
});

test('Server closed-dorm manual reopen preserves current load and provenance while clearing the closure',async()=>{
 const {db,DB}=sqliteFixture();
 const request=new Request('https://gate.example/api/records',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':'"3"'},
  body:JSON.stringify({__backendId:'dorm-fixture',type:'dorm',week_group:'WG26104',state:'open',
   phase:'OPEN',opened_at:'2026-10-16T15:20:00Z',closed_at:'',closed_timer:'',
   current_load:12,max_load:44,manual_reopen_override:'true'})});
 const response=await onRequestPut({request,env:{DB},data:{session:{role:'instructor'}}});
 assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
 const payload=await response.json();
 assert.equal(payload.data.state,'open');
 assert.equal(payload.data.phase,'OPEN');
 assert.equal(payload.data.current_load,12);
 assert.equal(payload.data.max_load,44);
 assert.equal(payload.data.closed_timer,'');
 assert.equal(payload.data.closed_at,'');
 assert.equal(payload.data.notes,'Preserve historical operational notes');
 assert.equal(payload.data.record_version,4);
 assert.equal(payload.data.created_by_role,'instructor');
 assert.equal(payload.data.updated_by_role,'instructor');
 assert.equal(db.prepare("SELECT COUNT(*) AS count FROM records WHERE id='dorm-fixture' AND json_extract(data,'$.state')='open'").get().count,1);
});

test('Admin writes remain fail-closed pending verified migration; Instructor requires active Week Group',async()=>{
 const {DB}=sqliteFixture(),body=JSON.stringify({__backendId:'dorm-fixture',type:'dorm',state:'open',manual_reopen_override:'true'});
 const make=role=>apiMiddleware({env:{DB,GATE_PERSISTENCE_ENABLED:'true',AUTH_SECRET:'test-only'},data:{session:{role}},
  request:new Request('https://gate.example/api/records',{method:'PUT',headers:{'Content-Type':'application/json'},body}),
  next:async()=>new Response('bypassed security',{status:209})});
 const admin=await make('admin');
 assert.equal(admin.status,503);assert.equal((await admin.json()).code,'admin_writes_disabled');
 const instructor=await make('instructor');
 assert.equal(instructor.status,409);assert.equal((await instructor.json()).code,'lifecycle_required');
});
