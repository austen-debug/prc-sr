import { cutoverRequested } from './persistence-core.mjs';
import { verifyCutoverReadiness } from './persistence.js';
import { verifyRequestSession } from './session-contract.mjs';
import { recordDiagnostic, safeRoute } from './diagnostic-store.mjs';

const restricted = (message, code = 'lifecycle_required', status = 409) => new Response(JSON.stringify({
  isOk: false, code, error: message
}), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const OPERATIONAL_TYPES = new Set(['bus', 'dorm', 'sound_event']);
const RECORD_TYPES = new Set(['bus', 'dorm', 'archive', 'config', 'sound_event', 'audit_event']);

function squadronApiAllowed(pathname, method) {
  if (pathname === '/api/session') return method === 'GET';
  if (pathname === '/api/logout') return method === 'POST';
  if (pathname === '/api/squadron-board') return method === 'GET';
  return false;
}

async function guardPersistence(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!cutoverRequested(env)) return null;
  if (!env.AUTH_SECRET) return restricted('AUTH_SECRET must be configured before enabling persistence.', 'configuration_required', 503);

  if (url.pathname === '/api/archive-delete' && request.method !== 'GET') {
    return restricted('Archived history is immutable. Record a correction through the amendment workflow.');
  }
  if (url.pathname !== '/api/records' || !['POST', 'PUT', 'DELETE'].includes(request.method)) return null;
  const preflight=await verifyCutoverReadiness(env);
  if (!preflight.ready) return restricted(preflight.message,'cutover_not_ready',503);

  let body;
  try { body = await request.clone().json(); }
  catch { return restricted('Invalid JSON request.', 'validation', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return restricted('Invalid record payload.', 'validation', 400);

  let stored = null;
  if (request.method !== 'POST') {
    const id = body.__backendId || body.id;
    if (!id) return restricted('Record ID is required.', 'validation', 400);
    stored = await env.DB.prepare('SELECT type,week_group,data FROM records WHERE id=?').bind(id).first();
    if (!stored) return null;
  }

  const type = String(stored?.type || body.type || '').trim().toLowerCase();
  if (request.method === 'POST' && !RECORD_TYPES.has(type)) {
    return restricted('Unsupported record type; no data was written.', 'validation', 400);
  }
  if (type === 'archive') return restricted('Archived history is immutable. Use archive amendments.');
  if (type === 'config') {
    let existingKey = '';
    if (stored) {
      try { existingKey = String(JSON.parse(stored.data)?.key || '').trim().toLowerCase(); }
      catch { return restricted('Stored configuration is invalid.', 'integrity_error', 503); }
    }
    if (existingKey === 'week_group' || String(body.key || '').trim().toLowerCase() === 'week_group') {
      return restricted('Only the transactional lifecycle may change the active Week Group.');
    }
  }
  if (request.method === 'POST' && type === 'dorm') {
    return restricted('Dorm initialization must use the transactional Week Group endpoint.');
  }

  if (OPERATIONAL_TYPES.has(type)) {
    const active = await env.DB.prepare("SELECT week_group FROM gate_week_groups WHERE state='active' LIMIT 1").first();
    if (!active) return restricted('Register an active Week Group before changing operational records.');
    const targetWeekGroup = String(stored?.week_group ?? body.week_group ?? '').trim().toUpperCase();
    const requestedWeekGroup = body.week_group === undefined ? targetWeekGroup : String(body.week_group || '').trim().toUpperCase();
    if (targetWeekGroup !== active.week_group || requestedWeekGroup !== active.week_group) {
      return restricted('Only records in the active Week Group can be modified.');
    }
    const configured = await env.DB.prepare("SELECT json_extract(data,'$.value') AS week_group FROM records WHERE type='config' AND json_extract(data,'$.key')='week_group' LIMIT 2").all();
    if (configured.results?.length !== 1 || configured.results[0].week_group !== active.week_group) {
      return restricted('Active Week Group configuration and lifecycle do not agree.', 'integrity_error', 503);
    }
  }
  return null;
}


// Admin inherits Instructor operational capabilities when D1 can retain the
// authenticated Admin role in audit history. The separate privileged Admin
// switch controls archive dispositions and future administration, not ordinary
// Receiving operations. Both classes fail closed until 0007 role provenance
// constraints and audit triggers have been verified against the live schema.
const INHERITED_ADMIN_WRITES = Object.freeze({
  '/api/records': new Set(['POST','PUT','DELETE']),
  '/api/persistence': new Set(['POST']),
  '/api/squadron-board': new Set(['POST'])
});
async function requireAdminWriteCompatibility(context,session) {
  if(session?.role!=='admin'||!['POST','PUT','PATCH','DELETE'].includes(context.request.method))return null;
  const path=new URL(context.request.url).pathname;
  // Identity revocation and sanitized issue reporting are independent of archive migration.
  if(['/api/logout','/api/admin-sessions','/api/admin-session-label','/api/client-diagnostics'].includes(path))return null;
  const inheritedOperationalWrite=INHERITED_ADMIN_WRITES[path]?.has(context.request.method)===true;
  if(!inheritedOperationalWrite && context.env?.GATE_ADMIN_WRITES_ENABLED!=='true')
    return restricted('Privileged Admin actions are disabled pending authorization.','admin_writes_disabled',503);
  if(!context.env?.DB)return restricted('Admin database is unavailable.','admin_schema_required',503);
  try {
    const schema=await context.env.DB.prepare(
      "SELECT name,sql FROM sqlite_master WHERE (type='table' AND name IN ('gate_audit_events','gate_archive_amendments','gate_squadron_notices','gate_squadron_information_revisions','gate_admin_archive_dispositions')) OR (type='trigger' AND name IN ('gate_record_audit_insert','gate_record_audit_update','gate_record_audit_delete','gate_mirror_records_insert','gate_mirror_records_update','gate_mirror_records_delete','trg_gate_admin_dispositions_no_delete','trg_gate_admin_dispositions_no_update'))"
    ).all();
    const found=new Map((schema.results||[]).map(row=>[row.name,String(row.sql||'')]));
    const roleTables=['gate_audit_events','gate_archive_amendments','gate_squadron_notices','gate_squadron_information_revisions'];
    const auditTriggers=['gate_record_audit_insert','gate_record_audit_update'];
    const dispositions=['gate_admin_archive_dispositions','trg_gate_admin_dispositions_no_delete','trg_gate_admin_dispositions_no_update'];
    const mirrorNames=['gate_mirror_records_insert','gate_mirror_records_update','gate_mirror_records_delete','gate_record_audit_delete'];
    const actorProvenanceReady=roleTables.every(name=>found.get(name)?.includes("'admin'")) &&
      auditTriggers.every(name=>found.get(name)?.includes("'admin'")) &&
      mirrorNames.every(name=>found.has(name));
    const privilegedDispositionReady=dispositions.every(name=>found.has(name));
    if(!actorProvenanceReady || (!inheritedOperationalWrite && !privilegedDispositionReady))
      return restricted('Authenticated Admin operational audit provenance is not ready. Migration 0007 must be validated before writing.','admin_schema_required',503);
  }catch{return restricted('Admin provenance verification failed.','admin_schema_required',503);}
  return null;
}

export async function onRequest(context) {
  // `context.data.session` may be populated by a verified upstream middleware.
  // It is server-owned request context, not client input. Re-verify only when absent.
  const session = context.data?.session || await verifyRequestSession(context.request, context.env);
  if (session) context.data.session = session;

  const url = new URL(context.request.url);
  if (session?.role === 'squadron' && !squadronApiAllowed(url.pathname, context.request.method)) {
    return restricted('Squadron access is limited to the read-only Squadron Board endpoint.', 'forbidden', 403);
  }

  const adminBlocked = await requireAdminWriteCompatibility(context,session);
  if(adminBlocked) return adminBlocked;

  const blocked = await guardPersistence(context);
  if (blocked) return blocked;
  // Record only response classification and route; never a payload, token,
  // query string or raw exception. The reporter is best-effort.
  try {
    const response=await context.next();
    if(url.pathname!=='/api/client-diagnostics' && response.status>=500) {
      await recordDiagnostic(context.env,{source:'server',category:'api',severity:'error',
        code:'API_HTTP_'+response.status,route:safeRoute(url.pathname),
        detail:'API returned a server error status.',status:response.status});
    }
    return response;
  } catch(error) {
    if(url.pathname!=='/api/client-diagnostics') {
      await recordDiagnostic(context.env,{source:'server',category:'api',severity:'error',
        code:'API_UNHANDLED_EXCEPTION',route:safeRoute(url.pathname),
        detail:'An unexpected API exception occurred.',status:500});
    }
    throw error;
  }
}
