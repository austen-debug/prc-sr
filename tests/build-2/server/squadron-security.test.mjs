import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {issueSession,verifyRequestSession} from '../../../functions/api/session-contract.mjs';
import {onRequestPost as login} from '../../../functions/api/login.js';
import {onRequest as guard} from '../../../functions/_middleware.js';
import {onRequestGet as board} from '../../../functions/api/squadron-board.js';
import {projectSquadronBoard} from '../../../functions/api/squadron-board-contract.mjs';

const env={AUTH_SECRET:'test-only-long-32-character-signing-secret-for-ci-2026',
  MTI_USERNAME:'mti',MTI_PASSWORD:'mti-test-pass',AIRMAN_USERNAME:'airman',AIRMAN_PASSWORD:'airman-test-pass',
  SQUADRON_USERNAME:'squadron_access',SQUADRON_PASSWORD:'squadron-test-pass'};
const url=path=>`https://gate.example${path}`;
async function cookie(role='squadron') {return `prc_sr_session=${await issueSession('test-user',role,env)}`;}
async function route(path,method='GET',role='squadron',other={}) {
  const request=new Request(url(path),{method,headers:{Cookie:await cookie(role)}});
  const context={request,env:{...env,...other},data:{},next:()=>new Response('APP CONTENT',{status:200})};
  return guard(context);
}
const stamp='2026-09-21T08:00:00Z';
const fixtureRows=[
  {type:'bus',week_group:'WG26050',bus_id:'A',bus_type:'airport',status:'arrived',otw_count:40,departed_at:'2026-09-21T07:30:00Z',arrived_at:'2026-09-21T07:58:00Z',notes:'PRIVATE',assigned_airman:'PRIVATE'},
  {type:'bus',week_group:'WG26050',bus_id:'B',bus_type:'airport',status:'otw',otw_count:45,departed_at:'2026-09-21T07:31:00Z',notes:'PRIVATE'},
  {type:'bus',week_group:'WG26050',bus_id:'C',bus_type:'local',status:'otw',otw_count:4,departed_at:'2026-09-21T07:32:00Z'},
  {type:'dorm',week_group:'WG26050',sdq:'321 TRS',dorm_name:'A1',state:'open',phase:'Processing',current_load:30,max_load:50,opened_at:'2026-09-21T07:00:00Z',assigned_airman:'PRIVATE',auditorium_location:'PRIVATE',notes:'PRIVATE'},
  {type:'dorm',week_group:'WG26050',sdq:'322 TRS',dorm_name:'A2',state:'closed',current_load:35,max_load:40,sex:'female'},
  {type:'dorm',week_group:'WG26051',sdq:'OLD',dorm_name:'SECRET',state:'empty',max_load:999,notes:'OLD SECRET'},
  {type:'archive',week_group:'WG26050',notes:'ARCHIVE SECRET'}
];
function fakeDatabase({weekGroup='WG26050',rows=fixtureRows}={}) {
  let queries=0;
  return {get count(){return queries;},prepare(sql){
    let bound='';
    return {bind(value){bound=value;return this;},async all(){
      queries++;
      if(sql.includes("type='config'"))return {results:[
        {data:JSON.stringify({key:'week_group',value:weekGroup})},
        {data:JSON.stringify({key:'last_airport',value:'23:15'})}
      ]};
      if(sql.includes("type IN ('bus','dorm')"))return {results:rows
        .filter(row=>['bus','dorm'].includes(row.type)&&row.week_group===bound)
        .map(row=>({type:row.type,week_group:row.week_group,data:JSON.stringify(row),updated_at:stamp}))};
      throw new Error('Unexpected database query');
    }};
  }};
}

test('missing or weak signing secret fails closed and cannot issue or verify sessions',async()=>{
  const req=new Request(url('/api/login'),{method:'POST',body:JSON.stringify({username:env.SQUADRON_USERNAME,password:env.SQUADRON_PASSWORD})});
  assert.equal((await login({request:req,env:{...env,AUTH_SECRET:undefined}})).status,503);
  assert.equal((await login({request:req,env:{...env,AUTH_SECRET:'weak'}})).status,503);
  assert.equal(await verifyRequestSession(new Request(url('/'),{headers:{Cookie:await cookie()}}),{AUTH_SECRET:'weak'}),null);
  assert.equal((await route('/api/records','GET','squadron',{AUTH_SECRET:'weak'})).status,503);
  const token=await issueSession('tester','squadron',env);
  assert.equal((await verifyRequestSession(new Request(url('/'),{headers:{Cookie:`prc_sr_session=${token.slice(0,-1)}x`}}),env)),null);
});

