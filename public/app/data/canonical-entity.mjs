import {
  normalizeText,
  normalizeTimestamp,
  normalizeWeekGroup,
  toNonNegativeNumber
} from '../domain/normalization.mjs';

export const CANONICAL_ENTITY_CONTRACT_VERSION = 'B.1.0';
export const CANONICAL_ACTOR_ROLES = Object.freeze(['instructor', 'airman', 'squadron', 'system', 'unknown']);

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export function normalizeActorRole(value, { allowUnknown = true } = {}) {
  const role = normalizeText(value).toLowerCase();
  if (CANONICAL_ACTOR_ROLES.includes(role) && (allowUnknown || role !== 'unknown')) return role;
  return allowUnknown ? 'unknown' : '';
}

export function isCanonicalEntity(value, expectedType = '') {
  if (!value || typeof value !== 'object' || !value.payload || typeof value.payload !== 'object') return false;
  const type = normalizeText(value.type).toLowerCase();
  if (!type || !normalizeText(value.schemaVersion)) return false;
  return !expectedType || type === normalizeText(expectedType).toLowerCase();
}

export function createCanonicalEntity({
  id = '',
  type = 'unknown',
  schemaVersion = '',
  recordVersion = 0,
  weekGroup = '',
  createdAt = null,
  updatedAt = null,
  createdByRole = 'unknown',
  updatedByRole = '',
  payload = {},
  compatibility = {},
  raw = {}
} = {}) {
  const normalizedCreatedRole = normalizeActorRole(createdByRole);
  const normalizedUpdatedRole = normalizeActorRole(updatedByRole || normalizedCreatedRole);
  const entity = {
    contractVersion: CANONICAL_ENTITY_CONTRACT_VERSION,
    id: normalizeText(id),
    type: normalizeText(type).toLowerCase() || 'unknown',
    schemaVersion: normalizeText(schemaVersion) || 'build-2.unknown',
    recordVersion: toNonNegativeNumber(recordVersion, { integer: true }),
    weekGroup: normalizeWeekGroup(weekGroup),
    createdAt: normalizeTimestamp(createdAt),
    updatedAt: normalizeTimestamp(updatedAt),
    createdByRole: normalizedCreatedRole,
    updatedByRole: normalizedUpdatedRole,
    payload: cloneJson(payload) || {},
    compatibility: cloneJson(compatibility) || {},
    raw: cloneJson(raw) || {}
  };
  return deepFreeze(entity);
}

export function canonicalEntityList(records = [], expectedType = '') {
  return Object.freeze((Array.isArray(records) ? records : [])
    .filter(record => isCanonicalEntity(record, expectedType)));
}

export function validateCanonicalEntity(entity) {
  const errors = [];
  if (!isCanonicalEntity(entity)) errors.push('Record is not a canonical Build 2 entity.');
  if (!normalizeText(entity?.type)) errors.push('Canonical entity type is required.');
  if (!normalizeText(entity?.schemaVersion)) errors.push('Canonical entity schemaVersion is required.');
  if (!CANONICAL_ACTOR_ROLES.includes(entity?.createdByRole)) errors.push('createdByRole is invalid.');
  if (!CANONICAL_ACTOR_ROLES.includes(entity?.updatedByRole)) errors.push('updatedByRole is invalid.');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
