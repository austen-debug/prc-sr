import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  GATE_SCHEMA_VERSION,
  createRecordEnvelope,
  validateBus,
  validateDorm,
  validateWeekGroup,
  validateArchive,
  adaptLegacyBus,
  adaptLegacyDorm
} from '../../../public/app/contracts/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const examples = resolve(here, '../../../docs/build-2/contracts/examples');
async function example(name) { return JSON.parse(await readFile(resolve(examples, name), 'utf8')); }

test('canonical examples validate', async () => {
  assert.equal(validateBus(await example('bus.json')).valid, true);
  assert.equal(validateDorm(await example('dorm.json')).valid, true);
  assert.equal(validateWeekGroup(await example('week-group.json')).valid, true);
  assert.equal(validateArchive(await example('archive.json')).valid, true);
});

test('record envelope owns schema and record versions', () => {
  const record = createRecordEnvelope({ id: 'b1', type: 'bus', weekGroup: '26-28', data: {} });
  assert.equal(record.schema_version, GATE_SCHEMA_VERSION);
  assert.equal(record.record_version, 1);
  assert.equal(record.week_group, '26-28');
  assert.ok(record.created_at.endsWith('Z'));
});

test('confirmed arrival requires arrived_at and never falls back to departed_at', () => {
  const record = createRecordEnvelope({
    id: 'b2', type: 'bus', weekGroup: '26-28',
    data: { bus_id: 'BUS 2', status: 'arrived', otw_count: 40, female_count: 0, nat_count: 0, space_force_count: 0, departed_at: '2026-07-14T20:00:00.000Z', arrived_at: null }
  });
  const result = validateBus(record);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.path === 'data.arrived_at'));
});

test('bus subsets cannot exceed total', () => {
  const record = createRecordEnvelope({
    id: 'b3', type: 'bus', weekGroup: '26-28',
    data: { bus_id: 'BUS 3', status: 'active', otw_count: 10, female_count: 11, nat_count: 0, space_force_count: 0, arrived_at: null }
  });
  assert.equal(validateBus(record).valid, false);
});

test('dorm load cannot exceed capacity and classifications cannot conflict', () => {
  const record = createRecordEnvelope({
    id: 'd1', type: 'dorm', weekGroup: '26-28',
    data: { dorm_name: 'A1', state: 'empty', max_load: 50, current_load: 51, band: true, space_force: true }
  });
  const result = validateDorm(record);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.code === 'classification_conflict'));
});

test('legacy bus adapter preserves identity and canonical count fields', () => {
  const result = adaptLegacyBus({
    __backendId: 'legacy-bus-1', type: 'bus', week_group: '26-28', bus_number: 'BUS 7', status: 'arrived',
    total_count: 48, naturalization_count: 3, space_force_count: 4,
    arrived_at: '2026-07-14T21:00:00-05:00', created_at: '2026-07-14T20:00:00-05:00'
  }, { role: 'instructor' });
  assert.equal(result.record.id, 'legacy-bus-1');
  assert.equal(result.record.data.otw_count, 48);
  assert.equal(result.record.data.nat_count, 3);
  assert.equal(validateBus(result.record).valid, true);
});

test('legacy dorm adapter preserves backend identity and clamps load', () => {
  const result = adaptLegacyDorm({
    __backendId: 'legacy-dorm-1', type: 'dorm', week_group: '26-28', dorm_name: 'A1', state: 'empty', capacity: 50, loaded: 55,
    is_space_force: true, created_at: '2026-07-14T20:00:00-05:00'
  }, { role: 'instructor' });
  assert.equal(result.record.id, 'legacy-dorm-1');
  assert.equal(result.record.data.current_load, 50);
  assert.equal(result.record.data.space_force, true);
  assert.equal(validateDorm(result.record).valid, true);
});

test('legacy local timestamp is surfaced instead of silently assigned a zone', () => {
  const result = adaptLegacyBus({
    id: 'legacy-bus-2', type: 'bus', week_group: '26-28', bus_id: 'BUS 8', status: 'active', otw_count: 20,
    departed_at: '2026-07-14T20:00'
  });
  assert.equal(result.record.data.departed_at, null);
  assert.ok(result.warnings.some(warning => warning.includes('timezone context')));
});
