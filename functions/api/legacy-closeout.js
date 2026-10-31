import { cutoverRequested } from './persistence-core.mjs';
// Legacy Week Group closeout: a single authoritative D1 transaction, with no
// browser-directed per-record DELETEs. No migration or new tables are required.
// Legacy closeout is unavailable while transactional persistence is enabled.
import { buildArchivePayload, parseOperationalRow } from './persistence-core.mjs';

const send = (body, status=200) => new Response(JSON.stringify(body), {
  status, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
});
const refuse = (code,error,status=409) => send({isOk:false,code,error},status);
const allowed = data => data?.session?.role === 'instructor';
const keyOk = value => typeof value==='string' && /^[a-f\d-]{36}$/i.test(value);
const nowIso = () => new Date().toISOString();
const assertion = (env,condition,...args) => {
  const stmt=env.DB.prepare(`SELECT CASE WHEN ${condition} THEN 1 ELSE json_extract('invalid-json','$') END`);
  return args.length ? stmt.bind(...args) : stmt;
};

async function committedArchive(env,requestId) {
  const rows=await env.DB.prepare("SELECT id,week_group FROM records WHERE type='archive' AND json_extract(data,'$.legacy_closeout_request_id')=? LIMIT 2").bind(requestId).all();
  if((rows.results||[]).length>1) throw new Error('Duplicate archive operation identity.');
  return rows.results?.[0] || null;
}
async function checkCompleted(env,requestId){
  const archive=await committedArchive(env,requestId);
  if(!archive)return null;
  const source=await env.DB.prepare("SELECT COUNT(*) AS n FROM records WHERE week_group=? AND type IN ('bus','dorm','sound_event')").bind(archive.week_group).first();
  const config=await env.DB.prepare("SELECT COUNT(*) AS n FROM records WHERE type='config' AND json_extract(data,'$.key')='week_group' AND json_extract(data,'$.value')=?").bind(archive.week_group).first();
  if(Number(source?.n)!==0||Number(config?.n)!==0)throw new Error('A completed archive conflicts with live operational state.');
  return {isOk:true,closed:true,archive_id:archive.id,week_group:archive.week_group,idempotent:true};
}

export async function onRequestGet({request,env,data}){
  if(!allowed(data))return refuse('forbidden','Instructor access required.',403);
  const requestId=new URL(request.url).searchParams.get('request_id');
  if(!keyOk(requestId))return refuse('validation','Valid request identity required.',400);
  try{
    const completed=await checkCompleted(env,requestId);
    return completed?send(completed):send({isOk:true,closed:false});
  }catch{
    return refuse('integrity_error','Closeout state requires investigation. Do not retry.',503);
  }
}

