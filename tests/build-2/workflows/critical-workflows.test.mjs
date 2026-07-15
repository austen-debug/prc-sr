import test from 'node:test';
import assert from 'node:assert/strict';

import { createGateRepositories } from '../../../public/app/data/index.mjs';
import { createRecordsClient } from '../../../public/app/data/records-client.mjs';
import { ARCHIVE_SNAPSHOT_SCHEMA_VERSION } from '../../../public/app/domain/archives.mjs';
import {
  WorkflowStatus,
  amendArchiveWorkflow,
  closeDormWorkflow,
  closeoutWeekGroupWorkflow,
  compensatePartialInitializationWorkflow,
  confirmArrivalWorkflow,
  correctArrivalCountsWorkflow,
  correctDormFinalTimeWorkflow,
  createLocalArrivalWorkflow,
  dispatchAirportBusWorkflow,
  initializeWeekGroupWorkflow,
  openDormWorkflow,
  reopenDormWorkflow,
  retryRequiredAuditWorkflow,
  updateDormLoadWorkflow
} from '../../../public/app/workflows/index.mjs';

const ACTOR = 'instructor';
const NOW = '2026-07-15T18:00:00.000Z';
const clone = value => JSON.parse(JSON.stringify(value));

function createMemoryTransport(seed = [], controls = {}) {
  const records = seed.map(record => ({
    created_at: record.created_at || NOW,
    updated_at: record.updated_at || record.created_at || NOW,
    record_version: record.record_version ?? 1,
    ...clone(record)
  }));
  let nextId = records.length + 1;
  let dormCreateCount = 0;
  const state = {
    failNextAuditCreate: Boolean(controls.failNextAuditCreate),
    failDormCreateAt: Number(controls.failDormCreateAt || 0),
    conflictNextUpdate: Boolean(controls.conflictNextUpdate),
    failDeleteOnceIds: new Set(controls.failDeleteOnceIds || [])
  };
  const response = (status, body) => ({ ok: status >= 200 && status < 300, status, body });

  return {
    capabilities: {
      recordVersioning: true,
      conditionalWrites: true,
      transactions: false,
      batchWrites: false,
      appendOnlyAudit: true,
      serverRoleProvenance: true
    },
    records,
    state,
    async list() {
      return response(200, { isOk: true, records: clone(records) });
    },
    async create(record) {
      if (record.type === 'audit_event' && state.failNextAuditCreate) {
        state.failNextAuditCreate = false;
        return response(503, { isOk: false, error: 'Injected audit persistence failure.' });
      }
      if (record.type === 'dorm') {
        dormCreateCount += 1;
        if (state.failDormCreateAt && dormCreateCount === state.failDormCreateAt) {
          state.failDormCreateAt = 0;
          return response(503, { isOk: false, error: 'Injected dorm creation failure.' });
        }
      }
      const created = {
        ...clone(record),
        __backendId: record.__backendId || `${record.type || 'record'}-${nextId++}`,
        record_version: 1,
        created_at: record.created_at || NOW,
        updated_at: record.updated_at || record.created_at || NOW
      };
      records.push(created);
      return response(201, { isOk: true, data: clone(created) });
    },
    async update(record, options = {}) {
      const index = records.findIndex(item => item.__backendId === record.__backendId);
      if (index < 0) return response(404, { isOk: false, error: 'Record not found.' });
      if (records[index].type === 'audit_event') return response(405, { isOk: false, error: 'Audit events are append-only.' });
      if (state.conflictNextUpdate) {
        records[index].record_version += 1;
        state.conflictNextUpdate = false;
      }
      if (Number.isFinite(options.expectedRecordVersion) && options.expectedRecordVersion !== records[index].record_version) {
        return response(409, {
          isOk: false,
          error: 'Record version conflict.',
          currentRecordVersion: records[index].record_version
        });
      }
      const updated = {
        ...clone(record),
        record_version: records[index].record_version + 1,
        created_at: records[index].created_at,
        updated_at: record.updated_at || NOW
      };
      records[index] = updated;
      return response(200, { isOk: true, data: clone(updated) });
    },
    async delete(record, options = {}) {
      const index = records.findIndex(item => item.__backendId === record.__backendId);
      if (index < 0) return response(404, { isOk: false, error: 'Record not found.' });
      if (records[index].type === 'audit_event') return response(405, { isOk: false, error: 'Audit events are append-only.' });
      if (state.failDeleteOnceIds.has(record.__backendId)) {
        state.failDeleteOnceIds.delete(record.__backendId);
        return response(503, { isOk: false, error: 'Injected deletion failure.' });
      }
      if (Number.isFinite(options.expectedRecordVersion) && options.expectedRecordVersion !== records[index].record_version) {
        return response(409, { isOk: false, error: 'Record version conflict.', currentRecordVersion: records[index].record_version });
      }
      records.splice(index, 1);
      return response(200, { isOk: true });
    }
  };
}

