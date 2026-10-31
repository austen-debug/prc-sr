// One authoritative live Week Group resolver shared by operational read surfaces.
// This is read-only. An inconsistent historic closeout is quarantined from live
// projections, not deleted or silently "repaired" in D1.
const week = value => String(value || '').trim().toUpperCase();
const stamp = value => { const n=Date.parse(String(value||'')); return Number.isFinite(n)?n:NaN; };
const failure = message => Object.assign(new Error(message),{code:'integrity_error'});
const state = (week_group='',status='idle',recovery=null) => Object.freeze({week_group,status,recovery});

export async function resolveLiveWeekGroup(env) {
  if (!env?.DB) throw failure('D1 binding is unavailable.');
  const configRows=await env.DB.prepare(
    "SELECT id,data,updated_at FROM records WHERE type='config' AND json_extract(data,'$.key')='week_group' LIMIT 2"
  ).all();
  const configs=configRows.results||[];
  if (configs.length>1) throw failure('Duplicate Week Group configuration.');
  let configured='',initId='',configTime=NaN;
  if (configs.length) {
    let payload;
    try { payload=JSON.parse(configs[0].data); }
    catch { throw failure('Malformed active Week Group configuration.'); }
    configured=week(payload?.value);
    initId=String(payload?.initialization_request_id||'');
    configTime=stamp(configs[0].updated_at);
  }

  // The lifecycle table may be absent in pre-migration legacy D1 installations.
  // Missing table is supported; other SQL failures fail closed.
  let cycles=[];
  try {
    const result=await env.DB.prepare(
      "SELECT cycle_id,week_group,state,activated_at FROM gate_week_groups WHERE state<>'closed' LIMIT 2"
    ).all();
    cycles=result.results||[];
  } catch(error) {
    if (!/no such table:\s*gate_week_groups\b/i.test(String(error?.message||''))) throw error;
  }
  if (cycles.length>1) throw failure('Multiple nonclosed Week Group cycles.');
  if (!configured && !cycles.length) return state();
  if (!configured || (cycles.length && (cycles[0].state!=='active' || week(cycles[0].week_group)!==configured)))
    return state('', 'recovery_required', {recovery_required:true,week_group:configured||week(cycles[0]?.week_group),reason:'lifecycle_mismatch'});

  const archiveRows=await env.DB.prepare(
    "SELECT id,created_at,json_extract(data,'$.archived_at') AS archived_at FROM records WHERE type='archive' AND week_group=? ORDER BY created_at DESC"
  ).bind(configured).all();
  const archives=archiveRows.results||[];
  const dates=archives.map(row=>stamp(row.archived_at||row.created_at));
  // An invalid archive timestamp prevents attribution to a newer cycle.
  const lastArchive=dates.length && dates.every(Number.isFinite) ? Math.max(...dates) : (archives.length?NaN:null);
  const dormRows=await env.DB.prepare(
    "SELECT id,created_at,json_extract(data,'$.initialization_request_id') AS initialization_request_id FROM records WHERE type='dorm' AND week_group=?"
  ).bind(configured).all();
  const dorms=dormRows.results||[];

  let genuinelyActive=false;
  if (cycles.length) {
    const activated=stamp(cycles[0].activated_at);
    genuinelyActive=dorms.length>0 && (!archives.length || (Number.isFinite(lastArchive) && Number.isFinite(activated) && activated>lastArchive));
  } else if (!archives.length) {
    genuinelyActive=dorms.length>0;
  } else {
    // A historical label can be legitimately reused, but ONLY with fresh
    // initialization identity, configuration and newly created dorm evidence.
    genuinelyActive=Number.isFinite(lastArchive) && initId.length>0 &&
      Number.isFinite(configTime) && configTime>lastArchive &&
      dorms.some(row=>row.initialization_request_id===initId && stamp(row.created_at)>lastArchive);
  }
  if (genuinelyActive) return state(configured,'active');

  const counts=await env.DB.prepare(
    "SELECT type,COUNT(*) AS n FROM records WHERE week_group=? AND type IN ('bus','dorm','sound_event') GROUP BY type"
  ).bind(configured).all();
  const byType=Object.fromEntries((counts.results||[]).map(row=>[row.type,Number(row.n)||0]));
  const recovery={
    recovery_required:true,week_group:configured,
    reason:archives.length?'archived_residual_state':'missing_active_dorm_manifest',
    archive_id:archives.length===1?archives[0].id:null,
    residual_buses:byType.bus||0,
    residual_dorms:byType.dorm||0,
    residual_sound_events:byType.sound_event||0
  };
  return state('','recovery_required',recovery);
}