export async function onRequestPost({request,env,data}){
  if(!allowed(data))return refuse('forbidden','Instructor access required.',403);
  if(cutoverRequested(env))
    return refuse('transactional_required','Use the canonical transactional closeout workflow.');
  if(!env?.DB)return refuse('database_unavailable','Database is unavailable.',503);
  if(request.headers.get('Origin') && request.headers.get('Origin')!==new URL(request.url).origin)
    return refuse('forbidden','Origin verification failed.',403);

  let payload;
  try{payload=await request.json();}catch{return refuse('validation','Invalid JSON request.',400);}
  const weekGroup=String(payload?.week_group||'').trim().toUpperCase();
  const requestId=payload?.request_id;
  if(!/^[A-Z0-9_-]{1,100}$/.test(weekGroup)||!keyOk(requestId))
    return refuse('validation','Valid Week Group and operation identity required.',400);

  try{
    const prior=await committedArchive(env,requestId);
    if(prior){
      if(prior.week_group!==weekGroup)return refuse('conflict','Operation belongs to a different Week Group.');
      return send(await checkCompleted(env,requestId));
    }

    const active=await env.DB.prepare("SELECT id,data FROM records WHERE type='config' AND json_extract(data,'$.key')='week_group' LIMIT 2").all();
    if(active.results?.length!==1||String(JSON.parse(active.results[0].data).value||'').trim().toUpperCase()!==weekGroup)
      return refuse('lifecycle_conflict','The active Week Group does not match. No records were changed.');
    const activeCycle=await env.DB.prepare("SELECT cycle_id FROM gate_week_groups WHERE state<>'closed' LIMIT 1").first();
    if(activeCycle)return refuse('transactional_required','Registered Week Groups must use transactional closeout.');

    const source=await env.DB.prepare("SELECT id,type,week_group,data,created_at,updated_at FROM records WHERE week_group=? AND type IN ('bus','dorm','sound_event') ORDER BY created_at,id").bind(weekGroup).all();
    const rows=source.results||[];
    const dorms=rows.filter(row=>row.type==='dorm').map(parseOperationalRow);
    const buses=rows.filter(row=>row.type==='bus').map(parseOperationalRow);
    if(!dorms.length&&!buses.length)return refuse('incomplete_closeout','No live dorm or bus records remain. Check archive history before retrying.');

    // Older client-side closeouts may have saved an archive and only deleted
    // some records. Never create a second archive over that partial state.
    const oldest=rows.map(row=>row.created_at).sort()[0]||nowIso();
    const existing=await env.DB.prepare("SELECT id FROM records WHERE type='archive' AND week_group=? AND (julianday(json_extract(data,'$.archived_at'))>=julianday(?) OR julianday(json_extract(data,'$.archived_at'))>=julianday('now','-1 day')) LIMIT 1").bind(weekGroup,oldest).first();
    if(existing){
      // An older closeout may have persisted the archive and then stopped partway
      // through browser-driven cleanup. Only resume when the archive contains a
      // lossless, immutable snapshot proving that EVERY remaining row belongs to it.
      // Reporting-only archives cannot establish that proof.
      const archives=await env.DB.prepare("SELECT id,data FROM records WHERE type='archive' AND week_group=? AND (julianday(json_extract(data,'$.archived_at'))>=julianday(?) OR julianday(json_extract(data,'$.archived_at'))>=julianday('now','-1 day')) LIMIT 2").bind(weekGroup,oldest).all();
      if(archives.results?.length===1){
        const candidate=archives.results[0];
        let saved;
        try{
          const parsed=JSON.parse(candidate.data);
          saved=JSON.parse(parsed.source_records_json);
        }catch(_){}
        if(Array.isArray(saved) && saved.length>0 && saved.every(item=>item && typeof item.id==='string' && typeof item.data==='string')){
          const byId=new Map(saved.map(item=>[item.id,item]));
          const matches=byId.size===saved.length && rows.every(row=>{
            const original=byId.get(row.id);
            return original && ['dorm','bus','sound_event'].includes(original.type) &&
              original.type===row.type && original.week_group===row.week_group &&
              original.data===row.data && original.created_at===row.created_at &&
              original.updated_at===row.updated_at;
          });
          if(matches){
            const snapshot=JSON.stringify(rows);
            const now=nowIso();
            const originalConfig=active.results[0];
            const airport=await env.DB.prepare("SELECT id FROM records WHERE type='config' AND json_extract(data,'$.key')='last_airport' LIMIT 2").all();
            if((airport.results||[]).length>1)return refuse('integrity_error','Duplicate last-airport configuration.');
            const statements=[
              assertion(env,`(SELECT COUNT(*) FROM records WHERE week_group=? AND type IN ('bus','dorm','sound_event'))=?
                AND NOT EXISTS(SELECT 1 FROM json_each(?) e LEFT JOIN records r ON r.id=json_extract(e.value,'$.id')
                  WHERE r.id IS NULL OR r.type IS NOT json_extract(e.value,'$.type')
                    OR r.week_group IS NOT json_extract(e.value,'$.week_group')
                    OR r.data IS NOT json_extract(e.value,'$.data')
                    OR r.created_at IS NOT json_extract(e.value,'$.created_at')
                    OR r.updated_at IS NOT json_extract(e.value,'$.updated_at'))
                AND (SELECT data FROM records WHERE id=? AND type='archive')=?
                AND EXISTS(SELECT 1 FROM records WHERE id=? AND type='config' AND json_extract(data,'$.value')=?)
                AND NOT EXISTS(SELECT 1 FROM gate_week_groups WHERE state<>'closed')`,
                weekGroup,rows.length,snapshot,candidate.id,candidate.data,originalConfig.id,weekGroup),
              env.DB.prepare("DELETE FROM records WHERE week_group=? AND type IN ('bus','dorm','sound_event')").bind(weekGroup),
              assertion(env,"NOT EXISTS(SELECT 1 FROM records WHERE week_group=? AND type IN ('bus','dorm','sound_event'))",weekGroup),
              env.DB.prepare("UPDATE records SET data=json_set(data,'$.value','', '$.updated_by_role','instructor', '$.record_version',COALESCE(CAST(json_extract(data,'$.record_version') AS INTEGER),0)+1),updated_at=? WHERE id=? AND type='config' AND json_extract(data,'$.key')='week_group' AND json_extract(data,'$.value')=?").bind(now,originalConfig.id,weekGroup),
              assertion(env,"changes()=1"),
              ...(airport.results?.length?[env.DB.prepare("UPDATE records SET data=json_set(data,'$.value','', '$.updated_by_role','instructor', '$.record_version',COALESCE(CAST(json_extract(data,'$.record_version') AS INTEGER),0)+1),updated_at=? WHERE id=? AND type='config' AND json_extract(data,'$.key')='last_airport'").bind(now,airport.results[0].id)]:[]),
              assertion(env,"NOT EXISTS(SELECT 1 FROM records WHERE type='config' AND json_extract(data,'$.key')='week_group' AND json_extract(data,'$.value')=?)",weekGroup)
            ];
            await env.DB.batch(statements);
            return send({isOk:true,closed:true,archive_id:candidate.id,week_group:weekGroup,recovered:true,source_record_count:rows.length});
          }
        }
      }
      const sounds=rows.filter(row=>row.type==='sound_event').length;
      return refuse('existing_archive',`An archive already exists. ${dorms.length} dorm, ${buses.length} bus, and ${sounds} sound-event records remain. Automatic recovery requires exact archived source-record proof; records were not changed.`);
    }

    const fields=['receiving_day_one_start','receiving_day_one_end','receiving_day_two_start','receiving_day_two_end'];
    const windows={};
    for(const field of fields){
      const incoming=payload?.receiving_windows?.[field];
      if(incoming!==undefined && (typeof incoming!=='string'||incoming.length>80))
        return refuse('validation','Invalid receiving-window metadata.',400);
      windows[field]=incoming||dorms.find(dorm=>dorm[field])?.[field]||'';
    }
    const now=nowIso(),archiveId=crypto.randomUUID();
    const archive=buildArchivePayload({cycleId:'',weekGroup,dorms,buses,sourceRecords:rows,windows,now,actorRole:'instructor'});
    archive.__backendId=archiveId;
    archive.legacy_closeout_request_id=requestId;
    const archiveJson=JSON.stringify(archive);
    if(new TextEncoder().encode(archiveJson).length>1800000)
      return refuse('archive_limit','Archive exceeds safe D1 row size. No records were removed.');
    const snapshot=JSON.stringify(rows);
    const originalConfig=active.results[0];
    const airport=await env.DB.prepare("SELECT id FROM records WHERE type='config' AND json_extract(data,'$.key')='last_airport' LIMIT 2").all();
    if((airport.results||[]).length>1)return refuse('integrity_error','Duplicate last-airport configuration.');

    const statements=[
      assertion(env,`(SELECT COUNT(*) FROM records WHERE week_group=? AND type IN ('bus','dorm','sound_event'))=?
        AND NOT EXISTS(SELECT 1 FROM json_each(?) e LEFT JOIN records r ON r.id=json_extract(e.value,'$.id')
          WHERE r.id IS NULL OR r.type IS NOT json_extract(e.value,'$.type')
            OR r.week_group IS NOT json_extract(e.value,'$.week_group')
            OR r.data IS NOT json_extract(e.value,'$.data')
            OR r.created_at IS NOT json_extract(e.value,'$.created_at')
            OR r.updated_at IS NOT json_extract(e.value,'$.updated_at'))
        AND EXISTS(SELECT 1 FROM records WHERE id=? AND type='config'
          AND json_extract(data,'$.key')='week_group' AND json_extract(data,'$.value')=?)
        AND NOT EXISTS(SELECT 1 FROM gate_week_groups WHERE state<>'closed')
        AND NOT EXISTS(SELECT 1 FROM records WHERE type='archive' AND week_group=?
          AND (julianday(json_extract(data,'$.archived_at'))>=julianday(?) OR julianday(json_extract(data,'$.archived_at'))>=julianday('now','-1 day')))`,
        weekGroup,rows.length,snapshot,originalConfig.id,weekGroup,weekGroup,oldest),
      env.DB.prepare("INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,'archive',?,?,?,?)")
        .bind(archiveId,weekGroup,archiveJson,now,now),
      assertion(env,"(SELECT data FROM records WHERE id=? AND type='archive')=? AND (SELECT json_extract(data,'$.source_records_json') FROM records WHERE id=?)=?",
        archiveId,archiveJson,archiveId,archive.source_records_json),
      env.DB.prepare("DELETE FROM records WHERE week_group=? AND type IN ('bus','dorm','sound_event')").bind(weekGroup),
      assertion(env,"NOT EXISTS(SELECT 1 FROM records WHERE week_group=? AND type IN ('bus','dorm','sound_event'))",weekGroup),
      env.DB.prepare("UPDATE records SET data=json_set(data,'$.value','', '$.updated_by_role','instructor', '$.record_version',COALESCE(CAST(json_extract(data,'$.record_version') AS INTEGER),0)+1),updated_at=? WHERE id=? AND type='config' AND json_extract(data,'$.key')='week_group' AND json_extract(data,'$.value')=?")
        .bind(now,originalConfig.id,weekGroup),
      assertion(env,'changes()=1'),
      ...(airport.results?.length?[env.DB.prepare("UPDATE records SET data=json_set(data,'$.value','', '$.updated_by_role','instructor', '$.record_version',COALESCE(CAST(json_extract(data,'$.record_version') AS INTEGER),0)+1),updated_at=? WHERE id=? AND type='config' AND json_extract(data,'$.key')='last_airport'").bind(now,airport.results[0].id)]:[]),
      assertion(env,"NOT EXISTS(SELECT 1 FROM records WHERE type='config' AND json_extract(data,'$.key')='week_group' AND json_extract(data,'$.value')=?)",weekGroup)
    ];
    await env.DB.batch(statements);
    return send({isOk:true,closed:true,archive_id:archiveId,week_group:weekGroup,source_record_count:rows.length});
  }catch(error){
    console.error('Legacy atomic closeout not confirmed:',error?.name||'error');
    return refuse('closeout_unconfirmed','Closeout was not confirmed. Check authoritative archive state before retrying.',503);
  }
}