function setup(seed = [], controls = {}) {
  const transport = createMemoryTransport(seed, controls);
  const client = createRecordsClient({ transport, timeZone: 'America/Chicago' });
  return { transport, repositories: createGateRepositories({ client }) };
}

function audits(transport, eventType = '') {
  return transport.records.filter(record => (
    record.type === 'audit_event' && (!eventType || record.event_type === eventType)
  ));
}

const clock = () => NOW;

test('arrival workflows persist, verify, audit, and preserve explicit conflicts', async () => {
  const { repositories, transport } = setup([
    { __backendId: 'bus-1', type: 'bus', week_group: 'WG', bus_id: '1', bus_type: 'airport', status: 'active', otw_count: 40, departed_at: '2026-07-15T17:00:00Z' }
  ]);

  const confirmed = await confirmArrivalWorkflow({
    repositories,
    clock,
    command: { operationId: 'arrival:1', actorRole: ACTOR, busId: 'bus-1', arrivedAt: NOW }
  });
  assert.equal(confirmed.status, WorkflowStatus.COMPLETE);
  assert.equal(confirmed.data.record.payload.confirmedArrival, true);
  assert.equal(audits(transport, 'bus_arrival_confirmed').length, 1);

  const corrected = await correctArrivalCountsWorkflow({
    repositories,
    clock,
    command: { operationId: 'arrival:2', actorRole: ACTOR, busId: 'bus-1', total: 39, female: 5, naturalization: 2, spaceForce: 1 }
  });
  assert.equal(corrected.status, WorkflowStatus.COMPLETE);
  assert.equal(corrected.data.record.payload.total, 39);

  transport.state.conflictNextUpdate = true;
  const conflict = await correctArrivalCountsWorkflow({
    repositories,
    clock,
    command: { operationId: 'arrival:3', actorRole: ACTOR, busId: 'bus-1', total: 38, female: 4, naturalization: 1, spaceForce: 1 }
  });
  assert.equal(conflict.status, WorkflowStatus.CONFLICT);
  assert.equal(audits(transport, 'bus_counts_corrected').length, 1);
});

test('create workflows verify airport dispatch and local arrivals before audit', async () => {
  const { repositories, transport } = setup();
  const dispatch = await dispatchAirportBusWorkflow({
    repositories,
    clock,
    command: { operationId: 'dispatch:1', actorRole: ACTOR, weekGroup: 'WG', busId: '7', total: 44, female: 10, naturalization: 2, spaceForce: 4, departedAt: NOW }
  });
  const local = await createLocalArrivalWorkflow({
    repositories,
    clock,
    command: { operationId: 'local:1', actorRole: 'airman', weekGroup: 'WG', destination: 'MEPS', total: 12, female: 5, naturalization: 1, spaceForce: 0, arrivedAt: NOW }
  });
  assert.equal(dispatch.status, WorkflowStatus.COMPLETE);
  assert.equal(local.status, WorkflowStatus.COMPLETE);
  assert.equal(audits(transport, 'airport_bus_dispatched').length, 1);
  assert.equal(audits(transport, 'local_arrival_created').length, 1);
});

