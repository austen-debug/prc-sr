import { verifyRequestSession } from './session-contract.mjs';

const restricted = (message, code = 'lifecycle_required', status = 409) => new Response(JSON.stringify({
  isOk: false, code, error: message
}), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function validateLengths(payload) {
  const fields = { sdq: 48, sec: 48, inter_sec: 64, dorm_name: 80 };
  if (String(payload.proposed_week_group || '').length > 24) return 'Week Group ID is too long.';
  for (const [index, row] of (Array.isArray(payload.rows) ? payload.rows : []).entries()) {
    for (const [field, limit] of Object.entries(fields)) {
      if (String(row?.[field] ?? '').length > limit) return `Row ${index + 1} ${field} exceeds ${limit} characters; no input was truncated.`;
    }
  }
  for (const key of ['receiving_day_one_start','receiving_day_one_end','receiving_day_two_start','receiving_day_two_end']) {
    if (String(payload.receiving_windows?.[key] || '').length > 40) return `Invalid receiving-window value: ${key}.`;
  }
  return '';
}

async function guardPersistence(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (env.GATE_PERSISTENCE_ENABLED !== 'true') return null;
  if (!env.AUTH_SECRET) return restricted('AUTH_SECRET must be configured before enabling persistence.', 'configuration_required', 503);
  if (request.method === 'POST' && url.pathname === '/api/persistence' && context.data.session?.role === 'instructor') {
    let body;
    try { body = await request.clone().json(); }
    catch { return restricted('Invalid JSON request.', 'validation', 400); }
    if (body?.action === 'save_draft') {
      const error = validateLengths(body);
      if (error) return restricted(error, 'validation', 400);
    }
    if (body?.action === 'closeout' && typeof body.cycle_id === 'string' && body.cycle_id) {
      const existing = await env.DB.prepare('SELECT status,archive_id FROM gate_workflow_operations WHERE idempotency_key=?')
        .bind(`closeout:${body.cycle_id}`).first();
      if (existing?.status === 'completed') {
        const cycle = await env.DB.prepare('SELECT week_group FROM gate_week_groups WHERE cycle_id=?').bind(body.cycle_id).first();
        return new Response(JSON.stringify({ isOk: true, idempotent: true, archive_id: existing.archive_id, week_group: cycle?.week_group || '' }), {
          headers: { 'Content-Type':'application/json', 'Cache-Control':'no-store' }
        });
      }
    }
  }
  // Legacy generic CRUD must not bypass the transactional lifecycle or mutate archived history.
  if (url.pathname === '/api/archive-delete' && request.method !== 'GET') {
    return restricted('Archived history is immutable. Record a correction through the amendment workflow.');
  }
  if (url.pathname === '/api/records' && ['POST','PUT','DELETE'].includes(request.method)) {
    let body;
    try { body = await request.clone().json(); }
    catch { return restricted('Invalid JSON request.', 'validation', 400); }
    let type = String(body?.type || '').toLowerCase();
    let configKey = type === 'config' ? String(body.key || '') : '';
    if (request.method !== 'POST') {
      const id = body?.__backendId || body?.id;
      if (id) {
        const stored = await env.DB.prepare('SELECT type,data FROM records WHERE id=?').bind(id).first();
        if (stored) {
          type = stored.type;
          if (type === 'config') {
            try { configKey = String(JSON.parse(stored.data)?.key || ''); }
            catch { return restricted('Stored configuration is invalid.', 'integrity_error', 503); }
          }
        }
      }
    }
    if (type === 'archive') return restricted('Archived history is immutable. Use archive amendments.');
    if (type === 'config' && configKey === 'week_group') return restricted('Only the transactional lifecycle may change the active Week Group.');
    if (request.method === 'POST' && type === 'dorm') return restricted('Dorm initialization must use the transactional Week Group endpoint.');
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
