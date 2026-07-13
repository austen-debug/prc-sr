import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  buildReceivingReportModel,
  calculateAssignmentSummary,
  calculateCapacityTotals,
  calculateConfirmedArrivalTotals,
  calculateManifestedBusTotals,
  calculateReceivingSummary,
  selectActiveBuses,
  selectConfirmedArrivals,
  validateReceivingWindows
} from '../../../public/app/domain/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, '../fixtures/B2-P1-F001-receiving-parity.json');
const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));

test('B2-P1-F001 reproduces the historical receiving totals', () => {
  const capacity = calculateCapacityTotals(fixture.records, fixture.weekGroup);
  const confirmed = calculateConfirmedArrivalTotals(fixture.records, fixture.weekGroup);
  const active = selectActiveBuses(fixture.records, fixture.weekGroup);
  const summary = calculateReceivingSummary({
    records: fixture.records,
    weekGroup: fixture.weekGroup,
    windows: fixture.receivingWindows
  });
  const report = buildReceivingReportModel(summary);

  assert.equal(capacity.total, fixture.expected.projectedTotal);
  assert.equal(capacity.spaceForce, fixture.expected.projectedSpaceForce);
  assert.equal(confirmed.total, fixture.expected.confirmedArrived);
  assert.equal(confirmed.female, fixture.expected.confirmedFemale);
  assert.equal(confirmed.naturalization, fixture.expected.confirmedNaturalization);
  assert.equal(confirmed.spaceForce, fixture.expected.confirmedSpaceForce);
  assert.equal(confirmed.airForce, fixture.expected.confirmedAirForce);
  assert.equal(active.length, fixture.expected.activeBusCount);

  assert.equal(summary.nights[0].totals.total, fixture.expected.nightOne.processed);
  assert.equal(summary.nights[0].totals.naturalization, fixture.expected.nightOne.naturalization);
  assert.equal(summary.nights[0].cumulative.total, fixture.expected.nightOne.cumulativeProcessed);
  assert.equal(summary.nights[0].cumulative.naturalization, fixture.expected.nightOne.cumulativeNaturalization);

  assert.equal(summary.nights[1].totals.total, fixture.expected.nightTwo.processed);
  assert.equal(summary.nights[1].totals.naturalization, fixture.expected.nightTwo.naturalization);
  assert.equal(summary.nights[1].cumulative.total, fixture.expected.nightTwo.cumulativeProcessed);
  assert.equal(summary.nights[1].cumulative.naturalization, fixture.expected.nightTwo.cumulativeNaturalization);

  assert.equal(report.includeSpaceForce, fixture.expected.spaceForceSentenceVisible);
  assert.equal(report.nights[1].standard.processed, 39);
  assert.equal(report.nights[1].standard.cumulative, 857);
  assert.equal(report.nights[1].naturalization.tonight, 4);
  assert.equal(report.nights[1].naturalization.cumulative, 56);
  assert.equal(report.nights[1].spaceForce, null);
});

test('active and malformed arrived records never enter confirmed-arrival totals', () => {
  const records = [
    {
      type: 'bus',
      week_group: 'WG',
      status: 'active',
      otw_count: 20,
      arrived_at: '2026-01-01T01:00:00Z'
    },
    {
      type: 'bus',
      week_group: 'WG',
      status: 'arrived',
      otw_count: 30,
      arrived_at: ''
    },
    {
      type: 'bus',
      week_group: 'WG',
      status: 'arrived',
      otw_count: 40,
      arrived_at: '2026-01-01T02:00:00Z'
    }
  ];

  const confirmed = selectConfirmedArrivals(records, 'WG');
  assert.equal(confirmed.length, 1);
  assert.equal(confirmed[0].total, 40);
});

test('receiving windows are half-open and assign a boundary arrival once', () => {
  const records = [
    { type: 'dorm', week_group: 'WG', max_load: 100 },
    {
      type: 'bus',
      week_group: 'WG',
      status: 'arrived',
      otw_count: 10,
      arrived_at: '2026-01-01T01:00:00Z'
    }
  ];
  const windows = {
    receiving_day_one_start: '2026-01-01T00:00:00Z',
    receiving_day_one_end: '2026-01-01T01:00:00Z',
    receiving_day_two_start: '2026-01-01T01:00:00Z',
    receiving_day_two_end: '2026-01-01T02:00:00Z'
  };

  const summary = calculateReceivingSummary({ records, weekGroup: 'WG', windows });
  assert.equal(summary.nights[0].totals.total, 0);
  assert.equal(summary.nights[1].totals.total, 10);
  assert.equal(summary.nights[1].cumulative.total, 10);
});

test('Air Force and Space Force are partitions of the same confirmed bus set', () => {
  const records = [
    { type: 'dorm', week_group: 'WG', max_load: 80, space_force: false },
    { type: 'dorm', week_group: 'WG', max_load: 120, space_force: true },
    {
      type: 'bus',
      week_group: 'WG',
      status: 'arrived',
      otw_count: 44,
      space_force_count: 10,
      nat_count: 4,
      arrived_at: '2026-01-01T00:30:00Z'
    }
  ];
  const windows = {
    receiving_day_one_start: '2026-01-01T00:00:00Z',
    receiving_day_one_end: '2026-01-01T01:00:00Z'
  };

  const summary = calculateReceivingSummary({ records, weekGroup: 'WG', windows });
  const report = buildReceivingReportModel(summary);

  assert.equal(summary.confirmed.total, 44);
  assert.equal(summary.confirmed.airForce, 34);
  assert.equal(summary.confirmed.spaceForce, 10);
  assert.equal(report.includeSpaceForce, true);
  assert.equal(report.nights[0].standard.processed, 34);
  assert.equal(report.nights[0].standard.projected, 80);
  assert.equal(report.nights[0].spaceForce.processed, 10);
  assert.equal(report.nights[0].spaceForce.projected, 120);
});

test('manifested bus totals remain distinct from confirmed arrivals', () => {
  const records = [
    {
      type: 'bus',
      week_group: 'WG',
      status: 'arrived',
      otw_count: 40,
      arrived_at: '2026-01-01T00:30:00Z'
    },
    {
      type: 'bus',
      week_group: 'WG',
      status: 'active',
      otw_count: 20,
      departed_at: '2026-01-01T00:45:00Z'
    }
  ];

  assert.equal(calculateManifestedBusTotals(records, 'WG').total, 60);
  assert.equal(calculateConfirmedArrivalTotals(records, 'WG').total, 40);
});

test('assignment summary exposes both awaiting and over-assigned conditions', () => {
  const records = [
    {
      type: 'bus',
      week_group: 'WG',
      status: 'arrived',
      otw_count: 50,
      arrived_at: '2026-01-01T00:30:00Z'
    },
    { type: 'dorm', week_group: 'WG', max_load: 60, current_load: 45 }
  ];

  assert.deepEqual(calculateAssignmentSummary(records, 'WG'), {
    weekGroup: 'WG',
    arrived: 50,
    loaded: 45,
    awaitingAssignment: 5,
    overAssigned: 0
  });
});

test('canonical receiving timestamps require explicit timezone offsets', () => {
  const validation = validateReceivingWindows({
    receiving_day_one_start: '2026-01-01T00:00',
    receiving_day_one_end: '2026-01-01T01:00'
  });

  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(' '), /timezone offset/i);
});
