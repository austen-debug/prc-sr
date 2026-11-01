import { readSiteLock, siteLockJson } from './site-lock-core.mjs';

const response=siteLockJson;
const gate=()=>response({isOk:false,code:'admin_system_control_disabled',error:'Admin system controls require reviewed migration 0012 and explicit enablement.'},503);
const fail=(code,error,status=409)=>response({isOk:false,code,error},status);
const assertion=(env,condition,...args)=>env.DB.prepare(
  'SELECT CASE WHEN ('+condition+") THEN 1 ELSE json_extract('invalid-json','$') END"
).bind(...args);

const fresh=data=>{
  const age=Date.now()-Number(data?.session?.iat);
  return Number.isFinite(age)&&age>=0&&age<=5*60*1000;
};
const validId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)&&id.length<=64;
const unlockedOrLocked=x=>x===true||x===false;

export async function onRequestGet({env,data}) {
  if(data?.session?.role!=='admin')return fail('forbidden','Admin access required.',403);
  try{
    const lock=await readSiteLock(env);
    const history=lock.installed ? (await env.DB.prepare(
      "SELECT operation_id,action,actor_role,reason,revision_before,revision_after,created_at FROM gate_admin_system_events WHERE action IN ('lock','unlock') ORDER BY created_at DESC LIMIT 20"
    ).all()).results||[] : [];
    return response({isOk:true,site_lock:lock,history,systemControlEnabled:env?.GATE_ADMIN_SYSTEM_CONTROL_ENABLED==='true'});
  }catch{return fail('system_control_unavailable','Admin system state could not be verified.',503);}
}

export async function onRequestPost({request,env,data}) {
  if(data?.session?.role!=='admin')return fail('forbidden','Admin access required.',403);
  if(env?.GATE_ADMIN_SYSTEM_CONTROL_ENABLED!=='true')return gate();
  if(!fresh(data))return fail('reauthentication_required','Sign in as Admin again before changing Site Lock.',403);
  if(request.headers.get('Origin')!==new URL(request.url).origin)
    return fail('origin_required','A same-origin action is required.',403);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))
    return fail('content_type','JSON is required.',415);
  let payload;
  try {const raw=await request.text();if(raw.length>4096)throw Error();payload=JSON.parse(raw);}
  catch{return fail('validation','Invalid request body.',400);}
  const {action,operationId,expectedRevision,reason,confirmation}=payload||{};
  const text=typeof reason==='string'?reason.trim():'';
  if(!['lock','unlock'].includes(action)||!validId(operationId)||
    !Number.isSafeInteger(expectedRevision)||expectedRevision<0||
    text.length<10||text.length>1000||
    confirmation!==(action==='lock'?'LOCK SITE':'UNLOCK SITE'))
    return fail('validation','Operation, revision, reason, and exact confirmation are required.',400);

  try {
    const state=await readSiteLock(env);
    if(!state.installed)return gate();
    const prior=await env.DB.prepare(
      'SELECT action,reason,revision_after FROM gate_admin_system_events WHERE operation_id=?'
    ).bind(operationId).first();
    if(prior)return prior.action===action&&prior.reason===text
      ?response({isOk:true,idempotent:true,operationId,revision:prior.revision_after,locked:action==='lock'})
      :fail('operation_conflict','Operation ID was already used.',409);
    const destination=action==='lock';
    if(state.revision!==expectedRevision || state.locked===destination)
      return fail('revision_conflict','Site Lock changed. Refresh before proceeding.',409);

    const next=state.revision+1,now=new Date().toISOString();
    await env.DB.batch([
      assertion(env,'EXISTS(SELECT 1 FROM gate_admin_system_control WHERE id=1 AND locked=? AND revision=?)',
        destination?0:1,expectedRevision),
      env.DB.prepare("UPDATE gate_admin_system_control SET locked=?,revision=revision+1,reason=?,updated_at=?,updated_by_role='admin' WHERE id=1 AND locked=? AND revision=?")
        .bind(destination?1:0,text,now,destination?0:1,expectedRevision),
      assertion(env,'changes()=1'),
      env.DB.prepare("INSERT INTO gate_admin_system_events(operation_id,action,actor_role,reason,revision_before,revision_after,created_at) VALUES(?,?,'admin',?,?,?,?)")
        .bind(operationId,action,text,expectedRevision,next,now),
      assertion(env,'EXISTS(SELECT 1 FROM gate_admin_system_control WHERE id=1 AND locked=? AND revision=?)',
        destination?1:0,next)
    ]);
    return response({isOk:true,operationId,revision:next,locked:destination});
  } catch {
    return fail('operation_unconfirmed','Site Lock write was not confirmed. Refresh status before retrying.',503);
  }
}
