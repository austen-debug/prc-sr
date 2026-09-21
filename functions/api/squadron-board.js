const SQUADRON_READ_ROLES = new Set(['squadron', 'instructor']);

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function n(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function safeParse(row) {
  try {
    return { ...JSON.parse(row?.data || '{}'), __rowCreatedAt: row?.created_at || '', __rowUpdatedAt: row?.updated_at || '' };
  } catch {
    return null;
  }
}

function safeIso(value) {
  const ms = new Date(value || '').getTime();
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function compareDorms(left, right) {
  const lOrder = n(left.display_order || left.input_order || left.source_row_index);
  const rOrder = n(right.display_order || right.input_order || right.source_row_index);
  if (lOrder !== rOrder) return lOrder - rOrder;
  return String(left.dorm_name || '').localeCompare(String(right.dorm_name || ''));
}

export function buildSquadronSnapshot({ weekGroup = '', records = [], now = new Date() } = {}) {
  const normalizedWeekGroup = String(weekGroup || '').trim().toUpperCase();
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const hourAgo = nowMs - (60 * 60 * 1000);

  const buses = records
    .filter(record => record && record.type === 'bus' && String(record.week_group || '').toUpperCase() === normalizedWeekGroup)
    .filter(record => String(record.bus_type || '').toLowerCase() === 'airport');
  const dorms = records
    .filter(record => record && record.type === 'dorm' && String(record.week_group || '').toUpperCase() === normalizedWeekGroup)
    .sort(compareDorms);

  const arrived = buses
    .filter(bus => String(bus.status || '').toLowerCase() === 'arrived')
    .reduce((sum, bus) => sum + n(bus.otw_count), 0);
  const expected = dorms.reduce((sum, dorm) => sum + n(dorm.max_load), 0);

  const dispatchedLastHour = buses.filter(bus => {
    const departedMs = new Date(bus.departed_at || '').getTime();
    return Number.isFinite(departedMs) && departedMs >= hourAgo && departedMs <= nowMs;
  }).length;
  const tempo = dispatchedLastHour >= 3 ? 'HEAVY' : (dispatchedLastHour === 2 ? 'MEDIUM' : 'SLOW');

  const activeBuses = buses
    .filter(bus => ['active', 'otw'].includes(String(bus.status || '').toLowerCase()))
    .sort((a, b) => new Date(a.departed_at || 0) - new Date(b.departed_at || 0))
    .map(bus => ({
      bus_id: String(bus.bus_id || ''),
      count: n(bus.otw_count),
      departed_at: safeIso(bus.departed_at || bus.created_at)
    }));

  const safeDorms = dorms.map(dorm => ({
    squadron: String(dorm.sdq || ''),
    dorm_name: String(dorm.dorm_name || ''),
    section: String(dorm.section || ''),
    state: ['open', 'closed'].includes(String(dorm.state || '').toLowerCase()) ? String(dorm.state).toLowerCase() : 'empty',
    phase: String(dorm.phase || ''),
    current_load: n(dorm.current_load),
    max_load: n(dorm.max_load),
    sex: String(dorm.sex || '').toLowerCase() === 'female' ? 'female' : 'male',
    band: bool(dorm.band),
    space_force: bool(dorm.space_force) || bool(dorm.is_space_force)
  }));

  return Object.freeze({
    week_group: normalizedWeekGroup,
    metrics: Object.freeze({ arrived, expected }),
    traffic: Object.freeze({ status: tempo, dispatched_last_60_minutes: dispatchedLastHour }),
    active_buses: Object.freeze(activeBuses),
    dorms: Object.freeze(safeDorms),
    generated_at: new Date(nowMs).toISOString()
  });
}

async function activeWeekGroup(env) {
  const lifecycle = await env.DB.prepare(
    "SELECT week_group FROM gate_week_groups WHERE state='active' LIMIT 2"
  ).all();
  const live = lifecycle.results || [];
  if (live.length > 1) throw Object.assign(new Error('Multiple active Week Groups detected.'), { code: 'integrity_error' });

  const config = await env.DB.prepare(
    "SELECT json_extract(data,'$.value') AS week_group FROM records WHERE type='config' AND json_extract(data,'$.key')='week_group' LIMIT 2"
  ).all();
  const configured = config.results || [];
  if (configured.length > 1) throw Object.assign(new Error('Multiple active Week Group configuration records detected.'), { code: 'integrity_error' });

  const lifecycleWeek = String(live[0]?.week_group || '').trim().toUpperCase();
  const configWeek = String(configured[0]?.week_group || '').trim().toUpperCase();
  if (lifecycleWeek && configWeek && lifecycleWeek !== configWeek) {
    throw Object.assign(new Error('Lifecycle and active Week Group configuration do not agree.'), { code: 'integrity_error' });
  }
  return lifecycleWeek || configWeek;
}

export async function onRequestGet({ env, data }) {
  const role = String(data?.session?.role || '').toLowerCase();
  if (!SQUADRON_READ_ROLES.has(role)) {
    return jsonResponse({ isOk: false, code: 'forbidden', error: 'Forbidden.' }, 403);
  }

  try {
    const weekGroup = await activeWeekGroup(env);
    if (!weekGroup) {
      return jsonResponse({
        isOk: true,
        board: buildSquadronSnapshot({ weekGroup: '', records: [], now: new Date() })
      });
    }

    const result = await env.DB.prepare(
      `SELECT type, week_group, data, created_at, updated_at
       FROM records
       WHERE week_group = ? AND type IN ('bus','dorm')
       ORDER BY created_at ASC`
    ).bind(weekGroup).all();

    const records = (result.results || [])
      .map(row => {
        const parsed = safeParse(row);
        if (!parsed) return null;
        return {
          ...parsed,
          type: String(parsed.type || row.type || '').toLowerCase(),
          week_group: String(parsed.week_group || row.week_group || '').toUpperCase()
        };
      })
      .filter(Boolean);

    return jsonResponse({
      isOk: true,
      board: buildSquadronSnapshot({ weekGroup, records, now: new Date() })
    });
  } catch (error) {
    return jsonResponse({
      isOk: false,
      code: error?.code || 'squadron_board_failed',
      error: error?.message || 'Unable to load Squadron Board.'
    }, error?.code === 'integrity_error' ? 503 : 500);
  }
}
