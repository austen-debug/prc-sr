import { withdrawnArchiveIds } from './archive-dispositions.mjs';
import {
  RECORDS_API_CAPABILITIES,
  conflictResponseBody,
  isAuditEvent,
  mayReadRecords,
  mayWriteRecords,
  normalizeServerRole,
  parseExpectedRecordVersion,
  recordVersionOf,
  sanitizeRecordForRole,
  stampAuditEvent,
  stampCreatedRecord,
  stampUpdatedRecord,
  validateAuditEvent
} from './records-contract.mjs';

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'rec_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function requestRole(data) {
  return normalizeServerRole(data?.session?.role);
}

function forbidden() {
  return jsonResponse({ isOk: false, code: 'forbidden', error: 'Forbidden.' }, 403);
}

function invalidExpectedVersion() {
  return jsonResponse({
    isOk: false,
    code: 'invalid_record_version',
    error: 'If-Match must contain a non-negative integer record version.'
  }, 400);
}

// Field-level edits are rebased only when their original values still match D1.
// Whole-record stale saves never overwrite newer operator work.
function fieldChangeRequest(record) {
  if (!Object.hasOwn(record,'__changes')) return null;
  const changes=record.__changes, base=record.__base_values;
  if (!changes || typeof changes!=='object' || Array.isArray(changes) || !Object.keys(changes).length)
    throw Object.assign(new Error('Changed fields must be a non-empty object.'),{status:400,code:'validation'});
  const protectedKeys=/^(?:__.*|id|type|week_group|record_version|recordVersion|created_at|updated_at|created_by_role|updated_by_role)$/;
  if (Object.entries(changes).some(([key,value])=>protectedKeys.test(key) || value !== null && typeof value==='object'))
    throw Object.assign(new Error('Field changes include protected or unsupported values.'),{status:400,code:'validation'});
  if (base !== undefined && (!base || typeof base!=='object' || Array.isArray(base) ||
      Object.keys(base).length!==Object.keys(changes).length ||
      Object.keys(changes).some(key=>!Object.hasOwn(base,key) || base[key] !== null && typeof base[key]==='object')))
    throw Object.assign(new Error('Original values must cover exactly the changed fields.'),{status:400,code:'validation'});
  return {changes,base};
}

