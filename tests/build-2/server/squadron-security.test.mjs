import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequest as apiMiddleware } from '../../../functions/api/_middleware.js';
import { onRequest as rootMiddleware } from '../../../functions/_middleware.js';
import { roleSigningSecret } from '../../../functions/api/session-contract.mjs';
import { buildSquadronSnapshot, onRequestGet, onRequestPost } from '../../../functions/api/squadron-board.js';

const roleEnv = secret => ({ AUTH_SECRET:secret, SQUADRON_USERNAME:'squadron_access', SQUADRON_PASSWORD:'test-squadron-password', MTI_USERNAME:'mti', MTI_PASSWORD:'test-instructor-password' });
async function sessionCookie(secret, role = 'squadron', username = 'squadron_access') {
  const now = Date.now();
  const payload = { username, role, iat: now, exp: now + 60_000 };
  const body = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(roleSigningSecret(role, roleEnv(secret))), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  const signature = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `prc_sr_session=${body}.${signature}`;
}
function request(path, cookie, method = 'GET') {
  return new Request(`https://gate.example${path}`, { method, headers: { Cookie: cookie } });
}
function bus(status, time, extra = {}) {
  return { type: 'bus', week_group: 'WG26050', bus_type: 'airport', status, departed_at: time, otw_count: 40, ...extra };
}
function dorm(extra = {}) {
  return { type: 'dorm', week_group: 'WG26050', id: 'dorm-1', sdq: '321 TRS', dorm_name: '3A1', state: 'empty', current_load: 0, max_load: 50, ...extra };
}

// A narrow D1 adapter supports genuine migration / SQL statement execution in the test, not a mocked SQL success.
function sqliteD1({ notices = true, information = true } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec("CREATE TABLE gate_week_groups (week_group TEXT, state TEXT); CREATE TABLE records (id TEXT, type TEXT, week_group TEXT, data TEXT, created_at TEXT, updated_at TEXT);");
  if (notices) sqlite.exec(readFileSync(new URL('../../../migrations/0005_gate_squadron_notices.sql', import.meta.url), 'utf8'));
  if (information) sqlite.exec(readFileSync(new URL('../../../migrations/0006_gate_squadron_information_revisions.sql', import.meta.url), 'utf8'));
  return {
    sqlite,
    async exec(sql) { sqlite.exec(sql); return { count: 0, duration: 0 }; },
    prepare(sql) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async first() { return sqlite.prepare(sql).get(...values) || null; },
        async all() { return { results: sqlite.prepare(sql).all(...values) }; },
        async run() { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: result.changes, last_row_id: Number(result.lastInsertRowid) } }; }
      };
    }
  };
}

test('root routing never serves operational app shell to Squadron and fails closed without AUTH_SECRET', async () => {
  const secret = 'route-test-secret';
  const cookie = await sessionCookie(secret);
  const env = roleEnv(secret);
  const root = await rootMiddleware({ request: request('/', cookie), env, next: async () => new Response('APP') });
  assert.equal(root.status, 302);
  assert.equal(root.headers.get('location'), 'https://gate.example/squadron/');
  const squadron = await rootMiddleware({ request: request('/squadron/', cookie), env, next: async () => new Response('SQUADRON') });
  assert.equal(await squadron.text(), 'SQUADRON');
  const records = await rootMiddleware({ request: request('/api/records', cookie), env, next: async () => new Response('SHOULD NOT RUN') });
  assert.equal(records.status, 403);
  const instructor = await sessionCookie(secret, 'instructor', 'mti');
  const instructorSquadronPath = await rootMiddleware({ request: request('/squadron/', instructor), env, next: async () => new Response('SHOULD NOT RUN') });
  assert.equal(instructorSquadronPath.status, 302);
  const missingSecret = await rootMiddleware({ request: request('/squadron/', cookie), env: {}, next: async () => new Response('SHOULD NOT RUN') });
  assert.notEqual(missingSecret.status, 200);
});