test('a committed arrival with audit failure returns recoverable partial state', async () => {
  const { repositories, transport } = setup([
    { __backendId: 'bus-1', type: 'bus', week_group: 'WG', bus_id: '1', bus_type: 'airport', status: 'active', otw_count: 40, departed_at: '2026-07-15T17:00:00Z' }
  ], { failNextAuditCreate: true });

  const result = await confirmArrivalWorkflow({
    repositories,
    clock,
    command: { operationId: 'arrival:audit-recovery', actorRole: ACTOR, busId: 'bus-1', arrivedAt: NOW }
  });
  assert.equal(result.status, WorkflowStatus.PARTIAL);
  assert.equal(result.phase, 'audit');
  assert.equal(transport.records.find(record => record.__backendId === 'bus-1').status, 'arrived');
  assert.equal(audits(transport).length, 0);

  const recovered = await retryRequiredAuditWorkflow({
    repositories,
    command: { operationId: result.operationId, auditCommand: result.recovery.auditCommand }
  });
  assert.equal(recovered.status, WorkflowStatus.COMPLETE);
  assert.equal(audits(transport, 'bus_arrival_confirmed').length, 1);
});

test('dorm workflows verify every transition and append one audit event each', async () => {
  const { repositories, transport } = setup([
    { __backendId: 'dorm-1', type: 'dorm', week_group: 'WG', dorm_name: 'A1', sdq: '321', max_load: 60, current_load: 0, state: 'empty' }
  ]);

  assert.equal((await openDormWorkflow({ repositories, clock, command: { operationId: 'dorm:open', actorRole: ACTOR, dormId: 'dorm-1', openedAt: NOW } })).status, WorkflowStatus.COMPLETE);
  assert.equal((await updateDormLoadWorkflow({ repositories, clock, command: { operationId: 'dorm:load', actorRole: 'airman', dormId: 'dorm-1', load: 42 } })).status, WorkflowStatus.COMPLETE);
  assert.equal((await closeDormWorkflow({ repositories, clock, command: { operationId: 'dorm:close', actorRole: ACTOR, dormId: 'dorm-1', closedAt: '2026-07-15T18:10:00Z', closedTimer: '10:00' } })).status, WorkflowStatus.COMPLETE);
  assert.equal((await correctDormFinalTimeWorkflow({ repositories, clock, command: { operationId: 'dorm:correct', actorRole: ACTOR, dormId: 'dorm-1', closedTimer: '09:45' } })).status, WorkflowStatus.COMPLETE);
  assert.equal((await reopenDormWorkflow({ repositories, clock, command: { operationId: 'dorm:reopen', actorRole: ACTOR, dormId: 'dorm-1', openedAt: '2026-07-15T18:20:00Z' } })).status, WorkflowStatus.COMPLETE);
  assert.equal(audits(transport).length, 5);
});

test('Week Group initialization validates all rows, verifies dorms, audits, and activates last', async () => {
  const { repositories, transport } = setup();
  const result = await initializeWeekGroupWorkflow({
    repositories,
    clock,
    command: {
      operationId: 'init:success',
      actorRole: ACTOR,
      weekGroup: '26-30',
      dorms: [
        { name: 'A1', sdq: '321', capacity: 50, sex: 'male' },
        { name: 'A2', sdq: '321', capacity: 48, sex: 'female' }
      ],
      receivingWindows: {
        receiving_day_one_start: '2026-07-15T18:00:00Z',
        receiving_day_one_end: '2026-07-15T20:00:00Z'
      }
    }
  });
  assert.equal(result.status, WorkflowStatus.COMPLETE);
  assert.equal(transport.records.filter(record => record.type === 'dorm').length, 2);
  assert.equal(transport.records.find(record => record.type === 'config' && record.key === 'week_group').value, '26-30');
  assert.equal(audits(transport, 'dorm_created').length, 2);
  assert.equal(audits(transport, 'week_group_initialized').length, 1);

  const duplicate = await initializeWeekGroupWorkflow({
    repositories: setup().repositories,
    clock,
    command: {
      operationId: 'init:duplicate', actorRole: ACTOR, weekGroup: 'WG',
      dorms: [{ name: 'A1', sdq: '321', capacity: 50 }, { name: 'A1', sdq: '321', capacity: 40 }]
    }
  });
  assert.equal(duplicate.status, WorkflowStatus.BLOCKED);
});

