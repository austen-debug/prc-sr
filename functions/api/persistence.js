import {
  PersistenceValidationError, normalizeDraft, validateInitialization,
  buildDormRows, parseOperationalRow, buildArchivePayload
} from './persistence-core.mjs';

const TYPES = ['bus', 'dorm', 'archive', 'config', 'sound_event'];
const WINDOW_KEYS = [
  'receiving_day_one_start', 'receiving_day_one_end',
  'receiving_day_two_start', 'receiving_day_two_end'
];
const nowIso = () => new Date().toISOString();
const newId = () => crypto.randomUUID();
const readRole = data => String(data?.session?.role || '').toLowerCase();
const enabled = env => env?.GATE_PERSISTENCE_ENABLED === 'true';
const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
});
const failure = (code, message, status) => response({ isOk: false, code, error: message }, status);
const conflict = message => failure('conflict', message, 409);
const forbidden = () => failure('forbidden', 'Instructor authorization is required.', 403);
const unavailable = message => failure('persistence_unavailable', message, 503);
const assertOne = env => env.DB.prepare("SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('invalid-json', '$') END");

async function mirrorStatus(env) {
  const triggers = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM sqlite_master WHERE type='trigger' AND name IN ('gate_mirror_records_insert','gate_mirror_records_update','gate_mirror_records_delete')"
  ).first();
  const stats = await env.DB.prepare(`WITH mirrored AS (
      SELECT id,'bus' AS type,week_group,data,created_at,updated_at FROM gate_v2_buses
      UNION ALL SELECT id,type,week_group,data,created_at,updated_at FROM gate_v2_dorms
      UNION ALL SELECT id,type,week_group,data,created_at,updated_at FROM gate_v2_archives
      UNION ALL SELECT id,type,week_group,data,created_at,updated_at FROM gate_v2_config
      UNION ALL SELECT id,type,week_group,data,created_at,updated_at FROM gate_v2_sound_events
    ) SELECT
      (SELECT COUNT(*) FROM records WHERE type IN ('bus','dorm','archive','config','sound_event')) AS original,
      (SELECT COUNT(*) FROM mirrored) AS mirrored,
      (SELECT COUNT(*) FROM records r LEFT JOIN mirrored m ON r.id=m.id AND r.type=m.type
       WHERE r.type IN ('bus','dorm','archive','config','sound_event')
       AND (m.id IS NULL OR m.week_group IS NOT r.week_group OR m.data IS NOT r.data
       OR m.created_at IS NOT r.created_at OR m.updated_at IS NOT r.updated_at)) AS differences`
  ).first();
  const ready = Number(triggers?.total) === 3 && Number(stats.original) === Number(stats.mirrored) && Number(stats.differences) === 0;
  return { ready, original: Number(stats.original), mirrored: Number(stats.mirrored), differences: Number(stats.differences), mirror_triggers: Number(triggers?.total) };
}

async function configRecord(env, key = 'week_group') {
  const result = await env.DB.prepare("SELECT * FROM records WHERE type='config' AND json_extract(data,'$.key')=? LIMIT 2").bind(key).all();
  if ((result.results || []).length > 1) throw new Error(`Duplicate configuration key: ${key}.`);
  return result.results?.[0] || null;
}

async function activeCycle(env) {
  return env.DB.prepare("SELECT * FROM gate_week_groups WHERE state <> 'closed' LIMIT 1").first();
}

function configValue(row) {
  if (!row) return '';
  try { return String(JSON.parse(row.data).value || '').trim().toUpperCase(); }
  catch { throw new Error('Active Week Group configuration has malformed JSON.'); }
}

async function loadDraft(env, id = '') {
  return id
    ? env.DB.prepare('SELECT * FROM gate_input_drafts WHERE draft_id=?').bind(id).first()
    : env.DB.prepare("SELECT * FROM gate_input_drafts WHERE status='draft' ORDER BY updated_at DESC LIMIT 1").first();
}