test('direct Squadron API requests can read only the projected board/session and logout', async () => {
  const secret = 'api-test-secret';
  const cookie = await sessionCookie(secret);
  const env = { ...roleEnv(secret), GATE_PERSISTENCE_ENABLED: 'false' };
  for (const [path, method] of [['/api/squadron-board', 'GET'], ['/api/session', 'GET'], ['/api/logout', 'POST']]) {
    const response = await apiMiddleware({ request: request(path, cookie, method), env, data: {}, next: async () => new Response('ALLOWED') });
    assert.equal(response.status, 200, `${method} ${path}`);
  }
  for (const [path, method] of [
    ['/api/squadron-board', 'POST'], ['/api/squadron-board', 'PUT'], ['/api/session', 'POST'],
    ['/api/records', 'GET'], ['/api/records', 'POST'], ['/api/persistence', 'POST'],
    ['/api/archive-delete', 'DELETE'], ['/api/sat-arrivals', 'GET'], ['/api/other', 'GET']
  ]) {
    const response = await apiMiddleware({ request: request(path, cookie, method), env, data: {}, next: async () => new Response('SHOULD NOT RUN') });
    assert.equal(response.status, 403, `${method} ${path}`);
  }
});

test('rolling bus tempo uses only airport dispatches and ages out automatically at the 60-minute boundary', () => {
  const now = new Date('2026-09-21T17:00:00Z');
  const records = [
    bus('arrived', '2026-09-21T16:30:00Z', { id:'b1' }),
    bus('active', '2026-09-21T16:45:00Z', { id:'b2' }),
    bus('active', '2026-09-21T16:59:00Z', { id:'b3' }),
    bus('arrived', '2026-09-21T15:59:00Z', { id:'old' }),
    bus('arrived', '2026-09-21T16:55:00Z', { type:'bus', bus_type:'local', id:'local' }),
    { ...bus('arrived','2026-09-21T16:55:00Z'), week_group:'WG26049' },
    dorm()
  ];
  const heavy = buildSquadronSnapshot({ weekGroup:'WG26050', records, now });
  assert.equal(heavy.metrics.arrived, 80);
  assert.equal(heavy.metrics.expected, 50);
  assert.equal(heavy.traffic.dispatched_last_60_minutes, 3);
  assert.equal(heavy.traffic.status, 'HEAVY');
  assert.ok(!('active_buses' in heavy));
  const medium = buildSquadronSnapshot({ weekGroup:'WG26050', records, now:'2026-09-21T17:31:00Z' });
  assert.equal(medium.traffic.dispatched_last_60_minutes, 2);
  assert.equal(medium.traffic.status, 'MEDIUM');
  const slow = buildSquadronSnapshot({ weekGroup:'WG26050', records, now:'2026-09-21T17:46:00Z' });
  assert.equal(slow.traffic.dispatched_last_60_minutes, 1);
  assert.equal(slow.traffic.status, 'SLOW');
  const inactive = buildSquadronSnapshot({ weekGroup:'', records, now });
  assert.equal(inactive.metrics.arrived, 0);
  assert.equal(inactive.dorms.length, 0);
});

test('Squadron projection is allowlisted, stable-id keyed and never invents unknown dorm states', () => {
  const projection = buildSquadronSnapshot({ weekGroup:'WG26050', records:[
    dorm({ __row_id:'opaque-id', state:'open', current_load:50, sex:'female', notes:'internal notes', assigned_airman:'name', auditorium_location:'private' }),
    bus('arrived','2026-09-21T16:30:00Z',{ notes:'internal bus notes' })
  ], now:'2026-09-21T17:00:00Z', lastFlight:'2345', notice: { id:7, message:'CQ coordination update', published_at:'2026-09-21T16:50:00Z' } });
  assert.equal(projection.dorms[0].card_id,'opaque-id');
  assert.equal(projection.metrics.last_flight, '2345');
  assert.equal(projection.notice.revision,7);
  assert.equal(projection.information.revision,0);
  assert.equal(projection.information.instructions.length,4);
  assert.match(projection.information.instructions[3], /210-671-3042/);
  assert.ok(!('active_buses' in projection));
  assert.doesNotMatch(JSON.stringify(projection), /internal notes|internal bus notes|assigned_airman|auditorium_location|private/);
  assert.throws(() => buildSquadronSnapshot({weekGroup:'WG26050',records:[dorm({state:'unrecognized'})]}), /Unrecognized dorm state/);
  assert.throws(() => buildSquadronSnapshot({weekGroup:'WG26050',records:[dorm({max_load:-1})]}), /Invalid Squadron operational count/);
});

