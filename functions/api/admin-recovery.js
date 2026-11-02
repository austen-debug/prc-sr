import { readSiteLock, siteLockJson } from './site-lock-core.mjs';
import { cutoverRequested, normalizeDraft, buildDormRows, buildArchivePayload, parseOperationalRow } from './persistence-core.mjs';

const reply=siteLockJson;
const fail=(code,message,status=409)=>reply({isOk:false,code,error:message},status);
const uuid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const WINDOWS=['receiving_day_one_start','receiving_day_one_end','receiving_day_two_start','receiving_day_two_end'];
const sourceTypes=['bus','dorm','sound_event'];
const guard=(env,sql,...args)=>env.DB.prepare(
  "SELECT CASE WHEN ("+sql+") THEN 1 ELSE json_extract('invalid-json','$') END"
).bind(...args);
const recentAdmin=data=>{
  const age=Date.now()-Number(data?.session?.iat);
  return Number.isFinite(age)&&age>=0&&age<=300000;
};
const uuidOk=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const blank=x=>!String(x||'').trim();
async function config(env,key) {
  const rows=await env.DB.prepare(
    "SELECT id,data,created_at,updated_at FROM records WHERE type='config' AND json_extract(data,'$.key')=? LIMIT 2"
  ).bind(key).all();
  if((rows.results||[]).length>1)throw Error('Duplicate configuration');
  const row=rows.results?.[0]||null;
  return row?{...row,payload:JSON.parse(row.data)}:null;
}
async function currentState(env) {
  const [wg,airport,cycles,records]=await Promise.all([
    config(env,'week_group'),config(env,'last_airport'),
    env.DB.prepare("SELECT * FROM gate_week_groups WHERE state<>'closed' LIMIT 2").all(),
    env.DB.prepare("SELECT id,type,week_group,data,created_at,updated_at FROM records WHERE type IN ('bus','dorm','sound_event') ORDER BY created_at,id").all()
  ]);
  if((cycles.results||[]).length>1)throw Error('Multiple live cycles');
  const group=String(wg?.payload?.value||'').trim().toUpperCase();
  const cycle=cycles.results?.[0]||null;
  if(!group||!/^[A-Z0-9_-]{1,24}$/.test(group)||
    (cycle&&(cycle.week_group!==group||cycle.state!=='active')))throw Error('No verified active Week Group');
  const sources=records.results||[];
  if(!sources.length||sources.some(row=>row.week_group!==group))throw Error('No complete current operational snapshot');
  const dorms=sources.filter(row=>row.type==='dorm').map(parseOperationalRow);
  const buses=sources.filter(row=>row.type==='bus').map(parseOperationalRow);
  if(!dorms.length)throw Error('The active Week Group has no dorm manifest');
  // Do not perform a duplicate closeout over a prior archived snapshot for
  // the same initialization. A legitimate reused label has a later init time.
  const archived=await env.DB.prepare(
    "SELECT id,json_extract(data,'$.archived_at') AS archived_at FROM records WHERE type='archive' AND week_group=?"
  ).bind(group).all();
  const initialized=Date.parse(wg.updated_at||'');
  if((archived.results||[]).some(row=>!Number.isFinite(initialized)||
    !Number.isFinite(Date.parse(row.archived_at))||
    Date.parse(row.archived_at)>=initialized))throw Error('Archived label conflicts with active initialization');
  return {group,cycle,wg,airport,sources,dorms,buses,archiveCount:(archived.results||[]).length};
}
async function originalManifest(env,state) {
  const initializedId=state.cycle?.cycle_id||state.wg?.payload?.initialization_request_id||'';
  if(!initializedId)throw Error('Original initialization identity is not available');
  const row=await env.DB.prepare(
    'SELECT cycle_id,week_group,manifest_json FROM gate_admin_input_manifests WHERE initialization_id=?'
  ).bind(initializedId).first();
  if(!row||row.cycle_id!==String(state.cycle?.cycle_id||''))
    throw Error('Immutable original Input manifest is not available for this Week Group');
  const original=normalizeDraft(JSON.parse(row.manifest_json));
  if(original.proposed_week_group!==row.week_group)throw Error('Immutable Input manifest identity mismatch');
  if(row.week_group===state.group)return original;
  // A verified Admin rename changes only the operational identity. Keep the
  // signed original Input manifest immutable; reconstruct with its new alias.
  const rename=await env.DB.prepare(
    'SELECT old_week_group,new_week_group FROM gate_admin_week_group_renames WHERE initialization_id=? AND new_week_group=?'
  ).bind(initializedId,state.group).first();
  if(!rename||rename.old_week_group!==row.week_group)
    throw Error('No audited Week Group rename connects original Input to current receiving identity');
  return normalizeDraft({...original,proposed_week_group:state.group});
}