function presentDraft(row) {
  if (!row) return null;
  return {
    draft_id: row.draft_id, proposed_week_group: row.proposed_week_group || '',
    rows: JSON.parse(row.rows_json), receiving_windows: JSON.parse(row.receiving_windows_json),
    import_review: JSON.parse(row.import_review_json), status: row.status,
    revision: row.revision, updated_at: row.updated_at, consumed_at: row.consumed_at
  };
}

async function health(env) {
  if (!enabled(env)) return { isOk: true, enabled: false, ready: false, message: 'Persistence v2 has not been enabled.' };
  const parity = await mirrorStatus(env);
  const config = await configRecord(env);
  const current = await activeCycle(env);
  const legacyWeekGroup = configValue(config);
  return {
    isOk: true, enabled: true, ...parity,
    legacy_week_group: legacyWeekGroup,
    cycle: current ? { cycle_id: current.cycle_id, week_group: current.week_group, state: current.state, revision: current.revision } : null,
    adoption_required: Boolean(legacyWeekGroup && !current),
    message: parity.ready ? '' : 'Record copies or mirror triggers are not synchronized. Do not activate the new workflow.'
  };
}

function ensureOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) throw new PersistenceValidationError('Cross-origin mutation rejected.');
}

async function saveDraft(env, payload) {
  const draft = normalizeDraft(payload);
  const id = typeof payload.draft_id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(payload.draft_id) ? payload.draft_id : '';
  const row = id ? await loadDraft(env, id) : null;
  const now = nowIso();
  const values = [draft.proposed_week_group || null, JSON.stringify(draft.rows), JSON.stringify(draft.receiving_windows), JSON.stringify(draft.import_review)];
  if (!id) {
    const draftId = newId();
    await env.DB.prepare('INSERT INTO gate_input_drafts(draft_id,proposed_week_group,rows_json,receiving_windows_json,import_review_json,status,revision,created_at,updated_at) VALUES(?,?,?,?,?,\'draft\',1,?,?)')
      .bind(draftId, ...values, now, now).run();
    return response({ isOk: true, draft: presentDraft(await loadDraft(env, draftId)) }, 201);
  }
  if (!row) return failure('not_found', 'Draft does not exist. Reload the Input page.', 404);
  const revision = Number(payload.revision);
  if (!Number.isSafeInteger(revision) || revision < 1) return failure('validation', 'A valid draft revision is required.', 400);
  if (row.status !== 'draft' || row.revision !== revision) return response({ isOk: false, code: 'draft_conflict', error: 'Draft changed elsewhere. Reload before saving.', current_revision: row.revision, current_status: row.status }, 409);
  const result = await env.DB.prepare("UPDATE gate_input_drafts SET proposed_week_group=?,rows_json=?,receiving_windows_json=?,import_review_json=?,revision=revision+1,updated_at=? WHERE draft_id=? AND revision=? AND status='draft'")
    .bind(...values, now, id, revision).run();
  if (Number(result?.meta?.changes) !== 1) return conflict('Draft was updated concurrently; reload the Input page.');
  return response({ isOk: true, draft: presentDraft(await loadDraft(env, id)) });
}

