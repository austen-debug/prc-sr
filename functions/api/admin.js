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
    if(mode!=='health')return response({isOk:false,code:'unsupported_mode'},400);
    const [tables,cycle,operations,archives,audit] = await Promise.all([
      env.DB.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','trigger') AND name IN ('gate_admin_archive_dispositions','trg_gate_admin_dispositions_no_update','trg_gate_admin_dispositions_no_delete')").all(),
      env.DB.prepare("SELECT cycle_id,week_group,state,revision,archive_id,updated_at FROM gate_week_groups WHERE state<>'closed' ORDER BY created_at DESC LIMIT 1").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM gate_workflow_operations WHERE status IN ('failed','needs_recovery','running','archive_verified')").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM records WHERE type='archive'").first(),
      env.DB.prepare("SELECT COUNT(*) AS n FROM gate_audit_events").first()
    ]);
    const names=new Set((tables.results||[]).map(row=>row.name));
    const schemaReady=['gate_admin_archive_dispositions','trg_gate_admin_dispositions_no_update','trg_gate_admin_dispositions_no_delete'].every(name=>names.has(name));
    return response({isOk:true,adminSchemaReady:schemaReady,writesEnabled:schemaReady&&env.GATE_ADMIN_WRITES_ENABLED==='true',
      activeCycle:cycle||null,unresolvedOperations:Number(operations?.n||0),archiveCount:Number(archives?.n||0),auditEventCount:Number(audit?.n||0)});
  }catch{ return response({isOk:false,code:'admin_health_unavailable',error:'Authoritative diagnostics unavailable.'},503);}
}
export async function onRequestPost(){return response({isOk:false,code:'read_only'},405);}
