import { PersistenceValidationError, normalizeDraft, validateInitialization, buildDormRows, parseOperationalRow, buildArchivePayload } from './persistence-core.mjs';

const WINDOWS = ['receiving_day_one_start','receiving_day_one_end','receiving_day_two_start','receiving_day_two_end'];
const nowIso = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const enabled = env => env?.GATE_PERSISTENCE_ENABLED === 'true';
const role = data => String(data?.session?.role || '').toLowerCase();
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers:{'Content-Type':'application/json','Cache-Control':'no-store'} });
const error = (code, message, status) => reply({isOk:false,code,error:message},status);
const conflict = message => error('conflict',message,409);
const unavailable = message => error('persistence_unavailable',message,503);
const deny = () => error('forbidden','Instructor authorization is required.',403);
const assertOne = env => env.DB.prepare("SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('invalid-json','$') END");
const failUnless = (env, sql, ...values) => env.DB.prepare(`SELECT CASE WHEN ${sql} THEN 1 ELSE json_extract('invalid-json','$') END`).bind(...values);

async function mirrorStatus(env) {
  const triggers = await env.DB.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger' AND name IN ('gate_mirror_records_insert','gate_mirror_records_update','gate_mirror_records_delete','gate_record_audit_insert','gate_record_audit_update','gate_record_audit_delete')").first();
  const counts = await env.DB.prepare(`WITH mirrored AS (
    SELECT id,'bus' AS type,week_group,data,created_at,updated_at FROM gate_v2_buses
    UNION ALL SELECT id,type,week_group,data,created_at,updated_at FROM gate_v2_dorms
    UNION ALL SELECT id,type,week_group,data,created_at,updated_at FROM gate_v2_archives
    UNION ALL SELECT id,type,week_group,data,created_at,updated_at FROM gate_v2_config
    UNION ALL SELECT id,type,week_group,data,created_at,updated_at FROM gate_v2_sound_events
  ) SELECT
  (SELECT COUNT(*) FROM records WHERE type IN ('bus','dorm','archive','config','sound_event')) AS original,
  (SELECT COUNT(*) FROM mirrored) AS mirrored,
  (SELECT COUNT(*) FROM records r LEFT JOIN mirrored m ON r.id=m.id AND r.type=m.type
    WHERE r.type IN ('bus','dorm','archive','config','sound_event') AND (m.id IS NULL
      OR r.week_group IS NOT m.week_group OR r.data IS NOT m.data
      OR r.created_at IS NOT m.created_at OR r.updated_at IS NOT m.updated_at)) AS differences,
  (SELECT COUNT(*) FROM mirrored m LEFT JOIN records r ON r.id=m.id AND r.type=m.type WHERE r.id IS NULL) AS extras,
  (SELECT COUNT(*) FROM records WHERE type NOT IN ('bus','dorm','archive','config','sound_event','audit_event')) AS unmapped`).first();
  const original = Number(counts.original), mirrored = Number(counts.mirrored), differences = Number(counts.differences);
  const extras = Number(counts.extras), unmapped = Number(counts.unmapped), installed = Number(triggers?.n || 0);
  return { ready:installed===6 && original===mirrored && differences===0 && extras===0 && unmapped===0,
    original,mirrored,differences,extras,unmapped,mirror_triggers:Math.min(installed,3),required_triggers:installed };
}
async function configRecord(env, key='week_group') {
  const records = await env.DB.prepare("SELECT * FROM records WHERE type='config' AND json_extract(data,'$.key')=? LIMIT 2").bind(key).all();
  if ((records.results||[]).length>1) throw new Error(`Duplicate configuration key: ${key}.`);
  return records.results?.[0] || null;
}
const activeCycle = env => env.DB.prepare("SELECT * FROM gate_week_groups WHERE state<>'closed' LIMIT 1").first();
function configValue(row) {
  if (!row) return '';
  let parsed;
  try { parsed = JSON.parse(row.data); } catch { throw new Error('Invalid Week Group configuration JSON.'); }
  return String(parsed.value||'').trim().toUpperCase();
}
const draftRow = (env,id='') => id
  ? env.DB.prepare('SELECT * FROM gate_input_drafts WHERE draft_id=?').bind(id).first()
  : env.DB.prepare("SELECT * FROM gate_input_drafts WHERE status='draft' ORDER BY updated_at DESC LIMIT 1").first();