async function adoptLegacy(env) {
  const parity = await mirrorStatus(env);
  if (!parity.ready) return unavailable('Staging parity or mirror triggers are not verified.');
  const config = await configRecord(env);
  const wg = configValue(config);
  if (!wg) return conflict('No active legacy Week Group exists to register.');
  const existing = await activeCycle(env);
  if (existing) {
    if (existing.week_group === wg && existing.state === 'active') return response({ isOk: true, cycle_id: existing.cycle_id, week_group: wg, adopted: false });
    return conflict('A different operational cycle is already registered.');
  }
  const row = await env.DB.prepare("SELECT data FROM records WHERE type='dorm' AND week_group=? LIMIT 1").bind(wg).first();
  if (!row) return conflict('Active configuration has no matching dorms. Manual recovery is required.');
  const dorm = JSON.parse(row.data);
  const windows = Object.fromEntries(WINDOW_KEYS.map(key => [key, String(dorm[key] || '')]));
  const id = newId(), eventId = newId(), now = nowIso();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO gate_week_groups(cycle_id,week_group,state,receiving_windows_json,created_at,updated_at,activated_at) VALUES(?,?,'active',?,?,?,?)")
        .bind(id, wg, JSON.stringify(windows), now, now, now),
      env.DB.prepare("INSERT INTO gate_audit_events(event_id,cycle_id,entity_type,entity_id,event_type,actor_role,metadata_json,occurred_at) VALUES(?,?,'week_group',?,'legacy_cycle_adopted','instructor',?,?)")
        .bind(eventId, id, id, JSON.stringify({ week_group: wg, source: 'legacy_config' }), now)
    ]);
    return response({ isOk: true, cycle_id: id, week_group: wg, adopted: true });
  } catch {
    return conflict('The active-cycle registration changed concurrently. Refresh lifecycle status.');
  }
}

function stampedConfig(row, key, value, now) {
  const original = row ? JSON.parse(row.data) : {};
  const id = row?.id || newId();
  const data = {
    ...original, type: 'config', key, value, __backendId: id,
    record_version: Math.max(0, Number(original.record_version) || 0) + 1,
    created_by_role: original.created_by_role || 'instructor', updated_by_role: 'instructor',
    created_at: row?.created_at || now, updated_at: now
  };
  return { id, data: JSON.stringify(data), created_at: row?.created_at || now, updated_at: now, original: row?.data || null };
}

function configStatements(env, row, key, value, now) {
  const stamped = stampedConfig(row, key, value, now);
  if (!row) return [env.DB.prepare('INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,\'config\',\'\',?,?,?)')
    .bind(stamped.id, stamped.data, stamped.created_at, now)];
  return [
    env.DB.prepare('UPDATE records SET data=?,updated_at=? WHERE id=? AND data=?')
      .bind(stamped.data, now, row.id, stamped.original),
    assertOne(env)
  ];
}

