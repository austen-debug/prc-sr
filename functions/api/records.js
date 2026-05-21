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

    await env.DB.prepare(
      `UPDATE records
       SET type = ?, week_group = ?, data = ?, updated_at = ?
       WHERE id = ?`
    )
      .bind(
        String(record.type || ''),
        String(record.week_group || ''),
        JSON.stringify(record),
        now,
        id
      )
      .run();

    return jsonResponse({
      isOk: true,
      data: record
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
