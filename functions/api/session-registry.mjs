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
export async function registerSession(env,{sessionId,username,role,issuedAt,expiresAt,userAgent}){
  const {device,browser}=describeDevice(userAgent);
  const db=env.DB;
  await db.batch([
    db.prepare('INSERT INTO gate_auth_sessions(session_id,username,role,device_label,browser_label,issued_at,expires_at,last_seen_at) VALUES(?,?,?,?,?,?,?,?)')
      .bind(sessionId,username,role,device,browser,issuedAt,expiresAt,issuedAt),
    db.prepare("INSERT INTO gate_auth_session_events(event_id,session_id,event_type,target_role,actor_role,reason,occurred_at) VALUES(?,?,'login',?,?,'',?)")
      .bind(crypto.randomUUID(),sessionId,role,role,issuedAt)
  ]);
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
