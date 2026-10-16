// Sanitized, bounded diagnostic telemetry. No raw HTTP bodies, URLs with query
// parameters, IP addresses, session tokens, stack traces, or trainee information.
export const safeRoute=value=>{
 const p=String(value||'').split('?')[0].split('#')[0];
 return /^\/[a-zA-Z0-9_./-]{0,110}$/.test(p)?p:'/';
};
export async function diagnosticReady(env){
 if(!env?.DB)return false;
 return Boolean(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='gate_diagnostic_events'").first());
}
export async function recordDiagnostic(env,input){
 try{
  if(!(await diagnosticReady(env)))return false;
  const code=String(input.code||'UNKNOWN').toUpperCase();
  const category=['api','runtime','connectivity','ui'].includes(input.category)?input.category:'runtime';
  const severity=input.severity==='warning'?'warning':'error';
  const source=input.source==='client'?'client':'server';
  // Details originate from static server messages or tightly structured browser
  // error types. Never persist arbitrary exception message/stack content.
  const detail=String(input.detail||'No additional safe diagnostic data').slice(0,200);
  await env.DB.prepare('INSERT INTO gate_diagnostic_events(event_id,source,category,severity,code,route,detail,http_status,occurred_at) VALUES(?,?,?,?,?,?,?,?,?)')
   .bind(crypto.randomUUID(),source,category,/^[A-Z0-9_]{2,48}$/.test(code)?code:'UNKNOWN',
    safeRoute(input.route),detail,Number.isSafeInteger(input.status)?input.status:0,Date.now()).run();
  return true;
 }catch(error){if(env?.GATE_TEST_DEBUG==='true')console.warn('DIAGNOSTIC_SQL_TEST_ERROR:',error?.message);return false;}
}
