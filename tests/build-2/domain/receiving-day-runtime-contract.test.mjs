import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import '../../../public/js/gate-receiving-window-engine.js';

const engine = globalThis.GateReceivingWindowEngine;
const windows = Object.freeze({
  receiving_day_one_start: '2026-09-29T05:00',
  receiving_day_one_end: '2026-09-30T07:00',
  receiving_day_two_start: '2026-09-30T07:00',
  receiving_day_two_end: '2026-10-01T07:00'
});

test('PORT CLEAR day ownership expires at the next configured Receiving Day start', () => {
  assert.equal(engine.windowAt('2026-09-29T09:59:59Z', windows), null);
  assert.equal(engine.windowAt('2026-09-29T10:00:00Z', windows)?.day, 'one');
  assert.equal(engine.windowAt('2026-09-30T11:59:59Z', windows)?.day, 'one');
  assert.equal(engine.windowAt('2026-09-30T12:00:00Z', windows)?.day, 'two');
  assert.equal(engine.windowAt('2026-10-01T11:59:59Z', windows)?.day, 'two');
  assert.equal(engine.windowAt('2026-10-01T12:00:00Z', windows), null);
});

test('archive Receiving Day totals use only confirmed arrived_at timestamps', () => {
  const summary = engine.summarizeArrivals([
    { status: 'arrived', arrived_at: '2026-09-29T10:00:00Z', otw_count: 20, nat_count: 2 },
    { status: 'arrived', arrived_at: '2026-09-30T11:59:59Z', otw_count: 30, nat_count: 3 },
    { status: 'arrived', arrived_at: '2026-09-30T12:00:00Z', otw_count: 40, nat_count: 4 },
    { status: 'active', departed_at: '2026-09-30T12:30:00Z', otw_count: 50, nat_count: 5 },
    { status: 'arrived', arrived_at: '2026-10-01T12:00:00Z', otw_count: 60, nat_count: 6 }
  ], windows);

  assert.equal(summary.validation.valid, true);
  assert.deepEqual(summary.dayOne.totals, { arrived: 50, naturalization: 5, female: 0, spaceForce: 0, busCount: 2 });
  assert.deepEqual(summary.dayTwo.totals, { arrived: 40, naturalization: 4, female: 0, spaceForce: 0, busCount: 1 });
  assert.equal(summary.unassignedTotals.arrived, 60);
});

test('active runtime consumers are wired to the canonical Receiving Day engine', async () => {
  const [middleware, portClear, archive] = await Promise.all([
    readFile(new URL('../../../functions/_middleware.js', import.meta.url), 'utf8'),
    readFile(new URL('../../../public/js/gate-ui-hooks.js', import.meta.url), 'utf8'),
    readFile(new URL('../../../public/js/gate-archive-controller.js', import.meta.url), 'utf8')
  ]);

  assert.doesNotMatch(middleware, /gate-receiving-window-engine\.js/);
  assert.match(portClear, /gate-receiving-window-engine\.js/);
  assert.match(portClear, /GateReceivingWindowEngine/);
  assert.match(portClear, /time >= window\.start && time < window\.end/);
  assert.match(archive, /GateReceivingWindowEngine/);
  assert.match(archive, /summarizeArrivals\(buses, windows\)/);
  assert.match(archive, /Receiving Day One/);
  assert.match(archive, /Receiving Day Two/);
});