async function initialize(env, payload) {
  const draftId = String(payload.draft_id || '');
  const revision = Number(payload.revision);
  if (!draftId || !Number.isSafeInteger(revision) || revision < 1) return failure('validation', 'Saved draft ID and revision are required.', 400);
  const key = `initialize:${draftId}:${revision}`;
  const prior = await env.DB.prepare('SELECT * FROM gate_workflow_operations WHERE idempotency_key=?').bind(key).first();
  if (prior?.status === 'completed') return response({ isOk: true, idempotent: true, cycle_id: prior.cycle_id, week_group: prior.request_fingerprint.split(':').slice(-1)[0] });
  const parity = await mirrorStatus(env);
  if (!parity.ready) return unavailable('Mirrors must pass the parity check before initialization.');
  const config = await configRecord(env);
  if (configValue(config)) return conflict('Close out the active Week Group before initialization.');
  if (await activeCycle(env)) return conflict('An operational cycle is still active or requires recovery.');
  const existing = await env.DB.prepare("SELECT COUNT(*) AS count FROM records WHERE type IN ('bus','dorm')").first();
  if (Number(existing?.count) > 0) return conflict('Unarchived live buses or dorms remain. Resolve them before initialization.');
  const saved = await loadDraft(env, draftId);
  if (!saved || saved.status !== 'draft' || saved.revision !== revision) return conflict('The saved draft has changed. Reload it before initialization.');
  const draft = normalizeDraft({ proposed_week_group: saved.proposed_week_group, rows: JSON.parse(saved.rows_json), receiving_windows: JSON.parse(saved.receiving_windows_json), import_review: JSON.parse(saved.import_review_json) });
  validateInitialization(draft);
  const now = nowIso(), cycleId = newId(), operationId = newId(), auditId = newId();
  const dormRows = buildDormRows(draft, cycleId, now, newId);
  const configSql = configStatements(env, config, 'week_group', draft.proposed_week_group, now);
  const sql = [
    env.DB.prepare("INSERT INTO gate_week_groups(cycle_id,week_group,state,source_draft_id,receiving_windows_json,revision,created_at,updated_at,activated_at) VALUES(?,?,'active',?,?,1,?,?,?)")
      .bind(cycleId, draft.proposed_week_group, draftId, JSON.stringify(draft.receiving_windows), now, now, now),
    env.DB.prepare("UPDATE gate_input_drafts SET status='consumed',consumed_at=?,revision=revision+1,updated_at=? WHERE draft_id=? AND revision=? AND status='draft'")
      .bind(now, now, draftId, revision),
    assertOne(env),
    ...configSql,
    env.DB.prepare(`INSERT INTO records(id,type,week_group,data,created_at,updated_at)
      SELECT json_extract(value,'$.id'),json_extract(value,'$.type'),json_extract(value,'$.week_group'),
      json_extract(value,'$.data'),json_extract(value,'$.created_at'),json_extract(value,'$.updated_at')
      FROM json_each(?)`).bind(JSON.stringify(dormRows)),
    env.DB.prepare("INSERT INTO gate_workflow_operations(operation_id,idempotency_key,action,status,cycle_id,draft_id,request_fingerprint,phase,created_at,updated_at,completed_at) VALUES(?,?,'initialize','completed',?,?,?,'committed',?,?,?)")
      .bind(operationId, key, cycleId, draftId, `${draftId}:${revision}:${draft.proposed_week_group}`, now, now, now),
    env.DB.prepare("INSERT INTO gate_audit_events(event_id,cycle_id,operation_id,entity_type,entity_id,event_type,actor_role,prior_version,resulting_version,metadata_json,occurred_at) VALUES(?,?,?,'week_group',?,'week_group_initialized','instructor',0,1,?,?)")
      .bind(auditId, cycleId, operationId, cycleId, JSON.stringify({ week_group: draft.proposed_week_group, dorm_count: dormRows.length }), now)
  ];
  try {
    await env.DB.batch(sql);
    return response({ isOk: true, cycle_id: cycleId, week_group: draft.proposed_week_group, dorm_count: dormRows.length });
  } catch (error) {
    console.error('Atomic GATE initialization rejected:', error);
    return conflict('Initialization did not commit. Refresh the draft and active-cycle status before retrying.');
  }
}

