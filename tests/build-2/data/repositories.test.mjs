import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordsClient } from '../../../public/app/data/records-client.mjs';
import { RepositoryErrorCode } from '../../../public/app/data/repository-result.mjs';
import { createGateRepositories } from '../../../public/app/data/index.mjs';

const ACTOR = 'instructor';
const clone = value => JSON.parse(JSON.stringify(value));

function createMemoryTransport(seed = [], { recordVersioning = true } = {}) {
  const records = seed.map(record => ({ record_version: record.record_version ?? 0, ...clone(record) }));
  let nextId = records.length + 1;
  const response = (status, body) => ({ ok: status >= 200 && status < 300, status, body });
  return {
    capabilities: {
      recordVersioning,
      conditionalWrites: recordVersioning,
      transactions: false,
      batchWrites: false,
      appendOnlyAudit: true,
      serverRoleProvenance: true
    },
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
      if (records[index].type === 'audit_event') return response(405, { isOk: false, error: 'Audit events are append-only.' });
      if (recordVersioning && Number.isFinite(options.expectedRecordVersion) && options.expectedRecordVersion !== records[index].record_version) {
        return response(409, { isOk: false, error: 'Record version conflict.', currentRecordVersion: records[index].record_version });
      }
      const updated = { ...clone(record), record_version: records[index].record_version + 1 };
      records[index] = updated;
      return response(200, { isOk: true, data: clone(updated) });
    },
    async delete(record, options = {}) {
      const index = records.findIndex(item => item.__backendId === record.__backendId);
      if (index < 0) return response(404, { isOk: false, error: 'Record not found.' });
      if (records[index].type === 'audit_event') return response(405, { isOk: false, error: 'Audit events are append-only.' });
      if (recordVersioning && Number.isFinite(options.expectedRecordVersion) && options.expectedRecordVersion !== records[index].record_version) {
        return response(409, { isOk: false, error: 'Record version conflict.' });
      }
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
  assert.equal(missing.error.code, RepositoryErrorCode.VALIDATION);
  const airport = await repositories.buses.createAirportBus({ actorRole: ACTOR, weekGroup: 'WG', busId: '7', total: 44, female: 12, naturalization: 3, spaceForce: 4, departedAt: '2026-07-07T18:00:00Z' });
  const local = await repositories.buses.createLocalArrival({ actorRole: 'airman', weekGroup: 'WG', destination: 'MEPS', total: 12, female: 5, naturalization: 2, arrivedAt: '2026-07-07T19:00:00Z' });
  assert.equal(airport.data.createdByRole, ACTOR);
  assert.equal(local.data.createdByRole, 'airman');
  assert.equal(transport.records[0].created_by_role, ACTOR);
  assert.equal(transport.records[1].updated_by_role, 'airman');
});

test('repository updates use record versions by default', async () => {
  const { repositories, transport } = setup([{ __backendId: 'bus-1', type: 'bus', week_group: 'WG', bus_id: '1', status: 'active', otw_count: 40, record_version: 2, departed_at: '2026-07-07T18:00:00Z' }]);
  const confirmed = await repositories.buses.confirmArrival('bus-1', { actorRole: ACTOR, arrivedAt: '2026-07-07T18:30:00Z' });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.data.recordVersion, 3);
  assert.equal(transport.records[0].record_version, 3);
});

test('dorm commands enforce bounds, explicit overrides, provenance, and version increments', async () => {
  const { repositories, transport } = setup([{ __backendId: 'dorm-1', type: 'dorm', week_group: 'WG', dorm_name: 'D1', max_load: 60, current_load: 0, state: 'empty', record_version: 1, created_at: '2026-07-07T17:00:00Z' }]);
  assert.equal((await repositories.dorms.updateLoad('dorm-1', { actorRole: 'airman', load: 61 })).error.code, RepositoryErrorCode.VALIDATION);
  assert.equal((await repositories.dorms.open('dorm-1', { actorRole: ACTOR, openedAt: '2026-07-07T18:00:00Z' })).ok, true);
  assert.equal((await repositories.dorms.updateLoad('dorm-1', { actorRole: 'airman', load: 59 })).ok, true);
  assert.equal((await repositories.dorms.close('dorm-1', { actorRole: ACTOR, closedAt: '2026-07-07T18:45:00Z', closedTimer: '45:00' })).ok, true);
  assert.equal(transport.records[0].record_version, 4);
  assert.equal(transport.records[0].updated_by_role, ACTOR);
});

