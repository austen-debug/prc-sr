import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildReceivingReportModel,
  calculateCapacityTotals,
  calculateConfirmedArrivalTotals,
  calculateReceivingSummary,
  selectActiveBuses,
  validateReceivingWindows
} from '../../../public/app/domain/index.mjs';
import {
  normalizePersistedRecord,
  normalizePersistedRecords,
  toCanonicalDomainRecords
} from '../../../public/app/data/index.mjs';

const WG = 'WG-1';
const WINDOWS = Object.freeze({
  receiving_day_one_start: '2026-07-14T20:00:00.000Z',
  receiving_day_one_end: '2026-07-15T11:00:00.000Z',
  receiving_day_two_start: '2026-07-15T20:00:00.000Z',
  receiving_day_two_end: '2026-07-16T11:00:00.000Z'
});

function arrived(id, total, at, extra = {}) {
  return { __backendId: id, type: 'bus', week_group: WG, bus_id: id, status: 'arrived', otw_count: total, arrived_at: at, ...extra };
}

function build1ConfirmedTotal(records, weekGroup) {
  return records
    .filter(record => record.type === 'bus' && String(record.week_group).toUpperCase() === weekGroup.toUpperCase())
    .filter(record => String(record.status).toLowerCase() === 'arrived' && Number.isFinite(Date.parse(record.arrived_at)))
    .reduce((sum, record) => sum + Math.max(0, Math.trunc(Number(record.otw_count) || 0)), 0);
}

test('Build 1 reference and Build 2 canonical selectors agree on confirmed arrivals', () => {
  const records = [
    arrived('B1', 40, '2026-07-14T21:00:00.000Z'),
    { type: 'bus', week_group: WG, bus_id: 'B2', status: 'active', otw_count: 30, departed_at: '2026-07-14T22:00:00.000Z' },
    arrived('B3', 15, '', { departed_at: '2026-07-14T23:00:00.000Z' }),
    arrived('OTHER', 99, '2026-07-14T21:00:00.000Z', { week_group: 'OTHER' })
  ];
  assert.equal(build1ConfirmedTotal(records, WG), 40);
  assert.equal(calculateConfirmedArrivalTotals(records, WG).total, 40);
  assert.equal(selectActiveBuses(records, WG).length, 1);
});

test('local arrivals are included when confirmed and active airport buses remain excluded', () => {
  const records = [
    arrived('LOCAL-1', 12, '2026-07-14T20:30:00.000Z', { bus_type: 'local', female_count: 4, nat_count: 1 }),
    { type: 'bus', week_group: WG, bus_id: 'AIRPORT-1', bus_type: 'airport', status: 'active', otw_count: 50, departed_at: '2026-07-14T20:10:00.000Z' }
  ];
  const totals = calculateConfirmedArrivalTotals(records, WG);
  assert.equal(totals.total, 12);
  assert.equal(totals.female, 4);
  assert.equal(totals.naturalization, 1);
  assert.equal(selectActiveBuses(records, WG).length, 1);
});

test('edited arrived bus counts replace prior values rather than accumulating duplicate totals', () => {
  const editedRecordSet = [arrived('B1', 44, '2026-07-14T21:00:00.000Z', { female_count: 8, nat_count: 3, space_force_count: 4 })];
  const totals = calculateConfirmedArrivalTotals(editedRecordSet, WG);
  assert.deepEqual({ total: totals.total, female: totals.female, nat: totals.naturalization, sf: totals.spaceForce, af: totals.airForce }, {
    total: 44, female: 8, nat: 3, sf: 4, af: 40
  });
});

test('confirmed arrivals outside configured windows remain confirmed but are not assigned to a receiving night', () => {
  const records = [arrived('EARLY', 20, '2026-07-14T19:59:59.000Z'), arrived('IN', 30, '2026-07-14T20:00:00.000Z')];
  const summary = calculateReceivingSummary({ records, weekGroup: WG, windows: WINDOWS });
  assert.equal(summary.confirmed.total, 50);
  assert.equal(summary.nights[0].totals.total, 30);
  assert.equal(summary.unassignedConfirmedTotals.total, 20);
});

