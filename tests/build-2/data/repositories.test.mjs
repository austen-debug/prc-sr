import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordsClient } from '../../../public/app/data/records-client.mjs';
import { RepositoryErrorCode } from '../../../public/app/data/repository-result.mjs';
import { createGateRepositories } from '../../../public/app/data/index.mjs';

const ACTOR = 'instructor';
const clone = value => JSON.parse(JSON.stringify(value));

function createMemoryTransport(seed = [], { recordVersioning = false } = {}) {
  const records = seed.map(record => ({ record_version: record.record_version ?? 0, ...clone(record) }));
  let nextId = records.length + 1;
  const response = (status, body) => ({ ok: status >= 200 && status < 300, status, body });
  return {
    capabilities: { recordVersioning, conditionalWrites: recordVersioning, transactions: false, batchWrites: false },
    records,
    async list() { return response(200, { isOk: true, records: clone(records) }); },
    async create(record) {
      const created = { ...clone(record), __backendId: record.__backendId || `rec-${nextId++}`, record_version: 1 };
      records.push(created);
      return response(201, { isOk: true, data: clone(created) });
    },
    async update(record, options = {}) {
      const index = records.findIndex(item => item.__backendId === record.__backendId);
      if (index < 0) return response(404, { isOk: false, error: 'Record not found.' });
      if (recordVersioning && Number.isFinite(options.expectedRecordVersion) && options.expectedRecordVersion !== records[index].record_version) return response(409, { isOk: false, error: 'Record version conflict.', currentRecordVersion: records[index].record_version });
      const updated = { ...clone(record), record_version: records[index].record_version + 1 };
      records[index] = updated;
      return response(200, { isOk: true, data: clone(updated) });
    },
    async delete(record, options = {}) {
      const index = records.findIndex(item => item.__backendId === record.__backendId);
      if (index < 0) return response(404, { isOk: false, error: 'Record not found.' });
      if (recordVersioning && Number.isFinite(options.expectedRecordVersion) && options.expectedRecordVersion !== records[index].record_version) return response(409, { isOk: false, error: 'Record version conflict.' });
      records.splice(index, 1);
      return response(200, { isOk: true });
    }
  };
}

function setup(seed = [], options = {}) {
  const transport = createMemoryTransport(seed, options);
  const client = createRecordsClient({ transport, timeZone: 'America/Chicago' });
  return { transport, client, repositories: createGateRepositories({ client }) };
}

test('repositories return typed canonical entities and preserve compatibility warnings', async () => {
  const { repositories } = setup([
    { __backendId: 'bus-1', type: 'bus', week_group: 'WG', status: 'arrived', otw_count: 10, arrived_at: '2026-07-07T18:00:00Z' },
    { __backendId: 'dorm-1', type: 'dorm', week_group: 'WG', dorm_name: 'D1', max_load: 60, current_load: 70 },
    { __backendId: 'bus-2', type: 'bus', week_group: 'OTHER', status: 'active', otw_count: 20 }
  ]);
  const buses = await repositories.buses.list({ weekGroup: 'WG' });
  const dorms = await repositories.dorms.list({ weekGroup: 'WG' });
  assert.equal(buses.data.length, 1);
  assert.equal(buses.data[0].payload.confirmedArrival, true);
  assert.equal(buses.data[0].createdByRole, 'unknown');
  assert.equal(dorms.data[0].payload.load, 60);
  assert.match(dorms.meta.warnings[0].message, /constrained/i);
});

test('new writes require actor role and persist creator/updater provenance', async () => {
  const { repositories, transport } = setup();
  const missing = await repositories.buses.createAirportBus({ weekGroup: 'WG', busId: '7', total: 44, departedAt: '2026-07-07T18:00:00Z' });
  assert.equal(missing.ok, false);
  assert.equal(missing.error.code, RepositoryErrorCode.VALIDATION);
  const airport = await repositories.buses.createAirportBus({ actorRole: ACTOR, weekGroup: 'WG', busId: '7', total: 44, female: 12, naturalization: 3, spaceForce: 4, departedAt: '2026-07-07T18:00:00Z' });
  const local = await repositories.buses.createLocalArrival({ actorRole: 'airman', weekGroup: 'WG', destination: 'MEPS', total: 12, female: 5, naturalization: 2, arrivedAt: '2026-07-07T19:00:00Z' });
  assert.equal(airport.data.createdByRole, ACTOR);
  assert.equal(airport.data.updatedByRole, ACTOR);
  assert.equal(local.data.createdByRole, 'airman');
  assert.equal(transport.records[0].created_by_role, ACTOR);
  assert.equal(transport.records[1].updated_by_role, 'airman');
});

