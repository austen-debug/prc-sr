import { GATE_SCHEMA_VERSION, GATE_SCHEMA_ID, RECORD_TYPES } from './schema-registry.mjs';

const VALID_ROLES = new Set(['instructor', 'airman', 'leadership', 'squadron', 'system', 'unknown']);

export function normalizeRole(value) {
  const role = String(value ?? '').trim().toLowerCase();
  return VALID_ROLES.has(role) ? role : 'unknown';
}

export function normalizeRecordType(value) {
  const type = String(value ?? '').trim().toLowerCase();
  return Object.values(RECORD_TYPES).includes(type) ? type : '';
}

export function normalizeIsoTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function createRecordEnvelope({
  id = '',
  type,
  schemaVersion = GATE_SCHEMA_VERSION,
  recordVersion = 1,
  weekGroup = '',
  createdAt = null,
  updatedAt = null,
  createdByRole = 'unknown',
  updatedByRole = 'unknown',
  data = {}
} = {}) {
  const now = new Date().toISOString();
  const normalizedCreatedAt = normalizeIsoTimestamp(createdAt) || now;
  const normalizedUpdatedAt = normalizeIsoTimestamp(updatedAt) || normalizedCreatedAt;

  return Object.freeze({
    id: String(id ?? '').trim(),
    type: normalizeRecordType(type),
    schema_version: Number.isInteger(Number(schemaVersion)) ? Number(schemaVersion) : GATE_SCHEMA_VERSION,
    schema_id: GATE_SCHEMA_ID,
    record_version: Math.max(1, Math.trunc(Number(recordVersion) || 1)),
    week_group: String(weekGroup ?? '').trim().toUpperCase(),
    created_at: normalizedCreatedAt,
    updated_at: normalizedUpdatedAt,
    created_by_role: normalizeRole(createdByRole),
    updated_by_role: normalizeRole(updatedByRole),
    data: Object.freeze({ ...(data && typeof data === 'object' && !Array.isArray(data) ? data : {}) })
  });
}

export function isRecordEnvelope(value) {
  return Boolean(
    value && typeof value === 'object' && !Array.isArray(value) &&
    typeof value.id === 'string' &&
    normalizeRecordType(value.type) &&
    Number.isInteger(value.schema_version) &&
    Number.isInteger(value.record_version) &&
    typeof value.week_group === 'string' &&
    normalizeIsoTimestamp(value.created_at) &&
    normalizeIsoTimestamp(value.updated_at) &&
    value.data && typeof value.data === 'object' && !Array.isArray(value.data)
  );
}
