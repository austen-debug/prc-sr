import { normalizeTimestamp } from '../domain/normalization.mjs';
import { normalizeActorRole } from './canonical-entity.mjs';

export function requireActorRole(value) {
  const role = normalizeActorRole(value, { allowUnknown: false });
  return Object.freeze({
    valid: Boolean(role),
    role,
    error: role ? '' : 'A recognized actorRole is required for Build 2 writes.'
  });
}

export function createProvenanceFields(actorRole, timestamp = '') {
  const validation = requireActorRole(actorRole);
  if (!validation.valid) return Object.freeze({ valid: false, error: validation.error, fields: Object.freeze({}) });
  const at = normalizeTimestamp(timestamp) || new Date().toISOString();
  return Object.freeze({
    valid: true,
    error: '',
    fields: Object.freeze({
      created_by_role: validation.role,
      updated_by_role: validation.role,
      created_at: at,
      updated_at: at
    })
  });
}

export function updateProvenanceFields(actorRole, timestamp = '') {
  const validation = requireActorRole(actorRole);
  if (!validation.valid) return Object.freeze({ valid: false, error: validation.error, fields: Object.freeze({}) });
  return Object.freeze({
    valid: true,
    error: '',
    fields: Object.freeze({
      updated_by_role: validation.role,
      updated_at: normalizeTimestamp(timestamp) || new Date().toISOString()
    })
  });
}
