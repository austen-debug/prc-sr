// Best-effort browser issue reporter; no request bodies, query strings,
// credentials, error message text, stack traces, or client IP addresses.
(()=>{'use strict';
 const originalFetch=window.fetch.bind(window),last=new Map();
 const allowed=path=>/^\/[a-zA-Z0-9_./-]{0,110}$/.test(path)?path:'/';
 const submit=(category,code,route,status=0)=>{
  const current=Date.now(),key=category+':'+code+':'+route;
  if(current-(last.get(key)||0)<60000)return;
  last.set(key,current);
  const payload=JSON.stringify({category,code,route:allowed(route),status});
  originalFetch('/api/client-diagnostics',{method:'POST',credentials:'same-origin',keepalive:true,
    headers:{'Content-Type':'application/json'},body:payload}).catch(()=>{});
 };
 window.addEventListener('error',event=>{
  const path=allowed(location.pathname);
  if(event.target&&event.target!==window)submit('ui','ASSET_LOAD_FAILURE',path);
  else submit('runtime','UNCAUGHT_SCRIPT_ERROR',path);
 },true);
 window.addEventListener('unhandledrejection',()=>submit('runtime','UNHANDLED_REJECTION',allowed(location.pathname)));
 window.fetch=(input,init)=>{
  // Maintain the original fetch interface, promise resolution and rejection.
  let endpoint='';
  try{const url=new URL(typeof input==='string'?input:input.url,location.href);if(url.origin===location.origin)endpoint=url.pathname;}catch{}
  const track=endpoint.startsWith('/api/')&&!['/api/client-diagnostics','/api/admin-diagnostics'].includes(endpoint);
  return originalFetch(input,init).then(response=>{
    if(track&&response.status>=500)submit('connectivity','API_HTTP_FAILURE',allowed(endpoint),response.status);
    return response;
  },error=>{
    if(track)submit('connectivity','API_NETWORK_FAILURE',allowed(endpoint));
    throw error;
  });
 };
})();