test('read endpoint uses only active WG, exposes notice but withholds raw records', async () => {
  const DB = sqliteD1();
  DB.sqlite.prepare("INSERT INTO gate_week_groups VALUES ('WG26050','active')").run();
  for (const record of [bus('arrived','2026-09-21T16:00:00Z', { id:'bus-1', notes:'NEVER SHOW' }), dorm({ id:'dorm-1', notes:'NEVER SHOW', assigned_airman:'PERSON' })]) {
    DB.sqlite.prepare('INSERT INTO records VALUES (?,?,?,?,?,?)').run(record.id, record.type, record.week_group, JSON.stringify(record), new Date().toISOString(), new Date().toISOString());
  }
  for (const [id,key,value,recordWeek] of [['wg-config','week_group','WG26050','WG26050'],['flight-config','last_airport','2350','']]) {
    // Airport last_airport is global config and is not guaranteed to carry the active Week Group.
    DB.sqlite.prepare('INSERT INTO records VALUES (?,?,?,?,?,?)').run(id, 'config',recordWeek, JSON.stringify({ key,value }),new Date().toISOString(),new Date().toISOString());
  }
  DB.sqlite.prepare("INSERT INTO gate_squadron_notices (week_group,message,published_at,published_by_role) VALUES ('WG26050','CQ UPDATE','2026-09-21T16:40:00Z','instructor')").run();
  DB.sqlite.prepare("INSERT INTO gate_squadron_information_revisions (instructions_json,published_at,published_by_role) VALUES (?,?,?)")
    .run(JSON.stringify(['Dorms open when full.','Call CQ with updates.']), '2026-09-21T16:35:00Z', 'instructor');
  const result = await onRequestGet({ env: { DB }, data: { session:{role:'squadron'} } });
  assert.equal(result.status,200);
  const payload=await result.json();
  assert.equal(payload.board.week_group,'WG26050');
  assert.equal(payload.board.notice.message,'CQ UPDATE');
  assert.equal(payload.board.metrics.last_flight,'2350');
  assert.deepEqual(payload.board.information.instructions,['Dorms open when full.','Call CQ with updates.']);
  assert.equal(payload.editor,false);
  assert.doesNotMatch(JSON.stringify(payload), /NEVER SHOW|PERSON|assigned_airman|notes|active_buses/);
  assert.equal((await onRequestGet({env:{DB},data:{session:{role:'airman'}}})).status,403);
  DB.sqlite.close();
});

test('notice publication is MTI-only, origin checked, conditional, append-only and cannot publish stale revisions', async () => {
  const DB=sqliteD1();
  DB.sqlite.prepare("INSERT INTO gate_week_groups VALUES ('WG26050','active')").run();
  DB.sqlite.prepare('INSERT INTO records VALUES (?,?,?,?,?,?)').run('config-wg','config','WG26050',JSON.stringify({ key:'week_group',value:'WG26050' }),'2026-09-21T00:00:00Z','2026-09-21T00:00:00Z');
  const makeRequest=(payload,origin='https://gate.example', extra={}) => new Request('https://gate.example/api/squadron-board',{method:'POST',headers:{ Origin:origin,'Content-Type':'application/json','X-Gate-Notice':'publish',...extra},body:JSON.stringify(payload)});
  const attempt=(req,role) => onRequestPost({request:req,env:{DB},data:{session:{role}}});
  const notice={ message:'Please coordinate with CQ.', expected_revision:0 };
  assert.equal((await attempt(makeRequest(notice),'squadron')).status,403);
  assert.equal((await attempt(makeRequest(notice),'airman')).status,403);
  assert.equal((await attempt(makeRequest(notice,'https://other.example'),'instructor')).status,403);
  const published=await attempt(makeRequest(notice),'instructor');
  assert.equal(published.status,200);
  const body=await published.json();
  assert.equal(body.notice.revision,1);
  assert.equal((await attempt(makeRequest(notice),'instructor')).status,409);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM gate_squadron_notices').get().n,1);
  assert.throws(()=>DB.sqlite.exec("UPDATE gate_squadron_notices SET message='changed' WHERE id=1"),/append-only/);
  assert.throws(()=>DB.sqlite.exec('DELETE FROM gate_squadron_notices WHERE id=1'),/append-only/);
  const clearRequest=(expected_revision, role='instructor') => onRequestPost({
    request:new Request('https://gate.example/api/squadron-board',{method:'POST',headers:{Origin:'https://gate.example','Content-Type':'application/json','X-Gate-Notice':'clear'},body:JSON.stringify({expected_revision})}),
    env:{DB},data:{session:{role}}
  });
  assert.equal((await clearRequest(1,'squadron')).status,403);
  assert.equal((await clearRequest(0)).status,409, 'clear must reject a stale notice revision');
  const cleared=await clearRequest(1);
  assert.equal(cleared.status,200);
  const clearedBody=await cleared.json();
  assert.equal(clearedBody.cleared,true);
  assert.equal(clearedBody.notice.revision,2);
  assert.equal(clearedBody.notice.message,'');
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM gate_squadron_notices').get().n,2, 'clear is an append-only revision, never a delete');
  const readAfterClear=await onRequestGet({env:{DB},data:{session:{role:'squadron'}}});
  const readAfterClearBody=await readAfterClear.json();
  assert.equal(readAfterClearBody.board.notice.revision,2);
  assert.equal(readAfterClearBody.board.notice.message,'', 'cleared sentinel must never be projected to Squadron users');

  const second=await attempt(makeRequest({message:'Second notice',expected_revision:2}),'instructor');
  assert.equal(second.status,200);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM gate_squadron_notices').get().n,3);
  DB.sqlite.close();
});

