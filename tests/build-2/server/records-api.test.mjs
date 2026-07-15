import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  onRequestDelete,
  onRequestGet,
  onRequestPost,
  onRequestPut
} from '../../../functions/api/records.js';
import { verifyRequestSession } from '../../../functions/api/session-contract.mjs';

const clone = value => JSON.parse(JSON.stringify(value));

function rowFor(record, id = record.__backendId || record.id) {
  const now = record.updated_at || record.created_at || '2026-07-15T00:00:00.000Z';
  return {
    id,
    type: record.type,
    week_group: record.week_group || '',
    data: JSON.stringify({ ...record, __backendId: id }),
    created_at: record.created_at || now,
    updated_at: now
  };
}

function createD1(seed = []) {
  const rows = seed.map(record => rowFor(record));

  function statement(sql) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    let bound = [];
    return {
      bind(...values) {
        bound = values;
        return this;
      },
      async all() {
        if (!normalized.startsWith('SELECT')) throw new Error(`Unsupported all SQL: ${normalized}`);
        return { results: clone(rows) };
      },
      async first() {
        if (!normalized.startsWith('SELECT') || !normalized.includes('WHERE id = ?')) {
          throw new Error(`Unsupported first SQL: ${normalized}`);
        }
        return clone(rows.find(item => item.id === bound[0]) || null);
      },
      async run() {
        if (normalized.startsWith('INSERT INTO records')) {
          const [id, type, weekGroup, data, createdAt, updatedAt] = bound;
          rows.push({ id, type, week_group: weekGroup, data, created_at: createdAt, updated_at: updatedAt });
          return { meta: { changes: 1 } };
        }

        if (normalized.startsWith('UPDATE records')) {
          const conditional = normalized.includes('json_extract');
          const id = bound[4];
          const index = rows.findIndex(item => item.id === id);
          if (index < 0) return { meta: { changes: 0 } };
          const current = JSON.parse(rows[index].data);
          if (current.type === 'audit_event') throw new Error('audit events are append-only');
          if (conditional && Number(current.record_version || 0) !== Number(bound[5])) {
            return { meta: { changes: 0 } };
          }
          rows[index] = {
            ...rows[index],
            type: bound[0],
            week_group: bound[1],
            data: bound[2],
            updated_at: bound[3]
          };
          return { meta: { changes: 1 } };
        }

        if (normalized.startsWith('DELETE FROM records')) {
          const id = bound[0];
          const index = rows.findIndex(item => item.id === id);
          if (index < 0) return { meta: { changes: 0 } };
          const current = JSON.parse(rows[index].data);
          if (current.type === 'audit_event') throw new Error('audit events are append-only');
          if (normalized.includes('json_extract') && Number(current.record_version || 0) !== Number(bound[1])) {
            return { meta: { changes: 0 } };
          }
          rows.splice(index, 1);
          return { meta: { changes: 1 } };
        }

        throw new Error(`Unsupported run SQL: ${normalized}`);
      }
    };
  }

  return {
    rows,
    prepare: statement
  };
}

const roleData = role => ({ session: { role } });
const json = async response => response.json();

function request(method, body, headers = {}) {
  return new Request('https://gate.example/api/records', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
}

test('records API requires a verified role and exposes Gate C capabilities', async () => {
  const env = { DB: createD1() };
  const denied = await onRequestGet({ env, data: {} });
  assert.equal(denied.status, 403);

  const allowed = await onRequestGet({ env, data: roleData('instructor') });
  const body = await json(allowed);
  assert.equal(allowed.status, 200);
  assert.equal(body.capabilities.recordVersioning, true);
  assert.equal(body.capabilities.conditionalWrites, true);
  assert.equal(body.capabilities.appendOnlyAudit, true);
});

test('server assigns version and trusted role provenance on create', async () => {
  const db = createD1();
  const response = await onRequestPost({
    env: { DB: db },
    data: roleData('instructor'),
    request: request('POST', {
      type: 'bus',
      week_group: 'WG',
      status: 'active',
      record_version: 99,
      created_by_role: 'squadron',
      updated_by_role: 'squadron'
    })
  });
  const body = await json(response);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('ETag'), '"1"');
  assert.equal(body.data.record_version, 1);
  assert.equal(body.data.created_by_role, 'instructor');
  assert.equal(body.data.updated_by_role, 'instructor');
});

test('conditional update increments version and stale writes receive stable conflict data', async () => {
  const db = createD1([{
    __backendId: 'bus-1',
    type: 'bus',
    week_group: 'WG',
    status: 'active',
    record_version: 1,
    created_by_role: 'instructor',
    updated_by_role: 'instructor'
  }]);

  const updated = await onRequestPut({
    env: { DB: db },
    data: roleData('airman'),
    request: request('PUT', { __backendId: 'bus-1', status: 'arrived', arrived_at: '2026-07-15T01:00:00Z' }, { 'If-Match': '1' })
  });
  const updatedBody = await json(updated);
  assert.equal(updated.status, 200);
  assert.equal(updatedBody.data.record_version, 2);
  assert.equal(updatedBody.data.created_by_role, 'instructor');
  assert.equal(updatedBody.data.updated_by_role, 'airman');

  const stale = await onRequestPut({
    env: { DB: db },
    data: roleData('instructor'),
    request: request('PUT', { __backendId: 'bus-1', status: 'active' }, { 'If-Match': '1' })
  });
  const staleBody = await json(stale);
  assert.equal(stale.status, 409);
  assert.equal(staleBody.code, 'record_version_conflict');
  assert.equal(staleBody.expectedRecordVersion, 1);
  assert.equal(staleBody.currentRecordVersion, 2);
});

