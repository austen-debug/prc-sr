import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeDraft,
  validateInitialization,
  buildDormRows,
  buildArchivePayload
} from '../../../functions/api/persistence-core.mjs';

function draftWith(windows) {
  return normalizeDraft({
    proposed_week_group: '26052',
    rows: [{
      rowIndex: 0,
      sdq: '323 TRS',
      sec: '4',
      inter_sec: '1',
      dorm_name: '2D1',
      sex: 'male',
      band: false,
      space_force: false,
      load: 57
    }],
    receiving_windows: windows,
    import_review: { published_total: 57, band_decision: 'none' }
  });
}

test('backend accepts adjacent datetime-local Receiving Day windows in PRC Central time', () => {
  const windows = {
    receiving_day_one_start: '2026-09-29T05:00',
    receiving_day_one_end: '2026-09-30T07:00',
    receiving_day_two_start: '2026-09-30T07:00',
    receiving_day_two_end: '2026-10-01T07:00'
  };
  const draft = draftWith(windows);
  assert.doesNotThrow(() => validateInitialization(draft));
  const rows = buildDormRows(draft, 'cycle-1', '2026-09-28T12:00:00.000Z', () => 'dorm-1');
  const payload = JSON.parse(rows[0].data);
  assert.equal(payload.receiving_day_one_end, '2026-09-30T07:00');
  assert.equal(payload.receiving_day_two_start, '2026-09-30T07:00');
});

test('backend rejects overlapping Receiving Day windows', () => {
  const draft = draftWith({
    receiving_day_one_start: '2026-09-29T05:00',
    receiving_day_one_end: '2026-09-30T07:01',
    receiving_day_two_start: '2026-09-30T07:00',
    receiving_day_two_end: '2026-10-01T07:00'
  });
  assert.throws(() => validateInitialization(draft), /cannot overlap/i);
});

test('archive payload retains authoritative arrival timestamps and Receiving Day windows', () => {
  const windows = {
    receiving_day_one_start: '2026-09-29T05:00',
    receiving_day_one_end: '2026-09-30T07:00',
    receiving_day_two_start: '2026-09-30T07:00',
    receiving_day_two_end: '2026-10-01T07:00'
  };
  const dorm = {
    type: 'dorm', week_group: '26052', dorm_name: '2D1', sdq: '323 TRS',
    section: '4', inter_sec: '1', sex: 'male', max_load: 57, current_load: 57
  };
  const bus = {
    type: 'bus', week_group: '26052', bus_id: '1', status: 'arrived',
    arrived_at: '2026-09-30T12:00:00.000Z', otw_count: 40, nat_count: 4,
    female_count: 0, space_force_count: 0
  };
  const sourceRecords = [
    { id: 'dorm-1', type: 'dorm', week_group: '26052', data: JSON.stringify(dorm), created_at: '2026-09-29T00:00:00Z', updated_at: '2026-09-30T00:00:00Z' },
    { id: 'bus-1', type: 'bus', week_group: '26052', data: JSON.stringify(bus), created_at: '2026-09-30T11:00:00Z', updated_at: '2026-09-30T12:00:00Z' }
  ];
  const archive = buildArchivePayload({
    cycleId: 'cycle-1',
    weekGroup: '26052',
    dorms: [dorm],
    buses: [bus],
    sourceRecords,
    windows,
    now: '2026-10-01T13:00:00Z'
  });
  assert.equal(archive.receiving_day_one_end, '2026-09-30T07:00');
  assert.equal(archive.receiving_day_two_start, '2026-09-30T07:00');
  const buses = JSON.parse(archive.bus_data);
  assert.equal(buses[0].status, 'arrived');
  assert.equal(buses[0].arrived_at, '2026-09-30T12:00:00.000Z');
  assert.equal(buses[0].otw_count, 40);
  assert.equal(buses[0].nat_count, 4);
});