test('receiving windows crossing midnight remain valid and use half-open boundaries', () => {
  const validation = validateReceivingWindows(WINDOWS);
  assert.equal(validation.valid, true);
  const records = [
    arrived('LATE', 10, '2026-07-15T05:30:00.000Z'),
    arrived('END', 7, '2026-07-15T11:00:00.000Z'),
    arrived('N2', 5, '2026-07-15T20:00:00.000Z')
  ];
  const summary = calculateReceivingSummary({ records, weekGroup: WG, windows: WINDOWS });
  assert.equal(summary.nights[0].totals.total, 10);
  assert.equal(summary.nights[1].totals.total, 5);
  assert.equal(summary.unassignedConfirmedTotals.total, 7);
});

test('malformed legacy timestamps are normalized with warnings and cannot create confirmed arrivals', () => {
  const normalized = normalizePersistedRecords([
    { __backendId: 'B1', type: 'bus', week_group: WG, status: 'arrived', otw_count: '25', arrived_at: 'not-a-date' }
  ]);
  const domainRecords = toCanonicalDomainRecords(normalized.records);
  assert.equal(calculateConfirmedArrivalTotals(domainRecords, WG).total, 0);
  assert.ok(normalized.warnings.some(item => /arrived_at/i.test(item.message)));
});

test('empty and partial Week Groups return deterministic zero totals', () => {
  const empty = calculateReceivingSummary({ records: [], weekGroup: WG, windows: WINDOWS });
  assert.equal(empty.projected.total, 0);
  assert.equal(empty.confirmed.total, 0);
  assert.equal(empty.nights[1].cumulative.total, 0);

  const partial = [
    { type: 'dorm', week_group: WG, dorm_name: 'A1', max_load: 50, current_load: 20 },
    { type: 'bus', week_group: WG, status: 'active', otw_count: 30 }
  ];
  assert.equal(calculateCapacityTotals(partial, WG).total, 50);
  assert.equal(calculateConfirmedArrivalTotals(partial, WG).total, 0);
});

test('Space Force presentation is suppressed only when both projected and confirmed Space Force are zero', () => {
  const noSfRecords = [
    { type: 'dorm', week_group: WG, dorm_name: 'A1', max_load: 100, space_force: false },
    arrived('B1', 40, '2026-07-14T21:00:00.000Z', { space_force_count: 0 })
  ];
  const noSfReport = buildReceivingReportModel(calculateReceivingSummary({ records: noSfRecords, weekGroup: WG, windows: WINDOWS }));
  assert.equal(noSfReport.includeSpaceForce, false);
  assert.equal(noSfReport.nights[0].spaceForce, null);

  const sfRecords = [...noSfRecords, { type: 'dorm', week_group: WG, dorm_name: 'S1', max_load: 20, space_force: true }];
  const sfReport = buildReceivingReportModel(calculateReceivingSummary({ records: sfRecords, weekGroup: WG, windows: WINDOWS }));
  assert.equal(sfReport.includeSpaceForce, true);
});

test('archive normalization preserves the same cumulative totals as the live canonical summary', () => {
  const liveRecords = [
    { __backendId: 'D1', type: 'dorm', week_group: WG, dorm_name: 'A1', max_load: 100, current_load: 70 },
    arrived('B1', 60, '2026-07-14T21:00:00.000Z', { female_count: 12, nat_count: 5, space_force_count: 4 }),
    arrived('B2', 20, '2026-07-15T21:00:00.000Z', { female_count: 3, nat_count: 2, space_force_count: 1 })
  ];
  const live = calculateReceivingSummary({ records: liveRecords, weekGroup: WG, windows: WINDOWS });
  const archive = normalizePersistedRecord({
    __backendId: 'A1', type: 'archive', week_group: WG,
    total_expected: live.projected.total,
    total_arrived: live.confirmed.total,
    total_loaded: 70,
    female_total: live.confirmed.female,
    nat_total: live.confirmed.naturalization,
    arrived_space_force_total: live.confirmed.spaceForce,
    bus_data: JSON.stringify(liveRecords.filter(record => record.type === 'bus')),
    dorm_data: JSON.stringify(liveRecords.filter(record => record.type === 'dorm')),
    ...WINDOWS
  });
  assert.equal(archive.payload.totalExpected, live.projected.total);
  assert.equal(archive.payload.totalArrived, live.confirmed.total);
  assert.equal(archive.payload.femaleTotal, live.confirmed.female);
  assert.equal(archive.payload.naturalizationTotal, live.confirmed.naturalization);
  assert.equal(archive.payload.spaceForceTotal, live.confirmed.spaceForce);
});