test('Squadron login uses only server-side variables and cannot inherit another role',async()=>{
  const req=(username,password)=>new Request(url('/api/login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
  const good=await login({request:req(env.SQUADRON_USERNAME,env.SQUADRON_PASSWORD),env});
  assert.equal(good.status,200);
  const body=await good.json();
  assert.equal(body.role,'squadron');
  assert.equal(body.redirect,'/squadron/');
  const session=await verifyRequestSession(new Request(url('/'),{headers:{Cookie:good.headers.get('Set-Cookie')}}),env);
  assert.equal(session.role,'squadron');
  assert.equal((await login({request:req(env.SQUADRON_USERNAME,'wrong'),env})).status,401);
  assert.equal((await login({request:req(env.SQUADRON_USERNAME,env.SQUADRON_PASSWORD),env:{...env,MTI_USERNAME:env.SQUADRON_USERNAME,MTI_PASSWORD:env.SQUADRON_PASSWORD}})).status,401);
  assert.equal((await login({request:req(env.SQUADRON_USERNAME,env.SQUADRON_PASSWORD),env:{...env,SQUADRON_PASSWORD:''}})).status,401);
});

test('Squadron direct requests cannot reach any other page, API or mutation',async()=>{
  for(const path of ['/','/index.html','/board','/input','/processing','/archive','/api/records','/api/persistence','/api/archive-delete','/api/sat-arrivals']){
    const response=await route(path);
    if(path.startsWith('/api/'))assert.equal(response.status,403,path);
    else {assert.equal(response.status,302,path);assert.equal(new URL(response.headers.get('location')).pathname,'/squadron/');}
  }
  for(const method of ['POST','PUT','PATCH','DELETE']){
    for(const path of ['/api/records','/api/persistence','/api/archive-delete','/api/squadron-board','/squadron/']){
      const response=await route(path,method);
      assert.equal(response.status,403,`${method} ${path}`);
    }
  }
  for(const path of ['/squadron/','/api/squadron-board','/api/session'])assert.equal((await route(path)).status,200,path);
  assert.equal((await route('/api/logout','POST')).status,200);
  assert.equal((await route('/squadron/','GET','airman')).status,403);
  assert.equal((await route('/api/squadron-board','GET','airman')).status,200); // Root lets API verify and deny the role.
  const anonymous=await guard({request:new Request(url('/api/records')),env,data:{},next:()=>new Response('UNSAFE')});
  assert.equal(anonymous.status,401);
});

test('Squadron board endpoint denies unauthorized roles before any database query',async()=>{
  const DB=fakeDatabase();
  const req=async role=>new Request(url('/api/squadron-board'),{headers:{Cookie:await cookie(role)}});
  assert.equal((await board({request:await req('airman'),env:{...env,DB}})).status,403);
  assert.equal(DB.count,0);
  assert.equal((await board({request:new Request(url('/api/squadron-board')),env:{...env,DB}})).status,401);
  assert.equal(DB.count,0);
  assert.equal((await board({request:await req('squadron'),env:{...env,DB}})).status,200);
  assert.equal(DB.count,2);
});

test('Squadron projection includes only approved current-cycle fields, accurate totals and no archive or staff details',async()=>{
  const DB=fakeDatabase();
  const request=new Request(url('/api/squadron-board'),{headers:{Cookie:await cookie()}});
  const response=await board({request,env:{...env,DB}});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  const body=await response.json();
  assert.equal(body.week_group,'WG26050');
  assert.equal(body.metrics.arrived,40);
  assert.equal(body.metrics.expected,90);
  assert.equal(body.metrics.final_airport_arrival,'23:15');
  assert.equal(body.active_buses.length,2);
  assert.equal(body.dorms.length,2);
  assert.equal(body.dorms[0].phase,'Processing');
  const serialized=JSON.stringify(body);
  for(const forbidden of ['PRIVATE','SECRET','assigned_airman','assigned_staff','auditorium_location','notes','archive','audit','source_records_json'])assert.ok(!serialized.includes(forbidden),forbidden);
});

test('rolling traffic thresholds ignore local buses; untrusted times do not create false Slow',()=>{
  const now=Date.parse('2026-09-21T08:00:00Z');
  const airportBus=(bus_id,departed_at)=>({type:'bus',bus_id,bus_type:'airport',week_group:'WG26050',status:'otw',otw_count:20,departed_at});
  const local=airportBus('LOCAL','2026-09-21T07:45:00Z');local.bus_type='local';
  const old=airportBus('OLD','2026-09-21T06:59:59Z');
  const busIds=['A','B','C'].map((id,i)=>airportBus(id,`2026-09-21T07:${String(30+i).padStart(2,'0')}:00Z`));
  const p=buses=>projectSquadronBoard({weekGroup:'WG26050',buses,nowMs:now});
  assert.equal(p([old,local]).traffic.level,'slow');
  assert.equal(p([busIds[0],local]).traffic.dispatched_last_hour,1);
  assert.equal(p([busIds[0],busIds[1],local]).traffic.level,'medium');
  assert.equal(p([...busIds,local]).traffic.level,'heavy');
  assert.equal(p([airportBus('UNKNOWN',''),local]).traffic.level,'unavailable');
  assert.equal(p([airportBus('FUTURE','2099-01-01T00:00:00Z')]).traffic.level,'unavailable');
});

test('standalone display provides accessible tooltips, two-by-two phone metrics and change-only refresh',()=>{
  const html=readFileSync(new URL('../../../public/squadron/index.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../../../public/css/gate-squadron-board.css',import.meta.url),'utf8');
  const js=readFileSync(new URL('../../../public/js/gate-squadron-board.js',import.meta.url),'utf8');
  assert.match(html,/Trainees that have arrived to the Pfingston Reception Center from the Airport/);
  assert.equal((html.match(/class="metric"/g)||[]).length,4);
  assert.equal((html.match(/class="dorm-column"/g)||[]).length,3);
  assert.match(html,/aria-describedby="tip-traffic"/);
  assert.match(html,/role="tooltip"/);
  assert.match(css,/@media\(max-width:1050px\)/);
  assert.match(css, /\.metrics\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(js,/if\(signature===lastBuses\) return/);
  assert.match(js,/if\(lastColumns\.get\(state\)===signature\) continue/);
  assert.doesNotMatch(js,/\/api\/records|localStorage|innerHTML\s*=/);
});
