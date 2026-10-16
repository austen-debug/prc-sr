// Administrative per-session device labels with immutable change history.
// A label is a human-entered nickname, never an attested device hostname.
import {sessionDetailsReady} from './session-registry.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
export async function onRequestPost({env,data,request}){
 if(data?.session?.role!=='admin')return json({isOk:false,code:'forbidden'},403);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({isOk:false,code:'origin_required'},403);
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))return json({isOk:false,code:'content_type'},415);
 const age=Date.now()-Number(data.session.iat);
 if(!Number.isFinite(age)||age<0||age>5*60*1000)return json({isOk:false,code:'reauthentication_required',error:'Sign in again before assigning a device label.'},403);
 let body;
 try{const raw=await request.text();if(raw.length>1200)throw Error();body=JSON.parse(raw);}catch{return json({isOk:false,code:'invalid_payload'},400);}
 const id=body?.sessionId, nickname=body?.nickname,reason=String(body?.reason||'').trim();
 if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id)||typeof nickname!=='string'
  ||nickname.length>60||/[^\x20-\x7E]/.test(nickname)||/[<>]/.test(nickname)
  ||nickname!==nickname.trim()||reason.length<10||reason.length>300){
   return json({isOk:false,code:'validation',error:'Select a session, use a printable label up to 60 characters, and enter a 10–300 character reason.'},400);
 }
 try{
  if(!(await sessionDetailsReady(env)))return json({isOk:false,code:'session_details_not_installed'},503);
  const now=Date.now();
  const old=await env.DB.prepare('SELECT device_nickname,expires_at,revoked_at FROM gate_auth_sessions WHERE session_id=?').bind(id).first();
  if(!old)return json({isOk:false,code:'not_found'},404);
  if(old.revoked_at!==null||Number(old.expires_at)<=now)return json({isOk:false,code:'session_inactive'},409);
  if(String(old.device_nickname||'')===nickname)return json({isOk:true,updated:false});
  const statements=[
   env.DB.prepare('UPDATE gate_auth_sessions SET device_nickname=? WHERE session_id=? AND device_nickname=? AND revoked_at IS NULL AND expires_at>?')
    .bind(nickname,id,String(old.device_nickname||''),now),
   env.DB.prepare("SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('invalid-json','$') END"),
   env.DB.prepare("INSERT INTO gate_auth_session_label_events(event_id,session_id,previous_nickname,new_nickname,actor_role,reason,occurred_at) VALUES(?,?,?,?,'admin',?,?)")
    .bind(crypto.randomUUID(),id,String(old.device_nickname||''),nickname,reason,now)
  ];
  const result=await env.DB.batch(statements);
  if(Number(result?.[0]?.meta?.changes)!==1)return json({isOk:false,code:'not_confirmed'},409);
  return json({isOk:true,updated:true});
 }catch{return json({isOk:false,code:'label_update_not_confirmed',error:'Device label update could not be confirmed. Refresh and retry.'},503);}
}
export async function onRequestGet(){return json({isOk:false,code:'method_not_allowed'},405);}