function publicDraft(row) {
  return row ? {draft_id:row.draft_id,proposed_week_group:row.proposed_week_group||'',rows:JSON.parse(row.rows_json),
    receiving_windows:JSON.parse(row.receiving_windows_json),import_review:JSON.parse(row.import_review_json),
    status:row.status,revision:row.revision,updated_at:row.updated_at,consumed_at:row.consumed_at} : null;
}
async function health(env) {
  if (!enabled(env)) return {isOk:true,enabled:false,ready:false,message:'Persistence is disabled.'};
  const parity = await mirrorStatus(env), config = await configRecord(env), cycle = await activeCycle(env);
  const legacy = configValue(config);
  return {isOk:true,enabled:true,...parity,legacy_week_group:legacy,
    cycle:cycle?{cycle_id:cycle.cycle_id,week_group:cycle.week_group,state:cycle.state,revision:cycle.revision}:null,
    adoption_required:Boolean(legacy&&!cycle),
    message:parity.ready?'':'Migration triggers or record parity are incomplete. Lifecycle is not available.'};
}
function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) throw new PersistenceValidationError('Cross-origin mutation rejected.');
}
async function saveDraft(env, payload) {
  if (configValue(await configRecord(env)) || await activeCycle(env)) return conflict('Close out the active Week Group before preparing the next Input draft.');
  const draft = normalizeDraft(payload);
  if (payload.draft_id !== undefined && (typeof payload.draft_id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(payload.draft_id))) return error('validation','Invalid draft ID.',400);
  const id = payload.draft_id||'', old = id?await draftRow(env,id):null, now = nowIso();
  const values = [draft.proposed_week_group||null,JSON.stringify(draft.rows),JSON.stringify(draft.receiving_windows),JSON.stringify(draft.import_review)];
  if (!id) {
    const generated = uuid();
    await env.DB.prepare("INSERT INTO gate_input_drafts(draft_id,proposed_week_group,rows_json,receiving_windows_json,import_review_json,status,revision,created_at,updated_at) VALUES(?,?,?,?,?,'draft',1,?,?)")
      .bind(generated,...values,now,now).run();
    return reply({isOk:true,draft:publicDraft(await draftRow(env,generated))},201);
  }
  if (!old) return error('not_found','Draft does not exist. Reload Input.',404);
  const revision = Number(payload.revision);
  if (!Number.isSafeInteger(revision)||revision<1) return error('validation','A valid draft revision is required.',400);
  if (old.status!=='draft'||old.revision!==revision) return reply({isOk:false,code:'draft_conflict',error:'Draft changed. Reload before saving.',current_revision:old.revision,current_status:old.status},409);
  const updated = await env.DB.prepare("UPDATE gate_input_drafts SET proposed_week_group=?,rows_json=?,receiving_windows_json=?,import_review_json=?,revision=revision+1,updated_at=? WHERE draft_id=? AND revision=? AND status='draft'")
    .bind(...values,now,id,revision).run();
  if (Number(updated?.meta?.changes)!==1) return conflict('Concurrent draft edit detected. Reload before saving.');
  return reply({isOk:true,draft:publicDraft(await draftRow(env,id))});
}
async function adopt(env) {
  if (!(await mirrorStatus(env)).ready) return unavailable('Migration parity or required triggers are not verified.');
  const group = configValue(await configRecord(env));
  if (!group) return conflict('There is no active legacy Week Group to register.');
  const current = await activeCycle(env);
  if (current) {
    if (current.week_group===group && current.state==='active') return reply({isOk:true,adopted:false,cycle_id:current.cycle_id,week_group:group});
    return conflict('A different cycle is registered.');
  }
  const dorm = await env.DB.prepare("SELECT data FROM records WHERE type='dorm' AND week_group=? LIMIT 1").bind(group).first();
  if (!dorm) return conflict('The configured active group has no dorms. Recovery is required.');
  const decoded = JSON.parse(dorm.data);
  const windows = Object.fromEntries(WINDOWS.map(key=>[key,String(decoded[key]||'')]));
  const id=uuid(), event=uuid(), now=nowIso();
  try {
    await env.DB.batch([
      failUnless(env,"(SELECT COUNT(*) FROM records WHERE type='config' AND json_extract(data,'$.key')='week_group' AND json_extract(data,'$.value')=?)=1",group),
      env.DB.prepare("INSERT INTO gate_week_groups(cycle_id,week_group,state,receiving_windows_json,created_at,updated_at,activated_at) VALUES(?,?,'active',?,?,?,?)")
        .bind(id,group,JSON.stringify(windows),now,now,now),
      env.DB.prepare("INSERT INTO gate_audit_events(event_id,cycle_id,entity_type,entity_id,event_type,actor_role,metadata_json,occurred_at) VALUES(?,?,'week_group',?,'legacy_cycle_adopted','instructor',?,?)")
        .bind(event,id,id,JSON.stringify({week_group:group,source:'legacy_config'}),now)
    ]);
    return reply({isOk:true,adopted:true,cycle_id:id,week_group:group});
  } catch { return conflict('Active-cycle registration changed concurrently. Refresh state.'); }
}
function configStatements(env,row,key,value,now) {
  const original = row?JSON.parse(row.data):{}, id=row?.id||uuid();
  const data=JSON.stringify({...original,type:'config',key,value,__backendId:id,
    record_version:Math.max(0,Number(original.record_version)||0)+1,
    created_by_role:original.created_by_role||'instructor',updated_by_role:'instructor',
    created_at:row?.created_at||now,updated_at:now});
  if (!row) return [env.DB.prepare("INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,'config','',?,?,?)").bind(id,data,now,now)];
  return [env.DB.prepare('UPDATE records SET data=?,updated_at=? WHERE id=? AND data=?').bind(data,now,row.id,row.data),assertOne(env)];
}
async function initialize(env,payload) {
  const id=String(payload.draft_id||''), revision=Number(payload.revision);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)||!Number.isSafeInteger(revision)||revision<1) return error('validation','Saved draft ID and revision are required.',400);
  const key=`initialize:${id}:${revision}`;
  const prior=await env.DB.prepare('SELECT * FROM gate_workflow_operations WHERE idempotency_key=?').bind(key).first();
  if (prior?.status==='completed') return reply({isOk:true,idempotent:true,cycle_id:prior.cycle_id,week_group:prior.request_fingerprint.split(':').at(-1)});
  if (prior) return conflict('An initialization operation needs recovery.');
  if (!(await mirrorStatus(env)).ready) return unavailable('Migration parity or triggers are incomplete.');
  const config=await configRecord(env);
  if (configValue(config)||await activeCycle(env)) return conflict('Close out the active Week Group first.');
  const existing=await env.DB.prepare("SELECT COUNT(*) AS n FROM records WHERE type IN ('bus','dorm')").first();
  if (Number(existing.n)>0) return conflict('Unarchived buses or dorms remain.');
  const saved=await draftRow(env,id);
  if (!saved||saved.status!=='draft'||saved.revision!==revision) return conflict('Saved Input draft changed; reload before initializing.');
  const draft=normalizeDraft({proposed_week_group:saved.proposed_week_group,rows:JSON.parse(saved.rows_json),receiving_windows:JSON.parse(saved.receiving_windows_json),import_review:JSON.parse(saved.import_review_json)});
  validateInitialization(draft);
  const now=nowIso(), cycleId=uuid(), operation=uuid(), audit=uuid();
  const dormRows=buildDormRows(draft,cycleId,now,uuid);
  const statements=[
    failUnless(env,"NOT EXISTS(SELECT 1 FROM records WHERE type IN ('bus','dorm')) AND NOT EXISTS(SELECT 1 FROM records WHERE type='config' AND json_extract(data,'$.key')='week_group' AND COALESCE(json_extract(data,'$.value'),'')<>'') AND NOT EXISTS(SELECT 1 FROM gate_week_groups WHERE state<>'closed')"),
    env.DB.prepare("INSERT INTO gate_week_groups(cycle_id,week_group,state,source_draft_id,receiving_windows_json,revision,created_at,updated_at,activated_at) VALUES(?,?,'active',?,?,1,?,?,?)")
      .bind(cycleId,draft.proposed_week_group,id,JSON.stringify(draft.receiving_windows),now,now,now),
    env.DB.prepare("UPDATE gate_input_drafts SET status='consumed',consumed_at=?,revision=revision+1,updated_at=? WHERE draft_id=? AND revision=? AND status='draft'").bind(now,now,id,revision),
    assertOne(env),
    ...configStatements(env,config,'week_group',draft.proposed_week_group,now),
    env.DB.prepare(`INSERT INTO records(id,type,week_group,data,created_at,updated_at)
      SELECT json_extract(value,'$.id'),json_extract(value,'$.type'),json_extract(value,'$.week_group'),json_extract(value,'$.data'),json_extract(value,'$.created_at'),json_extract(value,'$.updated_at') FROM json_each(?)`)
      .bind(JSON.stringify(dormRows)),
    env.DB.prepare("INSERT INTO gate_workflow_operations(operation_id,idempotency_key,action,status,cycle_id,draft_id,request_fingerprint,phase,created_at,updated_at,completed_at) VALUES(?,?,'initialize','completed',?,?,?,'committed',?,?,?)")
      .bind(operation,key,cycleId,id,`${id}:${revision}:${draft.proposed_week_group}`,now,now,now),
    env.DB.prepare("INSERT INTO gate_audit_events(event_id,cycle_id,operation_id,entity_type,entity_id,event_type,actor_role,prior_version,resulting_version,metadata_json,occurred_at) VALUES(?,?,?,'week_group',?,'week_group_initialized','instructor',0,1,?,?)")
      .bind(audit,cycleId,operation,cycleId,JSON.stringify({week_group:draft.proposed_week_group,dorm_count:dormRows.length}),now)
  ];
  try {
    await env.DB.batch(statements);
    return reply({isOk:true,cycle_id:cycleId,week_group:draft.proposed_week_group,dorm_count:dormRows.length});
  } catch (e) { console.error('Atomic initialization rejected:',e); return conflict('Initialization was not confirmed. Refresh authoritative state before retrying.'); }
}
async function closeout(env,payload) {
  const requested=String(payload.cycle_id||'');
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(requested)) return error('validation','A valid active cycle ID is required.',400);
  const key=`closeout:${requested}`;
  const prior=await env.DB.prepare('SELECT * FROM gate_workflow_operations WHERE idempotency_key=?').bind(key).first();
  if (prior?.status==='completed') {
    const archived=await env.DB.prepare("SELECT id FROM records WHERE id=? AND type='archive'").bind(prior.archive_id).first();
    const cycle=await env.DB.prepare('SELECT week_group,state,archive_id FROM gate_week_groups WHERE cycle_id=?').bind(requested).first();
    if (!archived||cycle?.state!=='closed'||cycle.archive_id!==prior.archive_id) return unavailable('Recorded closeout does not match the archived cycle. Recovery is required.');
    return reply({isOk:true,idempotent:true,archive_id:prior.archive_id,week_group:cycle.week_group,cycle_id:requested});
  }
  if (prior) return conflict('Closeout has an unresolved operation. Recover it before retrying.');
  const current=await activeCycle(env);
  if (!current||current.cycle_id!==requested) return conflict('Only the currently active Week Group may be closed. Refresh state.');
  if (current.state!=='active') return conflict('Cycle needs recovery before closeout.');
  const config=await configRecord(env);
  if (configValue(config)!==current.week_group) return conflict('Active configuration does not match the lifecycle.');
  if (!(await mirrorStatus(env)).ready) return unavailable('Migration parity or triggers are incomplete.');
  const orphans=await env.DB.prepare("SELECT COUNT(*) AS n FROM records WHERE type IN ('bus','dorm') AND week_group IS NOT ?").bind(current.week_group).first();
  if (Number(orphans.n)>0) return conflict('Other live Week Group records require recovery before closeout.');
  const rows=await env.DB.prepare("SELECT id,type,week_group,data,created_at,updated_at FROM records WHERE week_group=? AND type IN ('dorm','bus','sound_event') ORDER BY created_at,id").bind(current.week_group).all();
  const snapshot=rows.results||[], dorms=snapshot.filter(row=>row.type==='dorm').map(parseOperationalRow), buses=snapshot.filter(row=>row.type==='bus').map(parseOperationalRow);
  if (!dorms.length&&!buses.length) return conflict('No live buses or dorms found.');
  let windows;
  try { windows=JSON.parse(current.receiving_windows_json||'{}'); } catch { return conflict('Receiving-window state needs recovery.'); }
  if (!windows||typeof windows!=='object'||Array.isArray(windows)) return conflict('Invalid receiving-window state.');
  for (const field of WINDOWS) windows[field]=windows[field]||dorms.find(row=>row[field])?.[field]||'';
  const now=nowIso(), archiveId=uuid(), operation=uuid(), audit=uuid();
  const payloadArchive=buildArchivePayload({cycleId:current.cycle_id,weekGroup:current.week_group,dorms,buses,sourceRecords:snapshot,windows,now});
  payloadArchive.__backendId=archiveId;
  const archiveJson=JSON.stringify(payloadArchive);
  if (new TextEncoder().encode(archiveJson).length>1800000) return conflict('The complete archive exceeds the safe row limit. No data was cleared. A lossless storage plan is required.');
  const lastAirport=await configRecord(env,'last_airport');
  const expected=JSON.stringify(snapshot);
  const statements=[
    failUnless(env,"(SELECT COUNT(*) FROM records WHERE week_group=? AND type IN ('dorm','bus','sound_event'))=? AND NOT EXISTS (SELECT 1 FROM json_each(?) expected LEFT JOIN records actual ON actual.id=json_extract(expected.value,'$.id') WHERE actual.id IS NULL OR actual.type IS NOT json_extract(expected.value,'$.type') OR actual.week_group IS NOT json_extract(expected.value,'$.week_group') OR actual.data IS NOT json_extract(expected.value,'$.data') OR actual.created_at IS NOT json_extract(expected.value,'$.created_at') OR actual.updated_at IS NOT json_extract(expected.value,'$.updated_at')) AND EXISTS(SELECT 1 FROM gate_week_groups WHERE cycle_id=? AND state='active' AND revision=?) AND EXISTS(SELECT 1 FROM records WHERE type='config' AND json_extract(data,'$.key')='week_group' AND json_extract(data,'$.value')=?)",
      current.week_group,snapshot.length,expected,current.cycle_id,current.revision,current.week_group),
    env.DB.prepare("INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,'archive',?,?,?,?)").bind(archiveId,current.week_group,archiveJson,now,now),
    failUnless(env,"(SELECT data FROM records WHERE id=? AND type='archive')=? AND (SELECT json_extract(data,'$.source_records_json') FROM records WHERE id=?)=? AND (SELECT json_extract(data,'$.source_record_count') FROM records WHERE id=?)=?",
      archiveId,archiveJson,archiveId,payloadArchive.source_records_json,archiveId,snapshot.length),
    env.DB.prepare("DELETE FROM records WHERE week_group=? AND type IN ('dorm','bus','sound_event')").bind(current.week_group),
    failUnless(env,"NOT EXISTS(SELECT 1 FROM records WHERE week_group=? AND type IN ('dorm','bus','sound_event'))",current.week_group),
    ...configStatements(env,config,'week_group','',now),
    ...(lastAirport?configStatements(env,lastAirport,'last_airport','',now):[]),
    env.DB.prepare("UPDATE gate_week_groups SET state='closed',archive_id=?,closed_at=?,revision=revision+1,updated_at=? WHERE cycle_id=? AND state='active' AND revision=?")
      .bind(archiveId,now,now,current.cycle_id,current.revision),
    assertOne(env),
    env.DB.prepare("INSERT INTO gate_workflow_operations(operation_id,idempotency_key,action,status,cycle_id,request_fingerprint,archive_id,phase,created_at,updated_at,completed_at) VALUES(?,?,'closeout','completed',?,?,?,'archive_and_clear_committed',?,?,?)")
      .bind(operation,key,current.cycle_id,`${current.cycle_id}:${current.revision}`,archiveId,now,now,now),
    env.DB.prepare("INSERT INTO gate_audit_events(event_id,cycle_id,operation_id,entity_type,entity_id,event_type,actor_role,prior_version,resulting_version,metadata_json,occurred_at) VALUES(?,?,?,'week_group',?,'week_group_closed','instructor',?,?,?,?)")
      .bind(audit,current.cycle_id,operation,current.cycle_id,current.revision,current.revision+1,JSON.stringify({week_group:current.week_group,archive_id:archiveId,dorm_count:dorms.length,bus_count:buses.length,source_record_count:snapshot.length}),now)
  ];
  try {
    await env.DB.batch(statements);
    return reply({isOk:true,cycle_id:current.cycle_id,archive_id:archiveId,week_group:current.week_group,dorm_count:dorms.length,bus_count:buses.length,source_record_count:snapshot.length});
  } catch (e) { console.error('Atomic closeout rejected:',e); return conflict('Closeout was not confirmed. Inspect operation and archive before retrying.'); }
}
async function amendArchive(env,payload) {
  const id=String(payload.archive_id||''),reason=String(payload.reason||'').trim(),changes=payload.changes;
  const allowed=new Set(['week_group','archived_at','total_arrived','total_expected','total_loaded','female_total','nat_total','space_force_total','arrived_space_force_total',...WINDOWS]);
  if (!id||reason.length<5||reason.length>2000||!changes||typeof changes!=='object'||Array.isArray(changes)||!Object.keys(changes).length||Object.keys(changes).some(key=>!allowed.has(key))) return error('validation','Archive ID, documented reason and supported correction fields are required.',400);
  const archive=await env.DB.prepare("SELECT id FROM records WHERE id=? AND type='archive'").bind(id).first();
  if (!archive) return error('not_found','Archive not found.',404);
  const last=await env.DB.prepare('SELECT MAX(amendment_number) AS n FROM gate_archive_amendments WHERE archive_id=?').bind(id).first();
  const sequence=Number(last?.n||0)+1,amendment=uuid(),audit=uuid(),now=nowIso();
  const cycle=await env.DB.prepare('SELECT cycle_id FROM gate_week_groups WHERE archive_id=? LIMIT 1').bind(id).first();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO gate_archive_amendments(amendment_id,archive_id,cycle_id,amendment_number,amendment_type,reason,changes_json,actor_role,created_at) VALUES(?,?,?,?,'correction',?,?,'instructor',?)")
        .bind(amendment,id,cycle?.cycle_id||null,sequence,reason,JSON.stringify(changes),now),
      env.DB.prepare("INSERT INTO gate_audit_events(event_id,cycle_id,entity_type,entity_id,event_type,actor_role,metadata_json,occurred_at) VALUES(?,?,'archive',?,'archive_amended','instructor',?,?)")
        .bind(audit,cycle?.cycle_id||null,id,JSON.stringify({amendment_id:amendment,amendment_number:sequence,fields:Object.keys(changes)}),now)
    ]);
    return reply({isOk:true,amendment_id:amendment,amendment_number:sequence},201);
  } catch { return conflict('Archive amendment changed concurrently. Reload and retry.'); }
}
export async function onRequestGet({request,env,data}) {
  if (role(data)!=='instructor') return deny();
  const mode=new URL(request.url).searchParams.get('mode')||'health';
  try {
    if (mode==='health') return reply(await health(env));
    if (!enabled(env)) return unavailable('Persistence is disabled.');
    if (mode==='draft') return reply({isOk:true,draft:publicDraft(await draftRow(env,new URL(request.url).searchParams.get('id')||''))});
    if (mode==='amendments') {
      const id=new URL(request.url).searchParams.get('id')||'';
      if (!id) return error('validation','Archive ID is required.',400);
      const rows=await env.DB.prepare('SELECT * FROM gate_archive_amendments WHERE archive_id=? ORDER BY amendment_number ASC').bind(id).all();
      return reply({isOk:true,amendments:rows.results||[]});
    }
    return error('validation','Unsupported query mode.',400);
  } catch (e) { console.error('Persistence read failed:',e); return unavailable('Persistence schema or state verification failed.'); }
}
export async function onRequestPost({request,env,data}) {
  if (role(data)!=='instructor') return deny();
  if (!enabled(env)) return unavailable('Persistence is disabled.');
  try {
    sameOrigin(request);
    const raw=await request.text();
    if (raw.length>180000) return error('validation','Request exceeds persistence payload limit.',413);
    const payload=JSON.parse(raw);
    if (!payload||typeof payload!=='object'||Array.isArray(payload)) return error('validation','Invalid request body.',400);
    // Await dispatch inside the catch boundary: asynchronous validation failures must return 400, not an uncaught 500.
    if (payload.action==='save_draft') return await saveDraft(env,payload);
    if (payload.action==='adopt') return await adopt(env);
    if (payload.action==='initialize') return await initialize(env,payload);
    if (payload.action==='closeout') return await closeout(env,payload);
    if (payload.action==='amend_archive') return await amendArchive(env,payload);
    return error('validation','Unsupported persistence action.',400);
  } catch(e) {
    if (e instanceof PersistenceValidationError || e instanceof SyntaxError) return error('validation',e.message,400);
    console.error('GATE persistence request failed:',e);
    return error('persistence_failed','Persistence operation was not confirmed. Refresh authoritative state.',500);
  }
}
