const ROLE_SET = new Set(['instructor', 'airman', 'squadron', 'system']);
const WRITE_ROLE_SET = new Set(['instructor', 'airman', 'system']);

export const RECORDS_API_CAPABILITIES = Object.freeze({
  recordVersioning: true,
  conditionalWrites: true,
  transactions: false,
  batchWrites: false,
  appendOnlyAudit: true,
  serverRoleProvenance: true
});

export function normalizeServerRole(value) {
  const role = String(value ?? '').trim().toLowerCase();
  return ROLE_SET.has(role) ? role : 'unknown';
}

export function mayReadRecords(role) {
  return ROLE_SET.has(normalizeServerRole(role));
}

export function mayWriteRecords(role) {
  return WRITE_ROLE_SET.has(normalizeServerRole(role));
}

export function parseExpectedRecordVersion(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return Object.freeze({ supplied: false, valid: true, value: null });
  const normalized = raw.replace(/^W\//i, '').replace(/^"|"$/g, '');
  if (!/^\d+$/.test(normalized)) {
    return Object.freeze({ supplied: true, valid: false, value: null });
  }
  return Object.freeze({ supplied: true, valid: true, value: Number(normalized) });
}

export function recordVersionOf(record = {}) {
  const version = Number(record.record_version ?? record.recordVersion);
  return Number.isFinite(version) && version >= 0 ? Math.trunc(version) : 0;
}

export function stampCreatedRecord(record = {}, { id, role, now } = {}) {
  const actorRole = normalizeServerRole(role);
  return {
    ...record,
    __backendId: id,
    record_version: 1,
    created_at: record.created_at || now,
    updated_at: now,
    created_by_role: actorRole,
    updated_by_role: actorRole
  };
}

export function stampUpdatedRecord(existing = {}, incoming = {}, { role, now } = {}) {
  const actorRole = normalizeServerRole(role);
  return {
    ...existing,
    ...incoming,
    __backendId: existing.__backendId || incoming.__backendId,
    record_version: recordVersionOf(existing) + 1,
    created_at: existing.created_at || incoming.created_at || now,
    updated_at: now,
    created_by_role: existing.created_by_role || actorRole,
    updated_by_role: actorRole
  };
}

export function isAuditEvent(record = {}) {
  return String(record.type || '').trim().toLowerCase() === 'audit_event';
}

export function validateAuditEvent(record = {}) {
  const errors = [];
  if (!String(record.event_type || '').trim()) errors.push('event_type is required.');
  if (!String(record.entity_type || '').trim()) errors.push('entity_type is required.');
  if (!String(record.entity_id || '').trim()) errors.push('entity_id is required.');
  const priorVersion = Number(record.prior_version ?? 0);
  const resultingVersion = Number(record.resulting_version ?? 0);
  if (!Number.isFinite(priorVersion) || priorVersion < 0) errors.push('prior_version must be a non-negative number.');
  if (!Number.isFinite(resultingVersion) || resultingVersion < 0) errors.push('resulting_version must be a non-negative number.');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function stampAuditEvent(record = {}, { id, role, now } = {}) {
  const stamped = stampCreatedRecord({
    ...record,
    type: 'audit_event',
    schema_version: record.schema_version || 'build-2.audit-event.v1',
    occurred_at: record.occurred_at || now,
    actor_role: normalizeServerRole(role)
  }, { id, role, now });
  delete stamped.updated_at;
  return stamped;
}

export function conflictResponseBody({ expectedRecordVersion, currentRecordVersion } = {}) {
  return Object.freeze({
    isOk: false,
    code: 'record_version_conflict',
    error: 'Record version conflict.',
    expectedRecordVersion,
    currentRecordVersion
  });
}

export function sanitizeRecordForRole(record = {}, role = '') {
  if (normalizeServerRole(role) !== 'squadron') return record;
  const type = String(record.type || '').toLowerCase();
  if (!['bus', 'dorm', 'config'].includes(type)) return null;
  const sanitized = { ...record };
  delete sanitized.assigned_airman;
  delete sanitized.assigned_staff;
  delete sanitized.auditorium_location;
  delete sanitized.notes;
  return sanitized;
}
