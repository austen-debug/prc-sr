import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildArchiveSnapshot,
  buildArrivalSummary,
  buildBusLogSummary,
  buildCurrentSummaryModel,
  buildOperationalProcessingSummary,
  buildSquadronBoardSummary,
  buildStatusBoardSummary,
  buildWeekGroupContext,
  calculateTimerState,
  canTransitionDorm,
  formatElapsedMMSS,
  groupDormsByState,
  selectActiveWeekGroup,
  validateArchiveSnapshot,
  validateWeekGroupId
} from '../../../public/app/domain/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const historicalFixture = JSON.parse(await readFile(resolve(here, '../fixtures/B2-P1-F001-receiving-parity.json'), 'utf8'));

const records = [
  { type: 'config', key: 'week_group', value: 'wg-42' },
  { __backendId: 'D1', type: 'dorm', week_group: 'WG-42', dorm_name: 'A1', sdq: '321', state: 'empty', max_load: 50, current_load: 0 },
  { __backendId: 'D2', type: 'dorm', week_group: 'WG-42', dorm_name: 'A2', sdq: '321', state: 'open', phase: 'in_processing', max_load: 60, current_load: 20, opened_at: '2026-07-15T00:00:00Z', assigned_airman: 'Staff Member', auditorium_location: 'Auditorium 1' },
  { __backendId: 'D3', type: 'dorm', week_group: 'WG-42', dorm_name: 'A3', sdq: '322', state: 'closed', phase: 'complete', max_load: 40, current_load: 40, opened_at: '2026-07-15T00:00:00Z', closed_at: '2026-07-15T00:10:00Z', closed_timer: '10:00' },
  { __backendId: 'L1', type: 'bus', week_group: 'WG-42', bus_id: 'LOCAL-1', bus_type: 'local', status: 'arrived', otw_count: 10, female_count: 2, nat_count: 1, space_force_count: 0, arrived_at: '2026-07-15T01:00:00Z' },
  { __backendId: 'B1', type: 'bus', week_group: 'WG-42', bus_id: '12', bus_type: 'airport', status: 'arrived', otw_count: 44, female_count: 5, nat_count: 2, space_force_count: 4, departed_at: '2026-07-15T01:00:00Z', arrived_at: '2026-07-15T02:00:00Z' },
  { __backendId: 'B2', type: 'bus', week_group: 'WG-42', bus_id: '13', bus_type: 'airport', status: 'active', otw_count: 20, departed_at: '2026-07-15T02:15:00Z' }
];

const windows = {
  receiving_day_one_start: '2026-07-15T00:00:00Z',
  receiving_day_one_end: '2026-07-15T01:30:00Z',
  receiving_day_two_start: '2026-07-15T01:30:00Z',
  receiving_day_two_end: '2026-07-15T03:00:00Z'
};

test('active Week Group ownership normalizes aliases and validates context', () => {
  assert.equal(selectActiveWeekGroup(records), 'WG-42');
  assert.equal(buildWeekGroupContext(records).records.length, 6);
  assert.equal(validateWeekGroupId('').valid, false);
  assert.equal(validateWeekGroupId(' wg-42 ').weekGroup, 'WG-42');
});

test('arrival owner derives confirmed, local, and last-arrival truth from one eligible set', () => {
  const summary = buildArrivalSummary(records, 'WG-42');
  assert.equal(summary.confirmed.total, 54);
  assert.equal(summary.confirmed.airForce, 50);
  assert.equal(summary.confirmed.spaceForce, 4);
  assert.equal(summary.confirmed.naturalization, 3);
  assert.equal(summary.local.total, 10);
  assert.equal(summary.lastConfirmedArrival.busId, '12');
  assert.equal(summary.lastConfirmedArrival.arrivedAt, '2026-07-15T02:00:00.000Z');
});

test('bus-log owner keeps manifested, active, and arrived meanings separate', () => {
  const summary = buildBusLogSummary(records, 'WG-42');
  assert.equal(summary.manifested.total, 74);
  assert.equal(summary.active.total, 20);
  assert.equal(summary.arrived.total, 54);
});

