import {
  normalizeBoolean,
  normalizeStatus,
  normalizeText,
  toNonNegativeNumber
} from '../domain/normalization.mjs';
import {
  cloneLegacyRecord,
  DEFAULT_OPERATIONAL_TIME_ZONE,
  legacySchemaVersion,
  legacyWeekGroup,
  normalizeLegacyConfigKey,
  normalizeLegacyTimestamp,
  normalizeRecordVersion,
  parseLegacyArray
} from './legacy-compatibility.mjs';
import {
  createCanonicalEntity,
  isCanonicalEntity,
  normalizeActorRole
} from './canonical-entity.mjs';

const WINDOW_FIELDS = Object.freeze([
  'receiving_day_one_start',
  'receiving_day_one_end',
  'receiving_day_two_start',
  'receiving_day_two_end'
]);

function timestampValue(value, context, warnings, label) {
  const normalized = normalizeLegacyTimestamp(value, context);
  if (normalized.warning) warnings.push(`${label}: ${normalized.warning}`);
  return normalized.value;
}

function normalizeReceivingWindows(record, context, warnings) {
  const windows = {};
  for (const field of WINDOW_FIELDS) {
    windows[field] = timestampValue(record?.[field], context, warnings, field);
  }
  return Object.freeze(windows);
}

function normalizeBusPayload(record, context, warnings) {
  const total = toNonNegativeNumber(record.otw_count ?? record.total_count ?? record.total);
  const spaceForce = Math.min(toNonNegativeNumber(record.space_force_count), total);
  const status = normalizeStatus(record.status);
  const arrivedAt = timestampValue(record.arrived_at, context, warnings, 'arrived_at');
  const payload = {
    busId: normalizeText(record.bus_id),
    busType: normalizeText(record.bus_type || 'airport').toLowerCase(),
    destination: normalizeText(record.destination),
    originatingDestination: normalizeText(record.originating_destination),
    status,
    total,
    female: Math.min(toNonNegativeNumber(record.female_count), total),
    naturalization: Math.min(toNonNegativeNumber(record.nat_count), total),
    spaceForce,
    airForce: Math.max(total - spaceForce, 0),
    createdAt: timestampValue(record.created_at, context, warnings, 'created_at'),
    departedAt: timestampValue(record.departed_at, context, warnings, 'departed_at'),
    arrivedAt,
    confirmedArrival: status === 'arrived' && Boolean(arrivedAt),
    active: status === 'active'
  };

  if (status === 'arrived' && !arrivedAt) warnings.push('Arrived bus is missing a valid arrived_at timestamp and is not a confirmed arrival.');
  if (status === 'active' && arrivedAt) warnings.push('Active bus contains arrived_at but remains ineligible until status is arrived.');
  return Object.freeze(payload);
}

function normalizeDormPayload(record, context, warnings) {
  const capacity = toNonNegativeNumber(record.max_load ?? record.capacity);
  const requestedLoad = toNonNegativeNumber(record.current_load ?? record.loaded);
  if (requestedLoad > capacity) warnings.push(`current_load ${requestedLoad} exceeded max_load ${capacity} and was constrained.`);

  return Object.freeze({
    name: normalizeText(record.dorm_name || record.name),
    sdq: normalizeText(record.sdq),
    section: normalizeText(record.section),
    interSection: normalizeText(record.inter_sec),
    sex: normalizeText(record.sex).toLowerCase(),
    band: normalizeBoolean(record.band),
    spaceForce: normalizeBoolean(record.space_force) || normalizeBoolean(record.is_space_force),
    capacity,
    load: Math.min(requestedLoad, capacity),
    state: normalizeText(record.state || 'empty').toLowerCase(),
    phase: normalizeText(record.phase),
    openedAt: timestampValue(record.opened_at, context, warnings, 'opened_at'),
    closedAt: timestampValue(record.closed_at, context, warnings, 'closed_at'),
    closedTimer: normalizeText(record.closed_timer),
    assignedStaff: normalizeText(record.assigned_airman || record.assigned_staff),
    auditoriumLocation: normalizeText(record.auditorium_location),
    notes: normalizeText(record.notes),
    receivingWindows: normalizeReceivingWindows(record, context, warnings)
  });
}

function normalizeConfigPayload(record, aliasesUsed) {
  const rawKey = normalizeText(record.key);
  const key = normalizeLegacyConfigKey(rawKey);
  if (rawKey && rawKey.toLowerCase() !== key) aliasesUsed.push(`config.key:${rawKey}->${key}`);
  return Object.freeze({ key, value: normalizeText(record.value) });
}

function confirmedSpaceForceFromBuses(buses) {
  return buses
    .filter(bus => bus.confirmedArrival)
    .reduce((sum, bus) => sum + bus.spaceForce, 0);
}

