import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {onRequestPost as login} from '../../../functions/api/login.js';
import {onRequestPost as logout} from '../../../functions/api/logout.js';
import {verifyRequestSession} from '../../../functions/api/session-contract.mjs';
import {onRequestGet as listSessions,onRequestPost as revokeSession} from '../../../functions/api/admin-sessions.js';
import {onRequestGet as diagnostics} from '../../../functions/api/admin-diagnostics.js';
import {onRequestPost as clientDiagnostic} from '../../../functions/api/client-diagnostics.js';
import {onRequest as middleware} from '../../../functions/api/_middleware.js';
const load=name=>readFileSync(new URL('../../../migrations/'+name,import.meta.url),'utf8');
function fixture({registry=true,issues=true}={}){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON;CREATE TABLE records(id TEXT PRIMARY KEY,type TEXT NOT NULL,week_group TEXT,data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);');
 if(registry)db.exec(load('0008_gate_live_session_registry.sql'));
 if(issues)db.exec(load('0009_gate_diagnostic_events.sql'));
 function prepare(sql){const statement=db.prepare(sql);let args=[];return{
  bind(...values){args=values;return this;},
  async first(){return statement.get(...args)||null;},
  async all(){return{results:statement.all(...args)};},
  async run(){if(statement.columns().length)return{results:statement.all(...args),meta:{changes:0}};const r=statement.run(...args);return{meta:{changes:r.changes}};}
 }}
 const DB={prepare,async batch(stmts){db.exec('BEGIN');try{const results=[];for(const s of stmts)results.push(await s.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}};
 return {db,DB};
}
const credentials={AUTH_SECRET:'integration-secret',ADMIN_USERNAME:'admin-fixture',ADMIN_PASSWORD:'test-admin',
 MTI_USERNAME:'mti-fixture',MTI_PASSWORD:'test-instructor',AIRMAN_USERNAME:'airman-fixture',
 AIRMAN_PASSWORD:'test-airman',SQUADRON_USERNAME:'squad-fixture',SQUADRON_PASSWORD:'test-squad'};
async function authenticate(env,username,password,ua='Mozilla/5.0 (Macintosh) AppleWebKit/605.1 Safari/605.1'){
 const result=await login({env,request:new Request('https://gate.example/api/login',{method:'POST',
  headers:{'Content-Type':'application/json','User-Agent':ua},body:JSON.stringify({username,password})})});
 assert.equal(result.status,200,JSON.stringify(await result.clone().json()));
 const cookie=result.headers.get('Set-Cookie').split(';')[0];
 const session=await verifyRequestSession(new Request('https://gate.example/api/session',{headers:{Cookie:cookie}}),env);
 assert.ok(session);
 return {cookie,session};
}
test('tracked sessions authenticate independently from archive migration 0007 and identify device class',async()=>{
 const {db,DB}=fixture(),env={...credentials,DB};
 const admin=await authenticate(env,'admin-fixture','test-admin');
 const airman=await authenticate(env,'airman-fixture','test-airman','Mozilla/5.0 (iPhone) AppleWebKit/605.1 Mobile Safari/604.1');
 assert.ok(admin.session.sid);assert.ok(airman.session.sid);
 const result=await listSessions({env,data:{session:admin.session}});
 assert.equal(result.status,200);
 const body=await result.json();
 assert.equal(body.sessions.length,2);
 assert.equal(body.sessions.find(s=>s.id===admin.session.sid).current,true);
 const second=body.sessions.find(s=>s.id===airman.session.sid);
 assert.equal(second.device,'Phone');
 assert.equal(second.role,'airman');
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM gate_auth_session_events WHERE event_type='login'").get().n,2);
 const denied=await listSessions({env,data:{session:airman.session}});
 assert.equal(denied.status,403);
});
test('Admin can revoke another verified session; later requests are denied, with append-only evidence',async()=>{
 const {db,DB}=fixture(),env={...credentials,DB};
 const admin=await authenticate(env,'admin-fixture','test-admin'),instructor=await authenticate(env,'mti-fixture','test-instructor');
 const makeReq=(confirmed,reason,role=admin.session,origin='https://gate.example')=>revokeSession({
  env,data:{session:role},request:new Request('https://gate.example/api/admin-sessions',{method:'POST',
   headers:{Origin:origin,'Content-Type':'application/json'},
   body:JSON.stringify({sessionId:instructor.session.sid,confirmSessionId:confirmed,reason})})
 });
 assert.equal((await makeReq(instructor.session.sid,'Administrative access rotation',instructor.session)).status,403);
 assert.equal((await makeReq('incorrect','Administrative access rotation')).status,400);
 assert.equal((await makeReq(instructor.session.sid,'Administrative access rotation',admin.session,'https://evil.example')).status,403);
 const valid=await makeReq(instructor.session.sid,'Administrative access rotation');
 assert.equal(valid.status,200,JSON.stringify(await valid.clone().json()));
 assert.equal(await verifyRequestSession(new Request('https://gate.example/api/session',{headers:{Cookie:instructor.cookie}}),env),null);
 assert.equal((await makeReq(instructor.session.sid,'Administrative access rotation')).status,409);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM gate_auth_session_events WHERE event_type='revoke'").get().n,1);
 assert.throws(()=>db.prepare("DELETE FROM gate_auth_session_events").run(),/append-only/);
 assert.ok(await verifyRequestSession(new Request('https://gate.example/api/session',{headers:{Cookie:admin.cookie}}),env));
});
test('legacy sessions remain valid until expiry; new tracked sessions fail closed if registry disappears',async()=>{
 const legacyFixture=fixture({registry:false}),env={...credentials,DB:legacyFixture.DB};
 const legacy=await authenticate(env,'mti-fixture','test-instructor');
 assert.equal(legacy.session.sid,null);
 legacyFixture.db.exec(load('0008_gate_live_session_registry.sql'));
 const tracked=await authenticate(env,'airman-fixture','test-airman');
 assert.ok(tracked.session.sid);
 legacyFixture.db.exec('DROP TABLE gate_auth_sessions;');
 assert.equal(await verifyRequestSession(new Request('https://gate.example/api/session',{headers:{Cookie:tracked.cookie}}),env),null);
 const old=await verifyRequestSession(new Request('https://gate.example/api/session',{headers:{Cookie:legacy.cookie}}),env);
 assert.equal(old.role,'instructor');
});
test('explicit logout ends a tracked session and clears its cookie',async()=>{
 const {DB}=fixture(),env={...credentials,DB},airman=await authenticate(env,'airman-fixture','test-airman');
 const result=await logout({request:new Request('https://gate.example/api/logout',{method:'POST',headers:{Cookie:airman.cookie}}),env});
 assert.equal(result.status,200);
 assert.match(result.headers.get('Set-Cookie'),/Max-Age=0/);
 assert.equal(await verifyRequestSession(new Request('https://gate.example/api/session',{headers:{Cookie:airman.cookie}}),env),null);
});
test('diagnostic event storage omits sensitive content, enforces role, and reports server errors',async()=>{
 const {db,DB}=fixture(),env={...credentials,DB,GATE_TEST_DEBUG:'true'};
 const good={env,data:{session:{role:'airman'}},request:new Request('https://gate.example/api/client-diagnostics',{method:'POST',
  headers:{Origin:'https://gate.example','Content-Type':'application/json'},
  body:JSON.stringify({category:'runtime',code:'UNCAUGHT_SCRIPT_ERROR',route:'/processing/',status:0,
   message:'SECRET_TEST_PERSONAL_DATA'})})};
 assert.equal((await clientDiagnostic(good)).status,200);
 const wrong=await clientDiagnostic({...good,data:{session:{role:'squadron'}},
  request:new Request('https://gate.example/api/client-diagnostics',{method:'POST',
   headers:{Origin:'https://evil.example','Content-Type':'application/json'},
   body:JSON.stringify({category:'runtime',code:'UNCAUGHT_SCRIPT_ERROR',route:'/processing/'})})});
 assert.equal(wrong.status,403);
 const result=await middleware({env,data:{session:{role:'instructor'}},
  request:new Request('https://gate.example/api/records',{method:'GET'}),
  next:async()=>new Response('Unavailable',{status:503})});
 assert.equal(result.status,503);
 const recent=await diagnostics({env,data:{session:{role:'admin'}}});
 const body=await recent.json();
 assert.equal(body.isOk,true);
 assert.equal(body.events.length,2);
 assert.equal(body.events.some(e=>e.code==='API_HTTP_503'),true);
 assert.equal(JSON.stringify(body).includes('SECRET_TEST_PERSONAL_DATA'),false);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM gate_diagnostic_events').get().n,2);
 assert.equal((await diagnostics({env,data:{session:{role:'instructor'}}})).status,403);
});
test('Admin session revocation and client diagnostics are independent of Admin archive-write flag',async()=>{
 const {DB}=fixture(),env={...credentials,DB};
 for(const path of ['/api/admin-sessions','/api/client-diagnostics']){
  const res=await middleware({env,data:{session:{role:'admin'}},
   request:new Request('https://gate.example'+path,{method:'POST',headers:{Origin:'https://gate.example','Content-Type':'application/json'},body:'{}'}),
   next:async()=>new Response('route handler reached',{status:209})});
  assert.equal(res.status,209,path);
 }
 const operational=await middleware({env,data:{session:{role:'admin'}},
  request:new Request('https://gate.example/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"type":"bus"}'}),
  next:async()=>new Response('should be blocked',{status:209})});
 assert.equal(operational.status,503);
});
test('Admin page exposes both session management and issue investigation',()=>{
 const source=readFileSync(new URL('../../../public/administration/index.html',import.meta.url),'utf8');
 for(const id of ['panel-sessions','session-revoke','session-list','panel-issues','issue-dialog','issue-details'])
  assert.match(source,new RegExp(id));
});