test('bus confirmation and count edits preserve arrival identity and updater role', async () => {
  const { repositories, transport } = setup([{ __backendId: 'bus-1', type: 'bus', week_group: 'WG', bus_id: '1', bus_type: 'airport', status: 'active', otw_count: 40, created_at: '2026-07-07T18:00:00Z', departed_at: '2026-07-07T18:00:00Z' }]);
  const confirmed = await repositories.buses.confirmArrival('bus-1', { actorRole: ACTOR, arrivedAt: '2026-07-07T18:30:00Z' });
  const edited = await repositories.buses.updateCounts('bus-1', { actorRole: 'airman', total: 39, female: 4, naturalization: 2, spaceForce: 0, updatedAt: '2026-07-07T19:00:00Z' });
  assert.equal(confirmed.data.payload.confirmedArrival, true);
  assert.equal(edited.data.payload.arrivedAt, '2026-07-07T18:30:00.000Z');
  assert.equal(edited.data.updatedByRole, 'airman');
  assert.equal(transport.records[0].status, 'arrived');
});

test('dorm commands enforce bounds, explicit overrides, and provenance', async () => {
  const { repositories, transport } = setup([{ __backendId: 'dorm-1', type: 'dorm', week_group: 'WG', dorm_name: 'D1', max_load: 60, current_load: 0, state: 'empty', created_at: '2026-07-07T17:00:00Z' }]);
  assert.equal((await repositories.dorms.updateLoad('dorm-1', { actorRole: 'airman', load: 61 })).error.code, RepositoryErrorCode.VALIDATION);
  assert.equal((await repositories.dorms.open('dorm-1', { actorRole: ACTOR, openedAt: '2026-07-07T18:00:00Z' })).ok, true);
  assert.equal((await repositories.dorms.updateLoad('dorm-1', { actorRole: 'airman', load: 59 })).ok, true);
  assert.equal((await repositories.dorms.close('dorm-1', { actorRole: ACTOR, closedAt: '2026-07-07T18:45:00Z', closedTimer: '45:00' })).ok, true);
  assert.equal((await repositories.dorms.correctFinalTime('dorm-1', { actorRole: ACTOR, closedTimer: '44:30' })).ok, true);
  assert.equal((await repositories.dorms.reopen('dorm-1', { actorRole: ACTOR, openedAt: '2026-07-07T19:00:00Z' })).ok, true);
  assert.equal(transport.records[0].manual_closed_timer_override, true);
  assert.equal(transport.records[0].manual_reopen_override, true);
  assert.equal(transport.records[0].updated_by_role, ACTOR);
});

test('config repository normalizes aliases and refuses credentials', async () => {
  const { repositories } = setup([{ __backendId: 'cfg-1', type: 'config', key: 'active_wg', value: '26-28' }]);
  assert.equal((await repositories.config.getActiveWeekGroup()).data, '26-28');
  const secret = await repositories.config.set('SQUADRON_PASSWORD', 'do-not-store', { actorRole: ACTOR });
  assert.equal(secret.error.code, RepositoryErrorCode.VALIDATION);
});

test('archive repository writes canonical Space Force and provenance fields', async () => {
  const { repositories, transport } = setup();
  const result = await repositories.archives.createSnapshot({ actorRole: ACTOR, weekGroup: 'WG', archivedAt: '2026-07-09T17:00:00Z', totalExpected: 977, totalArrived: 975, totalLoaded: 970, femaleTotal: 120, naturalizationTotal: 56, spaceForceTotal: 118, busData: [], dormData: [] });
  assert.equal(result.ok, true);
  assert.equal(transport.records[0].space_force_total, 118);
  assert.equal(transport.records[0].arrived_space_force_total, 118);
  assert.equal(transport.records[0].created_by_role, ACTOR);
});

test('critical commands can fail closed until conflict detection exists', async () => {
  const { repositories } = setup([{ __backendId: 'bus-1', type: 'bus', week_group: 'WG', status: 'active', otw_count: 20, departed_at: '2026-07-07T18:00:00Z' }]);
  const result = await repositories.buses.confirmArrival('bus-1', { actorRole: ACTOR, arrivedAt: '2026-07-07T18:30:00Z', requireConflictDetection: true });
  assert.equal(result.error.code, RepositoryErrorCode.CONFLICT_DETECTION_UNAVAILABLE);
});

test('records client maps stale version responses to conflict', async () => {
  const { client, transport } = setup([{ __backendId: 'bus-1', type: 'bus', week_group: 'WG', status: 'active', otw_count: 20, record_version: 2 }], { recordVersioning: true });
  const stale = await client.update({ ...transport.records[0], status: 'arrived' }, { expectedRecordVersion: 1, requireConflictDetection: true });
  assert.equal(stale.error.code, RepositoryErrorCode.CONFLICT);
  assert.equal(stale.error.status, 409);
});
