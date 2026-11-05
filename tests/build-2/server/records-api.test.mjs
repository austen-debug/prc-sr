import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  calculateOperationalAccounting,
  onRequestDelete,
  onRequestGet,
  onRequestPost,
  onRequestPut
} from '../../../functions/api/records.js';
import { roleSigningSecret, verifyRequestSession } from '../../../functions/api/session-contract.mjs';

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

function createD1(seed = [], { liveGroup = 'WG' } = {}) {
  const rows = seed.map(record => rowFor(record));
  // Unit fixtures default to an active legacy cycle; explicitly pass an empty
  // liveGroup to verify rejection when no authoritative cycle exists.
  const virtualConfig = () => rows.filter(item=>item.type==='config' && JSON.parse(item.data).key==='week_group');
  const configured = () => virtualConfig().length ? virtualConfig() : (liveGroup ?
    [rowFor({__backendId:'fixture-week',type:'config',key:'week_group',value:liveGroup})] : []);

  function statement(sql) {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    let bound = [];
    return {
      bind(...values) {
        bound = values;
        return this;
      },
      async all() {
        // UPDATE/DELETE RETURNING produce a result row even when audit and
        // typed-mirror triggers inflate D1's aggregate meta.changes.
        if (normalized.startsWith('UPDATE records') || normalized.startsWith('DELETE FROM records') ||
            (normalized.startsWith('INSERT INTO records') && normalized.includes('RETURNING id'))) {
          if (!normalized.includes('RETURNING id')) throw new Error('Mutation must return the target record id.');
          return this.run();
        }
        if (!normalized.startsWith('SELECT')) throw new Error(`Unsupported all SQL: ${normalized}`);
        if (normalized.includes("WHERE type='archive' AND week_group=?"))
          return {results:clone(rows.filter(item=>item.type==='archive' && item.week_group===bound[0]))};
        if (normalized.includes("WHERE type='config' AND json_extract(data,'$.key')='week_group'"))
          return {results:clone(configured())};
        if (normalized.includes("FROM gate_week_groups WHERE state<>'closed'"))
          return {results:[]};
        if (normalized.includes("FROM records WHERE type='archive' AND week_group=?"))
          return {results:clone(rows.filter(item=>item.type==='archive' && item.week_group===bound[0])
            .map(item=>({...item,archived_at:JSON.parse(item.data).archived_at||item.created_at})))};
        if (normalized.includes("FROM records WHERE type='dorm' AND week_group=?"))
          return {results:clone(rows.filter(item=>item.type==='dorm' && item.week_group===bound[0]).map(item=>({
            id:item.id,created_at:item.created_at,initialization_request_id:JSON.parse(item.data).initialization_request_id||null
          })).concat(rows.some(item=>item.type==='dorm'||item.type==='archive')||!liveGroup?[]:
            [{id:'fixture-dorm',created_at:'2026-07-15T00:00:00Z',initialization_request_id:null}]))};
        if (normalized.includes("FROM records WHERE type='bus' AND json_extract(data,'$.operation_id')=?"))
          return {results:clone(rows.filter(item=>item.type==='bus' && JSON.parse(item.data).operation_id===bound[0]))};
        return { results: clone(rows) };
      },
      async first() {
        // Pre-migration D1 contains no Admin disposition table. Model that
        // catalog lookup without changing existing record fixture semantics.
        if (normalized.includes('FROM sqlite_master')) return null;
        if (normalized.includes("FROM gate_week_groups WHERE")) return null;
        if (normalized.includes("WHERE type='dorm' AND week_group=?"))
          return clone(rows.find(item=>item.type==='dorm' && item.week_group===bound[0] &&
            JSON.parse(item.data).initialization_request_id===bound[1] &&
            Date.parse(item.created_at)>Date.parse(bound[2]))||null);
        if (normalized.includes("WHERE type='archive' AND week_group=?")) {
          return clone(rows.find(item=>item.type==='archive' && item.week_group===bound[0])||null);
        }
        if (!normalized.startsWith('SELECT') || !normalized.includes('WHERE id = ?')) {
          throw new Error(`Unsupported first SQL: ${normalized}`);
        }
        return clone(rows.find(item => item.id === bound[0]) || null);
      },
      async run() {
        if (normalized.startsWith('INSERT INTO records')) {
          const [id, type, weekGroup, data, createdAt, updatedAt] = bound;
          if (normalized.includes('RETURNING id')) {
            const operationId=bound[6], busType=bound[8], busId=bound[10];
            if ((operationId && rows.some(item=>item.type==='bus' && JSON.parse(item.data).operation_id===operationId)) ||
                (busType==='airport' && rows.some(item=>item.type==='bus' && item.week_group===weekGroup &&
                  JSON.parse(item.data).bus_type==='airport' && String(JSON.parse(item.data).bus_id)===busId)))
              return {success:true,results:[],meta:{changes:0}};
          }
          rows.push({ id, type, week_group: weekGroup, data, created_at: createdAt, updated_at: updatedAt });
          return { success:true,results:[{id}],meta: { changes: 1 } };
        }

        if (normalized.startsWith('UPDATE records')) {
          const conditional = normalized.includes('json_extract');
          const id = bound[4];
          const index = rows.findIndex(item => item.id === id);
          if (index < 0) return { success: true, results: [], meta: { changes: 0 } };
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
          return { success: true, results: [{ id }], meta: { changes: 3 } };
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
          return { success: true, results: [{ id }], meta: { changes: 3 } };
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
      bus_type: 'airport',
      bus_id: '1',
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
    data: roleData('instructor'),
    request: request('PUT', { __backendId: 'bus-1', status: 'arrived', arrived_at: '2026-07-15T01:00:00Z' }, { 'If-Match': '1' })
  });
  const updatedBody = await json(updated);
  assert.equal(updated.status, 200);
  assert.equal(updatedBody.data.record_version, 2);
  assert.equal(updatedBody.data.created_by_role, 'instructor');
  assert.equal(updatedBody.data.updated_by_role, 'instructor');

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

test('Airman commands are limited to local arrivals and approved Processing fields',async()=>{
 const db=createD1([
  {__backendId:'bus-1',type:'bus',bus_type:'airport',bus_id:'1',week_group:'WG',
    status:'arrived',otw_count:20,record_version:1},
  {__backendId:'dorm-1',type:'dorm',week_group:'WG',state:'open',phase:'OPEN',
    max_load:30,current_load:0,assigned_airman:'',auditorium_location:'',record_version:1},
  {__backendId:'config-1',type:'config',key:'last_airport',value:'AA',record_version:1}
 ]);
 const env={DB:db},data=roleData('airman');
 const call=(handler,method,body,version)=>handler({env,data,
  request:request(method,body,version===undefined?{}:{'If-Match':String(version)})});
 for(const payload of [
  {type:'config',key:'last_airport',value:'XX'},
  {type:'bus',bus_type:'airport',bus_id:'3',week_group:'WG',status:'active',otw_count:2},
  {type:'dorm',week_group:'WG',max_load:20,current_load:0}
 ]){
  const response=await call(onRequestPost,'POST',payload);
  assert.equal(response.status,403,JSON.stringify(payload));
 }
 assert.equal((await call(onRequestPut,'PUT',{__backendId:'config-1',value:'BB'},1)).status,403);
 assert.equal((await call(onRequestPut,'PUT',{__backendId:'bus-1',status:'active'},1)).status,403);
 assert.equal((await call(onRequestDelete,'DELETE',{__backendId:'bus-1'},1)).status,403);
 assert.equal((await call(onRequestPut,'PUT',{__backendId:'dorm-1',
  __changes:{state:'closed'},__base_values:{state:'open'}},1)).status,403);
 const processing=await call(onRequestPut,'PUT',{__backendId:'dorm-1',
  __changes:{phase:'LOBBY',current_load:6,assigned_airman:'A',auditorium_location:'Room'},
  __base_values:{phase:'OPEN',current_load:0,assigned_airman:'',auditorium_location:''}},1);
 assert.equal(processing.status,200,await processing.clone().text());
 assert.equal((await processing.json()).data.updated_by_role,'airman');
 const arrival=await call(onRequestPost,'POST',{type:'bus',bus_type:'local',bus_id:'',
  week_group:'WG',destination:'Local',originating_destination:'Local',otw_count:2,status:'arrived'});
 assert.equal(arrival.status,201,await arrival.clone().text());
});

test('Operational writes reject absent and mismatched live Week Group identity',async()=>{
 const inactive=createD1([],{liveGroup:''});
 const unavailable=await onRequestPost({env:{DB:inactive},data:roleData('instructor'),
  request:request('POST',{type:'bus',bus_type:'airport',bus_id:'1',week_group:'WG',
    status:'active',otw_count:2})});
 assert.equal(unavailable.status,409);
 assert.equal((await unavailable.json()).code,'lifecycle_required');
 const db=createD1([{__backendId:'bus-old',type:'bus',week_group:'OTHER',
  status:'active',record_version:1}]);
 const change=await onRequestPut({env:{DB:db},data:roleData('instructor'),
  request:request('PUT',{__backendId:'bus-old',status:'arrived'},{'If-Match':'1'})});
 assert.equal(change.status,409);
 assert.equal((await change.json()).code,'lifecycle_required');
 assert.equal(JSON.parse(db.rows[0].data).status,'active');
});

test('Processing mutations acknowledge the affected row despite trigger-expanded D1 change counts', async () => {
  const db=createD1([{__backendId:'dorm-trigger',type:'dorm',week_group:'WG',
    state:'open',phase:'OPEN',current_load:0,max_load:40,record_version:1}]);
  // This fixture reports 3 aggregate changes for a single source-row write:
  // the record itself, a typed mirror, and an append-only audit event.
  const edit=await onRequestPut({env:{DB:db},data:roleData('instructor'),
    request:request('PUT',{__backendId:'dorm-trigger',
      __changes:{phase:'AUDITORIUM'},__base_values:{phase:'OPEN'}},{'If-Match':'1'})});
  assert.equal(edit.status,200,await edit.clone().text());
  const edited=await json(edit);
  assert.equal(edited.data.phase,'AUDITORIUM');
  assert.equal(edited.data.record_version,2);

  // Genuine version conflicts must still be rejected before any write.
  const stale=await onRequestPut({env:{DB:db},data:roleData('instructor'),
    request:request('PUT',{__backendId:'dorm-trigger',
      __changes:{phase:'LOBBY'},__base_values:{phase:'OPEN'}},{'If-Match':'1'})});
  assert.equal(stale.status,409);
  assert.equal((await json(stale)).code,'record_version_conflict');
  assert.equal(JSON.parse(db.rows[0].data).phase,'AUDITORIUM');

  const removed=await onRequestDelete({env:{DB:db},data:roleData('instructor'),
    request:request('DELETE',{__backendId:'dorm-trigger'},{'If-Match':'2'})});
  assert.equal(removed.status,200,await removed.clone().text());
  assert.equal((await json(removed)).id,'dorm-trigger');
  assert.equal(db.rows.length,0);
});

test('operational PUT and DELETE require an explicit expected version',async()=>{
  const db=createD1([{__backendId:'bus-1',type:'bus',week_group:'WG',record_version:1,status:'active'}]);
  for(const method of ['PUT','DELETE']){
    const handler=method==='PUT'?onRequestPut:onRequestDelete;
    const response=await handler({env:{DB:db},data:roleData('instructor'),
      request:request(method,{__backendId:'bus-1',type:'bus',status:'arrived'})});
    assert.equal(response.status,428);
    assert.equal((await json(response)).code,'record_version_required');
    assert.equal(JSON.parse(db.rows[0].data).status,'active');
  }
});
test('stale edits to disjoint bus fields rebase without reverting another operator; same-field edits require review',async()=>{
  const db=createD1([{__backendId:'bus-1',type:'bus',week_group:'WG',record_version:1,status:'active',otw_count:30}]);
  const put=(version,changes,base)=>onRequestPut({env:{DB:db},data:roleData('instructor'),
    request:request('PUT',{__backendId:'bus-1',record_version:version,__changes:changes,__base_values:base},
      {'If-Match':String(version)})});
  let response=await put(1,{status:'arrived'},{status:'active'});
  assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
  assert.equal((await json(response)).data.record_version,2);
  response=await put(1,{otw_count:32},{otw_count:30});
  assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
  let record=(await json(response)).data;
  assert.equal(record.record_version,3);
  assert.equal(record.status,'arrived');
  assert.equal(record.otw_count,32);
  response=await put(1,{otw_count:29},{otw_count:30});
  assert.equal(response.status,409);
  assert.equal((await json(response)).code,'record_version_conflict');
  assert.equal(JSON.parse(db.rows[0].data).otw_count,32);
  response=await put(3,{otw_count:29},{otw_count:32});
  assert.equal(response.status,200);
  record=(await json(response)).data;
  assert.equal(record.otw_count,29);
  assert.equal(record.status,'arrived');
  assert.equal(record.record_version,4);
});
test('processing phase and dorm loading from separate operators retain both successful field edits',async()=>{
  const db=createD1([
    {__backendId:'bus-1',type:'bus',week_group:'WG',status:'arrived',otw_count:40,record_version:1},
    {__backendId:'dorm-1',type:'dorm',week_group:'WG',state:'open',phase:'OPEN',max_load:50,current_load:0,record_version:1}
  ]);
  const write=(changes,base)=>onRequestPut({env:{DB:db},data:roleData('instructor'),
    request:request('PUT',{__backendId:'dorm-1',__changes:changes,__base_values:base},{'If-Match':'1'})});
  const phase=await write({phase:'AUDITORIUM'},{phase:'OPEN'});
  assert.equal(phase.status,200);
  const load=await write({current_load:20},{current_load:0});
  assert.equal(load.status,200,JSON.stringify(await load.clone().json()));
  const dorm=(await json(load)).data;
  assert.equal(dorm.current_load,20);
  assert.equal(dorm.phase,'AUDITORIUM');
  assert.equal(dorm.record_version,3);
});
test('field changes cannot alter protected record identity, provenance, or metadata',async()=>{
  const db=createD1([{__backendId:'bus-1',type:'bus',week_group:'WG',record_version:1,status:'active'}]);
  for(const key of ['type','week_group','__backendId','record_version','updated_by_role']){
    const response=await onRequestPut({env:{DB:db},data:roleData('instructor'),
      request:request('PUT',{__backendId:'bus-1',__changes:{[key]:'tamper'}},{'If-Match':'1'})});
    assert.equal(response.status,400);
  }
  assert.equal(JSON.parse(db.rows[0].data).record_version,1);
});
test('legacy non-lifecycle configuration updates without If-Match retain compatibility and server versions', async () => {
  const db = createD1([{ __backendId: 'cfg-1', type: 'config', key: 'last_airport', value: 'AA', record_version: 0 }]);
  const response = await onRequestPut({
    env: { DB: db },
    data: roleData('instructor'),
    request: request('PUT', { __backendId: 'cfg-1', type: 'config', key: 'last_airport', value: 'BB' })
  });
  const body = await json(response);
  assert.equal(response.status, 200);
  assert.equal(body.data.record_version, 1);
});

test('invalid If-Match and stale conditional deletes fail closed', async () => {
  const db = createD1([{ __backendId: 'bus-1', type: 'bus', week_group:'WG', record_version: 3 }]);
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

test('operational accounting treats arrived airport/local trainees as the physical pool', () => {
  const accounting = calculateOperationalAccounting([
    { type: 'bus', week_group: 'WG', bus_type: 'airport', status: 'arrived', otw_count: 44 },
    { type: 'bus', week_group: 'WG', bus_type: 'local', status: 'arrived', otw_count: 12 },
    { type: 'bus', week_group: 'WG', bus_type: 'airport', status: 'active', otw_count: 40 },
    { type: 'dorm', week_group: 'WG', current_load: 30 },
    { type: 'dorm', week_group: 'WG', current_load: 20 }
  ], 'WG');

  assert.deepEqual(accounting, { arrived: 56, loaded: 50, awaitingAssignment: 6, overAssigned: 0 });
});

test('records API rejects dorm assignments beyond physically arrived trainees or dorm capacity', async () => {
  const db = createD1([
    { __backendId: 'bus-1', type: 'bus', week_group: 'WG', status: 'arrived', otw_count: 40, record_version: 1 },
    { __backendId: 'dorm-1', type: 'dorm', week_group: 'WG', max_load: 30, current_load: 20, record_version: 1 },
    { __backendId: 'dorm-2', type: 'dorm', week_group: 'WG', max_load: 30, current_load: 15, record_version: 1 }
  ]);

  const beyondArrived = await onRequestPut({
    env: { DB: db },
    data: roleData('instructor'),
    request: request('PUT', { __backendId: 'dorm-2', type: 'dorm', week_group: 'WG', max_load: 30, current_load: 25 }, { 'If-Match': '1' })
  });
  const beyondArrivedBody = await json(beyondArrived);
  assert.equal(beyondArrived.status, 409);
  assert.equal(beyondArrivedBody.code, 'operational_invariant');

  const beyondCapacity = await onRequestPut({
    env: { DB: db },
    data: roleData('instructor'),
    request: request('PUT', { __backendId: 'dorm-1', type: 'dorm', week_group: 'WG', max_load: 30, current_load: 31 }, { 'If-Match': '1' })
  });
  const beyondCapacityBody = await json(beyondCapacity);
  assert.equal(beyondCapacity.status, 409);
  assert.equal(beyondCapacityBody.code, 'operational_invariant');
});

test('records API prevents reducing or deleting ARRIVED below assigned dorm load while allowing repairs', async () => {
  const db = createD1([
    { __backendId: 'bus-1', type: 'bus', week_group: 'WG', status: 'arrived', otw_count: 40, record_version: 1 },
    { __backendId: 'bus-2', type: 'bus', week_group: 'WG', status: 'arrived', otw_count: 20, record_version: 1 },
    { __backendId: 'dorm-1', type: 'dorm', week_group: 'WG', max_load: 60, current_load: 55, record_version: 1 }
  ]);

  const reduceArrival = await onRequestPut({
    env: { DB: db },
    data: roleData('instructor'),
    request: request('PUT', { __backendId: 'bus-2', type: 'bus', week_group: 'WG', status: 'arrived', otw_count: 10 }, { 'If-Match': '1' })
  });
  assert.equal(reduceArrival.status, 409);

  const deleteArrival = await onRequestDelete({
    env: { DB: db },
    data: roleData('instructor'),
    request: request('DELETE', { __backendId: 'bus-2' }, { 'If-Match': '1' })
  });
  assert.equal(deleteArrival.status, 409);

  const reduceLoad = await onRequestPut({
    env: { DB: db },
    data: roleData('instructor'),
    request: request('PUT', { __backendId: 'dorm-1', type: 'dorm', week_group: 'WG', max_load: 60, current_load: 45 }, { 'If-Match': '1' })
  });
  assert.equal(reduceLoad.status, 200);
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

test('Squadron role cannot read or mutate the generic records API', async () => {
  const db = createD1([
    { __backendId: 'dorm-1', type: 'dorm', assigned_airman: 'Staff', auditorium_location: 'Room', notes: 'internal' }
  ]);
  const read = await onRequestGet({ env: { DB: db }, data: roleData('squadron') });
  assert.equal(read.status, 403);

  const write = await onRequestPost({
    env: { DB: db },
    data: roleData('squadron'),
    request: request('POST', { type: 'bus' })
  });
  assert.equal(write.status, 403);
});

test('route-local session verifier accepts a valid signed role cookie', async () => {
  const secret = 'test-secret';
  const env = { AUTH_SECRET: secret, MTI_USERNAME:'tester', MTI_PASSWORD:'fixture-password' };
  const now = Date.now();
  const payload = { username: 'tester', role: 'instructor', iat: now, exp: now + 60_000 };
  const body = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(roleSigningSecret('instructor', env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  const signature = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const session = await verifyRequestSession(new Request('https://gate.example/api/records', {
    headers: { Cookie: `prc_sr_session=${body}.${signature}` }
  }), env);
  assert.equal(session.role, 'instructor');
  assert.equal(session.username, 'tester');
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

test('generic records API rejects creation, update and deletion for an already archived Week Group',async()=>{
  const db=createD1([
    {__backendId:'archived-week',type:'archive',week_group:'WG',record_version:1},
    {__backendId:'bus-1',type:'bus',week_group:'WG',status:'arrived',otw_count:3,record_version:1},
    {__backendId:'sound-1',type:'sound_event',week_group:'WG',record_version:1}
  ]);
  const env={DB:db},data=roleData('instructor');
  const create=await onRequestPost({env,data,request:request('POST',{type:'bus',bus_type:'airport',bus_id:'2',week_group:'WG',otw_count:2,status:'active'})});
  const update=await onRequestPut({env,data,request:request('PUT',{__backendId:'bus-1',week_group:'WG',status:'active'},{'If-Match':'1'})});
  const remove=await onRequestDelete({env,data,request:request('DELETE',{__backendId:'sound-1'})});
  for(const result of [create,update,remove]){
    assert.equal(result.status,409);
    assert.equal((await result.json()).code,'week_group_archived');
  }
  assert.equal(db.rows.length,3);
  assert.equal(JSON.parse(db.rows.find(item=>item.id==='bus-1').data).status,'arrived');
});

test('a genuinely reinitialized historical label remains writable after the prior archive',async()=>{
  const older='2026-10-20T10:00:00.000Z';
  const current='2026-10-27T10:00:00.000Z';
  const init='5a0e48e0-0123-4123-8123-012345678901';
  const db=createD1([
    {__backendId:'old-archive',type:'archive',week_group:'WG',archived_at:older,created_at:older},
    {__backendId:'active-cfg',type:'config',key:'week_group',value:'WG',
      initialization_request_id:init,updated_at:current},
    {__backendId:'current-dorm',type:'dorm',week_group:'WG',dorm_name:'3A1',
      initialization_request_id:init,created_at:current}
  ]);
  const response=await onRequestPost({env:{DB:db},data:roleData('instructor'),
    request:request('POST',{type:'bus',bus_type:'airport',bus_id:'2',week_group:'WG',status:'active',otw_count:2})});
  assert.equal(response.status,201,await response.clone().text());
  assert.equal(db.rows.filter(row=>row.type==='bus').length,1);
});
