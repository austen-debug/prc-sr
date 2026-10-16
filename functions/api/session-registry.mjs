// Privacy-bounded descriptions from ordinary User-Agent and Cloudflare request.cf.
// Geo is the approximate network egress at sign-in, not GPS or an attested location.
export const bounded=(value,length=80)=>typeof value==='string'
 ? value.replace(/[\x00-\x1F\x7F<>]/g,'').trim().slice(0,length):'';
export function describeContext(request){
 const ua=String(request?.headers?.get('User-Agent')||'').slice(0,512);
 let os='';
 if(/iPhone|iPad|iPod/i.test(ua)){
  const version=ua.match(/OS (\d+(?:_\d+){0,2})/i)?.[1]?.replaceAll('_','.')||'';
  os=(/iPad/i.test(ua)?'iPadOS':'iOS')+(version?' '+version:'');
 }else if(/Android/i.test(ua)){
  os='Android'+(ua.match(/Android\s+(\d+(?:\.\d+){0,2})/i)?.[1]?' '+ua.match(/Android\s+(\d+(?:\.\d+){0,2})/i)[1]:'');
 }else if(/Windows NT/i.test(ua)){
  const version=ua.match(/Windows NT\s+([0-9.]+)/i)?.[1]||'';
  os='Windows'+(version==='10.0'?' (NT 10; Windows 10/11)':version?' (NT '+version+')':'');
 }else if(/CrOS/i.test(ua))os='ChromeOS';
 else if(/Mac OS X/i.test(ua))os='macOS';
 else if(/Linux/i.test(ua))os='Linux';
 const b=ua.match(/Edg(?:e|A|iOS)?\/([0-9.]+)/i)
  ||ua.match(/FxiOS\/([0-9.]+)/i)
  ||ua.match(/Firefox\/([0-9.]+)/i)
  ||ua.match(/CriOS\/([0-9.]+)/i)
  ||ua.match(/Chrome\/([0-9.]+)/i)
  ||ua.match(/Version\/([0-9.]+).*Safari/i);
 const cf=request?.cf||{};
 return {
  os:bounded(os,48),
  browserVersion:bounded(b?.[1]||'',32),
  city:bounded(cf.city,80),region:bounded(cf.region,80),
  country:/^[A-Z]{2}$/.test(String(cf.country||'').toUpperCase())?String(cf.country).toUpperCase():'',
  organization:bounded(cf.asOrganization,100)
 };
}

// Signed-cookie session registry. No raw IP address or raw browser fingerprint is stored.
// Untracked pre-migration cookies cannot be remotely revoked; they expire on their original clock.
export async function registryReady(env) {
  if (!env?.DB) return false;
  const result=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('gate_auth_sessions','gate_auth_session_events')").all();
  const names=new Set((result.results||[]).map(r=>r.name));
  return names.has('gate_auth_sessions')&&names.has('gate_auth_session_events');
}
export function describeDevice(userAgent=''){
  const ua=String(userAgent).slice(0,512);
  const device=/iPad/i.test(ua)?'Tablet':/iPhone|Android.+Mobile/i.test(ua)?'Phone':/Android/i.test(ua)?'Tablet':/Windows|Macintosh|Linux/i.test(ua)?'Computer':'Unknown device';
  const browser=/Edg\//i.test(ua)?'Edge':/Firefox\//i.test(ua)?'Firefox':/Chrome\//i.test(ua)?'Chrome':/Safari\//i.test(ua)?'Safari':'Unknown browser';
  return {device,browser};
}
export async function sessionDetailsReady(env){
 if(!env?.DB)return false;
 try{
  const [columns,labels]=await Promise.all([
   env.DB.prepare("PRAGMA table_info('gate_auth_sessions')").all(),
   env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='gate_auth_session_label_events'").first()
  ]);
  const names=new Set((columns.results||[]).map(c=>c.name));
  return Boolean(labels)&&['os_label','browser_version','city','region','country','network_organization','device_nickname']
    .every(k=>names.has(k));
 }catch{return false;}
}
export async function registerSession(env,{sessionId,username,role,issuedAt,expiresAt,userAgent,request}){
  const {device,browser}=describeDevice(userAgent);
  const db=env.DB;
  const details=await sessionDetailsReady(env);
  const context=details?describeContext(request):null;
  const insert=details
   ?db.prepare('INSERT INTO gate_auth_sessions(session_id,username,role,device_label,browser_label,issued_at,expires_at,last_seen_at,os_label,browser_version,city,region,country,network_organization) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(sessionId,username,role,device,browser,issuedAt,expiresAt,issuedAt,
       context.os,context.browserVersion,context.city,context.region,context.country,context.organization)
   :db.prepare('INSERT INTO gate_auth_sessions(session_id,username,role,device_label,browser_label,issued_at,expires_at,last_seen_at) VALUES(?,?,?,?,?,?,?,?)')
      .bind(sessionId,username,role,device,browser,issuedAt,expiresAt,issuedAt);
  await db.batch([
    insert,
    db.prepare("INSERT INTO gate_auth_session_events(event_id,session_id,event_type,target_role,actor_role,reason,occurred_at) VALUES(?,?,'login',?,?,'',?)")
      .bind(crypto.randomUUID(),sessionId,role,role,issuedAt)
  ]);
  // Limit retained login-location data to 30 days after expiration.
  // Cleanup must never break sign-in or an authenticated session.
  try{await db.prepare('DELETE FROM gate_auth_sessions WHERE expires_at < ?').bind(issuedAt-30*86400000).run();}catch{}
}
export async function checkTrackedSession(env,payload){
  if(!env?.DB||typeof payload.sid!=='string'||!/^[a-f0-9-]{36}$/i.test(payload.sid))return false;
  const now=Date.now();
  const r=await env.DB.prepare('SELECT username,role,issued_at,expires_at,revoked_at FROM gate_auth_sessions WHERE session_id=?').bind(payload.sid).first();
  if(!r||r.revoked_at!==null||r.username!==payload.username||r.role!==payload.role||Number(r.issued_at)!==payload.iat||Number(r.expires_at)!==payload.exp||Number(r.expires_at)<=now)return false;
  // Conditional activity mark: the UPDATE changes a row only once per 60 seconds.
  await env.DB.prepare('UPDATE gate_auth_sessions SET last_seen_at=? WHERE session_id=? AND last_seen_at<? AND revoked_at IS NULL AND expires_at>?')
    .bind(now,payload.sid,now-60000,now).run();
  return true;
}
export async function revokeSelfSession(env,session){
  if(!env?.DB||!session?.sid)return;
  const now=Date.now();
  const db=env.DB;
  await db.batch([
    db.prepare('UPDATE gate_auth_sessions SET revoked_at=?,revoked_by_role=?,revoke_reason=? WHERE session_id=? AND revoked_at IS NULL')
      .bind(now,'self','Signed out',session.sid),
    db.prepare("INSERT INTO gate_auth_session_events(event_id,session_id,event_type,target_role,actor_role,reason,occurred_at) VALUES(?,?,'logout',?,?,'Signed out',?)")
      .bind(crypto.randomUUID(),session.sid,session.role,session.role,now)
  ]);
}
