// Admin-only live Week Group identity correction. No deletes, closeout or reset.
// Preview may be read while operational; mutation requires an audited Site Lock.
import {readSiteLock,siteLockJson} from './site-lock-core.mjs';
import {resolveLiveWeekGroup} from './live-week-group.mjs';

const reply=siteLockJson;
const fail=(code,error,status=409)=>reply({isOk:false,code,error},status);
const TYPES=['dorm','bus','sound_event'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WG=/^[A-Z0-9_-]{1,24}$/;
const fresh=data=>{const age=Date.now()-Number(data?.session?.iat);return Number.isFinite(age)&&age>=0&&age<=300000;};
const assertSql=(env,sql,...args)=>env.DB.prepare(
  "SELECT CASE WHEN ("+sql+") THEN 1 ELSE json_extract('invalid-json','$') END"
).bind(...args);
const getRows=async(env,sql,...args)=>{
  const statement=env.DB.prepare(sql);
  return (await (args.length?statement.bind(...args):statement).all()).results||[];
};
const hex=async(value)=>{
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
};
const safeText=(v)=>typeof v==='string'?v:'';
function inspectReferences(value,old,key='',depth=0){
  if(depth>20)throw Error('Operational data nesting exceeds rename validation.');
  if(typeof value==='string'){
    if(value.includes(old)&&!['week_group','dorm_identity'].includes(key))
      throw Error('Operational data contains an unrecognized embedded Week Group reference.');
  }else if(Array.isArray(value)){
    for(const v of value)inspectReferences(v,old,'',depth+1);
  }else if(value&&typeof value==='object'){
    for(const [k,v] of Object.entries(value))inspectReferences(v,old,k,depth+1);
  }
}
async function preview(env){
  const [configs,cycles,rows,installed]=await Promise.all([
    getRows(env,"SELECT id,type,week_group,data,created_at,updated_at FROM records WHERE type='config' AND json_extract(data,'$.key')='week_group'"),
    getRows(env,"SELECT cycle_id,week_group,state FROM gate_week_groups WHERE state<>'closed'"),
    getRows(env,"SELECT id,type,week_group,data,created_at,updated_at FROM records WHERE type IN ('dorm','bus','sound_event') ORDER BY created_at,id"),
    env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='gate_admin_week_group_renames'").first()
  ]);
  const flags={enabled:env.GATE_ADMIN_WEEK_GROUP_EDIT_ENABLED==='true',
    adminWritesEnabled:env.GATE_ADMIN_WRITES_ENABLED==='true',
    systemControlEnabled:env.GATE_ADMIN_SYSTEM_CONTROL_ENABLED==='true'};
  const lock=await readSiteLock(env);
  const base={isOk:true,installed:!!installed,locked:lock.locked,lock_revision:lock.revision,
    ...flags,week_group:'',initialization_id:'',dorm_count:0,bus_count:0,sound_count:0,source_record_count:0,
    ready:false,reason:'No verified active Week Group.'};
  if(!installed)return {...base,reason:'Additive migration 0013 is not installed.'};
  if(configs.length!==1 || cycles.length)return {...base,reason:'Only one verified active legacy Week Group can be renamed.'};
  const config=configs[0];
  let parsed;
  try {parsed=JSON.parse(config.data);} catch {return {...base,reason:'Active configuration is malformed.'};}
  const old=safeText(parsed.value).trim().toUpperCase();
  const init=safeText(parsed.initialization_request_id);
  if(!WG.test(old)||!UUID.test(init)||rows.length===0||
     rows.some(row=>row.week_group!==old)||!rows.some(row=>row.type==='dorm'))
    return {...base,reason:'Active source records or initialization identity cannot be verified.'};
  const verified=await resolveLiveWeekGroup(env);
  if(verified.status!=='active'||verified.week_group!==old)
    return {...base,reason:'Operational source ownership is not verified; reconcile before renaming.'};
  const summary={...base,week_group:old,initialization_id:init,config,
    rows,dorm_count:rows.filter(r=>r.type==='dorm').length,
    bus_count:rows.filter(r=>r.type==='bus').length,
    sound_count:rows.filter(r=>r.type==='sound_event').length,
    source_record_count:rows.length};
  try {
    const manifest=await env.DB.prepare("SELECT week_group,cycle_id,manifest_json FROM gate_admin_input_manifests WHERE initialization_id=?").bind(init).first();
    if(!manifest||manifest.week_group!==old||manifest.cycle_id!==''||
      JSON.parse(manifest.manifest_json).proposed_week_group!==old)
      throw Error('Original immutable Input manifest does not match the active initialization.');
    const prior=await env.DB.prepare("SELECT operation_id FROM gate_admin_week_group_renames WHERE initialization_id=?").bind(init).first();
    if(prior)throw Error('This initialization has already received an audited rename.');
    const notices=await env.DB.prepare('SELECT COUNT(*) AS n FROM gate_squadron_notices WHERE week_group=?').bind(old).first();
    if(Number(notices?.n)!==0)throw Error('A Squadron notice references this Week Group and needs a separate correction.');
    const mirrors={
      dorm:"gate_v2_dorms",bus:"gate_v2_buses",sound_event:"gate_v2_sound_events"
    };
    for(const type of TYPES){
      const table=mirrors[type];
      const original=rows.filter(r=>r.type===type);
      const mirror=await getRows(env,'SELECT id,week_group,data,created_at,updated_at FROM '+table+' WHERE week_group=?',old);
      if(mirror.length!==original.length)throw Error('Typed mirror count does not match '+type+' source.');
      const index=new Map(mirror.map(r=>[r.id,r]));
      if(original.some(r=>{const m=index.get(r.id);return !m||['week_group','data','created_at','updated_at'].some(k=>m[k]!==r[k]);}))
        throw Error('Typed mirror contents do not match '+type+' source.');
    }
    const triggers=await getRows(env,"SELECT name FROM sqlite_master WHERE type='trigger' AND name IN ('gate_mirror_records_update','gate_record_audit_update','trg_gate_admin_week_group_renames_no_update','trg_gate_admin_week_group_renames_no_delete')");
    if(triggers.length!==4)throw Error('Mirror, audit or immutable rename triggers are missing.');
    for(const row of rows){
      const payload=JSON.parse(row.data);
      if(payload.week_group!==old)throw Error('A source payload Week Group disagrees with the row identifier.');
      if(row.type==='dorm'&&(!safeText(payload.dorm_identity).startsWith(old+'::')||
          payload.initialization_request_id!==init))
        throw Error('Dorm identity or initialization metadata is inconsistent.');
      inspectReferences(payload,old);
    }
    if(new TextEncoder().encode(JSON.stringify([config,...rows])).length>1500000)
      throw Error('Pre-rename evidence exceeds safe D1 record size.');
    summary.snapshot_token=await hex(JSON.stringify([config,...rows]));
    summary.ready=true;summary.reason='Verified current source and typed mirror parity.';
  } catch(error){summary.reason=error.message||'Readiness verification failed.';}
  return summary;
}
const expose=p=>Object.fromEntries(Object.entries(p).filter(([k])=>!['config','rows'].includes(k)));

export async function onRequestGet({env,data}){
  if(data?.session?.role!=='admin')return fail('forbidden','Admin access required.',403);
  try{return reply(expose(await preview(env)));}
  catch{return fail('rename_preview_unavailable','Unable to verify Week Group state.',503);}
}
export async function onRequestPost({request,env,data}){
  if(data?.session?.role!=='admin')return fail('forbidden','Admin access required.',403);
  if(env?.GATE_ADMIN_WEEK_GROUP_EDIT_ENABLED!=='true'||
     env?.GATE_ADMIN_SYSTEM_CONTROL_ENABLED!=='true'||
     env?.GATE_ADMIN_WRITES_ENABLED!=='true')
    return fail('rename_disabled','Admin Week Group editing requires explicit enablement.',503);
  if(!fresh(data))return fail('reauthentication_required','Sign in as Admin again before editing the Week Group.',403);
  if(request.headers.get('Origin')!==new URL(request.url).origin)
    return fail('origin_required','A same-origin action is required.',403);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))
    return fail('content_type','JSON is required.',415);
  let body;
  try {const raw=await request.text();if(raw.length>4096)throw Error();body=JSON.parse(raw);}
  catch{return fail('validation','Invalid request body.',400);}
  const {operationId,expectedWeekGroup,expectedInitializationId,expectedLockRevision,expectedSnapshotToken,confirmation}=body||{};
  const newGroup=safeText(body?.newWeekGroup).trim().toUpperCase(),reason=safeText(body?.reason).trim();
  if(!UUID.test(operationId||'')||!WG.test(newGroup)||!WG.test(expectedWeekGroup||'')||
    !UUID.test(expectedInitializationId||'')||!Number.isSafeInteger(expectedLockRevision)||
    !/^[0-9a-f]{64}$/.test(expectedSnapshotToken||'')||reason.length<10||reason.length>1000||
    newGroup===expectedWeekGroup||confirmation!=='RENAME '+expectedWeekGroup+' TO '+newGroup)
    return fail('validation','Exact current ID, target ID, revision, reason and confirmation required.',400);

  try {
    const prior=await env.DB.prepare('SELECT old_week_group,new_week_group,reason FROM gate_admin_week_group_renames WHERE operation_id=?').bind(operationId).first();
    if(prior)return prior.old_week_group===expectedWeekGroup&&prior.new_week_group===newGroup&&prior.reason===reason
      ?reply({isOk:true,idempotent:true,operationId,week_group:newGroup})
      :fail('operation_conflict','Operation identity was previously used.',409);
    const current=await preview(env);
    if(!current.ready || !current.locked || current.lock_revision!==expectedLockRevision ||
       current.week_group!==expectedWeekGroup||
       current.initialization_id!==expectedInitializationId||
       current.snapshot_token!==expectedSnapshotToken)
      return fail('state_changed','Week Group state, contents or Site Lock changed. Refresh the preview.',409);
    const collision=await getRows(env,"SELECT id FROM records WHERE week_group=? AND type IN ('bus','dorm','sound_event','archive') LIMIT 1",newGroup);
    const cycleCollision=await env.DB.prepare('SELECT cycle_id FROM gate_week_groups WHERE week_group=? LIMIT 1').bind(newGroup).first();
    const noticeCollision=await env.DB.prepare('SELECT id FROM gate_squadron_notices WHERE week_group=? LIMIT 1').bind(newGroup).first();
    if(collision.length||cycleCollision||noticeCollision)
      return fail('target_in_use','Requested Week Group has existing operational or historical references.',409);

    const now=new Date().toISOString(),snapshot=[current.config,...current.rows];
    const sourceJson=JSON.stringify(snapshot);
    const statements=[
      assertSql(env,"EXISTS(SELECT 1 FROM gate_admin_system_control WHERE id=1 AND locked=1 AND revision=?)",expectedLockRevision),
      assertSql(env,"EXISTS(SELECT 1 FROM records WHERE id=? AND type='config' AND week_group IS ? AND data=? AND created_at=? AND updated_at=?)",
        current.config.id,current.config.week_group,current.config.data,current.config.created_at,current.config.updated_at),
      assertSql(env,"(SELECT COUNT(*) FROM records WHERE type IN ('dorm','bus','sound_event'))=? AND NOT EXISTS(SELECT 1 FROM json_each(?) e LEFT JOIN records r ON r.id=json_extract(e.value,'$.id') WHERE r.id IS NULL OR r.type IS NOT json_extract(e.value,'$.type') OR r.week_group IS NOT json_extract(e.value,'$.week_group') OR r.data IS NOT json_extract(e.value,'$.data') OR r.created_at IS NOT json_extract(e.value,'$.created_at') OR r.updated_at IS NOT json_extract(e.value,'$.updated_at'))",
        current.rows.length,JSON.stringify(current.rows)),
      assertSql(env,"NOT EXISTS(SELECT 1 FROM gate_week_groups WHERE state<>'closed') AND NOT EXISTS(SELECT 1 FROM records WHERE type IN ('dorm','bus','sound_event','archive') AND week_group=?)",newGroup),
      assertSql(env,"NOT EXISTS(SELECT 1 FROM gate_admin_week_group_renames WHERE initialization_id=?)",expectedInitializationId),
      env.DB.prepare("INSERT INTO gate_admin_week_group_renames(operation_id,initialization_id,old_week_group,new_week_group,actor_role,reason,snapshot_json,source_record_count,created_at) VALUES(?,?,?,?,'admin',?,?,?,?)")
        .bind(operationId,expectedInitializationId,expectedWeekGroup,newGroup,reason,sourceJson,current.rows.length,now)
    ];
    for(const row of snapshot){
      const d=JSON.parse(row.data);
      const updated={...d,record_version:Math.max(0,Number(d.record_version)||0)+1,
        updated_by_role:'admin',updated_at:now};
      let group=row.week_group;
      if(row.type==='config'){
        updated.value=newGroup;
        updated.week_group_correction_from=expectedWeekGroup;
        updated.week_group_correction_operation_id=operationId;
      }else{
        group=newGroup;
        updated.week_group=newGroup;
        if(row.type==='dorm')updated.dorm_identity=newGroup+d.dorm_identity.slice(expectedWeekGroup.length);
      }
      statements.push(env.DB.prepare("UPDATE records SET week_group=?,data=?,updated_at=? WHERE id=? AND type=? AND week_group IS ? AND data=? AND created_at=? AND updated_at=?")
        .bind(group,JSON.stringify(updated),now,row.id,row.type,row.week_group,row.data,row.created_at,row.updated_at));
      statements.push(assertSql(env,'changes()=1'));
    }
    statements.push(
      env.DB.prepare("INSERT INTO gate_audit_events(event_id,cycle_id,operation_id,entity_type,entity_id,event_type,actor_role,prior_version,resulting_version,metadata_json,occurred_at) VALUES(?,NULL,NULL,'week_group',?,'admin_week_group_renamed','admin',0,1,?,?)")
        .bind(crypto.randomUUID(),newGroup,JSON.stringify({operation_id:operationId,old_week_group:expectedWeekGroup,new_week_group:newGroup,initialization_id:expectedInitializationId,source_record_count:current.rows.length,reason}),now),
      assertSql(env,"(SELECT COUNT(*) FROM records WHERE type IN ('dorm','bus','sound_event') AND week_group=?)=? AND NOT EXISTS(SELECT 1 FROM records WHERE type IN ('dorm','bus','sound_event') AND week_group=?) AND EXISTS(SELECT 1 FROM records WHERE id=? AND json_extract(data,'$.value')=?)",
        newGroup,current.rows.length,expectedWeekGroup,current.config.id,newGroup),
      assertSql(env,"(SELECT COUNT(*) FROM gate_v2_buses WHERE week_group=?)=? AND (SELECT COUNT(*) FROM gate_v2_dorms WHERE week_group=?)=? AND (SELECT COUNT(*) FROM gate_v2_sound_events WHERE week_group=?)=?",
        newGroup,current.bus_count,newGroup,current.dorm_count,newGroup,current.sound_count),
      assertSql(env,"NOT EXISTS(SELECT 1 FROM records r LEFT JOIN gate_v2_buses m ON m.id=r.id WHERE r.type='bus' AND r.week_group=? AND (m.id IS NULL OR m.week_group IS NOT r.week_group OR m.data IS NOT r.data OR m.created_at IS NOT r.created_at OR m.updated_at IS NOT r.updated_at)) AND NOT EXISTS(SELECT 1 FROM records r LEFT JOIN gate_v2_dorms m ON m.id=r.id WHERE r.type='dorm' AND r.week_group=? AND (m.id IS NULL OR m.week_group IS NOT r.week_group OR m.data IS NOT r.data OR m.created_at IS NOT r.created_at OR m.updated_at IS NOT r.updated_at)) AND NOT EXISTS(SELECT 1 FROM records r LEFT JOIN gate_v2_sound_events m ON m.id=r.id WHERE r.type='sound_event' AND r.week_group=? AND (m.id IS NULL OR m.week_group IS NOT r.week_group OR m.data IS NOT r.data OR m.created_at IS NOT r.created_at OR m.updated_at IS NOT r.updated_at))",newGroup,newGroup,newGroup),
      assertSql(env,"EXISTS(SELECT 1 FROM gate_admin_week_group_renames WHERE operation_id=? AND source_record_count=?)",operationId,current.rows.length)
    );
    await env.DB.batch(statements);
    return reply({isOk:true,operationId,old_week_group:expectedWeekGroup,week_group:newGroup,
      dorm_count:current.dorm_count,bus_count:current.bus_count,sound_count:current.sound_count,
      locked:true});
  }catch(error){
    console.error('Admin Week Group identity correction not confirmed:',error?.name||'error');
    return fail('rename_unconfirmed','Rename outcome is unconfirmed. Refresh authoritative state and audit receipt; do not retry blindly.',503);
  }
}
