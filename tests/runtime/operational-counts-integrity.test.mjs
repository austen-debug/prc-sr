import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('live operational accounting preserves ARRIVED = LOADED + AWAITING', async () => {
  const script = await source('public/js/gate-operational-counts.js');
  const context = { window: {} };
  vm.runInNewContext(script, context);
  const accounting = context.window.GateOperationalCounts.calculateAssignmentSummary([
    { type: 'bus', week_group: 'WG', bus_type: 'airport', status: 'active', otw_count: 44 },
    { type: 'bus', week_group: 'WG', bus_type: 'airport', status: 'arrived', otw_count: 40 },
    { type: 'bus', week_group: 'WG', bus_type: 'local', status: 'ARRIVED', otw_count: 12 },
    { type: 'dorm', week_group: 'WG', current_load: 30, max_load: 40 },
    { type: 'dorm', week_group: 'WG', current_load: 15, max_load: 20 },
    { type: 'bus', week_group: 'OTHER', status: 'arrived', otw_count: 99 }
  ], 'wg');

  assert.equal(accounting.arrived, 52);
  assert.equal(accounting.loaded, 45);
  assert.equal(accounting.awaitingAssignment, 7);
  assert.equal(accounting.overAssigned, 0);
  assert.equal(accounting.arrived, accounting.loaded + accounting.awaitingAssignment);
});

test('operational accounting helper loads before Status and Processing metric consumers', async () => {
  const middleware = await source('functions/_middleware.js');
  const helper = middleware.indexOf('/js/gate-operational-counts.js');
  const processing = middleware.indexOf('/js/prc-dash-processing-loaded-summary.js');
  const status = middleware.indexOf('/js/gate-premium-metrics-controller.js');

  assert.ok(helper >= 0);
  assert.ok(processing > helper);
  assert.ok(status > helper);
});