function normalizeArchivePayload(record, context, warnings) {
  const busDataResult = parseLegacyArray(record.bus_data, { field: 'bus_data' });
  const dormDataResult = parseLegacyArray(record.dorm_data, { field: 'dorm_data' });
  if (busDataResult.warning) warnings.push(busDataResult.warning);
  if (dormDataResult.warning) warnings.push(dormDataResult.warning);

  const buses = busDataResult.value.map(bus => normalizeBusPayload(bus, context, warnings));
  const dorms = dormDataResult.value.map(dorm => normalizeDormPayload(dorm, context, warnings));
  const derivedArrivedSpaceForce = confirmedSpaceForceFromBuses(buses);
  const explicitArrivedSpaceForce = toNonNegativeNumber(record.arrived_space_force_total);
  const broadLegacySpaceForce = toNonNegativeNumber(record.space_force_total);

  let spaceForceTotal = explicitArrivedSpaceForce || derivedArrivedSpaceForce;
  if (!spaceForceTotal && broadLegacySpaceForce && buses.every(bus => bus.status === 'unknown')) {
    spaceForceTotal = broadLegacySpaceForce;
    warnings.push('Archive Space Force total used legacy broad fallback because bus arrival status was unavailable.');
  }
  if (broadLegacySpaceForce && broadLegacySpaceForce !== spaceForceTotal) {
    warnings.push(`Legacy space_force_total ${broadLegacySpaceForce} differs from confirmed-arrival Space Force total ${spaceForceTotal}.`);
  }

  const firstDormWithWindows = dormDataResult.value.find(dorm => WINDOW_FIELDS.some(field => dorm?.[field])) || {};
  const windowSource = Object.fromEntries(WINDOW_FIELDS.map(field => [field, record[field] ?? firstDormWithWindows[field] ?? '']));

  return Object.freeze({
    archivedAt: timestampValue(record.archived_at || record.created_at, context, warnings, 'archived_at'),
    archiveSchemaVersion: normalizeText(record.archive_schema_version),
    closeoutSafetyVersion: normalizeText(record.closeout_safety_version),
    totalExpected: toNonNegativeNumber(record.total_expected),
    totalArrived: toNonNegativeNumber(record.total_arrived),
    totalLoaded: toNonNegativeNumber(record.total_loaded),
    femaleTotal: toNonNegativeNumber(record.female_total),
    naturalizationTotal: toNonNegativeNumber(record.nat_total),
    spaceForceTotal,
    receivingWindows: normalizeReceivingWindows(windowSource, context, warnings),
    buses: Object.freeze(buses),
    dorms: Object.freeze(dorms)
  });
}

function payloadFor(record, type, context, warnings, aliasesUsed) {
  if (type === 'bus') return normalizeBusPayload(record, context, warnings);
  if (type === 'dorm') return normalizeDormPayload(record, context, warnings);
  if (type === 'config') return normalizeConfigPayload(record, aliasesUsed);
  if (type === 'archive') return normalizeArchivePayload(record, context, warnings);
  warnings.push(`Unsupported record type "${type || 'unknown'}" preserved as an opaque payload.`);
  return Object.freeze(cloneLegacyRecord(record));
}

function legacyRole(record, field, fallback = 'unknown') {
  const aliases = field === 'created'
    ? [record.created_by_role, record.createdByRole, record.actor_role, record.actorRole]
    : [record.updated_by_role, record.updatedByRole, record.actor_role, record.actorRole];
  return normalizeActorRole(aliases.find(value => normalizeText(value)) || fallback);
}

export function normalizePersistedRecord(record = {}, options = {}) {
  const context = { timeZone: options.timeZone || DEFAULT_OPERATIONAL_TIME_ZONE };
  const warnings = [];
  const aliasesUsed = [];
  const type = normalizeText(record.type).toLowerCase() || 'unknown';
  const raw = cloneLegacyRecord(record);
  const createdAt = timestampValue(record.created_at, context, warnings, 'created_at');
  const updatedAt = timestampValue(record.updated_at, context, warnings, 'updated_at');
  const createdByRole = legacyRole(record, 'created');
  const updatedByRole = legacyRole(record, 'updated', createdByRole);
  const payload = payloadFor(record, type, context, warnings, aliasesUsed);

  return createCanonicalEntity({
    id: normalizeText(record.__backendId || record.id),
    type,
    schemaVersion: legacySchemaVersion(record),
    recordVersion: normalizeRecordVersion(record.record_version ?? record.recordVersion),
    weekGroup: legacyWeekGroup(record),
    createdAt,
    updatedAt,
    createdByRole,
    updatedByRole,
    payload,
    compatibility: {
      source: 'build-1',
      operationalTimeZone: context.timeZone,
      aliasesUsed,
      warnings
    },
    raw
  });
}

export function normalizePersistedRecords(records = [], options = {}) {
  const normalized = (Array.isArray(records) ? records : []).map(record => normalizePersistedRecord(record, options));
  const warnings = normalized.flatMap(record => record.compatibility.warnings.map(message => ({
    recordId: record.id,
    type: record.type,
    message
  })));
  return Object.freeze({ records: Object.freeze(normalized), warnings: Object.freeze(warnings) });
}

export function restoreBuild1Record(envelope) {
  return cloneLegacyRecord(envelope?.raw || {});
}

export function toBuild1Record(envelope, patch = {}) {
  return {
    ...restoreBuild1Record(envelope),
    ...cloneLegacyRecord(patch),
    __backendId: envelope?.id || patch.__backendId || '',
    type: envelope?.type || patch.type || 'unknown'
  };
}

export function toCanonicalDomainRecord(entity) {
  return isCanonicalEntity(entity) ? entity : null;
}

export function toCanonicalDomainRecords(entities = []) {
  return Object.freeze((Array.isArray(entities) ? entities : [])
    .filter(entity => isCanonicalEntity(entity)));
}
