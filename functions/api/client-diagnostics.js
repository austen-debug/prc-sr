// Authenticated browser issue reporting; accepted only same-origin, classified reports.
import {recordDiagnostic} from './diagnostic-store.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function onRequestPost({request,env,data}){
 if(!['admin','instructor','airman','squadron'].includes(data?.session?.role))return json({isOk:false,code:'unauthorized'},401);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({isOk:false,code:'origin_required'},403);
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))return json({isOk:false,code:'content_type'},415);
 let report;
 try{const raw=await request.text();if(raw.length>800)throw Error();report=JSON.parse(raw);}catch{return json({isOk:false,code:'invalid_payload'},400);}
 const category=['runtime','connectivity','ui'].includes(report?.category)?report.category:null;
 const code=String(report?.code||'');
 const route=String(report?.route||'');
 if(!category||!(/^[A-Z0-9_]{3,40}$/.test(code))||!/^\/[a-zA-Z0-9_./-]{0,110}$/.test(route))
  return json({isOk:false,code:'validation'},400);
 const status=Number(report.status)||0;
 // Only predefined message groups; avoid transferring raw exception text.
 const detail=category==='connectivity'?'Browser reported a failed API request or transport.'
  :category==='ui'?'Browser reported an asset loading failure.'
  :'Browser reported an uncaught script or promise failure.';
 await recordDiagnostic(env,{source:'client',category,code,route,detail,status:Number.isInteger(status)&&status>=0&&status<=599?status:0});
 return json({isOk:true});
}
