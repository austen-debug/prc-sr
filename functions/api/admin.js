// GATE Admin diagnostics. Read-only; never a write authority for operational records.
function response(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
export async function onRequestGet({env,data,request}){
  if(data?.session?.role!=='admin') return response({isOk:false,code:'forbidden'},403);
  if(!env?.DB) return response({isOk:false,code:'database_unavailable'},503);
  try {
    const mode = new URL(request.url).searchParams.get('mode') || 'health';
    if(mode==='audit'){
      const rows=await env.DB.prepare('SELECT event_id,cycle_id,entity_type,entity_id,event_type,actor_role,prior_version,resulting_version,occurred_at FROM gate_audit_events ORDER BY occurred_at DESC LIMIT 120').all();
      return response({isOk:true,events:rows.results||[]});
    }
    if(mode==='cycles'){
      const rows=await env.DB.prepare('SELECT cycle_id,week_group,state,revision,archive_id,created_at,closed_at FROM gate_week_groups ORDER BY created_at DESC LIMIT 75').all();
      return response({isOk:true,cycles:rows.results||[]});
    }
    if(mode==='security'){
      const configured=(name)=>Boolean(String(env?.[name]||'').trim());
      return response({isOk:true,roles:[
        {role:'admin',permissions:'All Instructor operations + separately authorized archive administration',configured:configured('ADMIN_USERNAME')&&configured('ADMIN_PASSWORD')},
        {role:'instructor',permissions:'Full existing receiving operations',configured:configured('MTI_USERNAME')&&configured('MTI_PASSWORD')},
        {role:'airman',permissions:'Existing authorized board and processing',configured:configured('AIRMAN_USERNAME')&&configured('AIRMAN_PASSWORD')},
        {role:'squadron',permissions:'Existing restricted Squadron Board',configured:configured('SQUADRON_USERNAME')&&configured('SQUADRON_PASSWORD')}
      ],adminWritesEnabled:env.GATE_ADMIN_WRITES_ENABLED==='true',persistenceEnabled:env.GATE_PERSISTENCE_ENABLED==='true',
      sessionExpiresAt:Number(data?.session?.exp||0),
      operationalRule:'Admin inherits Instructor operations after authenticated actor audit provenance is installed; privileged archive actions additionally require the Admin write switch.'});
    }
    if(mode==='integrity'){
      const counts=await env.DB.prepare(`WITH mirrored AS (
        SELECT id,'bus' AS type,week_group,data,created_at,updated_at FROM gate_v2_buses
        UNION ALL SELECT id,type,week_group,data,created_at,updated_at FROM gate_v2_dorms
        UNION ALL SELECT id,type,week_group,data,created_at,updated_at FROM gate_v2_archives
        UNION ALL SELECT id,type,week_group,data,created_at,updated_at FROM gate_v2_config
        UNION ALL SELECT id,type,week_group,data,created_at,updated_at FROM gate_v2_sound_events
      )
      SELECT
        (SELECT COUNT(*) FROM records WHERE type IN ('bus','dorm','archive','config','sound_event')) AS original,
        (SELECT COUNT(*) FROM mirrored) AS mirrored,
        (SELECT COUNT(*) FROM records r LEFT JOIN mirrored m ON m.id=r.id AND m.type=r.type
          WHERE r.type IN ('bus','dorm','archive','config','sound_event') AND
          (m.id IS NULL OR r.week_group IS NOT m.week_group OR r.data IS NOT m.data
           OR r.created_at IS NOT m.created_at OR r.updated_at IS NOT m.updated_at)) AS differences,
        (SELECT COUNT(*) FROM mirrored m LEFT JOIN records r ON r.id=m.id AND r.type=m.type WHERE r.id IS NULL) AS extras,
        (SELECT COUNT(*) FROM records WHERE type NOT IN ('bus','dorm','archive','config','sound_event','audit_event')) AS unmapped`).first();
      const trigger=await env.DB.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger' AND name IN ('gate_mirror_records_insert','gate_mirror_records_update','gate_mirror_records_delete','gate_record_audit_insert','gate_record_audit_update','gate_record_audit_delete')").first();
      const triggerCount=Number(trigger?.n||0);
      const complete=Number(counts?.original)===Number(counts?.mirrored) && Number(counts?.differences)===0 && Number(counts?.extras)===0 && Number(counts?.unmapped)===0 && triggerCount===6;
      return response({isOk:true,integrityReady:complete,counts:{original:Number(counts?.original||0),mirrored:Number(counts?.mirrored||0),differences:Number(counts?.differences||0),extras:Number(counts?.extras||0),unmapped:Number(counts?.unmapped||0)},requiredTriggerCount:triggerCount});
    }
    if(mode!=='health')return response({isOk:false,code:'unsupported_mode'},400);
    const [tables,cycle,operations,archives,audit] = await Promise.all([
      env.DB.prepare("SELECT name,sql FROM sqlite_master WHERE (type='table' AND name IN ('gate_audit_events','gate_archive_amendments','gate_squadron_notices','gate_squadron_information_revisions','gate_admin_archive_dispositions')) OR (type='trigger' AND name IN ('gate_record_audit_insert','gate_record_audit_update','trg_gate_admin_dispositions_no_delete','trg_gate_admin_dispositions_no_update'))").all(),
      env.DB.prepare("SELECT cycle_id,week_group,state,revision,archive_id,updated_at FROM gate_week_groups WHERE state<>'closed' ORDER BY created_at DESC LIMIT 1").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM gate_workflow_operations WHERE status IN ('failed','needs_recovery','running','archive_verified')").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM records WHERE type='archive'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM gate_audit_events").first()
    ]);
    const definitions=new Map((tables.results||[]).map(row=>[row.name,String(row.sql||'')]));
    const operationalSchemaReady=['gate_audit_events','gate_archive_amendments','gate_squadron_notices','gate_squadron_information_revisions','gate_record_audit_insert','gate_record_audit_update'].every(name=>definitions.get(name)?.includes("'admin'"));
    const archiveSchemaReady=['gate_admin_archive_dispositions','trg_gate_admin_dispositions_no_update','trg_gate_admin_dispositions_no_delete'].every(name=>definitions.has(name));
    const schemaReady=operationalSchemaReady&&archiveSchemaReady;
    return response({isOk:true,adminSchemaReady:schemaReady,operationalWritesReady:operationalSchemaReady,
      writesEnabled:schemaReady&&env.GATE_ADMIN_WRITES_ENABLED==='true',
      activeCycle:cycle||null,unresolvedOperations:Number(operations?.n||0),archiveCount:Number(archives?.n||0),auditEventCount:Number(audit?.n||0)});
  }catch{ return response({isOk:false,code:'admin_health_unavailable',error:'Authoritative diagnostics unavailable.'},503);}
}
export async function onRequestPost(){return response({isOk:false,code:'read_only'},405);}
