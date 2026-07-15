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

export async function onRequestGet({ env, data }) {
  const role = requestRole(data);
  if (!mayReadRecords(role)) return forbidden();

  try {
    const result = await env.DB.prepare(
      `SELECT id, type, week_group, data, created_at, updated_at
       FROM records
       ORDER BY created_at ASC`
    ).all();

    const records = (result.results || [])
      .map(safeParseRecord)
      .map(record => sanitizeRecordForRole(record, role))
      .filter(Boolean);

    return jsonResponse({ isOk: true, records, capabilities: RECORDS_API_CAPABILITIES });
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

    if (type === 'audit_event') {
      const validation = validateAuditEvent(record);
      if (!validation.valid) {
        return jsonResponse({ isOk: false, code: 'validation', error: validation.errors.join(' ') }, 400);
      }
    }

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
    if (isAuditEvent(existingRecord)) {
      return jsonResponse({ isOk: false, code: 'append_only', error: 'Audit events are append-only.' }, 405);
    }

    const currentVersion = recordVersionOf(existingRecord);
    if (expected.supplied && expected.value !== currentVersion) {
      return jsonResponse(conflictResponseBody({
        expectedRecordVersion: expected.value,
        currentRecordVersion: currentVersion
      }), 409);
    }

    const now = new Date().toISOString();
    const normalized = normalizeDormUpdate(record, existingRecord, now);
    const storedRecord = stampUpdatedRecord(existingRecord, {
      ...normalized,
      type: existingRecord.type,
      __backendId: id
    }, { role, now });

    const statement = expected.supplied
      ? env.DB.prepare(
        `UPDATE records
         SET type = ?, week_group = ?, data = ?, updated_at = ?
         WHERE id = ?
           AND COALESCE(CAST(json_extract(data, '$.record_version') AS INTEGER), 0) = ?`
      ).bind(
        String(storedRecord.type || ''),
        String(storedRecord.week_group || ''),
        JSON.stringify(storedRecord),
        now,
        id,
        currentVersion
      )
      : env.DB.prepare(
        `UPDATE records
         SET type = ?, week_group = ?, data = ?, updated_at = ?
         WHERE id = ?`
      ).bind(
        String(storedRecord.type || ''),
        String(storedRecord.week_group || ''),
        JSON.stringify(storedRecord),
        now,
        id
      );

    const result = await statement.run();
    if (expected.supplied && changedRows(result) !== 1) {
      const currentRow = await getRecordRow(env, id);
      const latestVersion = recordVersionOf(parseStoredRecord(currentRow) || {});
      return jsonResponse(conflictResponseBody({
        expectedRecordVersion: expected.value,
        currentRecordVersion: latestVersion
      }), 409);
    }

    return jsonResponse({ isOk: true, data: storedRecord }, 200, { ETag: `"${storedRecord.record_version}"` });
  } catch (error) {
    return jsonResponse({ isOk: false, error: error.message || 'Failed to update record.' }, 500);
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
    if (isAuditEvent(existingRecord)) {
      return jsonResponse({ isOk: false, code: 'append_only', error: 'Audit events are append-only.' }, 405);
    }

    const currentVersion = recordVersionOf(existingRecord);
    if (expected.supplied && expected.value !== currentVersion) {
      return jsonResponse(conflictResponseBody({
        expectedRecordVersion: expected.value,
        currentRecordVersion: currentVersion
      }), 409);
    }

    const statement = expected.supplied
      ? env.DB.prepare(
        `DELETE FROM records
         WHERE id = ?
           AND COALESCE(CAST(json_extract(data, '$.record_version') AS INTEGER), 0) = ?`
      ).bind(id, currentVersion)
      : env.DB.prepare('DELETE FROM records WHERE id = ?').bind(id);

    const result = await statement.run();
    if (expected.supplied && changedRows(result) !== 1) {
      const currentRow = await getRecordRow(env, id);
      const latestVersion = recordVersionOf(parseStoredRecord(currentRow) || {});
      return jsonResponse(conflictResponseBody({
        expectedRecordVersion: expected.value,
        currentRecordVersion: latestVersion
      }), 409);
    }

    return jsonResponse({ isOk: true, id, deletedRecordVersion: currentVersion });
  } catch (error) {
    return jsonResponse({ isOk: false, error: error.message || 'Failed to delete record.' }, 500);
  }
}