function safeParseRecord(row) {
  try {
    const data = JSON.parse(row.data || '{}');
    return {
      ...data,
      __backendId: row.id,
      record_version: recordVersionOf(data),
      created_at: data.created_at || row.created_at,
      updated_at: data.updated_at || row.updated_at
    };
  } catch {
    return {
      __backendId: row.id,
      type: row.type,
      week_group: row.week_group,
      record_version: 0,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

function parseStoredRecord(row) {
  return row ? safeParseRecord(row) : null;
}

async function getRecordRow(env, id) {
  return env.DB.prepare(
    `SELECT id, type, week_group, data, created_at, updated_at
     FROM records
     WHERE id = ?`
  ).bind(id).first();
}

// An archived Week Group must be immutable at the generic records boundary.
 // Lifecycle transactions use D1 directly; this blocks stale browser sessions
 // from recreating or modifying records after closeout.
async function archivedWeekGroup(env, type, weekGroup) {
  if (!['bus','dorm','sound_event'].includes(String(type || ''))) return false;
  const label=String(weekGroup || '').trim().toUpperCase();
  if (!label) return false;
  const archived=await env.DB.prepare("SELECT id FROM records WHERE type='archive' AND week_group=? LIMIT 1").bind(label).first();
  return Boolean(archived);
}
function archivedRecordConflict() {
  return jsonResponse({isOk:false,code:'week_group_archived',
    error:'This Week Group has an archive. Operational records are locked pending lifecycle reconciliation.'},409);
}

function changedRows(result) {
  const changes = Number(result?.meta?.changes ?? result?.changes);
  return Number.isFinite(changes) ? changes : 0;
}

function formatElapsedFromOpenedAt(openedAt, closedAt = new Date().toISOString()) {
  const openedMs = new Date(openedAt || '').getTime();
  const closedMs = new Date(closedAt || '').getTime();
  if (!Number.isFinite(openedMs) || !Number.isFinite(closedMs)) return '00:00';
  const elapsed = Math.max(0, Math.floor((closedMs - openedMs) / 1000));
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function isManualClosedTimerOverride(record) {
  const value = record?.manual_closed_timer_override;
  return value === true || value === 'true';
}

function isManualDormReopenOverride(record) {
  const value = record?.manual_reopen_override;
  return value === true || value === 'true';
}

function isValidClosedTimer(value) {
  return /^\d{1,4}:\d{2}$/.test(String(value || '').trim());
}

function normalizeDormUpdate(incomingRecord, existingRecord, now) {
  if (!existingRecord || existingRecord.type !== 'dorm') return incomingRecord;
  const existingState = String(existingRecord.state || '').toLowerCase();
  const incomingState = String(incomingRecord.state || '').toLowerCase();

  if (existingState === 'closed' && incomingState === 'open' && isManualDormReopenOverride(incomingRecord)) {
    return {
      ...existingRecord,
      ...incomingRecord,
      type: 'dorm',
      state: 'open',
      phase: incomingRecord.phase || 'OPEN',
      opened_at: incomingRecord.opened_at || now,
      closed_at: '',
      closed_timer: '',
      manual_reopen_override: undefined,
      manual_closed_timer_override: undefined,
      __backendId: existingRecord.__backendId || incomingRecord.__backendId
    };
  }

  if (existingState === 'closed') {
    const manualTimerOverride = isManualClosedTimerOverride(incomingRecord);
    const incomingClosedTimer = String(incomingRecord.closed_timer || '').trim();
    const preservedClosedTimer = manualTimerOverride && isValidClosedTimer(incomingClosedTimer)
      ? incomingClosedTimer
      : (existingRecord.closed_timer || incomingRecord.closed_timer || '00:00');

    return {
      ...existingRecord,
      ...incomingRecord,
      type: 'dorm',
      state: 'closed',
      phase: 'Closed',
      opened_at: existingRecord.opened_at || incomingRecord.opened_at || '',
      closed_at: existingRecord.closed_at || incomingRecord.closed_at || now,
      closed_timer: preservedClosedTimer,
      overtime_sound_sent: existingRecord.overtime_sound_sent || incomingRecord.overtime_sound_sent || 'false',
      overtime_sound_at: existingRecord.overtime_sound_at || incomingRecord.overtime_sound_at || '',
      manual_reopen_override: undefined,
      manual_closed_timer_override: undefined,
      __backendId: existingRecord.__backendId || incomingRecord.__backendId
    };
  }

  if (incomingState === 'closed') {
    const closedAt = incomingRecord.closed_at || now;
    const openedAt = existingRecord.opened_at || incomingRecord.opened_at || '';
    return {
      ...existingRecord,
      ...incomingRecord,
      type: 'dorm',
      state: 'closed',
      phase: 'Closed',
      opened_at: openedAt,
      closed_at: closedAt,
      closed_timer: incomingRecord.closed_timer || formatElapsedFromOpenedAt(openedAt, closedAt),
      manual_reopen_override: undefined,
      manual_closed_timer_override: undefined,
      __backendId: existingRecord.__backendId || incomingRecord.__backendId
    };
  }

  if (existingState === 'open') {
    return {
      ...existingRecord,
      ...incomingRecord,
      type: 'dorm',
      state: 'open',
      opened_at: existingRecord.opened_at || incomingRecord.opened_at || '',
      closed_at: '',
      closed_timer: '',
      manual_reopen_override: undefined,
      manual_closed_timer_override: undefined,
      __backendId: existingRecord.__backendId || incomingRecord.__backendId
    };
  }

  return incomingRecord;
}


function validateBusCounts(record) {
  const fields = ['otw_count','female_count','nat_count','space_force_count'];
  for (const field of fields) {
    if (record[field] === undefined || record[field] === null || record[field] === '') continue;
    const amount = Number(record[field]);
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw operationalInvariant('Bus ' + field + ' must be a non-negative whole number.', 400);
  }
  const total = Number(record.otw_count ?? 0);
  for (const field of ['female_count','nat_count','space_force_count']) {
    if (Number(record[field] ?? 0) > total)
      throw operationalInvariant('Bus ' + field + ' cannot exceed total passengers.', 400);
  }
}

function operationalCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function normalizedOperationalWeek(value) {
  return String(value || '').trim().toUpperCase();
}

export function calculateOperationalAccounting(records = [], weekGroup = '') {
  const requestedWeek = normalizedOperationalWeek(weekGroup);
  let arrived = 0;
  let loaded = 0;

  for (const record of Array.isArray(records) ? records : []) {
    if (!record || (requestedWeek && normalizedOperationalWeek(record.week_group) !== requestedWeek)) continue;
    if (record.type === 'bus' && String(record.status || '').trim().toLowerCase() === 'arrived') {
      arrived += operationalCount(record.otw_count);
    }
    if (record.type === 'dorm') {
      loaded += operationalCount(record.current_load);
    }
  }

  return Object.freeze({
    arrived,
    loaded,
    awaitingAssignment: Math.max(arrived - loaded, 0),
    overAssigned: Math.max(loaded - arrived, 0)
  });
}

function operationalInvariant(message, status = 409) {
  return Object.assign(new Error(message), { code: 'operational_invariant', status });
}

// A single D1 UPDATE statement evaluates aggregate accounting at write time.
// Per-record CAS alone cannot serialize updates to two different dorms.
function accountingWriteGuard(env, before, after) {
  if (!before || !['dorm','bus'].includes(before.type)) return null;
  const week = normalizedOperationalWeek(before.week_group);
  // Legacy unscoped rows cannot participate in a Week Group aggregate.
  // Preserve compatible record-version behavior for those rows.
  if (!week) return null;
  if (after && normalizedOperationalWeek(after.week_group) !== week)
    throw operationalInvariant('Operational Week Group cannot change during an edit.', 409);
  const contribution = record => record.type === 'dorm'
    ? operationalCount(record.current_load)
    : (String(record.status || '').trim().toLowerCase() === 'arrived' ? -operationalCount(record.otw_count) : 0);
  const delta = (after ? contribution(after) : 0) - contribution(before);
  if (delta <= 0) return null;
  // The following predicate is part of the UPDATE itself, not a prior SELECT.
  // SQLite evaluates competing writes against the committed state in write order.
  const sql = `(
    SELECT MAX(0, COALESCE(SUM(CASE
      WHEN type='bus' AND LOWER(TRIM(json_extract(data,'$.status')))='arrived'
        THEN -CAST(COALESCE(json_extract(data,'$.otw_count'),0) AS INTEGER)
      WHEN type='dorm'
        THEN CAST(COALESCE(json_extract(data,'$.current_load'),0) AS INTEGER)
      ELSE 0 END),0) + ?)
    FROM records WHERE week_group=? AND type IN ('bus','dorm')
  ) <= (
    SELECT MAX(0, COALESCE(SUM(CASE
      WHEN type='bus' AND LOWER(TRIM(json_extract(data,'$.status')))='arrived'
        THEN -CAST(COALESCE(json_extract(data,'$.otw_count'),0) AS INTEGER)
      WHEN type='dorm'
        THEN CAST(COALESCE(json_extract(data,'$.current_load'),0) AS INTEGER)
      ELSE 0 END),0))
    FROM records WHERE week_group=? AND type IN ('bus','dorm')
  )`;
  // If there is already an overassignment, a new mutation cannot worsen it.
  // If there is spare arrival capacity, the mutation cannot exceed that capacity.
  return { sql, values:[delta,week,week] };
}

function dormLoadShapeChanged(existingRecord, replacement) {
  return operationalCount(existingRecord?.current_load) !== operationalCount(replacement?.current_load) ||
    operationalCount(existingRecord?.max_load) !== operationalCount(replacement?.max_load);
}

function validateDormLoadShape(record) {
  const rawLoad = Number(record?.current_load ?? 0);
  const rawCapacity = Number(record?.max_load ?? 0);
  if (!Number.isFinite(rawLoad) || !Number.isInteger(rawLoad) || rawLoad < 0) {
    throw operationalInvariant('Dorm current load must be a non-negative whole number.', 400);
  }
  if (!Number.isFinite(rawCapacity) || !Number.isInteger(rawCapacity) || rawCapacity < 0) {
    throw operationalInvariant('Dorm capacity must be a non-negative whole number.', 400);
  }
  if (rawLoad > rawCapacity) {
    throw operationalInvariant('Dorm current load cannot exceed dorm capacity.', 409);
  }
}

async function operationalWeekRecords(env, weekGroup) {
  const week = String(weekGroup || '');
  const result = await env.DB.prepare(
    `SELECT id, type, week_group, data, created_at, updated_at
     FROM records
     WHERE week_group = ?
       AND type IN ('bus','dorm')
     ORDER BY created_at ASC`
  ).bind(week).all();

  return (result.results || [])
    .map(parseStoredRecord)
    .filter(record => record && ['bus', 'dorm'].includes(record.type) &&
      normalizedOperationalWeek(record.week_group) === normalizedOperationalWeek(week));
}

async function enforceOperationalAccountingMutation(env, existingRecord, incomingRecord, { deleting = false } = {}) {
  if (!existingRecord || !['bus', 'dorm'].includes(existingRecord.type)) return;

  const replacement = deleting ? null : {
    ...existingRecord,
    ...(incomingRecord || {}),
    type: existingRecord.type,
    week_group: incomingRecord?.week_group ?? existingRecord.week_group
  };

  if (replacement?.type === 'dorm' && dormLoadShapeChanged(existingRecord, replacement)) {
    validateDormLoadShape(replacement);
  }

  const weekGroup = replacement?.week_group ?? existingRecord.week_group;
  const currentRecords = await operationalWeekRecords(env, weekGroup);
  const before = calculateOperationalAccounting(currentRecords, weekGroup);
  const id = existingRecord.__backendId || existingRecord.id;
  const projectedRecords = currentRecords.filter(record => (record.__backendId || record.id) !== id);
  if (replacement) projectedRecords.push(replacement);

  const after = calculateOperationalAccounting(projectedRecords, weekGroup);
  if (after.overAssigned > before.overAssigned) {
    throw operationalInvariant(
      `This change would assign ${after.loaded} trainees to dorms while only ${after.arrived} are physically arrived. Reduce dorm assignments before reducing or removing arrived trainees.`
    );
  }
}

export async function onRequestGet({ request, env, data }) {
  const role = requestRole(data);
  if (!mayReadRecords(role)) return forbidden();

  try {
    const scope = request ? (new URL(request.url).searchParams.get('scope') || '') : '';
    const liveOnly = scope === 'live';
    const result = await env.DB.prepare(
      liveOnly
        ? `SELECT id, type, week_group, data, created_at, updated_at
           FROM records
           WHERE type <> 'archive'
           ORDER BY created_at ASC`
        : `SELECT id, type, week_group, data, created_at, updated_at
           FROM records
           ORDER BY created_at ASC`
    ).all();

    // A withdrawn archive must not remain visible through the legacy all-records
    // read path after it has been removed from the canonical archive library.
    // The live-only path is untouched for existing operational workflows.
    const withdrawn = role === 'instructor' && !liveOnly
      ? await withdrawnArchiveIds(env)
      : new Set();
    const records = (result.results || [])
      .map(safeParseRecord)
      .filter(record => !(record?.type === 'archive' && withdrawn.has(String(record.__backendId || record.id || ''))))
      .map(record => sanitizeRecordForRole(record, role))
      .filter(Boolean);

    return jsonResponse({
      isOk: true,
      records,
      capabilities: RECORDS_API_CAPABILITIES,
      scope: liveOnly ? 'live' : 'all'
    });
  } catch (error) {
    return jsonResponse({ isOk: false, error: error.message || 'Failed to load records.' }, 500);
  }
}

export async function onRequestPost({ request, env, data }) {
  const role = requestRole(data);
  if (!mayWriteRecords(role)) return forbidden();

  try {
    const record = await request.json();
    const type = String(record.type || '').trim().toLowerCase();
    if (!type) return jsonResponse({ isOk: false, code: 'validation', error: 'Record type is required.' }, 400);
    if (type === 'archive' || type === 'archive_amendment')
      return jsonResponse({isOk:false,code:'immutable_archive',error:'Archives are created only by verified closeout; corrections use append-only amendments.'},405);

    if (type === 'audit_event') {
      // Administrative event names are reserved to server-owned D1 transactions.
      // Legacy operational event types and their existing authorship stay unchanged.
      const reserved = new Set(['archive_withdrawn','archive_restored','record_delete_authorized']);
      if (reserved.has(String(record.event_type || '').trim().toLowerCase()))
        return jsonResponse({isOk:false,code:'server_audit_required',error:'Administrative events require server transaction provenance.'},403);
      const validation = validateAuditEvent(record);
      if (!validation.valid) {
        return jsonResponse({ isOk: false, code: 'validation', error: validation.errors.join(' ') }, 400);
      }
    }

    if (type === 'dorm' || type === 'bus') {
      try {
        if (type === 'dorm') validateDormLoadShape(record);
        else validateBusCounts(record);
      } catch (error) {
        return jsonResponse({ isOk: false, code: error.code || 'validation', error: error.message }, error.status || 400);
      }
    }

    if (await archivedWeekGroup(env,type,record.week_group)) return archivedRecordConflict();

    const id = makeId();
    const now = new Date().toISOString();
    const storedRecord = type === 'audit_event'
      ? stampAuditEvent(record, { id, role, now })
      : stampCreatedRecord({ ...record, type }, { id, role, now });

    await env.DB.prepare(
      `INSERT INTO records (id, type, week_group, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      type,
      String(storedRecord.week_group || ''),
      JSON.stringify(storedRecord),
      now,
      now
    ).run();

    return jsonResponse({ isOk: true, data: storedRecord }, 201, { ETag: `"${storedRecord.record_version}"` });
  } catch (error) {
    return jsonResponse({ isOk: false, error: error.message || 'Failed to create record.' }, 500);
  }
}

export async function onRequestPut({ request, env, data }) {
  const role = requestRole(data);
  if (!mayWriteRecords(role)) return forbidden();

  const expected = parseExpectedRecordVersion(request.headers.get('If-Match'));
  if (!expected.valid) return invalidExpectedVersion();

  try {
    const record = await request.json();
    const id = record.__backendId || record.id;
    if (!id) return jsonResponse({ isOk: false, code: 'validation', error: 'Missing __backendId.' }, 400);

    const existingRow = await getRecordRow(env, id);
    if (!existingRow) return jsonResponse({ isOk: false, code: 'not_found', error: 'Record not found.' }, 404);

    const existingRecord = parseStoredRecord(existingRow);
    // Enforce on the stored row, never on a client-supplied type or feature flag.
    if (existingRow.type === 'archive' || existingRow.type === 'archive_amendment')
      return jsonResponse({isOk:false,code:'immutable_archive',error:'Historical snapshots cannot be overwritten. Use Create Amendment.'},405);
    if (isAuditEvent(existingRecord)) {
      return jsonResponse({ isOk: false, code: 'append_only', error: 'Audit events are append-only.' }, 405);
    }

    if (await archivedWeekGroup(env,existingRow.type,existingRow.week_group)) return archivedRecordConflict();
    const currentVersion = recordVersionOf(existingRecord);
    if (['bus','dorm'].includes(existingRow.type) && !expected.supplied)
      return jsonResponse({isOk:false,code:'record_version_required',error:'An If-Match record version is required for operational updates.'},428);
    const patch=fieldChangeRequest(record);
    if (expected.supplied && expected.value !== currentVersion &&
        (!patch?.base || Object.entries(patch.changes).some(([key]) =>
          JSON.stringify(existingRecord[key] ?? null) !== JSON.stringify(patch.base[key])))) {
      return jsonResponse(conflictResponseBody({
        expectedRecordVersion: expected.value,
        currentRecordVersion: currentVersion
      }), 409);
    }

    const now = new Date().toISOString();
    const incoming = patch ? { ...existingRecord, ...patch.changes } : record;
    const normalized = normalizeDormUpdate(incoming, existingRecord, now);
    if (existingRow.type === 'bus') validateBusCounts(normalized);
    await enforceOperationalAccountingMutation(env, existingRecord, normalized);
    const storedRecord = stampUpdatedRecord(existingRecord, {
      ...normalized,
      type: existingRecord.type,
      __backendId: id
    }, { role, now });

    const guard = accountingWriteGuard(env, existingRecord, storedRecord);
    const statement = env.DB.prepare(
      `UPDATE records
       SET type = ?, week_group = ?, data = ?, updated_at = ?
       WHERE id = ?${expected.supplied ? " AND COALESCE(CAST(json_extract(data, '$.record_version') AS INTEGER), 0) = ?" : ''}
         ${guard ? ' AND ' + guard.sql : ''}`
    ).bind(
      String(storedRecord.type || ''),
      String(storedRecord.week_group || ''),
      JSON.stringify(storedRecord),
      now,
      id,
      ...(expected.supplied ? [currentVersion] : []),
      ...(guard?.values || [])
    );

    const result = await statement.run();
    if (changedRows(result) !== 1 && (expected.supplied || guard)) {
      const currentRow = await getRecordRow(env, id);
      const latestVersion = recordVersionOf(parseStoredRecord(currentRow) || {});
      if (expected.supplied && latestVersion !== currentVersion)
        return jsonResponse(conflictResponseBody({
          expectedRecordVersion: expected.value,
          currentRecordVersion: latestVersion
        }), 409);
      return jsonResponse({isOk:false,code:'operational_invariant',
        error:'Operational counts changed before the write committed. Refresh and retry the assignment.'},409);
    }

    return jsonResponse({ isOk: true, data: storedRecord }, 200, { ETag: `"${storedRecord.record_version}"` });
  } catch (error) {
    return jsonResponse({
      isOk: false,
      code: error?.code || 'update_failed',
      error: error.message || 'Failed to update record.'
    }, Number(error?.status) || 500);
  }
}

export async function onRequestDelete({ request, env, data }) {
  const role = requestRole(data);
  if (!mayWriteRecords(role)) return forbidden();

  const expected = parseExpectedRecordVersion(request.headers.get('If-Match'));
  if (!expected.valid) return invalidExpectedVersion();

  try {
    const record = await request.json();
    const id = record.__backendId || record.id;
    if (!id) return jsonResponse({ isOk: false, code: 'validation', error: 'Missing record id.' }, 400);

    const existingRow = await getRecordRow(env, id);
    if (!existingRow) return jsonResponse({ isOk: false, code: 'not_found', error: 'Record not found.' }, 404);
    const existingRecord = parseStoredRecord(existingRow);
    if (existingRow.type === 'archive' || existingRow.type === 'archive_amendment') return jsonResponse({isOk:false,code:'immutable_archive',error:'Historical archives and amendments cannot be physically deleted.'},403);
    if (isAuditEvent(existingRecord)) {
      return jsonResponse({ isOk: false, code: 'append_only', error: 'Audit events are append-only.' }, 405);
    }

    if (await archivedWeekGroup(env,existingRow.type,existingRow.week_group)) return archivedRecordConflict();
    const currentVersion = recordVersionOf(existingRecord);
    if (['bus','dorm'].includes(existingRow.type) && !expected.supplied)
      return jsonResponse({isOk:false,code:'record_version_required',error:'An If-Match record version is required for operational deletion.'},428);
    if (expected.supplied && expected.value !== currentVersion) {
      return jsonResponse(conflictResponseBody({
        expectedRecordVersion: expected.value,
        currentRecordVersion: currentVersion
      }), 409);
    }

    await enforceOperationalAccountingMutation(env, existingRecord, null, { deleting: true });

    const guard = accountingWriteGuard(env, existingRecord, null);
    const statement = env.DB.prepare(
      `DELETE FROM records WHERE id = ?
       ${expected.supplied ? " AND COALESCE(CAST(json_extract(data, '$.record_version') AS INTEGER), 0) = ?" : ''}
       ${guard ? ' AND ' + guard.sql : ''}`
    ).bind(id, ...(expected.supplied ? [currentVersion] : []), ...(guard?.values || []));

    // The existing delete trigger records a SYSTEM observation without authenticated attribution.
    // For Admin, the verified actor audit must be in the same transaction as the delete.
    let result;
    if (role === 'admin') {
      const eventId = crypto.randomUUID();
      const operationId = crypto.randomUUID();
      const now = new Date().toISOString();
      const metadata = JSON.stringify({ operation_id: operationId, authenticated_actor: true });
      const statements = [
        statement,
        env.DB.prepare("SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('invalid-json','$') END"),
        env.DB.prepare(`INSERT INTO gate_audit_events
          (event_id,cycle_id,entity_type,entity_id,event_type,actor_role,prior_version,resulting_version,metadata_json,occurred_at)
          VALUES (?,(SELECT cycle_id FROM gate_week_groups WHERE state='active' AND week_group=? LIMIT 1),?,?,'record_delete_authorized','admin',?,?,?,?)`)
          .bind(eventId, String(existingRow.week_group || ''), String(existingRecord.type || ''), id,
            currentVersion, currentVersion, metadata, now)
      ];
      const batch = await env.DB.batch(statements);
      result = batch?.[0];
    } else {
      result = await statement.run();
    }
    if ((expected.supplied || guard) && changedRows(result) !== 1) {
      const currentRow = await getRecordRow(env, id);
      const latestVersion = recordVersionOf(parseStoredRecord(currentRow) || {});
      if (expected.supplied && latestVersion !== currentVersion)
        return jsonResponse(conflictResponseBody({
          expectedRecordVersion: expected.value,
          currentRecordVersion: latestVersion
        }), 409);
      return jsonResponse({isOk:false,code:'operational_invariant',
        error:'Operational counts changed before deletion committed. Refresh and retry.'},409);
    }

    return jsonResponse({ isOk: true, id, deletedRecordVersion: currentVersion });
  } catch (error) {
    return jsonResponse({
      isOk: false,
      code: error?.code || 'delete_failed',
      error: error.message || 'Failed to delete record.'
    }, Number(error?.status) || 500);
  }
}
