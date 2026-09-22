function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

function roleOf(data) {
  return String(data?.session?.role || '').trim().toLowerCase();
}

function forbidden() {
  return jsonResponse({ isOk: false, code: 'forbidden', error: 'Instructor authorization is required.' }, 403);
}

function safeObject(value) {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeArray(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function timestamp(value) {
  const time = Date.parse(String(value || ''));
  return Number.isFinite(time) ? time : 0;
}

function archiveSummary(row, amendments = []) {
  const stored = safeObject(row.data);
  const data = applyAmendments(stored, amendments);
  const archivedAt = String(data.archived_at || row.created_at || '');
  return {
    id: String(row.id || ''),
    week_group: String(data.week_group || row.week_group || ''),
    archived_at: archivedAt,
    created_at: String(data.created_at || row.created_at || ''),
    updated_at: String(data.updated_at || row.updated_at || ''),
    dorm_count: number(data.dorm_count),
    bus_count: number(data.bus_count),
    total_arrived: number(data.total_arrived),
    total_loaded: number(data.total_loaded),
    total_expected: number(data.total_expected),
    female_total: number(data.female_total),
    nat_total: number(data.nat_total),
    space_force_total: number(data.space_force_total || data.arrived_space_force_total),
    archive_schema_version: String(data.archive_schema_version || ''),
    source_record_count: number(data.source_record_count),
    source_snapshot_format: String(data.source_snapshot_format || ''),
    integrity: stored.source_snapshot_format === 'lossless-record-rows-v1'
      ? 'lossless'
      : (String(stored.archive_schema_version || '').startsWith('gate-archive-schema-v3') ? 'canonical' : 'legacy'),
    amendment_count: amendments.length
  };
}

async function archiveRows(env) {
  const result = await env.DB.prepare(
    `SELECT id, week_group, data, created_at, updated_at
     FROM records
     WHERE type = 'archive'
     ORDER BY created_at DESC, id DESC`
  ).all();
  return result.results || [];
}

async function amendmentRows(env, archiveId) {
  try {
    const result = await env.DB.prepare(
      `SELECT amendment_id, archive_id, cycle_id, amendment_number, amendment_type,
              reason, changes_json, actor_role, created_at
       FROM gate_archive_amendments
       WHERE archive_id = ?
       ORDER BY amendment_number ASC`
    ).bind(archiveId).all();
    return result.results || [];
  } catch {
    return [];
  }
}

async function allAmendmentRows(env) {
  try {
    const result = await env.DB.prepare(
      `SELECT amendment_id, archive_id, cycle_id, amendment_number, amendment_type,
              reason, changes_json, actor_role, created_at
       FROM gate_archive_amendments
       ORDER BY archive_id ASC, amendment_number ASC`
    ).all();
    return result.results || [];
  } catch {
    return [];
  }
}

function presentAmendments(rows) {
  return rows.map(row => ({
    amendment_id: String(row.amendment_id || ''),
    amendment_number: number(row.amendment_number),
    amendment_type: String(row.amendment_type || 'correction'),
    reason: String(row.reason || ''),
    changes: safeObject(row.changes_json),
    actor_role: String(row.actor_role || ''),
    created_at: String(row.created_at || '')
  }));
}

function applyAmendments(base, amendments) {
  return amendments.reduce((record, amendment) => ({
    ...record,
    ...amendment.changes
  }), { ...base });
}

async function lifecycleForArchive(env, archiveId) {
  try {
    const row = await env.DB.prepare(
      `SELECT cycle_id, week_group, state, archive_id, activated_at, closed_at, revision
       FROM gate_week_groups
       WHERE archive_id = ?
       LIMIT 1`
    ).bind(archiveId).first();
    if (!row) return null;
    return {
      cycle_id: String(row.cycle_id || ''),
      week_group: String(row.week_group || ''),
      state: String(row.state || ''),
      archive_id: String(row.archive_id || ''),
      activated_at: String(row.activated_at || ''),
      closed_at: String(row.closed_at || ''),
      revision: number(row.revision)
    };
  } catch {
    return null;
  }
}

function archiveDetail(row, amendments, lifecycle) {
  const stored = safeObject(row.data);
  const corrected = applyAmendments(stored, amendments);
  const dorms = safeArray(stored.dorm_data);
  const buses = safeArray(stored.bus_data);

  // The read model intentionally never returns source_records_json. It is a
  // lossless recovery artifact retained in D1, not a browser presentation field.
  const archive = {
    id: String(row.id || ''),
    week_group: String(corrected.week_group || row.week_group || ''),
    archived_at: String(corrected.archived_at || row.created_at || ''),
    created_at: String(stored.created_at || row.created_at || ''),
    updated_at: String(stored.updated_at || row.updated_at || ''),
    dorm_count: number(corrected.dorm_count ?? dorms.length),
    bus_count: number(corrected.bus_count ?? buses.length),
    total_arrived: number(corrected.total_arrived),
    total_loaded: number(corrected.total_loaded),
    total_expected: number(corrected.total_expected),
    female_total: number(corrected.female_total),
    nat_total: number(corrected.nat_total),
    space_force_total: number(corrected.space_force_total || corrected.arrived_space_force_total),
    arrived_space_force_total: number(corrected.arrived_space_force_total),
    receiving_day_one_start: String(corrected.receiving_day_one_start || ''),
    receiving_day_one_end: String(corrected.receiving_day_one_end || ''),
    receiving_day_two_start: String(corrected.receiving_day_two_start || ''),
    receiving_day_two_end: String(corrected.receiving_day_two_end || ''),
    archive_schema_version: String(stored.archive_schema_version || ''),
    closeout_safety_version: String(stored.closeout_safety_version || ''),
    source_record_count: number(stored.source_record_count),
    source_snapshot_format: String(stored.source_snapshot_format || ''),
    integrity: stored.source_snapshot_format === 'lossless-record-rows-v1'
      ? 'lossless'
      : (String(stored.archive_schema_version || '').startsWith('gate-archive-schema-v3') ? 'canonical' : 'legacy')
  };

  return { archive, dorms, buses, amendments, lifecycle };
}

export async function onRequestGet({ request, env, data }) {
  if (roleOf(data) !== 'instructor') return forbidden();

  try {
    const url = new URL(request.url);
    const id = String(url.searchParams.get('id') || '').trim();

    if (!id) {
      const [rows, rawAmendments] = await Promise.all([archiveRows(env), allAmendmentRows(env)]);
      const amendmentsByArchive = new Map();
      presentAmendments(rawAmendments).forEach(amendment => {
        const archiveId = String(rawAmendments.find(row => row.amendment_id === amendment.amendment_id)?.archive_id || '');
        if (!archiveId) return;
        if (!amendmentsByArchive.has(archiveId)) amendmentsByArchive.set(archiveId, []);
        amendmentsByArchive.get(archiveId).push(amendment);
      });
      const archives = rows
        .map(row => archiveSummary(row, amendmentsByArchive.get(String(row.id || '')) || []))
        .sort((a, b) => timestamp(b.archived_at) - timestamp(a.archived_at) || b.id.localeCompare(a.id));
      return jsonResponse({ isOk: true, archives, count: archives.length });
    }

    const row = await env.DB.prepare(
      `SELECT id, week_group, data, created_at, updated_at
       FROM records
       WHERE id = ? AND type = 'archive'
       LIMIT 1`
    ).bind(id).first();

    if (!row) return jsonResponse({ isOk: false, code: 'not_found', error: 'Archive not found.' }, 404);

    const amendments = presentAmendments(await amendmentRows(env, id));
    const lifecycle = await lifecycleForArchive(env, id);
    return jsonResponse({ isOk: true, ...archiveDetail(row, amendments, lifecycle) });
  } catch (error) {
    console.error('Archive read failed:', error);
    return jsonResponse({ isOk: false, code: 'archive_read_failed', error: 'Unable to load archive records.' }, 500);
  }
}

export async function onRequestPost() {
  return jsonResponse({ isOk: false, code: 'read_only', error: 'Archive presentation endpoint is read-only.' }, 405);
}

export async function onRequestPut() {
  return jsonResponse({ isOk: false, code: 'read_only', error: 'Archive presentation endpoint is read-only.' }, 405);
}

export async function onRequestDelete() {
  return jsonResponse({ isOk: false, code: 'read_only', error: 'Archive presentation endpoint is read-only.' }, 405);
}
