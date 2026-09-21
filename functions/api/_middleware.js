import { verifyRequestSession } from './session-contract.mjs';

const restricted = (message, code = 'lifecycle_required', status = 409) => new Response(JSON.stringify({
  isOk: false, code, error: message
}), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const OPERATIONAL_TYPES = new Set(['bus', 'dorm', 'sound_event']);
const RECORD_TYPES = new Set(['bus', 'dorm', 'archive', 'config', 'sound_event', 'audit_event']);

async function guardPersistence(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (env.GATE_PERSISTENCE_ENABLED !== 'true') return null;
  if (!env.AUTH_SECRET) return restricted('AUTH_SECRET must be configured before enabling persistence.', 'configuration_required', 503);

  // The persistence endpoint alone owns retries and verifies the archived row AND closed cycle.
  // Never return a synthetic closeout success from middleware based on an operation row alone.
  if (url.pathname === '/api/archive-delete' && request.method !== 'GET') {
    return restricted('Archived history is immutable. Record a correction through the amendment workflow.');
  }
  if (url.pathname !== '/api/records' || !['POST', 'PUT', 'DELETE'].includes(request.method)) return null;

  let body;
  try { body = await request.clone().json(); }
  catch { return restricted('Invalid JSON request.', 'validation', 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return restricted('Invalid record payload.', 'validation', 400);

  let stored = null;
  if (request.method !== 'POST') {
    const id = body.__backendId || body.id;
    if (!id) return restricted('Record ID is required.', 'validation', 400);
    stored = await env.DB.prepare('SELECT type,week_group,data FROM records WHERE id=?').bind(id).first();
    // The records endpoint retains ownership of its not-found response.
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

  // Existing bus/dorm CRUD remains owned by records; D1 triggers mirror each committed write.
  // Reject cross-cycle, orphan and post-closeout mutations rather than creating a second live WG.
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

export async function onRequest(context) {
  const session = await verifyRequestSession(context.request, context.env);
  if (session) context.data.session = session;
  const blocked = await guardPersistence(context);
  if (blocked) return blocked;
  return context.next();
}