function sourceCheckSql() {
  return "(SELECT COUNT(*) FROM records WHERE type IN ('bus','dorm','sound_event'))=? AND NOT EXISTS("+
    "SELECT 1 FROM json_each(?) expected LEFT JOIN records actual ON actual.id=json_extract(expected.value,'$.id') "+
    "WHERE actual.id IS NULL OR actual.type IS NOT json_extract(expected.value,'$.type') "+
    "OR actual.week_group IS NOT json_extract(expected.value,'$.week_group') "+
    "OR actual.data IS NOT json_extract(expected.value,'$.data') "+
    "OR actual.created_at IS NOT json_extract(expected.value,'$.created_at') "+
    "OR actual.updated_at IS NOT json_extract(expected.value,'$.updated_at'))";
}
function clearConfig(env,row,key,oldValue,time) {
  if(!row)return [];
  return [env.DB.prepare(
    "UPDATE records SET data=json_set(data,'$.value','', '$.updated_by_role','admin', '$.record_version',COALESCE(CAST(json_extract(data,'$.record_version') AS INTEGER),0)+1, '$.updated_at',?),updated_at=? WHERE id=? AND type='config' AND data=? AND json_extract(data,'$.key')=? AND json_extract(data,'$.value')=?"
  ).bind(time,time,row.id,row.data,key,oldValue)];
}
async function checkReady(env) {
  if(env?.GATE_ADMIN_SYSTEM_CONTROL_ENABLED!=='true'||env?.GATE_ADMIN_WRITES_ENABLED!=='true')
    throw Error('Admin system control and Admin writes must be explicitly enabled');
  const status=await readSiteLock(env);
  if(!status.installed||!status.locked)throw Error('Site Lock must be engaged before emergency recovery');
  const sql=await env.DB.prepare(
    "SELECT name,type,sql FROM sqlite_master WHERE (type='table' AND name IN ('gate_admin_reset_evidence','gate_admin_system_events','gate_audit_events','gate_admin_input_manifests')) OR (type='trigger' AND name IN ('trg_gate_admin_reset_evidence_immutable_update','trg_gate_admin_reset_evidence_immutable_delete','trg_gate_admin_system_events_immutable_update','trg_gate_admin_system_events_immutable_delete','trg_gate_admin_input_manifests_no_update','trg_gate_admin_input_manifests_no_delete','trg_gate_archive_source_no_update','trg_gate_archive_source_no_delete','trg_gate_archive_source_no_replace'))"
  ).all();
  const schema=new Map((sql.results||[]).map(row=>[row.name,row]));
  const necessary=['gate_admin_reset_evidence','gate_admin_system_events','gate_audit_events','gate_admin_input_manifests',
    'trg_gate_admin_reset_evidence_immutable_update','trg_gate_admin_reset_evidence_immutable_delete',
    'trg_gate_admin_system_events_immutable_update','trg_gate_admin_system_events_immutable_delete',
    'trg_gate_admin_input_manifests_no_update','trg_gate_admin_input_manifests_no_delete',
    'trg_gate_archive_source_no_update','trg_gate_archive_source_no_delete','trg_gate_archive_source_no_replace'];
  if(necessary.some(name=>!schema.has(name)))throw Error('Recovery schema or immutable triggers are incomplete');
  return status;
}
export async function onRequestGet({env,data}) {
  if(data?.session?.role!=='admin')return fail('forbidden','Admin access required.',403);
  try{
    const lock=await readSiteLock(env);
    const state=await currentState(env);
    let resetAvailable=false,reason='';
    try{await originalManifest(env,state);resetAvailable=true;}catch(e){reason=e.message;}
    return reply({isOk:true,locked:lock.locked,revision:lock.revision,
      week_group:state.group,cycle_id:state.cycle?.cycle_id||'',
      cycle_revision:Number(state.cycle?.revision||0),
      dorm_count:state.dorms.length,bus_count:state.buses.length,
      sound_count:state.sources.filter(row=>row.type==='sound_event').length,
      source_record_count:state.sources.length,
      arrived:state.buses.filter(b=>b.status==='arrived').reduce((sum,b)=>sum+(Number(b.otw_count)||0),0),
      loaded:state.dorms.reduce((sum,d)=>sum+(Number(d.current_load)||0),0),
      expected:state.dorms.reduce((sum,d)=>sum+(Number(d.max_load)||0),0),
      reset_available:resetAvailable,reset_unavailable_reason:reason,
      adminRecoveryEnabled:env?.GATE_ADMIN_SYSTEM_CONTROL_ENABLED==='true'&&env?.GATE_ADMIN_WRITES_ENABLED==='true'});
  }catch(e){
    return fail('no_recoverable_active_group','No verified active Week Group is available for emergency recovery.',409);
  }
}
export async function onRequestPost({request,env,data}) {
  if(data?.session?.role!=='admin')return fail('forbidden','Admin access required.',403);
  if(!recentAdmin(data))return fail('reauthentication_required','Reauthenticate Admin before emergency recovery.',403);
  if(request.headers.get('Origin')!==new URL(request.url).origin)
    return fail('origin_required','Same-origin Admin action required.',403);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))
    return fail('content_type','JSON is required.',415);
  let input;
  try{const raw=await request.text();if(raw.length>4096)throw Error();input=JSON.parse(raw);}
  catch{return fail('validation','Invalid request.',400);}
  const {action,operationId,confirmation,expectedWeekGroup,expectedCycleId,expectedRevision,reason}=input||{};
  const note=typeof reason==='string'?reason.trim():'';
  if(!['reset_week_group','archive_and_zero'].includes(action)||!uuidOk(operationId)||
    !/^[A-Z0-9_-]{1,24}$/.test(expectedWeekGroup||'')||
    typeof expectedCycleId!=='string'||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||
    note.length<10||note.length>1000||
    confirmation!==(action==='reset_week_group'?'RESET ':'ARCHIVE ')+expectedWeekGroup)
    return fail('validation','Exact Week Group, revision, operation, reason and typed confirmation are required.',400);
  try {
    await checkReady(env);
    const prior=await env.DB.prepare('SELECT action,week_group,evidence_id FROM gate_admin_system_events WHERE operation_id=?')
      .bind(operationId).first();
    if(prior)return prior.action===action&&prior.week_group===expectedWeekGroup
      ?reply({isOk:true,idempotent:true,operationId,evidence_id:prior.evidence_id,action})
      :fail('operation_conflict','Operation identity was previously used.',409);
    const state=await currentState(env);
    if(state.group!==expectedWeekGroup||String(state.cycle?.cycle_id||'')!==expectedCycleId||
      Number(state.cycle?.revision||0)!==expectedRevision)
      return fail('revision_conflict','Active Week Group changed. Refresh recovery preview.',409);
    const manifest=action==='reset_week_group'?await originalManifest(env,state):null;
    const newTime=now(),evidenceId=uuid(),sourceJson=JSON.stringify(state.sources),manifestJson=JSON.stringify(manifest||{});
    if(new TextEncoder().encode(sourceJson).length>1750000)
      return fail('snapshot_limit','Source snapshot exceeds safe storage limit. No changes made.',409);
    const generated=manifest?buildDormRows(manifest,state.cycle?.cycle_id||'',newTime,uuid,'admin').map(row=>{
      if(!state.cycle) {
        const data=JSON.parse(row.data);
        data.initialization_request_id=state.wg.payload.initialization_request_id;
        row.data=JSON.stringify(data);
      }
      return row;
    }):[];
    if(manifest && generated.length!==state.dorms.length)
      return fail('manifest_conflict','The original Input dorm count no longer matches current setup. No changes made.');
    let archive=null,archiveId='';
    if(action==='archive_and_zero'){
      const windows=state.cycle?JSON.parse(state.cycle.receiving_windows_json||'{}'):
        Object.fromEntries(WINDOWS.map(key=>[key,String(state.dorms[0]?.[key]||'')]));
      archiveId=uuid();
      archive=buildArchivePayload({
        cycleId:state.cycle?.cycle_id||'',weekGroup:state.group,
        dorms:state.dorms,buses:state.buses,sourceRecords:state.sources,
        windows,now:newTime,actorRole:'admin'
      });
      archive.__backendId=archiveId;
      archive.admin_emergency_action='archive_and_zero';
      archive.admin_operation_id=operationId;
      archive.admin_reason=note;
      if(new TextEncoder().encode(JSON.stringify(archive)).length>1750000)
        return fail('archive_limit','Archive exceeds safe storage limit. No changes made.');
    }
    const lock=await readSiteLock(env);
    const statements=[
      guard(env,sourceCheckSql(),state.sources.length,sourceJson),
      guard(env,"EXISTS(SELECT 1 FROM gate_admin_system_control WHERE id=1 AND locked=1 AND revision=?)",lock.revision),
      guard(env,"EXISTS(SELECT 1 FROM records WHERE id=? AND data=? AND updated_at=?)",state.wg.id,state.wg.data,state.wg.updated_at),
      guard(env,"NOT EXISTS(SELECT 1 FROM gate_admin_system_events WHERE operation_id=?)",operationId),
      ...(manifest?[guard(env,"EXISTS(SELECT 1 FROM gate_admin_input_manifests WHERE initialization_id=? AND manifest_json=?)",
        state.cycle?.cycle_id||state.wg.payload.initialization_request_id,manifestJson)]:[]),
      ...(state.cycle?[guard(env,"EXISTS(SELECT 1 FROM gate_week_groups WHERE cycle_id=? AND state='active' AND revision=?)",
        state.cycle.cycle_id,expectedRevision)]:[guard(env,"NOT EXISTS(SELECT 1 FROM gate_week_groups WHERE state<>'closed')")]),
      env.DB.prepare("INSERT INTO gate_admin_reset_evidence(evidence_id,operation_id,action,week_group,cycle_id,manifest_json,source_records_json,source_record_count,archive_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
        .bind(evidenceId,operationId,action,state.group,expectedCycleId,manifestJson,sourceJson,state.sources.length,archiveId,newTime),
      ...(archive?[env.DB.prepare("INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,'archive',?,?,?,?)")
        .bind(archiveId,state.group,JSON.stringify(archive),newTime,newTime)]:[]),
      env.DB.prepare("DELETE FROM records WHERE week_group=? AND type IN ('bus','dorm','sound_event')").bind(state.group),
      guard(env,"NOT EXISTS(SELECT 1 FROM records WHERE type IN ('bus','dorm','sound_event'))"),
      ...(generated.length?[env.DB.prepare("INSERT INTO records(id,type,week_group,data,created_at,updated_at) SELECT json_extract(value,'$.id'),json_extract(value,'$.type'),json_extract(value,'$.week_group'),json_extract(value,'$.data'),json_extract(value,'$.created_at'),json_extract(value,'$.updated_at') FROM json_each(?)")
        .bind(JSON.stringify(generated)),
        guard(env,"(SELECT COUNT(*) FROM records WHERE type='dorm' AND week_group=?)=?",state.group,generated.length)]:[]),
      ...(action==='archive_and_zero'?clearConfig(env,state.wg,'week_group',state.group,newTime):[]),
      ...(state.airport?clearConfig(env,state.airport,'last_airport',String(state.airport.payload.value||''),newTime):[]),
      ...(action==='archive_and_zero'?[guard(env,
        "EXISTS(SELECT 1 FROM records WHERE id=? AND type='config' AND json_extract(data,'$.value')='')",state.wg.id)]:[]),
      ...(state.airport?[guard(env,
        "EXISTS(SELECT 1 FROM records WHERE id=? AND type='config' AND json_extract(data,'$.value')='')",state.airport.id)]:[]),
      ...(state.cycle?[env.DB.prepare(
        action==='archive_and_zero'
          ?"UPDATE gate_week_groups SET state='closed',archive_id=?,closed_at=?,revision=revision+1,updated_at=? WHERE cycle_id=? AND state='active' AND revision=?"
          :"UPDATE gate_week_groups SET revision=revision+1,updated_at=? WHERE cycle_id=? AND state='active' AND revision=?"
      ).bind(...(action==='archive_and_zero'
        ?[archiveId,newTime,newTime,state.cycle.cycle_id,expectedRevision]
        :[newTime,state.cycle.cycle_id,expectedRevision])),
      guard(env,'changes()=1')]:[]),
      env.DB.prepare("INSERT INTO gate_admin_system_events(operation_id,action,actor_role,reason,week_group,cycle_id,revision_before,revision_after,evidence_id,created_at) VALUES(?,?,'admin',?,?,?,?,?,?,?)")
        .bind(operationId,action,note,state.group,expectedCycleId,expectedRevision,expectedRevision+1,evidenceId,newTime),
      env.DB.prepare("INSERT INTO gate_audit_events(event_id,cycle_id,operation_id,entity_type,entity_id,event_type,actor_role,prior_version,resulting_version,metadata_json,occurred_at) VALUES(?,?,?,'week_group',?,?,'admin',?,?,?,?)")
        .bind(uuid(),state.cycle?.cycle_id||null,state.cycle?null: null,state.group,action==='reset_week_group'?'admin_week_group_reset':'admin_archive_and_zero',
          expectedRevision,expectedRevision+1,JSON.stringify({operation_id:operationId,evidence_id:evidenceId,archive_id:archiveId,source_record_count:state.sources.length,reason:note}),newTime),
      guard(env,"EXISTS(SELECT 1 FROM gate_admin_reset_evidence WHERE evidence_id=? AND source_record_count=?)",evidenceId,state.sources.length)
    ];
    await env.DB.batch(statements);
    return reply({isOk:true,operationId,evidence_id:evidenceId,archive_id:archiveId,action,week_group:state.group,
      dorm_count:generated.length,cleared_record_count:state.sources.length,locked:true});
  } catch(e) {
    console.error('Admin emergency recovery not confirmed:',e?.name||'error');
    return fail('recovery_unconfirmed','No recovery outcome was confirmed; inspect the operation receipt and lifecycle before retrying.',503);
  }
}