test('instructor writes self-bootstrap missing storage for a legacy config-only active Week Group without granting Squadron mutations', async () => {
  const DB=sqliteD1({notices:false,information:false});
  // Production can still have a readable legacy active Week Group represented only by the config record.
  // Notice publication must use the same activeWeekGroup resolution instead of requiring a lifecycle row.
  DB.sqlite.prepare('INSERT INTO records VALUES (?,?,?,?,?,?)').run('config-wg','config','WG26050',JSON.stringify({ key:'week_group',value:'WG26050' }),'2026-09-21T00:00:00Z','2026-09-21T00:00:00Z');

  const before=await onRequestGet({env:{DB},data:{session:{role:'squadron'}}});
  assert.equal(before.status,200);
  const beforeBody=await before.json();
  assert.equal(beforeBody.board.information.revision,0);
  assert.equal(beforeBody.board.information.instructions.length,4);

  const noticeRequest=new Request('https://gate.example/api/squadron-board',{
    method:'POST',
    headers:{Origin:'https://gate.example','Content-Type':'application/json','X-Gate-Notice':'publish'},
    body:JSON.stringify({message:'Test notification',expected_revision:0})
  });
  const published=await onRequestPost({request:noticeRequest,env:{DB},data:{session:{role:'instructor'}}});
  assert.equal(published.status,200);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM gate_squadron_notices').get().n,1);
  assert.equal(DB.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='gate_squadron_information_revisions'").get(), undefined, 'notice bootstrap must not depend on unrelated information storage');

  const informationRequest=(instructions, expected_revision) => new Request('https://gate.example/api/squadron-board',{
    method:'POST',
    headers:{Origin:'https://gate.example','Content-Type':'application/json','X-Gate-Information':'save'},
    body:JSON.stringify({instructions,expected_revision})
  });
  const blocked=await onRequestPost({request:informationRequest(['No access'],0),env:{DB},data:{session:{role:'squadron'}}});
  assert.equal(blocked.status,403);

  const first=await onRequestPost({request:informationRequest(['First standing instruction','Second standing instruction'],0),env:{DB},data:{session:{role:'instructor'}}});
  assert.equal(first.status,200);
  assert.ok(DB.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='gate_squadron_information_revisions'").get());
  const firstBody=await first.json();
  assert.equal(firstBody.information.revision,1);
  assert.equal((await onRequestPost({request:informationRequest(['stale'],0),env:{DB},data:{session:{role:'instructor'}}})).status,409);

  const second=await onRequestPost({request:informationRequest(['Second standing instruction'],1),env:{DB},data:{session:{role:'instructor'}}});
  assert.equal(second.status,200);
  assert.equal(DB.sqlite.prepare('SELECT COUNT(*) AS n FROM gate_squadron_information_revisions').get().n,2);
  assert.throws(()=>DB.sqlite.exec("UPDATE gate_squadron_information_revisions SET instructions_json='[]' WHERE id=1"),/append-only/);
  assert.throws(()=>DB.sqlite.exec('DELETE FROM gate_squadron_information_revisions WHERE id=1'),/append-only/);

  const after=await onRequestGet({env:{DB},data:{session:{role:'squadron'}}});
  assert.equal(after.status,200);
  const afterBody=await after.json();
  assert.deepEqual(afterBody.board.information.instructions,['Second standing instruction']);
  assert.equal(afterBody.board.information.revision,2);
  DB.sqlite.close();
});

