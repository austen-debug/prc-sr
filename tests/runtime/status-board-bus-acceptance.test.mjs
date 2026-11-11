import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = path => readFile(resolve(root, path), 'utf8');

test('Status Board arrival confirmation accepts a record by backend ID and updates the active bus projection', async () => {
  const workflow = await source('public/js/gate-bus-workflow-controller.js');
  const controller = await source('public/js/gate-status-board-controller.js');
  const start = workflow.indexOf('  function confirmBusArrivalCanonical(id) {');
  const end = workflow.indexOf('\n  function onSubmit(event) {', start);
  assert.ok(start > 0 && end > start, 'canonical bus arrival function must be present');
  const arrivalAction = workflow.slice(start, end);
  assert.doesNotMatch(arrivalAction, /isBusRecord\(record\)/, 'acceptance must not require an optional bus type');
  assert.doesNotMatch(arrivalAction, /insertAdjacentHTML|createElement|innerHTML/, 'acceptance must not change UI markup');

  const startActive = controller.indexOf('  function getActiveBuses() {');
  const endActive = controller.indexOf('\n  function computeElapsedTimer(', startActive);
  assert.ok(startActive > 0 && endActive > startActive, 'active bus projection must be present');

  const records = [
    { __backendId: 'bus-existing', type: 'bus', week_group: 'WG', bus_id: '7',
      // Historical records without bus_type are still rendered by the Status Board.
      status: 'active', otw_count: 27, female_count: 8, nat_count: 3, record_version: 2 },
    { __backendId: 'bus-arrived', type: 'bus', week_group: 'WG', bus_type: 'airport',
      status: 'arrived', otw_count: 14, record_version: 1 }
  ];
  let confirmation = null;
  const writes = [];
  const refreshes = [];
  const errors = [];
  const sandbox = {
    pendingArrivals: new Set(),
    data: () => records,
    records: () => records,
    activeWeekGroup: () => 'WG',
    isActiveBus: bus => ['active', 'otw'].includes(bus?.status),
    confirmAction: (_message, handler) => { confirmation = handler; },
    updateCache: updated => {
      const index = records.findIndex(record => record.__backendId === updated.__backendId);
      records[index] = { ...records[index], ...updated };
    },
    refreshAllSurfaces: source => refreshes.push(source),
    showMessage: (_id, message) => errors.push(message),
    console,
    window: {
      dataSdk: {
        update: async payload => {
          writes.push(payload);
          const record = records.find(item => item.__backendId === payload.__backendId);
          return { isOk: true, data: {
            ...record, ...payload.__changes, record_version: record.record_version + 1
          } };
        }
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(arrivalAction + '\n' + controller.slice(startActive, endActive), sandbox);

  assert.deepEqual(Array.from(sandbox.getActiveBuses(), item => item.__backendId), ['bus-existing']);
  sandbox.confirmBusArrivalCanonical('bus-existing');
  assert.equal(typeof confirmation, 'function', 'bus card opens the existing confirmation popup');
  await confirmation();

  assert.equal(writes.length, 1);
  assert.equal(writes[0].__backendId, 'bus-existing');
  assert.equal(writes[0].record_version, 2);
  assert.equal(writes[0].__changes.status, 'arrived');
  assert.ok(Number.isFinite(Date.parse(writes[0].__changes.arrived_at)));
  assert.equal(records[0].otw_count, 27, 'passenger count is preserved');
  assert.equal(records[0].female_count, 8, 'female count is preserved');
  assert.equal(records[0].nat_count, 3, 'naturalization count is preserved');
  assert.equal(records[0].record_version, 3);
  assert.equal(records[0].status, 'arrived');
  assert.equal(sandbox.getActiveBuses().length, 0, 'confirmed bus leaves the Status Board');
  assert.equal(records.filter(item => item.type === 'bus' && item.status === 'arrived')
    .reduce((total, item) => total + item.otw_count, 0), 41,
    'Arrived increases by the confirmed bus passenger count');
  assert.deepEqual(refreshes, ['bus-arrival-confirm']);
  assert.deepEqual(errors, []);
});

test('Status Board confirmation accepts OTW alias and does not duplicate an in-flight update', async () => {
  const workflow = await source('public/js/gate-bus-workflow-controller.js');
  const start = workflow.indexOf('  function confirmBusArrivalCanonical(id) {');
  const end = workflow.indexOf('\n  function onSubmit(event) {', start);
  const action = workflow.slice(start, end);
  const bus = { __backendId: 'bus-otw', type: 'bus', week_group: 'WG',
    bus_type: 'airport', bus_id: '10', status: 'otw', otw_count: 11, record_version: 1 };
  let callback;
  let resolves;
  let calls = 0;
  const pendingWrite = new Promise(resolve => { resolves = resolve; });
  const context = {
    pendingArrivals: new Set(),
    data: () => [bus],
    isActiveBus: record => ['otw', 'active'].includes(record.status),
    confirmAction: (_, fn) => { callback = fn; },
    updateCache: updated => Object.assign(bus, updated),
    refreshAllSurfaces: () => {},
    showMessage: () => {},
    console,
    window: { dataSdk: { update: async () => { calls++; return pendingWrite; } } }
  };
  vm.createContext(context);
  vm.runInContext(action, context);
  context.confirmBusArrivalCanonical(bus.__backendId);
  const first = callback();
  const second = callback();
  assert.equal(calls, 1, 'duplicate confirmation while pending is ignored');
  resolves({ isOk: true, data: { ...bus, status: 'arrived', record_version: 2 } });
  await Promise.all([first, second]);
  assert.equal(bus.status, 'arrived');
  assert.equal(context.pendingArrivals.size, 0);
});
