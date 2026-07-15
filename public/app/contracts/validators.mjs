import { GATE_SCHEMA_VERSION, RECORD_STATUSES, getSchema } from './schema-registry.mjs';
import { isRecordEnvelope, normalizeIsoTimestamp } from './record-envelope.mjs';

function issue(path, code, message) {
  return Object.freeze({ path, code, message });
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function validateCounts(data, totalField, countFields, errors) {
  const total = data[totalField];
  if (!isNonNegativeInteger(total)) errors.push(issue(`data.${totalField}`, 'invalid_integer', 'Must be a non-negative integer.'));
  for (const field of countFields) {
    const value = data[field] ?? 0;
    if (!isNonNegativeInteger(value)) errors.push(issue(`data.${field}`, 'invalid_integer', 'Must be a non-negative integer.'));
    if (isNonNegativeInteger(total) && isNonNegativeInteger(value) && value > total) {
      errors.push(issue(`data.${field}`, 'exceeds_total', `Cannot exceed ${totalField}.`));
    }
  }
}

export function validateEnvelope(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return Object.freeze({ valid: false, errors: Object.freeze([issue('', 'invalid_record', 'Record must be an object.')]) });
  }
  if (!isRecordEnvelope(record)) errors.push(issue('', 'invalid_envelope', 'Record does not satisfy the canonical envelope.'));
  if (record.schema_version !== GATE_SCHEMA_VERSION) errors.push(issue('schema_version', 'unsupported_schema', `Expected schema version ${GATE_SCHEMA_VERSION}.`));
  if (!record.id) errors.push(issue('id', 'required', 'Persistent records require an ID.'));
  if (!record.week_group && record.type !== 'audit') errors.push(issue('week_group', 'required', 'Operational records require a Week Group.'));
  if (normalizeIsoTimestamp(record.updated_at) && normalizeIsoTimestamp(record.created_at) && Date.parse(record.updated_at) < Date.parse(record.created_at)) {
    errors.push(issue('updated_at', 'timestamp_order', 'updated_at cannot precede created_at.'));
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function validateBus(record) {
  const errors = [...validateEnvelope(record).errors];
  const data = record?.data || {};
  if (record?.type !== 'bus') errors.push(issue('type', 'wrong_type', 'Expected bus record.'));
  if (!String(data.bus_id || '').trim()) errors.push(issue('data.bus_id', 'required', 'Bus identity is required.'));
  if (!RECORD_STATUSES.BUS.includes(data.status)) errors.push(issue('data.status', 'invalid_status', 'Bus status is not canonical.'));
  validateCounts(data, 'otw_count', ['female_count', 'nat_count', 'space_force_count'], errors);
  if (data.status === 'arrived' && !normalizeIsoTimestamp(data.arrived_at)) errors.push(issue('data.arrived_at', 'required_for_status', 'Confirmed arrivals require arrived_at.'));
  if (data.status === 'active' && data.arrived_at) errors.push(issue('data.arrived_at', 'forbidden_for_status', 'Active buses cannot have arrived_at.'));
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function validateDorm(record) {
  const errors = [...validateEnvelope(record).errors];
  const data = record?.data || {};
  if (record?.type !== 'dorm') errors.push(issue('type', 'wrong_type', 'Expected dorm record.'));
  if (!String(data.dorm_name || '').trim()) errors.push(issue('data.dorm_name', 'required', 'Dorm name is required.'));
  if (!RECORD_STATUSES.DORM.includes(data.state)) errors.push(issue('data.state', 'invalid_status', 'Dorm state is not canonical.'));
  validateCounts(data, 'max_load', ['current_load'], errors);
  if (data.band === true && data.space_force === true) errors.push(issue('data.space_force', 'classification_conflict', 'Band and Space Force flags are mutually exclusive.'));
  if (data.state === 'open' && !normalizeIsoTimestamp(data.opened_at)) errors.push(issue('data.opened_at', 'required_for_status', 'Open dorms require opened_at.'));
  if (data.state === 'closed' && !normalizeIsoTimestamp(data.closed_at)) errors.push(issue('data.closed_at', 'required_for_status', 'Closed dorms require closed_at.'));
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function validateWeekGroup(record) {
  const errors = [...validateEnvelope(record).errors];
  const data = record?.data || {};
  if (record?.type !== 'week_group') errors.push(issue('type', 'wrong_type', 'Expected Week Group record.'));
  if (!String(data.week_group || '').trim()) errors.push(issue('data.week_group', 'required', 'Week Group identifier is required.'));
  if (record?.week_group !== String(data.week_group || '').trim().toUpperCase()) errors.push(issue('data.week_group', 'envelope_mismatch', 'Week Group data must match the envelope.'));
  if (!isNonNegativeInteger(data.projected_total)) errors.push(issue('data.projected_total', 'invalid_integer', 'Projected total must be a non-negative integer.'));
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function validateConfig(record) {
  const errors = [...validateEnvelope(record).errors];
  const data = record?.data || {};
  if (record?.type !== 'config') errors.push(issue('type', 'wrong_type', 'Expected config record.'));
  const fields = ['receiving_night_one_start', 'receiving_night_one_end', 'receiving_night_two_start', 'receiving_night_two_end'];
  for (const field of fields) if (!normalizeIsoTimestamp(data[field])) errors.push(issue(`data.${field}`, 'invalid_timestamp', 'Receiving windows require explicit valid timestamps.'));
  if (fields.every(field => normalizeIsoTimestamp(data[field]))) {
    if (Date.parse(data.receiving_night_one_end) <= Date.parse(data.receiving_night_one_start)) errors.push(issue('data.receiving_night_one_end', 'invalid_window', 'Night One end must follow start.'));
    if (Date.parse(data.receiving_night_two_end) <= Date.parse(data.receiving_night_two_start)) errors.push(issue('data.receiving_night_two_end', 'invalid_window', 'Night Two end must follow start.'));
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function validateArchive(record) {
  const errors = [...validateEnvelope(record).errors];
  const data = record?.data || {};
  if (record?.type !== 'archive') errors.push(issue('type', 'wrong_type', 'Expected archive record.'));
  for (const field of ['projected_total', 'arrived_total', 'arrived_air_force_total', 'arrived_space_force_total', 'naturalization_total', 'female_total']) {
    if (!isNonNegativeInteger(data[field] ?? 0)) errors.push(issue(`data.${field}`, 'invalid_integer', 'Archive totals must be non-negative integers.'));
  }
  if (!Array.isArray(data.bus_data)) errors.push(issue('data.bus_data', 'invalid_array', 'Archive bus_data must be an array.'));
  if (!Array.isArray(data.dorm_data)) errors.push(issue('data.dorm_data', 'invalid_array', 'Archive dorm_data must be an array.'));
  if ((data.arrived_air_force_total ?? 0) + (data.arrived_space_force_total ?? 0) !== (data.arrived_total ?? 0)) errors.push(issue('data.arrived_total', 'service_sum_mismatch', 'Air Force plus Space Force must equal arrived total.'));
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function validateAudit(record) {
  const errors = [...validateEnvelope(record).errors];
  const data = record?.data || {};
  if (record?.type !== 'audit') errors.push(issue('type', 'wrong_type', 'Expected audit record.'));
  for (const field of ['action', 'entity_type', 'entity_id']) if (!String(data[field] || '').trim()) errors.push(issue(`data.${field}`, 'required', `${field} is required.`));
  if (!normalizeIsoTimestamp(data.occurred_at)) errors.push(issue('data.occurred_at', 'invalid_timestamp', 'Audit occurred_at is required.'));
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function validateRecord(record) {
  if (!getSchema(record?.type)) return Object.freeze({ valid: false, errors: Object.freeze([issue('type', 'unsupported_type', 'Record type is not registered.')]) });
  return ({ bus: validateBus, dorm: validateDorm, week_group: validateWeekGroup, config: validateConfig, archive: validateArchive, audit: validateAudit })[record.type](record);
}
