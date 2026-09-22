// Single Squadron read contract. Only an authenticated instructor can publish a notice.
const READ_ROLES = new Set(['squadron', 'instructor']);
const DORM_STATES = new Set(['empty', 'open', 'closed']);

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}

function number(value) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) throw Object.assign(new Error('Invalid Squadron operational count.'), { code: 'integrity_error' });
  return parsed;
}

function bool(value) { return value === true || value === 'true' || value === 1 || value === '1'; }
function iso(value) {
  const ms = new Date(value || '').getTime();
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
function parseRow(row) {
  try {
    const payload = JSON.parse(row.data);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    return { ...payload, type: String(row.type).toLowerCase(), week_group: String(row.week_group).toUpperCase(), __row_id: String(row.id || '') };
  } catch { return null; }
}
function orderDorms(a, b) {
  // Match GateRecordDisplay: explicit Input order first, then stable SQL created_at order.
  const rank = dorm => {
    for (const key of ['display_order', 'input_order', 'source_row_index', 'row_index']) {
      const value = dorm[key];
      if (value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value))) return Number(value);
    }
    return null;
  };
  const left = rank(a), right = rank(b);
  if (left !== null && right !== null && left !== right) return left - right;
  if (left !== null && right === null) return -1;
  if (left === null && right !== null) return 1;
  return 0;
}

// Pure projection: never send raw D1 rows, notes, personnel, auditorium fields, or archives.
export function buildSquadronSnapshot({ weekGroup = '', records = [], now = new Date(), notice = null, lastFlight = '' } = {}) {
  const week = String(weekGroup || '').trim().toUpperCase();
  const instant = new Date(now).getTime();
  if (!Number.isFinite(instant)) throw new Error('Invalid snapshot time.');
  const airport = week ? records.filter(r => r?.type === 'bus' && String(r.week_group).toUpperCase() === week && String(r.bus_type || '').toLowerCase() === 'airport') : [];
  const dorms = week ? records.filter(r => r?.type === 'dorm' && String(r.week_group).toUpperCase() === week).sort(orderDorms) : [];
  const arrived = airport.filter(bus => String(bus.status || '').toLowerCase() === 'arrived').reduce((sum, bus) => sum + number(bus.otw_count), 0);
  const expected = dorms.reduce((sum, dorm) => sum + number(dorm.max_load), 0);
  const since = instant - 60 * 60 * 1000;
  const dispatches = airport.filter(bus => {
    const at = new Date(bus.departed_at || '').getTime();
    return Number.isFinite(at) && at > since && at <= instant;
  }).length;
  const traffic = { status: dispatches >= 3 ? 'HEAVY' : dispatches === 2 ? 'MEDIUM' : 'SLOW', dispatched_last_60_minutes: dispatches };
  const safeDorms = dorms.map(dorm => {
    const state = String(dorm.state || 'empty').toLowerCase();
    if (!DORM_STATES.has(state)) throw Object.assign(new Error('Unrecognized dorm state; Squadron Board withheld.'), { code: 'integrity_error' });
    const current = number(dorm.current_load);
    const maximum = number(dorm.max_load);
    const cardId = String(dorm.__row_id || dorm.id || `${dorm.sdq || ''}:${dorm.dorm_name || ''}:${dorm.section || ''}:${dorm.input_order || ''}`);
    if (!cardId.trim()) throw Object.assign(new Error('Dorm identity is missing.'), { code: 'integrity_error' });
    return {
      card_id: cardId,
      squadron: String(dorm.sdq || ''),
      dorm_name: String(dorm.dorm_name || ''),
      section: String(dorm.section || ''),
      state,
      phase: String(dorm.phase || ''),
      current_load: current,
      max_load: maximum,
      load_discrepancy: state === 'open' && maximum > 0 && current < maximum,
      sex: String(dorm.sex || '').toLowerCase() === 'female' ? 'female' : 'male',
      band: bool(dorm.band),
      space_force: bool(dorm.space_force) || bool(dorm.is_space_force)
    };
  });
  if (new Set(safeDorms.map(d => d.card_id)).size !== safeDorms.length) {
    throw Object.assign(new Error('Duplicate dorm identifiers; Squadron Board withheld.'), { code: 'integrity_error' });
  }
  const safeNotice = notice ? {
    revision: number(notice.id),
    message: String(notice.message || ''),
    published_at: iso(notice.published_at)
  } : null;
  if (lastFlight && (typeof lastFlight !== 'string' || lastFlight.length > 64)) {
    throw Object.assign(new Error('Invalid last-flight configuration.'), { code: 'integrity_error' });
  }
  return Object.freeze({
    week_group: week,
    metrics: Object.freeze({ arrived, expected, last_flight: lastFlight || null }),
    traffic: Object.freeze(traffic),
    dorms: Object.freeze(safeDorms),
    notice: safeNotice ? Object.freeze(safeNotice) : null,
    generated_at: new Date(instant).toISOString()
  });
}

