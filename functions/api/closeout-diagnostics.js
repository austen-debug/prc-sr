// Instructor-only read-only diagnostics for interrupted Week Group closeout.
// No source-row JSON, trainee identifiers, writes, or mutation recovery here.
const send=(body,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
});
const number=value=>Number.isFinite(Number(value))?Number(value):0;

export async function onRequestGet({request,env,data}){
  if (data?.session?.role!=='instructor') return send({isOk:false,code:'forbidden'},403);
  if (!env?.DB) return send({isOk:false,code:'database_unavailable'},503);
  const weekGroup=String(new URL(request.url).searchParams.get('week_group')||'').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,100}$/.test(weekGroup)) return send({isOk:false,code:'validation',error:'Valid Week Group required.'},400);
  try {
    const config=await env.DB.prepare("SELECT data,updated_at FROM records WHERE type='config' AND json_extract(data,'$.key')='week_group' LIMIT 2").all();
    const configs=config.results||[];
    let active='', activeInitialization='';
    if(configs.length===1) {
      const parsed=JSON.parse(configs[0].data);
      active=String(parsed.value||'').trim().toUpperCase();
      activeInitialization=String(parsed.initialization_request_id||'');
    }
    const live=await env.DB.prepare("SELECT id,type,week_group,data,created_at,updated_at FROM records WHERE week_group=? AND type IN ('dorm','bus','sound_event') ORDER BY created_at,id").bind(weekGroup).all();
    const liveRows=live.results||[];
    const counts={dorm:0,bus:0,sound_event:0};
    let arrived=0;
    for(const row of liveRows){
      counts[row.type]=(counts[row.type]||0)+1;
      if(row.type==='bus') {
        const bus=JSON.parse(row.data);
        if(String(bus.status||'').trim().toLowerCase()==='arrived') arrived+=number(bus.otw_count);
      }
    }
    const archives=await env.DB.prepare("SELECT id,data,created_at FROM records WHERE type='archive' AND week_group=? ORDER BY created_at DESC").bind(weekGroup).all();
    const history=(archives.results||[]).map(row=>{
      const parsed=JSON.parse(row.data);
      let source=null;
      try { const items=JSON.parse(parsed.source_records_json); if(Array.isArray(items))source=items; }catch(_){}
      const saved=source?new Map(source.map(item=>[String(item?.id||''),item])):null;
      let matching=0,unmatched=0,changed=0;
      if(saved){
        for(const item of liveRows){
          const original=saved.get(item.id);
          if(!original){unmatched++;continue;}
          if(original.type!==item.type||original.week_group!==item.week_group||
             original.data!==item.data||original.created_at!==item.created_at||
             original.updated_at!==item.updated_at) changed++;
          else matching++;
        }
      }
      return {
        archive_id:row.id,archived_at:String(parsed.archived_at||row.created_at||''),
        dorm_count:number(parsed.dorm_count),bus_count:number(parsed.bus_count),
        arrived:number(parsed.total_arrived),expected:number(parsed.total_expected),
        loaded:number(parsed.total_loaded),
        source_snapshot_format:String(parsed.source_snapshot_format||''),
        source_record_count:parsed.source_record_count??null,
        saved_source_rows:source?.length??null,
        snapshot_count_matches:Boolean(source&&parsed.source_record_count===source.length),
        unchanged_remaining_records:saved?matching:null,
        missing_from_snapshot:saved?unmatched:null,
        modified_since_snapshot:saved?changed:null
      };
    });
    return send({
      isOk:true,week_group:weekGroup,active_week_group:active,
      active_config_count:configs.length,active_initialization_present:Boolean(activeInitialization),
      live_counts:counts,live_arrived:arrived,archive_count:history.length,archives:history,
      recovery_guidance:history.length===1&&history[0].snapshot_count_matches&&
        history[0].missing_from_snapshot===0&&history[0].modified_since_snapshot===0
        ? 'A full snapshot may support verified recovery; server still enforces additional lifecycle checks.'
        : 'Manual operator reconciliation required. No records were changed.'
    });
  }catch(e){
    console.error('Week Group closeout diagnostic failed:',e?.name||'error');
    return send({isOk:false,code:'diagnostic_unavailable',error:'Read-only reconciliation could not be completed.'},503);
  }
}
export async function onRequestPost(){return send({isOk:false,code:'method_not_allowed'},405);}
export async function onRequestPut(){return send({isOk:false,code:'method_not_allowed'},405);}
export async function onRequestDelete(){return send({isOk:false,code:'method_not_allowed'},405);}
