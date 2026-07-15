import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReceivingReportModel, calculateCapacityTotals, calculateConfirmedArrivalTotals, calculateReceivingSummary, selectActiveBuses, validateReceivingWindows } from '../../../public/app/domain/index.mjs';
import { normalizePersistedRecord, normalizePersistedRecords } from '../../../public/app/data/index.mjs';

const WG = 'WG-1';
const WINDOWS = Object.freeze({
  receiving_day_one_start: '2026-07-14T20:00:00.000Z', receiving_day_one_end: '2026-07-15T11:00:00.000Z',
  receiving_day_two_start: '2026-07-15T20:00:00.000Z', receiving_day_two_end: '2026-07-16T11:00:00.000Z'
});
const canonical = records => normalizePersistedRecords(records, { timeZone: 'America/Chicago' }).records;
const arrived = (id, total, at, extra = {}) => ({ __backendId: id, type: 'bus', week_group: WG, bus_id: id, status: 'arrived', otw_count: total, arrived_at: at, ...extra });
const build1ConfirmedTotal = records => records.filter(r => r.type === 'bus' && String(r.week_group).toUpperCase() === WG).filter(r => String(r.status).toLowerCase() === 'arrived' && Number.isFinite(Date.parse(r.arrived_at))).reduce((sum, r) => sum + Math.max(0, Math.trunc(Number(r.otw_count) || 0)), 0);

test('Build 1 reference and canonical selectors agree', () => {
  const legacy = [arrived('B1', 40, '2026-07-14T21:00:00Z'), { type: 'bus', week_group: WG, status: 'active', otw_count: 30 }, arrived('B3', 15, '')];
  const records = canonical(legacy);
  assert.equal(build1ConfirmedTotal(legacy), 40);
  assert.equal(calculateConfirmedArrivalTotals(records, WG).total, 40);
  assert.equal(selectActiveBuses(records, WG).length, 1);
});

test('local arrivals are included and active airport buses excluded', () => {
  const records = canonical([arrived('LOCAL', 12, '2026-07-14T20:30:00Z', { bus_type: 'local', female_count: 4, nat_count: 1 }), { type: 'bus', week_group: WG, status: 'active', otw_count: 50 }]);
  const totals = calculateConfirmedArrivalTotals(records, WG);
  assert.deepEqual([totals.total, totals.female, totals.naturalization, selectActiveBuses(records, WG).length], [12, 4, 1, 1]);
});

test('edited arrived counts replace prior values', () => {
  const totals = calculateConfirmedArrivalTotals(canonical([arrived('B1', 44, '2026-07-14T21:00:00Z', { female_count: 8, nat_count: 3, space_force_count: 4 })]), WG);
  assert.deepEqual([totals.total, totals.female, totals.naturalization, totals.spaceForce, totals.airForce], [44, 8, 3, 4, 40]);
});

test('outside-window arrivals remain confirmed and unassigned', () => {
  const summary = calculateReceivingSummary({ records: canonical([arrived('EARLY', 20, '2026-07-14T19:59:59Z'), arrived('IN', 30, '2026-07-14T20:00:00Z')]), weekGroup: WG, windows: WINDOWS });
  assert.deepEqual([summary.confirmed.total, summary.nights[0].totals.total, summary.unassignedConfirmedTotals.total], [50, 30, 20]);
});

test('cross-midnight windows retain half-open boundaries', () => {
  assert.equal(validateReceivingWindows(WINDOWS).valid, true);
  const summary = calculateReceivingSummary({ records: canonical([arrived('LATE', 10, '2026-07-15T05:30:00Z'), arrived('END', 7, '2026-07-15T11:00:00Z'), arrived('N2', 5, '2026-07-15T20:00:00Z')]), weekGroup: WG, windows: WINDOWS });
  assert.deepEqual([summary.nights[0].totals.total, summary.nights[1].totals.total, summary.unassignedConfirmedTotals.total], [10, 5, 7]);
});

test('malformed legacy timestamps warn and do not confirm arrival', () => {
  const normalized = normalizePersistedRecords([{ __backendId: 'B1', type: 'bus', week_group: WG, status: 'arrived', otw_count: 25, arrived_at: 'not-a-date' }]);
  assert.equal(calculateConfirmedArrivalTotals(normalized.records, WG).total, 0);
  assert.ok(normalized.warnings.some(item => /arrived_at/i.test(item.message)));
});

test('empty and partial Week Groups produce deterministic totals', () => {
  const empty = calculateReceivingSummary({ records: [], weekGroup: WG, windows: WINDOWS });
  assert.deepEqual([empty.projected.total, empty.confirmed.total, empty.nights[1].cumulative.total], [0, 0, 0]);
  const partial = canonical([{ type: 'dorm', week_group: WG, dorm_name: 'A1', max_load: 50, current_load: 20 }, { type: 'bus', week_group: WG, status: 'active', otw_count: 30 }]);
  assert.deepEqual([calculateCapacityTotals(partial, WG).total, calculateConfirmedArrivalTotals(partial, WG).total], [50, 0]);
});

test('Space Force display follows canonical projected and confirmed values', () => {
  const base = [{ type: 'dorm', week_group: WG, dorm_name: 'A1', max_load: 100 }, arrived('B1', 40, '2026-07-14T21:00:00Z')];
  const noSf = buildReceivingReportModel(calculateReceivingSummary({ records: canonical(base), weekGroup: WG, windows: WINDOWS }));
  const withSf = buildReceivingReportModel(calculateReceivingSummary({ records: canonical([...base, { type: 'dorm', week_group: WG, dorm_name: 'S1', max_load: 20, space_force: true }]), weekGroup: WG, windows: WINDOWS }));
  assert.equal(noSf.includeSpaceForce, false);
  assert.equal(withSf.includeSpaceForce, true);
});

test('archive normalization preserves canonical live totals', () => {
  const legacy = [{ type: 'dorm', week_group: WG, dorm_name: 'A1', max_load: 100, current_load: 70 }, arrived('B1', 60, '2026-07-14T21:00:00Z', { female_count: 12, nat_count: 5, space_force_count: 4 })];
  const live = calculateReceivingSummary({ records: canonical(legacy), weekGroup: WG, windows: WINDOWS });
  const archive = normalizePersistedRecord({ type: 'archive', week_group: WG, total_expected: live.projected.total, total_arrived: live.confirmed.total, total_loaded: 70, female_total: live.confirmed.female, nat_total: live.confirmed.naturalization, arrived_space_force_total: live.confirmed.spaceForce, bus_data: JSON.stringify(legacy.filter(r => r.type === 'bus')), dorm_data: JSON.stringify(legacy.filter(r => r.type === 'dorm')), ...WINDOWS });
  assert.deepEqual([archive.payload.totalExpected, archive.payload.totalArrived, archive.payload.femaleTotal, archive.payload.naturalizationTotal, archive.payload.spaceForceTotal], [100, 60, 12, 5, 4]);
});