async function closeout(env, payload) {
  const current = await activeCycle(env);
  if (!current) return conflict('Register the active Week Group or initialize a new group first.');
  const key = `closeout:${current.cycle_id}`;
  const prior = await env.DB.prepare('SELECT * FROM gate_workflow_operations WHERE idempotency_key=?').bind(key).first();
  if (prior?.status === 'completed') return response({ isOk: true, idempotent: true, archive_id: prior.archive_id, week_group: current.week_group });
  if (current.state !== 'active') return conflict('The operational cycle requires recovery before closeout.');
  const config = await configRecord(env);
  if (configValue(config) !== current.week_group) return conflict('Active Week Group configuration does not match the lifecycle record.');
  const parity = await mirrorStatus(env);
  if (!parity.ready) return unavailable('Mirrors must pass parity before closeout.');
  const result = await env.DB.prepare("SELECT id,type,week_group,data,created_at,updated_at FROM records WHERE week_group=? AND type IN ('dorm','bus','sound_event') ORDER BY created_at,id").bind(current.week_group).all();
  const snapshot = result.results || [];
  const dorms = snapshot.filter(row => row.type === 'dorm').map(parseOperationalRow);
  const buses = snapshot.filter(row => row.type === 'bus').map(parseOperationalRow);
  if (!dorms.length && !buses.length) return conflict('No live dorms or buses found for this group.');
  let windows = {};
  try { windows = JSON.parse(current.receiving_windows_json || '{}'); } catch { return conflict('Receiving-window state requires recovery.'); }
  for (const field of WINDOW_KEYS) windows[field] = windows[field] || dorms.find(row => row[field])?.[field] || '';
  const now = nowIso(), archiveId = newId(), operationId = newId(), auditId = newId();
  const payloadArchive = buildArchivePayload({ cycleId: current.cycle_id, weekGroup: current.week_group, dorms, buses, windows, now });
  payloadArchive.__backendId = archiveId;
  const archiveJson = JSON.stringify(payloadArchive);
  if (new TextEncoder().encode(archiveJson).length > 1800000) return conflict('Archive exceeds safe D1 row size. Contact an administrator; no data was cleared.');
  const expected = JSON.stringify(snapshot.map(row => ({ id: row.id, type: row.type, data: row.data })));
  const lastAirport = await configRecord(env, 'last_airport');
  const sql = [
    env.DB.prepare(`SELECT CASE WHEN
      (SELECT COUNT(*) FROM records WHERE week_group=? AND type IN ('dorm','bus','sound_event'))=?
      AND NOT EXISTS(SELECT 1 FROM json_each(?) expected LEFT JOIN records actual
        ON actual.id=json_extract(expected.value,'$.id')
        WHERE actual.id IS NULL OR actual.type IS NOT json_extract(expected.value,'$.type')
        OR actual.week_group IS NOT ? OR actual.data IS NOT json_extract(expected.value,'$.data'))
      THEN 1 ELSE json_extract('invalid-json','$') END`).bind(current.week_group, snapshot.length, expected, current.week_group),
    env.DB.prepare("INSERT INTO records(id,type,week_group,data,created_at,updated_at) VALUES(?,'archive',?,?,?,?)")
      .bind(archiveId, current.week_group, archiveJson, now, now),
    env.DB.prepare("DELETE FROM records WHERE week_group=? AND type IN ('dorm','bus','sound_event')").bind(current.week_group),
    ...configStatements(env, config, 'week_group', '', now),
    ...(lastAirport ? configStatements(env, lastAirport, 'last_airport', '', now) : []),
    env.DB.prepare("UPDATE gate_week_groups SET state='closed',archive_id=?,closed_at=?,revision=revision+1,updated_at=? WHERE cycle_id=? AND state='active' AND revision=?")
      .bind(archiveId, now, now, current.cycle_id, current.revision),
    assertOne(env),
    env.DB.prepare("INSERT INTO gate_workflow_operations(operation_id,idempotency_key,action,status,cycle_id,request_fingerprint,archive_id,phase,created_at,updated_at,completed_at) VALUES(?,?,'closeout','completed',?,?,?,'archive_and_clear_committed',?,?,?)")
      .bind(operationId, key, current.cycle_id, `${current.cycle_id}:${current.revision}`, archiveId, now, now, now),
    env.DB.prepare("INSERT INTO gate_audit_events(event_id,cycle_id,operation_id,entity_type,entity_id,event_type,actor_role,prior_version,resulting_version,metadata_json,occurred_at) VALUES(?,?,?,'week_group',?,'week_group_closed','instructor',?,?,?,?)")
      .bind(auditId, current.cycle_id, operationId, current.cycle_id, current.revision, current.revision + 1, JSON.stringify({ week_group: current.week_group, archive_id: archiveId, dorm_count: dorms.length, bus_count: buses.length }), now)
  ];
  try {
    await env.DB.batch(sql);
    return response({ isOk: true, archive_id: archiveId, week_group: current.week_group, dorm_count: dorms.length, bus_count: buses.length });
  } catch (error) {
    console.error('Atomic GATE closeout rejected:', error);
    return conflict('Closeout did not commit. Reload live data before retrying; no records should be cleared by a failed transaction.');
  }
}

