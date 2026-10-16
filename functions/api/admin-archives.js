// Admin-only reversible archive dispositions. Does not UPDATE or DELETE historical snapshots.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const admin=data=>data?.session?.role==='admin';
const token=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(value);
async function ready(env){
  if(!env?.DB)return false;
  const rows=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','trigger') AND name IN ('gate_admin_archive_dispositions','trg_gate_admin_dispositions_no_update','trg_gate_admin_dispositions_no_delete')").all();
  const names=new Set((rows.results||[]).map(row=>row.name));
  return ['gate_admin_archive_dispositions','trg_gate_admin_dispositions_no_update','trg_gate_admin_dispositions_no_delete'].every(name=>names.has(name));
}
async function latest(env,id){
  return env.DB.prepare('SELECT revision,action,operation_id FROM gate_admin_archive_dispositions WHERE archive_id=? ORDER BY revision DESC LIMIT 1').bind(id).first();
}
export async function onRequestGet({env,data,request}){
  if(!admin(data))return json({isOk:false,code:'forbidden'},403);
  try{
    if(!(await ready(env)))return json({isOk:false,code:'admin_schema_required'},503);
    const id=new URL(request.url).searchParams.get('archive_id');
    if(id){
      if(!token(id))return json({isOk:false,code:'validation'},400);
      const rows=await env.DB.prepare('SELECT operation_id,archive_id,revision,action,reason,actor_role,occurred_at FROM gate_admin_archive_dispositions WHERE archive_id=? ORDER BY revision DESC LIMIT 100').bind(id).all();
      return json({isOk:true,dispositions:rows.results||[],revision:rows.results?.[0]?.revision||0});
    }
    const rows=await env.DB.prepare('SELECT operation_id,archive_id,revision,action,reason,actor_role,occurred_at FROM gate_admin_archive_dispositions ORDER BY occurred_at DESC LIMIT 200').all();
    return json({isOk:true,dispositions:rows.results||[]});
  }catch{return json({isOk:false,code:'admin_dispositions_unavailable'},503);}
}
export async function onRequestPost({request,env,data}){
  if(!admin(data))return json({isOk:false,code:'forbidden'},403);
  if(env?.GATE_ADMIN_WRITES_ENABLED!=='true')return json({isOk:false,code:'admin_writes_disabled'},503);
  if(request.headers.get('Origin')!==new URL(request.url).origin)return json({isOk:false,code:'origin_required'},403);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))return json({isOk:false,code:'content_type'},415);
  if(Date.now()-Number(data.session.iat)>5*60*1000)return json({isOk:false,code:'reauthentication_required'},403);
  let input;
  try{const raw=await request.text();if(raw.length>4096)throw Error();input=JSON.parse(raw);}catch{return json({isOk:false,code:'invalid_payload'},400);}
  const {archiveId,action,reason,expectedRevision,operationId,confirmArchiveId}=input||{};
  if(!token(archiveId)||!token(operationId)||confirmArchiveId!==archiveId||!['withdraw','restore'].includes(action)||
    !Number.isSafeInteger(expectedRevision)||expectedRevision<0||typeof reason!=='string'||reason.trim().length<10||reason.trim().length>1000)
    return json({isOk:false,code:'validation',error:'A valid archive, reason, revision, operation and exact confirmation are required.'},400);
  try{
    if(!(await ready(env)))return json({isOk:false,code:'admin_schema_required'},503);
    const priorOp=await env.DB.prepare('SELECT operation_id,archive_id,revision,action FROM gate_admin_archive_dispositions WHERE operation_id=?').bind(operationId).first();
    if(priorOp)return priorOp.archive_id===archiveId&&priorOp.action===action?json({isOk:true,idempotent:true,operationId,revision:priorOp.revision}):json({isOk:false,code:'operation_conflict'},409);
    const row=await env.DB.prepare("SELECT id FROM records WHERE id=? AND type='archive'").bind(archiveId).first();
    if(!row)return json({isOk:false,code:'archive_not_found'},404);
    const current=await latest(env,archiveId);
    const rev=Number(current?.revision||0);
    if(rev!==expectedRevision)return json({isOk:false,code:'revision_conflict',revision:rev},409);
    if((action==='withdraw'&&current?.action==='withdraw')||(action==='restore'&&current?.action!=='withdraw'))
      return json({isOk:false,code:'invalid_transition'},409);
    const cycle=await env.DB.prepare('SELECT cycle_id,state FROM gate_week_groups WHERE archive_id=? LIMIT 1').bind(archiveId).first();
    if(cycle&&cycle.state!=='closed')return json({isOk:false,code:'active_cycle'},409);
    const timestamp=new Date().toISOString(),auditId=crypto.randomUUID();
    const auditType=action==='withdraw'?'archive_withdrawn':'archive_restored';
    const metadata=JSON.stringify({operation_id:operationId,disposition_revision:rev+1});
    const statements=[
      env.DB.prepare("INSERT INTO gate_admin_archive_dispositions(operation_id,archive_id,revision,action,reason,actor_role,occurred_at) SELECT ?,?,?,?,?,'admin',? WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND type='archive') AND COALESCE((SELECT MAX(revision) FROM gate_admin_archive_dispositions WHERE archive_id=?),0)=? AND NOT EXISTS(SELECT 1 FROM gate_week_groups WHERE archive_id=? AND state<>'closed')")
        .bind(operationId,archiveId,rev+1,action,reason.trim(),timestamp,archiveId,archiveId,rev,archiveId),
      env.DB.prepare("INSERT INTO gate_audit_events(event_id,cycle_id,entity_type,entity_id,event_type,actor_role,prior_version,resulting_version,metadata_json,occurred_at) SELECT ?,?,'archive',? ,?,'admin',?,?,?,? WHERE EXISTS(SELECT 1 FROM gate_admin_archive_dispositions WHERE operation_id=?)")
        .bind(auditId,cycle?.cycle_id||null,archiveId,auditType,rev,rev+1,metadata,timestamp,operationId)
    ];
    const results=await env.DB.batch(statements);
    if(Number(results?.[0]?.meta?.changes)!==1||Number(results?.[1]?.meta?.changes)!==1)
      return json({isOk:false,code:'revision_conflict',error:'Archive state changed; refresh before retrying.'},409);
    return json({isOk:true,operationId,revision:rev+1,action});
  }catch{return json({isOk:false,code:'admin_command_not_committed',error:'Operation was not confirmed; refresh authoritative state.'},503);}
}
