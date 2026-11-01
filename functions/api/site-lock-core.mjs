// Read-only authoritative Site Lock contract. Missing migration leaves the
// existing site operational; malformed/failed installed state fails closed.
export async function readSiteLock(env) {
  if (!env?.DB) throw new Error('D1 binding unavailable for Site Lock.');
  let row;
  try {
    row=await env.DB.prepare('SELECT locked,revision,reason,updated_at FROM gate_admin_system_control WHERE id=1').first();
  } catch (error) {
    if (/no such table:\s*gate_admin_system_control\b/i.test(String(error?.message||'')))
      return Object.freeze({installed:false,locked:false,revision:0});
    throw error;
  }
  if (!row || ![0,1].includes(Number(row.locked)) || !Number.isSafeInteger(Number(row.revision)))
    throw new Error('Site Lock control record invalid.');
  return Object.freeze({
    installed:true,locked:Number(row.locked)===1,
    revision:Number(row.revision),reason:String(row.reason||''),updated_at:row.updated_at
  });
}

export const siteLockJson=(body,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
});

export function siteLockBlockedApi() {
  return siteLockJson({isOk:false,code:'site_locked',error:'GATE is currently down for maintenance.'},423);
}

export function siteMaintenancePage() {
  // Never render the underlying protected application while Site Lock is on.
  // The blur is a visual treatment only; access is denied by middleware.
  const html=String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>GATE — Maintenance</title>
<style>
:root{color-scheme:dark;font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif}
*{box-sizing:border-box}body{margin:0;min-height:100dvh;background:#0c1523;color:#eef3fa;display:grid;place-items:center}
.backdrop{position:fixed;inset:-25px;filter:blur(15px);opacity:.35;pointer-events:none;background:
linear-gradient(110deg,#2a445e 18%,#152e45 18% 22%,transparent 22%),
repeating-linear-gradient(0deg,#283c52 0 36px,#111f30 36px 60px)}
.backdrop:after{content:"";position:absolute;inset:12% 10%;border:2px solid #7192ae;border-radius:18px}
main{position:relative;z-index:1;width:min(92vw,490px);padding:2.25rem 2rem;background:#16263a;border:1px solid #526982;border-radius:18px;text-align:center;box-shadow:0 25px 75px #0009}
.icon{font-size:2rem;margin-bottom:.75rem}h1{font-size:1.35rem;line-height:1.4;margin:0 0 .75rem}
p{color:#c9d5e3;line-height:1.6}button{font:inherit;cursor:pointer;background:#263d56;color:#fff;border:1px solid #7995ac;border-radius:9px;padding:.85rem 2rem;font-weight:700;width:100%;margin-top:1rem}
button:focus-visible{outline:3px solid #9ad4ff;outline-offset:3px}
</style></head><body><div class="backdrop" aria-hidden="true"></div>
<main role="dialog" aria-modal="true" aria-labelledby="title" aria-describedby="description">
<div class="icon" aria-hidden="true">🔒</div><h1 id="title">GATE is currently down for maintenance</h1>
<p id="description">System access has been temporarily restricted by an administrator.</p>
<form action="/api/logout" method="post" id="logout"><button type="submit">LOG OUT</button></form>
</main><script>
document.getElementById('logout').addEventListener('submit',async function(e){
e.preventDefault();try{await fetch('/api/logout',{method:'POST',credentials:'same-origin',cache:'no-store'});}catch(_){}
location.replace('/login/');
});
let previous=null;
async function check(){
try{const r=await fetch('/api/site-status',{credentials:'same-origin',cache:'no-store'});
if(!r.ok)return;const s=await r.json();
if(previous===null)previous=s.revision;
if(s.isOk&&s.locked===false)location.replace('/');}catch(_){}}
setInterval(check,10000);
</script></body></html>`;
  return new Response(html,{status:200,headers:{'Content-Type':'text/html; charset=UTF-8','Cache-Control':'no-store','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff'}});
}