async function activeWeekGroup(env) {
  const lifecycle = await env.DB.prepare("SELECT week_group FROM gate_week_groups WHERE state='active' LIMIT 2").all();
  const live = lifecycle.results || [];
  if (live.length > 1) throw Object.assign(new Error('Multiple active Week Groups.'), { code: 'integrity_error' });
  const configured = await env.DB.prepare("SELECT json_extract(data,'$.value') AS week_group FROM records WHERE type='config' AND json_extract(data,'$.key')='week_group' LIMIT 2").all();
  const configs = configured.results || [];
  if (configs.length > 1) throw Object.assign(new Error('Multiple Week Group configurations.'), { code: 'integrity_error' });
  const cycle = String(live[0]?.week_group || '').trim().toUpperCase();
  const config = String(configs[0]?.week_group || '').trim().toUpperCase();
  if (cycle && config && cycle !== config) throw Object.assign(new Error('Week Group lifecycle/config mismatch.'), { code: 'integrity_error' });
  return cycle || config;
}

async function readBoard(env) {
  const weekGroup = await activeWeekGroup(env);
  if (!weekGroup) return buildSquadronSnapshot({ now: new Date() });
  const source = await env.DB.prepare("SELECT id,type,week_group,data FROM records WHERE week_group=? AND type IN ('bus','dorm') ORDER BY created_at ASC").bind(weekGroup).all();
  const records = (source.results || []).map(parseRow);
  if (records.some(record => !record)) throw Object.assign(new Error('Malformed operational record; Squadron Board withheld.'), { code: 'integrity_error' });
  const flight = await env.DB.prepare("SELECT json_extract(data,'$.value') AS last_flight FROM records WHERE type='config' AND json_extract(data,'$.key')='last_airport' ORDER BY updated_at DESC LIMIT 1").first();
  const notice = await env.DB.prepare('SELECT id,message,published_at FROM gate_squadron_notices WHERE week_group=? ORDER BY id DESC LIMIT 1').bind(weekGroup).first();
  return buildSquadronSnapshot({ weekGroup, records, now: new Date(), notice, lastFlight: flight?.last_flight || '' });
}

export async function onRequestGet({ env, data }) {
  const role = String(data?.session?.role || '').toLowerCase();
  if (!READ_ROLES.has(role)) return reply({ isOk: false, code: 'forbidden', error: 'Forbidden.' }, 403);
  try {
    return reply({ isOk: true, editor: role === 'instructor', board: await readBoard(env) });
  } catch (error) {
    return reply({ isOk: false, code: error?.code || 'squadron_board_failed', error: error?.message || 'Board unavailable.' }, error?.code === 'integrity_error' ? 503 : 500);
  }
}

export async function onRequestPost({ request, env, data }) {
  if (data?.session?.role !== 'instructor') return reply({ isOk: false, code: 'forbidden', error: 'Instructor access required.' }, 403);
  const origin = request.headers.get('Origin');
  if (origin !== new URL(request.url).origin || request.headers.get('X-Gate-Notice') !== 'publish' || !/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
    return reply({ isOk: false, code: 'forbidden', error: 'Invalid publication request.' }, 403);
  }
  let payload;
  try {
    const text = await request.text();
    if (text.length > 4096) return reply({ isOk: false, code: 'validation', error: 'Notice request exceeds the allowed size.' }, 400);
    payload = JSON.parse(text);
  } catch { return reply({ isOk: false, code: 'validation', error: 'Invalid JSON notice.' }, 400); }
  const message = String(payload?.message ?? '').trim();
  const expectedRevision = payload?.expected_revision;
  if (!message || message.length > 1000 || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    return reply({ isOk: false, code: 'validation', error: 'A notice (1–1000 characters) and current revision are required.' }, 400);
  }
  try {
    const weekGroup = await activeWeekGroup(env);
    if (!weekGroup) return reply({ isOk: false, code: 'lifecycle_required', error: 'No active Week Group.' }, 409);
    const publishedAt = new Date().toISOString();
    // One atomic conditional insert: no overwrites, orphan notices, or two successful stale publishers.
    const result = await env.DB.prepare(`INSERT INTO gate_squadron_notices (week_group,message,published_at,published_by_role)
      SELECT wg.week_group, ?, ?, 'instructor' FROM gate_week_groups wg
      WHERE wg.state='active' AND wg.week_group=?
        AND COALESCE((SELECT MAX(id) FROM gate_squadron_notices WHERE week_group=?),0)=?`)
      .bind(message, publishedAt, weekGroup, weekGroup, expectedRevision).run();
    if (result.meta?.changes !== 1) return reply({ isOk: false, code: 'conflict', error: 'The active group or notice changed. Refresh before publishing.' }, 409);
    const revision = result.meta?.last_row_id;
    if (!Number.isSafeInteger(revision) || revision < 1) return reply({ isOk: false, code: 'publication_unconfirmed', error: 'Check the published notice before retrying.' }, 503);
    return reply({ isOk: true, notice: { revision, message, published_at: publishedAt } });
  } catch (error) {
    return reply({ isOk: false, code: error?.code || 'publication_failed', error: error?.message || 'Unable to publish notice.' }, error?.code === 'integrity_error' ? 503 : 500);
  }
}