async function amendArchive(env, payload) {
  const id = String(payload.archive_id || '');
  const reason = String(payload.reason || '').trim();
  const changes = payload.changes;
  const allowed = new Set(['week_group','archived_at','total_arrived','total_expected','total_loaded','female_total','nat_total','space_force_total','arrived_space_force_total',...WINDOW_KEYS]);
  if (!id || reason.length < 5 || reason.length > 2000 || !changes || typeof changes !== 'object' || Array.isArray(changes) || !Object.keys(changes).length || Object.keys(changes).some(key => !allowed.has(key))) {
    return failure('validation', 'Archive ID, a documented reason, and supported correction fields are required.', 400);
  }
  const archive = await env.DB.prepare("SELECT id FROM records WHERE id=? AND type='archive'").bind(id).first();
  if (!archive) return failure('not_found', 'Archive not found.', 404);
  const last = await env.DB.prepare('SELECT MAX(amendment_number) AS n FROM gate_archive_amendments WHERE archive_id=?').bind(id).first();
  const count = Number(last?.n || 0) + 1, amendmentId = newId(), auditId = newId(), now = nowIso();
  const cycle = await env.DB.prepare('SELECT cycle_id FROM gate_week_groups WHERE archive_id=? LIMIT 1').bind(id).first();
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO gate_archive_amendments(amendment_id,archive_id,cycle_id,amendment_number,amendment_type,reason,changes_json,actor_role,created_at) VALUES(?,?,?,?,'correction',?,?,'instructor',?)")
        .bind(amendmentId, id, cycle?.cycle_id || null, count, reason, JSON.stringify(changes), now),
      env.DB.prepare("INSERT INTO gate_audit_events(event_id,cycle_id,entity_type,entity_id,event_type,actor_role,metadata_json,occurred_at) VALUES(?,?,'archive',?,'archive_amended','instructor',?,?)")
        .bind(auditId, cycle?.cycle_id || null, id, JSON.stringify({ amendment_id: amendmentId, amendment_number: count, fields: Object.keys(changes) }), now)
    ]);
    return response({ isOk: true, amendment_id: amendmentId, amendment_number: count }, 201);
  } catch {
    return conflict('Archive amendment changed concurrently. Reload the archive and retry.');
  }
}

export async function onRequestGet({ request, env, data }) {
  if (readRole(data) !== 'instructor') return forbidden();
  const mode = new URL(request.url).searchParams.get('mode') || 'health';
  try {
    if (mode === 'health') return response(await health(env));
    if (!enabled(env)) return unavailable('Persistence v2 is not enabled.');
    if (mode === 'draft') return response({ isOk: true, draft: presentDraft(await loadDraft(env, new URL(request.url).searchParams.get('id') || '')) });
    if (mode === 'amendments') {
      const id = new URL(request.url).searchParams.get('id') || '';
      if (!id) return failure('validation', 'Archive ID is required.', 400);
      const results = await env.DB.prepare('SELECT * FROM gate_archive_amendments WHERE archive_id=? ORDER BY amendment_number ASC').bind(id).all();
      return response({ isOk: true, amendments: results.results || [] });
    }
    return failure('validation', 'Unsupported query mode.', 400);
  } catch (error) {
    console.error('Persistence read failed:', error);
    return unavailable('Persistence tables are not available or failed validation.');
  }
}

export async function onRequestPost({ request, env, data }) {
  if (readRole(data) !== 'instructor') return forbidden();
  if (!enabled(env)) return unavailable('Persistence v2 is not enabled.');
  try {
    ensureOrigin(request);
    const raw = await request.text();
    if (raw.length > 180000) return failure('validation', 'Request exceeds the persistence payload limit.', 413);
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return failure('validation', 'Invalid request body.', 400);
    if (payload.action === 'save_draft') return saveDraft(env, payload);
    if (payload.action === 'adopt') return adoptLegacy(env);
    if (payload.action === 'initialize') return initialize(env, payload);
    if (payload.action === 'closeout') return closeout(env, payload);
    if (payload.action === 'amend_archive') return amendArchive(env, payload);
    return failure('validation', 'Unsupported persistence action.', 400);
  } catch (error) {
    if (error instanceof PersistenceValidationError || error instanceof SyntaxError) return failure('validation', error.message, 400);
    console.error('GATE persistence request failed:', error);
    return failure('persistence_failed', 'Persistence operation failed without confirmation. Refresh authoritative state.', 500);
  }
}