test('legacy updates without If-Match remain compatible but still advance server version', async () => {
  const db = createD1([{ __backendId: 'cfg-1', type: 'config', key: 'week_group', value: 'WG', record_version: 0 }]);
  const response = await onRequestPut({
    env: { DB: db },
    data: roleData('instructor'),
    request: request('PUT', { __backendId: 'cfg-1', type: 'config', key: 'week_group', value: 'WG-2' })
  });
  const body = await json(response);
  assert.equal(response.status, 200);
  assert.equal(body.data.record_version, 1);
});

test('invalid If-Match and stale conditional deletes fail closed', async () => {
  const db = createD1([{ __backendId: 'bus-1', type: 'bus', record_version: 3 }]);
  const invalid = await onRequestDelete({
    env: { DB: db },
    data: roleData('instructor'),
    request: request('DELETE', { __backendId: 'bus-1' }, { 'If-Match': 'bad' })
  });
  assert.equal(invalid.status, 400);

  const stale = await onRequestDelete({
    env: { DB: db },
    data: roleData('instructor'),
    request: request('DELETE', { __backendId: 'bus-1' }, { 'If-Match': '2' })
  });
  assert.equal(stale.status, 409);
  assert.equal(db.rows.length, 1);

  const deleted = await onRequestDelete({
    env: { DB: db },
    data: roleData('instructor'),
    request: request('DELETE', { __backendId: 'bus-1' }, { 'If-Match': '3' })
  });
  assert.equal(deleted.status, 200);
  assert.equal(db.rows.length, 0);
});

test('audit events are server-attributed, PII-restricted, and append-only', async () => {
  const db = createD1();
  const created = await onRequestPost({
    env: { DB: db },
    data: roleData('airman'),
    request: request('POST', {
      type: 'audit_event',
      event_type: 'dorm.load_updated',
      entity_type: 'dorm',
      entity_id: 'D1',
      actor_role: 'instructor',
      prior_version: 1,
      resulting_version: 2,
      metadata: { load: 40 }
    })
  });
  const createdBody = await json(created);
  assert.equal(created.status, 201);
  assert.equal(createdBody.data.actor_role, 'airman');
  assert.equal(createdBody.data.record_version, 1);

  const update = await onRequestPut({
    env: { DB: db },
    data: roleData('instructor'),
    request: request('PUT', { __backendId: createdBody.data.__backendId, summary: 'changed' }, { 'If-Match': '1' })
  });
  assert.equal(update.status, 405);

  const remove = await onRequestDelete({
    env: { DB: db },
    data: roleData('instructor'),
    request: request('DELETE', { __backendId: createdBody.data.__backendId }, { 'If-Match': '1' })
  });
  assert.equal(remove.status, 405);

  const prohibited = await onRequestPost({
    env: { DB: db },
    data: roleData('instructor'),
    request: request('POST', {
      type: 'audit_event',
      event_type: 'test',
      entity_type: 'bus',
      entity_id: 'B1',
      metadata: { trainee_name: 'not allowed' }
    })
  });
  assert.equal(prohibited.status, 400);
});

test('Squadron role is read-only and receives a limited record set', async () => {
  const db = createD1([
    { __backendId: 'dorm-1', type: 'dorm', assigned_airman: 'Staff', auditorium_location: 'Room', notes: 'internal' },
    { __backendId: 'archive-1', type: 'archive', total_arrived: 10 },
    { __backendId: 'audit-1', type: 'audit_event', event_type: 'test', entity_type: 'bus', entity_id: 'B1' }
  ]);
  const read = await onRequestGet({ env: { DB: db }, data: roleData('squadron') });
  const body = await json(read);
  assert.equal(body.records.length, 1);
  assert.equal(body.records[0].type, 'dorm');
  assert.equal('assigned_airman' in body.records[0], false);
  assert.equal('auditorium_location' in body.records[0], false);
  assert.equal('notes' in body.records[0], false);

  const write = await onRequestPost({
    env: { DB: db },
    data: roleData('squadron'),
    request: request('POST', { type: 'bus' })
  });
  assert.equal(write.status, 403);
});

test('route-local session verifier accepts a valid signed role cookie', async () => {
  const secret = 'test-secret';
  const payload = { role: 'instructor', exp: Date.now() + 60_000 };
  const body = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  const signature = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const session = await verifyRequestSession(new Request('https://gate.example/api/records', {
    headers: { Cookie: `prc_sr_session=${body}.${signature}` }
  }), { AUTH_SECRET: secret });
  assert.deepEqual(session, { role: 'instructor' });
});

test('schema and migration enforce audit append-only triggers', async () => {
  const schema = await readFile(new URL('../../../schema.sql', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../../../migrations/0002_gate_c_append_only_audit.sql', import.meta.url), 'utf8');
  for (const source of [schema, migration]) {
    assert.match(source, /prevent_audit_event_update/);
    assert.match(source, /prevent_audit_event_delete/);
    assert.match(source, /RAISE\(ABORT, 'audit events are append-only'\)/);
  }
});
