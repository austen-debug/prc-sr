import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest as apiMiddleware } from '../../../functions/api/_middleware.js';
import { onRequest as rootMiddleware } from '../../../functions/_middleware.js';
import { buildSquadronSnapshot, onRequestGet as getSquadronBoard } from '../../../functions/api/squadron-board.js';

async function sessionCookie(secret, role = 'squadron', username = 'squadron_access') {
  const now = Date.now();
  const payload = { username, role, iat: now, exp: now + 60_000 };
  const body = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  const signature = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `prc_sr_session=${body}.${signature}`;
}

function request(path, cookie, method = 'GET') {
  return new Request(`https://gate.example${path}`, { method, headers: { Cookie: cookie } });
}

test('root routing never serves the operational app shell to a Squadron session', async () => {
  const secret = 'route-test-secret';
  const cookie = await sessionCookie(secret);
  const env = { AUTH_SECRET: secret };

  const root = await rootMiddleware({ request: request('/', cookie), env, next: async () => new Response('APP') });
  assert.equal(root.status, 302);
  assert.equal(root.headers.get('location'), 'https://gate.example/squadron/');

  const squadron = await rootMiddleware({ request: request('/squadron/', cookie), env, next: async () => new Response('SQUADRON') });
  assert.equal(squadron.status, 200);
  assert.equal(await squadron.text(), 'SQUADRON');

  const records = await rootMiddleware({ request: request('/api/records', cookie), env, next: async () => new Response('SHOULD NOT RUN') });
  assert.equal(records.status, 403);

  const instructorCookie = await sessionCookie(secret, 'instructor', 'mti');
  const instructorSquadronPath = await rootMiddleware({ request: request('/squadron/', instructorCookie), env, next: async () => new Response('SHOULD NOT RUN') });
  assert.equal(instructorSquadronPath.status, 302);
  assert.equal(instructorSquadronPath.headers.get('location'), 'https://gate.example/');
});

test('API middleware permits only the Squadron read contract and logout', async () => {
  const secret = 'api-test-secret';
  const cookie = await sessionCookie(secret);
  const env = { AUTH_SECRET: secret, GATE_PERSISTENCE_ENABLED: 'false' };

  const allowed = await apiMiddleware({
    request: request('/api/squadron-board', cookie, 'GET'),
    env,
    data: {},
    next: async () => new Response('BOARD')
  });
  assert.equal(allowed.status, 200);
  assert.equal(await allowed.text(), 'BOARD');

  for (const [path, method] of [
    ['/api/squadron-board', 'POST'],
    ['/api/records', 'GET'],
    ['/api/records', 'POST'],
    ['/api/persistence', 'POST'],
    ['/api/archive-delete', 'DELETE'],
    ['/api/sat-arrivals', 'GET']
  ]) {
    const response = await apiMiddleware({
      request: request(path, cookie, method),
      env,
      data: {},
      next: async () => new Response('SHOULD NOT RUN')
    });
    assert.equal(response.status, 403, `${method} ${path}`);
  }
});

test('Squadron snapshot uses airport-only metrics and rolling dispatch tempo', () => {
  const now = new Date('2026-09-21T17:00:00.000Z');
  const records = [
    { type: 'bus', week_group: 'WG26050', bus_type: 'airport', bus_id: '1', status: 'arrived', otw_count: 40, departed_at: '2026-09-21T16:30:00.000Z' },
    { type: 'bus', week_group: 'WG26050', bus_type: 'airport', bus_id: '2', status: 'active', otw_count: 35, departed_at: '2026-09-21T16:45:00.000Z' },
    { type: 'bus', week_group: 'WG26050', bus_type: 'airport', bus_id: '3', status: 'active', otw_count: 30, departed_at: '2026-09-21T14:00:00.000Z' },
    { type: 'bus', week_group: 'WG26050', bus_type: 'local', status: 'arrived', otw_count: 99, departed_at: '2026-09-21T16:50:00.000Z' },
    { type: 'dorm', week_group: 'WG26050', sdq: '321 TRS', dorm_name: '3A1', max_load: 50, current_load: 40, state: 'open' },
    { type: 'dorm', week_group: 'WG26050', sdq: '322 TRS', dorm_name: '4B2', max_load: 50, current_load: 0, state: 'empty' }
  ];

  const board = buildSquadronSnapshot({ weekGroup: 'WG26050', records, now });
  assert.equal(board.metrics.arrived, 40);
  assert.equal(board.metrics.expected, 100);
  assert.equal(board.traffic.dispatched_last_60_minutes, 2);
  assert.equal(board.traffic.status, 'MEDIUM');
  assert.equal(board.active_buses.length, 2);
  assert.deepEqual(board.active_buses.map(bus => bus.bus_id), ['3', '2']);
});

test('Squadron endpoint returns an allowlisted payload and withholds operational notes and assignments', async () => {
  const rows = [
    {
      type: 'bus', week_group: 'WG26050', created_at: '2026-09-21T16:00:00Z', updated_at: '2026-09-21T16:30:00Z',
      data: JSON.stringify({ type: 'bus', week_group: 'WG26050', bus_type: 'airport', bus_id: '7', status: 'active', otw_count: 42, departed_at: '2026-09-21T16:30:00Z', notes: 'never expose' })
    },
    {
      type: 'dorm', week_group: 'WG26050', created_at: '2026-09-21T15:00:00Z', updated_at: '2026-09-21T16:20:00Z',
      data: JSON.stringify({ type: 'dorm', week_group: 'WG26050', sdq: '321 TRS', dorm_name: '3A1', section: '01', state: 'open', phase: 'Processing', current_load: 20, max_load: 50, assigned_airman: 'Internal Staff', auditorium_location: 'Internal Room', notes: 'Internal note' })
    }
  ];
  const DB = {
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      let bound = [];
      return {
        bind(...values) { bound = values; return this; },
        async all() {
          if (normalized.includes("FROM gate_week_groups WHERE state='active'")) return { results: [{ week_group: 'WG26050' }] };
          if (normalized.includes("json_extract(data,'$.value')")) return { results: [{ week_group: 'WG26050' }] };
          if (normalized.includes("WHERE week_group = ? AND type IN ('bus','dorm')")) {
            assert.equal(bound[0], 'WG26050');
            return { results: rows };
          }
          throw new Error(`Unexpected SQL: ${normalized}`);
        }
      };
    }
  };

  const response = await getSquadronBoard({ env: { DB }, data: { session: { role: 'squadron' } } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.isOk, true);
  assert.equal(body.board.week_group, 'WG26050');
  assert.equal(body.board.dorms[0].dorm_name, '3A1');
  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /assigned_airman|auditorium_location|Internal Staff|Internal Room|Internal note|never expose/);

  const denied = await getSquadronBoard({ env: { DB }, data: { session: { role: 'airman' } } });
  assert.equal(denied.status, 403);
});