test('dorm and processing owners group states, phases, and transition eligibility', () => {
  const groups = groupDormsByState(records, 'WG-42');
  const processing = buildOperationalProcessingSummary(records, 'WG-42');
  assert.equal(groups.empty.length, 1);
  assert.equal(groups.open.length, 1);
  assert.equal(groups.closed.length, 1);
  assert.equal(processing.assignment.arrived, 54);
  assert.equal(processing.assignment.loaded, 60);
  assert.equal(processing.assignment.overAssigned, 6);
  assert.equal(processing.phases['in processing'].length, 1);
  assert.equal(canTransitionDorm(groups.open[0], 'close'), true);
  assert.equal(canTransitionDorm(groups.open[0], 'reopen'), false);
  assert.equal(canTransitionDorm(groups.closed[0], 'correctFinalTime'), true);
});

test('timer owner is deterministic and preserves final-time corrections', () => {
  const running = calculateTimerState({
    state: 'open',
    openedAt: '2026-07-15T00:00:00Z',
    now: '2026-07-15T00:20:00Z',
    overtimeThresholdSeconds: 900
  });
  const closed = calculateTimerState({
    state: 'closed',
    openedAt: '2026-07-15T00:00:00Z',
    closedAt: '2026-07-15T00:09:00Z',
    closedTimer: '10:00',
    now: '2026-07-15T01:00:00Z'
  });
  assert.deepEqual(running, { state: 'open', running: true, overtime: true, elapsedSeconds: 1200, display: '20:00', source: 'running_clock' });
  assert.equal(closed.display, '10:00');
  assert.equal(closed.source, 'closed_timer');
  assert.equal(formatElapsedMMSS(3661), '61:01');
});

test('Status Board and Squadron Board share one operational summary while limited view omits staff detail', () => {
  const options = { records, weekGroup: 'WG-42', now: '2026-07-15T00:20:00Z' };
  const status = buildStatusBoardSummary(options);
  const squadron = buildSquadronBoardSummary(options);
  assert.equal(status.arrivals.confirmed.total, squadron.arrivals.confirmed.total);
  assert.deepEqual(status.dorms.stateCounts, squadron.stateCounts);
  assert.equal(status.timers.find(entry => entry.dormId === 'D2').timer.overtime, true);
  assert.equal('assignedStaff' in squadron.dorms.open[0], false);
  assert.equal('auditoriumLocation' in squadron.dorms.open[0], false);
});

test('Current Summary and immutable archive use the same receiving report model', () => {
  const current = buildCurrentSummaryModel({ records, weekGroup: 'WG-42', windows, generatedAt: '2026-07-15T03:05:00Z' });
  const archive = buildArchiveSnapshot({ records, weekGroup: 'WG-42', windows, archivedAt: '2026-07-15T03:10:00Z' });
  assert.deepEqual(current.report, archive.receivingDocument.report);
  assert.equal(archive.confirmed.total, 54);
  assert.equal(archive.loaded.total, 60);
  assert.equal(archive.buses.length, 2);
  assert.equal(archive.dorms.length, 3);
  assert.equal(validateArchiveSnapshot(archive).valid, true);
  assert.equal(Object.isFrozen(archive), true);
  assert.equal(Object.isFrozen(archive.buses[0]), true);
  assert.equal(Object.isFrozen(records[0]), false);
});

test('archive snapshots require explicit identity and time', () => {
  assert.throws(() => buildArchiveSnapshot({ records, archivedAt: '2026-07-15T03:10:00Z' }), /Week Group/i);
  assert.throws(() => buildArchiveSnapshot({ records, weekGroup: 'WG-42', archivedAt: '' }), /archivedAt/i);
});

test('completed summary owners preserve the historical 911/857 operational fixture', () => {
  const status = buildStatusBoardSummary({
    records: historicalFixture.records,
    weekGroup: historicalFixture.weekGroup,
    now: '2026-01-08T06:00:00Z'
  });
  const current = buildCurrentSummaryModel({
    records: historicalFixture.records,
    weekGroup: historicalFixture.weekGroup,
    windows: historicalFixture.receivingWindows,
    generatedAt: '2026-01-08T06:00:00Z'
  });
  assert.equal(status.dorms.capacity.total, 911);
  assert.equal(status.arrivals.confirmed.total, 857);
  assert.equal(current.report.nights[1].cumulativeTotalProcessed, 857);
  assert.equal(current.report.nights[1].naturalization.cumulative, 56);
});
