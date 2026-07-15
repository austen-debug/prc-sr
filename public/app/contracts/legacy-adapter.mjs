import { createRecordEnvelope, normalizeIsoTimestamp } from './record-envelope.mjs';

function text(value) { return String(value ?? '').trim(); }
function integer(value) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0; }
function bool(value) { return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true'; }

function requireTimestamp(value, field, warnings) {
  const normalized = normalizeIsoTimestamp(value);
  if (!normalized && value) warnings.push(`${field}: legacy timestamp requires repository timezone context`);
  return normalized;
}

export function adaptLegacyBus(record = {}, context = {}) {
  const warnings = [];
  const total = integer(record.otw_count ?? record.total_count ?? record.total);
  const statusRaw = text(record.status).toLowerCase();
  const status = ['arrived'].includes(statusRaw) ? 'arrived' : ['cancelled', 'deleted'].includes(statusRaw) ? 'cancelled' : 'active';
  const arrivedAt = requireTimestamp(record.arrived_at, 'arrived_at', warnings);
  const envelope = createRecordEnvelope({
    id: text(record.__backendId || record.id), type: 'bus', weekGroup: record.week_group || context.weekGroup,
    createdAt: requireTimestamp(record.created_at, 'created_at', warnings), updatedAt: requireTimestamp(record.updated_at, 'updated_at', warnings),
    createdByRole: record.created_by_role || context.role, updatedByRole: record.updated_by_role || context.role,
    recordVersion: record.record_version || 1,
    data: {
      bus_id: text(record.bus_id || record.bus_number || record.local_id),
      bus_type: text(record.bus_type || (record.local_arrival ? 'local' : 'airport')).toLowerCase() || 'airport',
      status,
      otw_count: total,
      female_count: Math.min(integer(record.female_count), total),
      nat_count: Math.min(integer(record.nat_count ?? record.naturalization_count), total),
      space_force_count: Math.min(integer(record.space_force_count), total),
      departed_at: requireTimestamp(record.departed_at ?? record.departure_time, 'departed_at', warnings),
      arrived_at: arrivedAt,
      driver: text(record.driver), notes: text(record.notes)
    }
  });
  return Object.freeze({ record: envelope, warnings: Object.freeze(warnings), source_schema: record.schema_version || 1 });
}

export function adaptLegacyDorm(record = {}, context = {}) {
  const warnings = [];
  const capacity = integer(record.max_load ?? record.capacity);
  const envelope = createRecordEnvelope({
    id: text(record.__backendId || record.id), type: 'dorm', weekGroup: record.week_group || context.weekGroup,
    createdAt: requireTimestamp(record.created_at, 'created_at', warnings), updatedAt: requireTimestamp(record.updated_at, 'updated_at', warnings),
    createdByRole: record.created_by_role || context.role, updatedByRole: record.updated_by_role || context.role,
    recordVersion: record.record_version || 1,
    data: {
      dorm_name: text(record.dorm_name || record.name), sdq: text(record.sdq || record.squadron),
      state: text(record.state || 'empty').toLowerCase(), phase: text(record.phase), max_load: capacity,
      current_load: Math.min(integer(record.current_load ?? record.loaded), capacity),
      female: bool(record.female || record.is_female), band: bool(record.band || record.is_band),
      space_force: bool(record.space_force || record.is_space_force), auditorium_location: text(record.auditorium_location),
      opened_at: requireTimestamp(record.opened_at, 'opened_at', warnings), closed_at: requireTimestamp(record.closed_at, 'closed_at', warnings),
      final_processing_time: requireTimestamp(record.final_processing_time, 'final_processing_time', warnings),
      closed_timer: text(record.closed_timer), display_order: Number.isInteger(Number(record.display_order)) ? Number(record.display_order) : null
    }
  });
  return Object.freeze({ record: envelope, warnings: Object.freeze(warnings), source_schema: record.schema_version || 1 });
}

export function adaptLegacyWeekGroup(record = {}, context = {}) {
  const weekGroup = text(record.week_group || record.weekGroup || context.weekGroup).toUpperCase();
  return Object.freeze({
    record: createRecordEnvelope({
      id: text(record.__backendId || record.id), type: 'week_group', weekGroup,
      createdAt: normalizeIsoTimestamp(record.created_at), updatedAt: normalizeIsoTimestamp(record.updated_at),
      createdByRole: record.created_by_role || context.role, updatedByRole: record.updated_by_role || context.role,
      data: { week_group: weekGroup, projected_total: integer(record.projected_total ?? record.expected_total), active: record.active !== false, initialized_at: normalizeIsoTimestamp(record.initialized_at) }
    }), warnings: Object.freeze([]), source_schema: record.schema_version || 1
  });
}

export function adaptLegacyRecord(record = {}, context = {}) {
  const type = text(record.type || record.record_type).toLowerCase();
  if (type === 'bus' || record.bus_id || record.bus_number || record.local_arrival) return adaptLegacyBus(record, context);
  if (type === 'dorm' || record.dorm_name || record.max_load !== undefined) return adaptLegacyDorm(record, context);
  if (type === 'week_group' || type === 'weekgroup') return adaptLegacyWeekGroup(record, context);
  return Object.freeze({ record: null, warnings: Object.freeze(['Unsupported legacy record type; no migration performed.']), source_schema: record.schema_version || 1 });
}
