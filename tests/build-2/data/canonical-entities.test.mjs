import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CANONICAL_ENTITY_CONTRACT_VERSION,
  isCanonicalEntity,
  normalizePersistedRecord,
  normalizePersistedRecords,
  restoreBuild1Record,
  toCanonicalDomainRecord,
  toCanonicalDomainRecords,
  validateCanonicalEntity
} from '../../../public/app/data/index.mjs';
import {
  calculateConfirmedArrivalTotals,
  normalizeBusRecord,
  normalizeDormRecord,
  selectActiveWeekGroup
} from '../../../public/app/domain/index.mjs';

const options = { timeZone: 'America/Chicago' };

test('legacy records normalize once into immutable canonical entities', () => {
  const source = {
    __backendId: 'B1', type: 'bus', week_group: '26-30', bus_id: '4', bus_type: 'airport',
    status: 'arrived', otw_count: 44, female_count: 8, nat_count: 3, space_force_count: 4,
    arrived_at: '2026-07-15T02:00:00Z', created_by_role: 'instructor', updated_by_role: 'airman'
  };
  const entity = normalizePersistedRecord(source, options);
  assert.equal(entity.contractVersion, CANONICAL_ENTITY_CONTRACT_VERSION);
  assert.equal(isCanonicalEntity(entity, 'bus'), true);
  assert.equal(validateCanonicalEntity(entity).valid, true);
  assert.equal(entity.weekGroup, '26-30');
  assert.equal(entity.createdByRole, 'instructor');
  assert.equal(entity.updatedByRole, 'airman');
  assert.equal(entity.payload.total, 44);
  assert.equal(Object.isFrozen(entity), true);
  assert.equal(Object.isFrozen(entity.payload), true);
  assert.deepEqual(restoreBuild1Record(entity), source);
});

test('legacy records without provenance remain readable as unknown rather than fabricated', () => {
  const entity = normalizePersistedRecord({ type: 'dorm', week_group: 'WG', dorm_name: 'A1', max_load: 50 }, options);
  assert.equal(entity.createdByRole, 'unknown');
  assert.equal(entity.updatedByRole, 'unknown');
});

test('canonical domain handoff is identity-preserving and never reconstructs Build 1 fields', () => {
  const entity = normalizePersistedRecord({ __backendId: 'B1', type: 'bus', week_group: 'WG', bus_id: '1', status: 'active', otw_count: 20 }, options);
  const handedOff = toCanonicalDomainRecord(entity);
  const list = toCanonicalDomainRecords([entity]);
  assert.equal(handedOff, entity);
  assert.equal(list[0], entity);
  assert.equal('week_group' in handedOff, false);
  assert.equal('otw_count' in handedOff, false);
  assert.equal('bus_id' in handedOff, false);
});

test('domain normalization consumes canonical payload fields and exposes provenance', () => {
  const busEntity = normalizePersistedRecord({ __backendId: 'B1', type: 'bus', week_group: 'WG', bus_id: '1', status: 'arrived', otw_count: 20, arrived_at: '2026-07-15T02:00:00Z', created_by_role: 'instructor', updated_by_role: 'airman' }, options);
  const dormEntity = normalizePersistedRecord({ __backendId: 'D1', type: 'dorm', week_group: 'WG', dorm_name: 'A1', sdq: '321', max_load: 50, current_load: 20, assigned_airman: 'Staff', auditorium_location: 'Auditorium' }, options);
  const bus = normalizeBusRecord(busEntity);
  const dorm = normalizeDormRecord(dormEntity);
  assert.equal(bus.total, 20);
  assert.equal(bus.createdByRole, 'instructor');
  assert.equal(bus.updatedByRole, 'airman');
  assert.equal(dorm.name, 'A1');
  assert.equal(dorm.assignedStaff, 'Staff');
  assert.equal(dorm.auditoriumLocation, 'Auditorium');
  assert.equal('raw' in bus, false);
  assert.equal('raw' in dorm, false);
});

test('raw legacy records are not accepted as domain entities', () => {
  const raw = [{ type: 'bus', week_group: 'WG', status: 'arrived', otw_count: 40, arrived_at: '2026-07-15T02:00:00Z' }];
  assert.equal(calculateConfirmedArrivalTotals(raw, 'WG').total, 0);
  const canonical = normalizePersistedRecords(raw, options).records;
  assert.equal(calculateConfirmedArrivalTotals(canonical, 'WG').total, 40);
});

test('config aliases end at the compatibility boundary', () => {
  const records = normalizePersistedRecords([
    { type: 'config', key: 'active_wg', value: '26-30' },
    { type: 'bus', week_group: '26-30', status: 'active', otw_count: 20 }
  ], options).records;
  assert.equal(records[0].payload.key, 'week_group');
  assert.equal(selectActiveWeekGroup(records), '26-30');
  assert.equal('key' in records[0], false);
});

test('unknown future record types remain losslessly recoverable and excluded from typed domain selectors', () => {
  const source = { __backendId: 'X1', type: 'future_extension', week_group: 'WG', custom: { preserve: true } };
  const entity = normalizePersistedRecord(source, options);
  assert.equal(entity.payload.custom.preserve, true);
  assert.deepEqual(restoreBuild1Record(entity), source);
  assert.equal(calculateConfirmedArrivalTotals([entity], 'WG').total, 0);
});
