function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

function makeId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return 'rec_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function safeParseRecord(row) {
  try {
    const data = JSON.parse(row.data || '{}');

    return {
      ...data,
      __backendId: row.id
    };
  } catch {
    return {
      __backendId: row.id,
      type: row.type,
      week_group: row.week_group
    };
  }
}

function parseStoredRecord(row) {
  if (!row) return null;
  return safeParseRecord(row);
}

function formatElapsedFromOpenedAt(openedAt, closedAt = new Date().toISOString()) {
  const openedMs = new Date(openedAt || '').getTime();
  const closedMs = new Date(closedAt || '').getTime();

  if (!Number.isFinite(openedMs) || !Number.isFinite(closedMs)) {
    return '00:00';
  }

  const elapsed = Math.max(0, Math.floor((closedMs - openedMs) / 1000));
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function isManualClosedTimerOverride(record) {
  const value = record?.manual_closed_timer_override;
  return value === true || value === 'true';
}

function isValidClosedTimer(value) {
  return /^\d{1,4}:\d{2}$/.test(String(value || '').trim());
}

function normalizeDormUpdate(incomingRecord, existingRecord, now) {
  if (!existingRecord || existingRecord.type !== 'dorm') {
    return incomingRecord;
  }

  const existingState = String(existingRecord.state || '').toLowerCase();
  const incomingState = String(incomingRecord.state || '').toLowerCase();

  // Once a dorm is closed, its timing fields are locked at the first recorded close.
  // Later stale modal saves may update editable fields, but they cannot reopen the dorm
  // or replace closed_timer/closed_at with a later running timer. A right-click instructor
  // edit may intentionally correct the final timer by setting manual_closed_timer_override.
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
      manual_closed_timer_override: undefined,
      __backendId: existingRecord.__backendId || incomingRecord.__backendId
    };
  }

  // First valid close wins. Use the client-provided close timer from the close button
  // when present, but keep the existing opened_at as the source of truth for the dorm.
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
      manual_closed_timer_override: undefined,
      __backendId: existingRecord.__backendId || incomingRecord.__backendId
    };
  }

  // Preserve the active open time during routine phase/load/Airman updates so an older
  // modal cannot accidentally reset or alter the live timer.
  if (existingState === 'open') {
    return {
      ...existingRecord,
      ...incomingRecord,
      type: 'dorm',
      state: 'open',
      opened_at: existingRecord.opened_at || incomingRecord.opened_at || '',
      closed_at: '',
      closed_timer: '',
      __backendId: existingRecord.__backendId || incomingRecord.__backendId
    };
  }

  return incomingRecord;
}

export async function onRequestGet({ env }) {
  try {
    const result = await env.DB.prepare(
      `SELECT id, type, week_group, data, created_at, updated_at
       FROM records
       ORDER BY created_at ASC`
    ).all();

    const records = (result.results || []).map(safeParseRecord);

    return jsonResponse({
      isOk: true,
      records
    });
  } catch (error) {
    return jsonResponse({
      isOk: false,
      error: error.message || 'Failed to load records.'
    }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const record = await request.json();

    const id = makeId();
    const now = new Date().toISOString();

    const storedRecord = {
      ...record,
      __backendId: id
    };

    await env.DB.prepare(
      `INSERT INTO records (id, type, week_group, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        String(record.type || ''),
        String(record.week_group || ''),
        JSON.stringify(storedRecord),
        now,
        now
      )
      .run();

    return jsonResponse({
      isOk: true,
      data: storedRecord
    });
  } catch (error) {
    return jsonResponse({
      isOk: false,
      error: error.message || 'Failed to create record.'
    }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const record = await request.json();

    const id = record.__backendId;

    if (!id) {
      return jsonResponse({
        isOk: false,
        error: 'Missing __backendId.'
      }, 400);
    }

    const now = new Date().toISOString();

    const existingRow = await env.DB.prepare(
      `SELECT id, type, week_group, data, created_at, updated_at
       FROM records
       WHERE id = ?`
    )
      .bind(id)
      .first();

    if (!existingRow) {
      return jsonResponse({
        isOk: false,
        error: 'Record not found.'
      }, 404);
    }

    const existingRecord = parseStoredRecord(existingRow);
    const storedRecord = normalizeDormUpdate(record, existingRecord, now);

    await env.DB.prepare(
      `UPDATE records
       SET type = ?, week_group = ?, data = ?, updated_at = ?
       WHERE id = ?`
    )
      .bind(
        String(storedRecord.type || ''),
        String(storedRecord.week_group || ''),
        JSON.stringify(storedRecord),
        now,
        id
      )
      .run();

    return jsonResponse({
      isOk: true,
      data: storedRecord
    });
  } catch (error) {
    return jsonResponse({
      isOk: false,
      error: error.message || 'Failed to update record.'
    }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const record = await request.json();

    const id = record.__backendId || record.id;

    if (!id) {
      return jsonResponse({
        isOk: false,
        error: 'Missing record id.'
      }, 400);
    }

    await env.DB.prepare(
      `DELETE FROM records WHERE id = ?`
    )
      .bind(id)
      .run();

    return jsonResponse({
      isOk: true
    });
  } catch (error) {
    return jsonResponse({
      isOk: false,
      error: error.message || 'Failed to delete record.'
    }, 500);
  }
}
