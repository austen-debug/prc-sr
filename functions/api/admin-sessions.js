// Admin-only session registry inspection and immediate per-session revocation.
// Independent of archive migration and GATE_ADMIN_WRITES_ENABLED.
import {registryReady,sessionDetailsReady} from './session-registry.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
const isAdmin=data=>data?.session?.role==='admin';
export async function onRequestGet({env,data}){
 if(!isAdmin(data))return json({isOk:false,code:'forbidden'},403);
 try{
  if(!(await registryReady(env)))return json({isOk:false,code:'session_registry_not_installed',error:'Install additive migration 0008 before listing devices.'},503);
  const now=Date.now();
  const extended=await sessionDetailsReady(env);
  const columns='session_id,role,device_label,browser_label,issued_at,expires_at,last_seen_at'
   +(extended?',os_label,browser_version,city,region,country,network_organization,device_nickname':'');
  const [active,history,labels]=await Promise.all([
   env.DB.prepare('SELECT '+columns+' FROM gate_auth_sessions WHERE revoked_at IS NULL AND expires_at>? ORDER BY last_seen_at DESC LIMIT 200').bind(now).all(),
   env.DB.prepare('SELECT session_id,event_type,target_role,actor_role,reason,occurred_at FROM gate_auth_session_events ORDER BY occurred_at DESC LIMIT 60').all(),
   extended?env.DB.prepare('SELECT session_id,actor_role,reason,occurred_at FROM gate_auth_session_label_events ORDER BY occurred_at DESC LIMIT 60').all():Promise.resolve({results:[]})
  ]);
  return json({isOk:true,registryReady:true,sessions:(active.results||[]).map(r=>({
   id:r.session_id,role:r.role,device:r.device_label,browser:r.browser_label,
   issuedAt:Number(r.issued_at),expiresAt:Number(r.expires_at),lastSeenAt:Number(r.last_seen_at),
   current:r.session_id===data.session.sid,
   recentlyActive:Number(r.last_seen_at)>now-5*60*1000,
   os:r.os_label||'',browserVersion:r.browser_version||'',
   city:r.city||'',region:r.region||'',country:r.country||'',
   organization:r.network_organization||'',nickname:r.device_nickname||''
  })),sessionDetailsReady:extended,
   events:[...(history.results||[]).map(e=>({id:e.session_id,action:e.event_type,role:e.target_role,by:e.actor_role,reason:e.reason,at:Number(e.occurred_at)})),
    ...(labels.results||[]).map(e=>({id:e.session_id,action:'device_label',role:'admin',by:e.actor_role,reason:e.reason,at:Number(e.occurred_at)}))]
    .sort((a,b)=>b.at-a.at).slice(0,60),
   legacyNotice:'Only sessions created after registry installation can be listed or individually revoked; earlier signed cookies expire naturally.'});
 }catch{return json({isOk:false,code:'session_registry_unavailable'},503);}
}
export async function onRequestPost({env,data,request}){
 if(!isAdmin(data))return json({isOk:false,code:'forbidden'},403);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({isOk:false,code:'origin_required'},403);
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))return json({isOk:false,code:'content_type'},415);
 const age=Date.now()-Number(data?.session?.iat);
 if(!Number.isFinite(age)||age<0||age>5*60*1000)return json({isOk:false,code:'reauthentication_required',error:'Sign in again before revoking a session.'},403);
 let body;
 try{const raw=await request.text();if(raw.length>2048)throw Error();body=JSON.parse(raw);}catch{return json({isOk:false,code:'invalid_payload'},400);}
 const id=body?.sessionId, reason=String(body?.reason||'').trim();
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id)||reason.length<10||reason.length>300||body?.confirmSessionId!==id)
  return json({isOk:false,code:'validation',error:'Exact session confirmation and a reason of 10–300 characters are required.'},400);
 if(id===data.session.sid)return json({isOk:false,code:'current_session',error:'Use Sign Out to end your own Admin session.'},409);
 try{
  if(!(await registryReady(env)))return json({isOk:false,code:'session_registry_not_installed'},503);
  const now=Date.now(),target=await env.DB.prepare('SELECT role,revoked_at,expires_at FROM gate_auth_sessions WHERE session_id=?').bind(id).first();
  if(!target)return json({isOk:false,code:'not_found'},404);
  if(target.revoked_at!==null||Number(target.expires_at)<=now)return json({isOk:false,code:'already_inactive'},409);
  const statements=[
   env.DB.prepare('UPDATE gate_auth_sessions SET revoked_at=?,revoked_by_role=?,revoke_reason=? WHERE session_id=? AND revoked_at IS NULL AND expires_at>?')
    .bind(now,'admin',reason,id,now),
   env.DB.prepare("SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('invalid-json','$') END"),
   env.DB.prepare("INSERT INTO gate_auth_session_events(event_id,session_id,event_type,target_role,actor_role,reason,occurred_at) VALUES(?,?,'revoke',?,'admin',?,?)")
    .bind(crypto.randomUUID(),id,target.role,reason,now)
  ];
  const result=await env.DB.batch(statements);
  if(Number(result?.[0]?.meta?.changes)!==1)return json({isOk:false,code:'not_confirmed'},409);
  return json({isOk:true,revokedSessionId:id});
 }catch{return json({isOk:false,code:'revocation_not_confirmed',error:'Session revocation was not confirmed. Refresh before retrying.'},503);}
}