test('config repository refuses credential persistence', async () => {
  const { repositories } = setup([{ __backendId: 'cfg-1', type: 'config', key: 'active_wg', value: '26-28' }]);
  assert.equal((await repositories.config.getActiveWeekGroup()).data, '26-28');
  const secret = await repositories.config.set('SQUADRON_PASSWORD', 'do-not-store', { actorRole: ACTOR });
  assert.equal(secret.error.code, RepositoryErrorCode.VALIDATION);
});

test('archive repository writes canonical lineage, Space Force, and provenance fields', async () => {
  const { repositories, transport } = setup();
  const result = await repositories.archives.createSnapshot({ actorRole: ACTOR, operationId: 'archive:test', archiveKind: 'closeout', weekGroup: 'WG', archivedAt: '2026-07-09T17:00:00Z', totalExpected: 977, totalArrived: 975, totalLoaded: 970, femaleTotal: 120, naturalizationTotal: 56, spaceForceTotal: 118, busData: [], dormData: [], closeoutManifest: { busIds: ['b1'], recordVersions: { b1: 2 } } });
  assert.equal(result.ok, true);
  assert.equal(transport.records[0].space_force_total, 118);
  assert.equal(transport.records[0].operation_id, 'archive:test');
  assert.equal(result.data.payload.closeoutManifest.recordVersions.b1, 2);
  assert.equal(transport.records[0].created_by_role, ACTOR);
});

test('audit repository appends canonical events idempotently and refuses mutation', async () => {
  const { repositories, transport } = setup();
  const command = {
    actorRole: ACTOR,
    eventType: 'bus.arrival_confirmed',
    weekGroup: 'WG',
    entityType: 'bus',
    entityId: 'bus-1',
    priorVersion: 2,
    resultingVersion: 3,
    occurredAt: '2026-07-07T18:30:00Z',
    summary: 'Arrival confirmed.',
    metadata: { count: 40, operationId: 'audit:test' }
  };
  const event = await repositories.audit.appendOnce(command);
  const replay = await repositories.audit.appendOnce(command);
  assert.equal(event.ok, true);
  assert.equal(replay.meta.unchanged, true);
  assert.equal(event.data.payload.eventType, 'bus.arrival_confirmed');
  assert.equal(event.data.payload.actorRole, ACTOR);
  assert.equal(transport.records.filter(record => record.type === 'audit_event').length, 1);
  assert.equal((await repositories.audit.deleteById(event.data.id)).error.code, RepositoryErrorCode.VALIDATION);
  assert.equal((await repositories.audit.updateEnvelope(event.data)).error.code, RepositoryErrorCode.VALIDATION);
});

test('audit repository rejects prohibited trainee metadata', async () => {
  const { repositories } = setup();
  const result = await repositories.audit.append({ actorRole: ACTOR, eventType: 'test', entityType: 'bus', entityId: '1', metadata: { trainee_name: 'not allowed' } });
  assert.equal(result.error.code, RepositoryErrorCode.VALIDATION);
});

test('sound-event repository clears only the requested Week Group', async () => {
  const { repositories, transport } = setup([
    { __backendId: 's1', type: 'sound_event', week_group: 'WG', event: 'overtime' },
    { __backendId: 's2', type: 'sound_event', week_group: 'OTHER', event: 'overtime' }
  ]);
  const result = await repositories.soundEvents.clearWeekGroup('WG', { actorRole: ACTOR, timestamp: '2026-07-07T18:30:00Z' });
  assert.equal(result.ok, true);
  assert.equal(transport.records.some(record => record.__backendId === 's1'), false);
  assert.equal(transport.records.some(record => record.__backendId === 's2'), true);
});

test('repositories fail closed when a version-capable backend is unavailable', async () => {
  const { repositories } = setup([{ __backendId: 'bus-1', type: 'bus', week_group: 'WG', status: 'active', otw_count: 20, departed_at: '2026-07-07T18:00:00Z' }], { recordVersioning: false });
  const result = await repositories.buses.confirmArrival('bus-1', { actorRole: ACTOR, arrivedAt: '2026-07-07T18:30:00Z' });
  assert.equal(result.error.code, RepositoryErrorCode.CONFLICT_DETECTION_UNAVAILABLE);
});

test('records client maps stale version responses to conflict', async () => {
  const { client, transport } = setup([{ __backendId: 'bus-1', type: 'bus', week_group: 'WG', status: 'active', otw_count: 20, record_version: 2 }]);
  const stale = await client.update({ ...transport.records[0], status: 'arrived' }, { expectedRecordVersion: 1, requireConflictDetection: true });
  assert.equal(stale.error.code, RepositoryErrorCode.CONFLICT);
  assert.equal(stale.error.status, 409);
});