test('partial initialization remains inactive and resumes with the same operation id', async () => {
  const { repositories, transport } = setup([], { failDormCreateAt: 2 });
  const command = {
    operationId: 'init:resume', actorRole: ACTOR, weekGroup: 'WG',
    dorms: [{ name: 'A1', sdq: '321', capacity: 50 }, { name: 'A2', sdq: '321', capacity: 40 }]
  };
  const partial = await initializeWeekGroupWorkflow({ repositories, clock, command });
  assert.equal(partial.status, WorkflowStatus.PARTIAL);
  assert.equal(transport.records.filter(record => record.type === 'dorm').length, 1);
  assert.equal(transport.records.some(record => record.type === 'config' && record.key === 'week_group'), false);

  const resumed = await initializeWeekGroupWorkflow({ repositories, clock, command });
  assert.equal(resumed.status, WorkflowStatus.COMPLETE);
  assert.equal(transport.records.filter(record => record.type === 'dorm').length, 2);
  assert.equal(transport.records.find(record => record.type === 'config' && record.key === 'week_group').value, 'WG');
});

test('partial initialization compensation is blocked after activation and safe before activation', async () => {
  const setupPartial = setup([], { failDormCreateAt: 2 });
  const command = {
    operationId: 'init:compensate', actorRole: ACTOR, weekGroup: 'WG',
    dorms: [{ name: 'A1', sdq: '321', capacity: 50 }, { name: 'A2', sdq: '321', capacity: 40 }]
  };
  await initializeWeekGroupWorkflow({ repositories: setupPartial.repositories, clock, command });
  const compensated = await compensatePartialInitializationWorkflow({
    repositories: setupPartial.repositories,
    clock,
    command: { operationId: 'compensation:1', initializationOperationId: command.operationId, actorRole: ACTOR, weekGroup: 'WG' }
  });
  assert.equal(compensated.status, WorkflowStatus.COMPLETE);
  assert.equal(setupPartial.transport.records.filter(record => record.type === 'dorm').length, 0);

  const setupActive = setup([
    { __backendId: 'cfg-1', type: 'config', key: 'week_group', value: 'WG' },
    { __backendId: 'dorm-1', type: 'dorm', week_group: 'WG', dorm_name: 'A1', sdq: '321', max_load: 50, current_load: 0, state: 'empty', operation_id: 'init:active' }
  ]);
  const blocked = await compensatePartialInitializationWorkflow({
    repositories: setupActive.repositories,
    clock,
    command: { operationId: 'compensation:2', initializationOperationId: 'init:active', actorRole: ACTOR, weekGroup: 'WG' }
  });
  assert.equal(blocked.status, WorkflowStatus.BLOCKED);
});

function closeoutSeed() {
  return [
    { __backendId: 'cfg-wg', type: 'config', key: 'week_group', value: 'WG' },
    { __backendId: 'cfg-last', type: 'config', key: 'last_airport', value: '21:00' },
    { __backendId: 'dorm-1', type: 'dorm', week_group: 'WG', dorm_name: 'A1', sdq: '321', max_load: 50, current_load: 50, state: 'closed', opened_at: '2026-07-15T17:00:00Z', closed_at: '2026-07-15T17:10:00Z', closed_timer: '10:00' },
    { __backendId: 'bus-1', type: 'bus', week_group: 'WG', bus_id: '1', bus_type: 'airport', status: 'arrived', otw_count: 50, female_count: 10, nat_count: 2, space_force_count: 4, departed_at: '2026-07-15T16:30:00Z', arrived_at: '2026-07-15T17:00:00Z' },
    { __backendId: 'sound-1', type: 'sound_event', week_group: 'WG', event: 'overtime' }
  ];
}

