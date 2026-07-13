import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  convertLocalDateTimeToIso,
  normalizeLegacyTimestamp,
  normalizePersistedRecord,
  normalizePersistedRecords,
  restoreBuild1Record,
  toCanonicalDomainRecords
} from '../../../public/app/data/index.mjs';
import {
  calculateConfirmedArrivalTotals,
  calculateCapacityTotals,
  selectActiveBuses
} from '../../../public/app/domain/operational-metrics.mjs';
import { calculateReceivingSummary } from '../../../public/app/domain/receiving.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(await readFile(resolve(here, '../fixtures/B2-P1-F011-record-compatibility.json'), 'utf8'));
const historicalFixture = JSON.parse(await readFile(resolve(here, '../fixtures/B2-P1-F001-receiving-parity.json'), 'utf8'));
const options = { timeZone: fixture.operationalTimeZone };

test('datetime-local values normalize through the explicit operational time zone', () => {
  assert.equal(convertLocalDateTimeToIso('2026-07-07T12:00', options).value, fixture.expected.summerLocalNoonUtc);
  assert.equal(convertLocalDateTimeToIso('2026-01-07T12:00', options).value, '2026-01-07T18:00:00.000Z');
  assert.equal(normalizeLegacyTimestamp('2026-07-07T17:00:00Z', options).source, 'explicit-offset');
});

test('legacy config aliases normalize without changing the original persisted record', () => {
  const source = fixture.records[0];
  const envelope = normalizePersistedRecord(source, options);
  assert.equal(envelope.payload.key, fixture.expected.canonicalConfigKey);
  assert.deepEqual(restoreBuild1Record(envelope), source);
  assert.match(envelope.compatibility.aliasesUsed.join(' '), /active_wg->week_group/);
});

test('bus eligibility is determined after compatibility normalization', () => {
  const result = normalizePersistedRecords(fixture.records, options);
  const domainRecords = toCanonicalDomainRecords(result.records);
  const confirmed = calculateConfirmedArrivalTotals(domainRecords, '26-28');
  const active = selectActiveBuses(domainRecords, '26-28');
  assert.equal(confirmed.total, fixture.expected.confirmedArrived);
  assert.equal(confirmed.buses.length, 1);
  assert.equal(active.length, fixture.expected.activeBusCount);
  assert.equal(confirmed.buses[0].arrivedAt, fixture.expected.summerLocalNoonUtc);
});

test('dorm loads are constrained at the compatibility boundary and flagged', () => {
  const envelope = normalizePersistedRecord(fixture.records[3], options);
  assert.equal(envelope.payload.load, fixture.expected.constrainedDormLoad);
  assert.match(envelope.compatibility.warnings.join(' '), /exceeded max_load/);
  assert.equal(envelope.payload.receivingWindows.receiving_day_one_start, fixture.expected.summerLocalNoonUtc);
});

test('archive Space Force normalization prefers confirmed-arrival truth', () => {
  const envelope = normalizePersistedRecord(fixture.records[4], options);
  assert.equal(envelope.payload.spaceForceTotal, fixture.expected.archiveConfirmedSpaceForce);
  assert.equal(envelope.payload.buses.filter(bus => bus.confirmedArrival).length, 1);
  assert.match(envelope.compatibility.warnings.join(' '), /differs from confirmed-arrival Space Force total/);
});

test('unknown record types remain losslessly recoverable', () => {
  const source = fixture.records[5];
  const envelope = normalizePersistedRecord(source, options);
  assert.equal(envelope.type, 'future_extension');
  assert.deepEqual(restoreBuild1Record(envelope), source);
  assert.equal(envelope.payload.custom.preserve, fixture.expected.unknownRecordPreserved);
});

test('normalized Build 1 records preserve receiving calculation parity', () => {
  const result = normalizePersistedRecords(fixture.records, options);
  const domainRecords = toCanonicalDomainRecords(result.records);
  const summary = calculateReceivingSummary({
    records: domainRecords,
    weekGroup: '26-28',
    windows: {
      receiving_day_one_start: '2026-07-07T17:00:00Z',
      receiving_day_one_end: '2026-07-08T20:00:00Z'
    }
  });
  assert.equal(summary.confirmed.total, 44);
  assert.equal(summary.nights[0].totals.total, 44);
  assert.equal(summary.nights[0].totals.spaceForce, 4);
});

test('compatibility normalization preserves the historical F001 parity baseline', () => {
  const result = normalizePersistedRecords(historicalFixture.records, options);
  const domainRecords = toCanonicalDomainRecords(result.records);
  const capacity = calculateCapacityTotals(domainRecords, historicalFixture.weekGroup);
  const confirmed = calculateConfirmedArrivalTotals(domainRecords, historicalFixture.weekGroup);
  const active = selectActiveBuses(domainRecords, historicalFixture.weekGroup);
  const summary = calculateReceivingSummary({
    records: domainRecords,
    weekGroup: historicalFixture.weekGroup,
    windows: historicalFixture.receivingWindows
  });

  assert.equal(capacity.total, historicalFixture.expected.projectedTotal);
  assert.equal(confirmed.total, historicalFixture.expected.confirmedArrived);
  assert.equal(active.length, historicalFixture.expected.activeBusCount);
  assert.equal(summary.nights[0].totals.total, historicalFixture.expected.nightOne.processed);
  assert.equal(summary.nights[0].totals.naturalization, historicalFixture.expected.nightOne.naturalization);
  assert.equal(summary.nights[1].totals.total, historicalFixture.expected.nightTwo.processed);
  assert.equal(summary.nights[1].totals.naturalization, historicalFixture.expected.nightTwo.naturalization);
  assert.equal(summary.nights[1].cumulative.total, historicalFixture.expected.nightTwo.cumulativeProcessed);
  assert.equal(summary.nights[1].cumulative.naturalization, historicalFixture.expected.nightTwo.cumulativeNaturalization);
});

test('malformed archive arrays produce warnings instead of exceptions', () => {
  const envelope = normalizePersistedRecord({
    __backendId: 'bad-archive',
    type: 'archive',
    week_group: 'WG',
    bus_data: '{not-json',
    dorm_data: '{}'
  }, options);
  assert.deepEqual(envelope.payload.buses, []);
  assert.deepEqual(envelope.payload.dorms, []);
  assert.match(envelope.compatibility.warnings.join(' '), /invalid JSON|not an array/);
});
