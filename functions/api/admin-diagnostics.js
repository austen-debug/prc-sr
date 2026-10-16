// Admin-only incident triage: live diagnostics plus observed (not inferred-active) events.
import {diagnosticReady} from './diagnostic-store.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
export async function onRequestGet({env,data}){
 if(data?.session?.role!=='admin')return json({isOk:false,code:'forbidden'},403);
 try{
  const check=await env.DB.prepare('SELECT 1 AS online').first();
  const installed=await diagnosticReady(env);
  const result=installed
   ?await env.DB.prepare('SELECT event_id,source,category,severity,code,route,detail,http_status,occurred_at FROM gate_diagnostic_events ORDER BY occurred_at DESC LIMIT 150').all()
   :{results:[]};
  const checks=[
   {code:'D1_CONNECTIVITY',ok:Number(check?.online)===1,description:'D1 database queries are responding.'},
   {code:'ERROR_REPORTING',ok:installed,description:installed?'Diagnostic event storage is installed.':'Install additive migration 0009 to retain newly observed application errors.'}
  ];
  return json({isOk:true,checkedAt:Date.now(),checks,events:(result.results||[]).map(e=>({
   id:e.event_id,source:e.source,category:e.category,severity:e.severity,code:e.code,
   route:e.route,detail:e.detail,status:Number(e.http_status),at:Number(e.occurred_at)
  })),note:'Events are observed errors, not proof that a problem remains unresolved. Browser reports begin only after the reporter is deployed; old errors cannot be reconstructed.'});
 }catch{return json({isOk:false,code:'diagnostics_unavailable',error:'The diagnostics endpoint could not query D1.'},503);}
}
export async function onRequestPost(){return json({isOk:false,code:'read_only'},405);}