test('closeout verifies archive, audits, clears all eligible live records, and preserves archive manifest', async () => {
  const { repositories, transport } = setup(closeoutSeed());
  const result = await closeoutWeekGroupWorkflow({
    repositories,
    clock,
    command: { operationId: 'closeout:success', actorRole: ACTOR, weekGroup: 'WG', archivedAt: NOW }
  });
  assert.equal(result.status, WorkflowStatus.COMPLETE);
  assert.equal(transport.records.filter(record => ['bus', 'dorm', 'sound_event'].includes(record.type)).length, 0);
  assert.equal(transport.records.find(record => record.__backendId === 'cfg-wg').value, '');
  assert.equal(transport.records.find(record => record.__backendId === 'cfg-last').value, '');
  const archive = transport.records.find(record => record.type === 'archive');
  assert.equal(archive.operation_id, 'closeout:success');
  assert.deepEqual(archive.closeout_manifest.busIds, ['bus-1']);
  assert.deepEqual(archive.closeout_manifest.soundEventIds, ['sound-1']);
  assert.equal(audits(transport, 'week_group_closeout_completed').length, 1);
});

test('closeout resumes after partial deletion without creating a duplicate archive', async () => {
  const { repositories, transport } = setup(closeoutSeed(), { failDeleteOnceIds: ['bus-1'] });
  const command = { operationId: 'closeout:resume', actorRole: ACTOR, weekGroup: 'WG', archivedAt: NOW };
  const partial = await closeoutWeekGroupWorkflow({ repositories, clock, command });
  assert.equal(partial.status, WorkflowStatus.PARTIAL);
  assert.equal(transport.records.filter(record => record.type === 'archive').length, 1);

  const resumed = await closeoutWeekGroupWorkflow({ repositories, clock, command });
  assert.equal(resumed.status, WorkflowStatus.COMPLETE);
  assert.equal(transport.records.filter(record => record.type === 'archive').length, 1);
  assert.equal(transport.records.filter(record => ['bus', 'dorm', 'sound_event'].includes(record.type)).length, 0);
});

test('archive amendment creates a new immutable lineage record and leaves parent unchanged', async () => {
  const { repositories, transport } = setup();
  const parent = await repositories.archives.createSnapshot({
    actorRole: ACTOR,
    operationId: 'archive:parent',
    archiveKind: 'closeout',
    weekGroup: 'WG',
    archivedAt: '2026-07-15T17:00:00Z',
    totalExpected: 50,
    totalArrived: 50,
    totalLoaded: 50,
    femaleTotal: 10,
    naturalizationTotal: 2,
    spaceForceTotal: 4,
    busData: [],
    dormData: []
  });
  const parentRawBefore = clone(transport.records.find(record => record.__backendId === parent.data.id));
  const snapshot = {
    schemaVersion: ARCHIVE_SNAPSHOT_SCHEMA_VERSION,
    weekGroup: 'WG',
    archivedAt: NOW,
    projected: { total: 50, airForce: 46, spaceForce: 4 },
    confirmed: { total: 49, airForce: 45, spaceForce: 4, female: 10, naturalization: 2 },
    loaded: { total: 49, capacity: 50 },
    receivingWindows: {},
    buses: [],
    dorms: [],
    receivingDocument: {}
  };
  const amended = await amendArchiveWorkflow({
    repositories,
    clock,
    command: {
      operationId: 'archive:amendment',
      actorRole: ACTOR,
      parentArchiveId: parent.data.id,
      reason: 'Corrected confirmed total after source review.',
      amendedAt: NOW,
      snapshot
    }
  });
  assert.equal(amended.status, WorkflowStatus.COMPLETE);
  assert.equal(transport.records.filter(record => record.type === 'archive').length, 2);
  assert.deepEqual(transport.records.find(record => record.__backendId === parent.data.id), parentRawBefore);
  const child = transport.records.find(record => record.type === 'archive' && record.__backendId !== parent.data.id);
  assert.equal(child.parent_archive_id, parent.data.id);
  assert.equal(child.archive_kind, 'amendment');
  assert.match(child.amendment_reason, /Corrected confirmed total/);
  assert.equal(audits(transport, 'archive_amended').length, 1);
});
