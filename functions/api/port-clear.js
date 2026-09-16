import { normalizeServerRole } from './records-contract.mjs';

const TIME_ZONE = 'America/Chicago';
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit',
  day: '2-digit', hour: '2-digit', minute: '2-digit'
});

function respond(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function chicagoParts(ms) {
  return Object.fromEntries(formatter.formatToParts(new Date(ms)).map(part => [part.type, part.value]));
}

// Input's datetime-local value is a San Antonio wall-clock time, not UTC or viewer-local time.
function receivingStartUtc(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const wallMs = Date.UTC(year, month - 1, day, hour, minute);
  if (new Date(wallMs).toISOString().slice(0, 16) !== value) return null;
  // Determine the matching Chicago UTC offset using the IANA time zone, including DST.
  const matches = [];
  for (let hours = -14; hours <= 14; hours += 1) {
    const utcMs = wallMs + hours * 3600000;
    const parts = chicagoParts(utcMs);
    if (Number(parts.year) === year && Number(parts.month) === month &&
        Number(parts.day) === day && Number(parts.hour) === hour &&
        Number(parts.minute) === minute) matches.push(utcMs);
  }
  return matches.length ? new Date(Math.min(...matches)).toISOString() : null;
}

async function currentWeekGroup(env) {
  const row = await env.DB.prepare(
    `SELECT data FROM records WHERE type = 'config'
     AND json_valid(data) AND json_extract(data, '$.key') = 'week_group'
     ORDER BY updated_at DESC LIMIT 1`
  ).first();
  try { return String(JSON.parse(row?.data || '{}').value || '').trim(); }
  catch { return ''; }
}

async function dayTwoStart(env, weekGroup) {
  const rows = await env.DB.prepare(
    `SELECT DISTINCT json_extract(data, '$.receiving_day_two_start') AS day_two
     FROM records WHERE type = 'dorm' AND week_group = ?
     AND json_valid(data) AND NULLIF(json_extract(data, '$.receiving_day_two_start'), '') IS NOT NULL`
  ).bind(weekGroup).all();
  const starts = (rows.results || []).map(row => String(row.day_two || '').trim()).filter(Boolean);
  return starts.length === 1 ? starts[0] : null;
}

function requestRole(data) {
  return normalizeServerRole(data?.session?.role);
}

export async function onRequestGet({ env, data }) {
  if (!['instructor', 'airman', 'squadron', 'system'].includes(requestRole(data))) {
    return respond({ isOk: false, error: 'Unauthorized.' }, 401);
  }
  try {
    const weekGroup = await currentWeekGroup(env);
    const serverNow = new Date().toISOString();
    if (!weekGroup) return respond({ isOk: true, weekGroup: '', event: null, serverNow });
    const row = await env.DB.prepare(
      `SELECT id, data FROM records WHERE type = 'port_clear' AND week_group = ?
       ORDER BY created_at DESC, id DESC LIMIT 1`
    ).bind(weekGroup).first();
    const record = row ? JSON.parse(row.data) : null;
    const event = record && Date.parse(record.expires_at) > Date.parse(serverNow)
      ? { id: row.id, weekGroup, sentAt: record.sent_at, expiresAt: record.expires_at }
      : null;
    return respond({ isOk: true, weekGroup, event, serverNow });
  } catch {
    return respond({ isOk: false, error: 'Unable to load PORT CLEAR status.' }, 500);
  }
}

export async function onRequestPost({ request, env, data }) {
  if (requestRole(data) !== 'instructor') {
    return respond({ isOk: false, error: 'Instructor access required.' }, 403);
  }
  try {
    const input = await request.json().catch(() => ({}));
    const weekGroup = await currentWeekGroup(env);
    if (!weekGroup || String(input.weekGroup || '') !== weekGroup) {
      return respond({ isOk: false, error: 'The active Week Group changed. Refresh before sending PORT CLEAR.' }, 409);
    }
    const start = await dayTwoStart(env, weekGroup);
    if (!start) {
      return respond({ isOk: false, error: 'Receiving Day Two start must be configured consistently on the Input page before PORT CLEAR can be sent.' }, 409);
    }
    const expiresAt = receivingStartUtc(start);
    const now = new Date().toISOString();
    if (!expiresAt || Date.parse(expiresAt) <= Date.parse(now)) {
      return respond({ isOk: false, error: 'Receiving Day Two has started or its configured start is invalid.' }, 409);
    }
    const id = crypto.randomUUID();
    const record = {
      type: 'port_clear', week_group: weekGroup, sent_at: now,
      expires_at: expiresAt, receiving_day_two_start: start,
      created_at: now, created_by_role: 'instructor'
    };
    await env.DB.prepare(
      `INSERT INTO records (id, type, week_group, data, created_at, updated_at)
       VALUES (?, 'port_clear', ?, ?, ?, ?)`
    ).bind(id, weekGroup, JSON.stringify(record), now, now).run();
    return respond({ isOk: true, weekGroup, event: {
      id, weekGroup, sentAt: now, expiresAt
    }, serverNow: now }, 201);
  } catch {
    return respond({ isOk: false, error: 'Unable to send PORT CLEAR. No alert was confirmed.' }, 500);
  }
}
