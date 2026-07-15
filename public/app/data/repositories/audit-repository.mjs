import { normalizeText, normalizeTimestamp, normalizeWeekGroup, toNonNegativeNumber } from '../../domain/normalization.mjs';
import { normalizeActorRole } from '../canonical-entity.mjs';
import { BaseRepository } from './base-repository.mjs';
import { validationFailure } from '../repository-result.mjs';

const PROHIBITED_METADATA_KEY = /^(?:trainee_name|first_name|last_name|ssn|social_security|dod_id|edipi|orders?)$/i;

function containsProhibitedMetadata(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsProhibitedMetadata);
  return Object.entries(value).some(([key, child]) => (
    PROHIBITED_METADATA_KEY.test(key) || containsProhibitedMetadata(child)
  ));
}

export class GateAuditRepository extends BaseRepository {
  constructor({ client }) {
    super({ client, type: 'audit_event' });
  }

  async append(command = {}) {
    const eventType = normalizeText(command.eventType).toLowerCase();
    const entityType = normalizeText(command.entityType).toLowerCase();
    const entityId = normalizeText(command.entityId);
    const weekGroup = normalizeWeekGroup(command.weekGroup);
    const occurredAt = normalizeTimestamp(command.occurredAt) || new Date().toISOString();
    const priorVersion = toNonNegativeNumber(command.priorVersion);
    const resultingVersion = toNonNegativeNumber(command.resultingVersion);
    const actorRole = normalizeActorRole(command.actorRole);
    const metadata = command.metadata && typeof command.metadata === 'object' && !Array.isArray(command.metadata)
      ? command.metadata
      : {};

    if (!eventType) return validationFailure('Audit event type is required.');
    if (!entityType || !entityId) return validationFailure('Audit entity type and id are required.');
    if (resultingVersion < priorVersion) return validationFailure('Audit resulting version cannot be lower than the prior version.');
    if (containsProhibitedMetadata(metadata)) return validationFailure('Audit metadata contains prohibited trainee or orders fields.');

    return this.createRaw({
      schema_version: 'build-2.audit-event.v1',
      event_type: eventType,
      week_group: weekGroup,
      entity_type: entityType,
      entity_id: entityId,
      actor_role: actorRole,
      occurred_at: occurredAt,
      prior_version: priorVersion,
      resulting_version: resultingVersion,
      summary: normalizeText(command.summary),
      metadata
    }, {
      actorRole: command.actorRole,
      timestamp: occurredAt
    });
  }

  async updateEnvelope() {
    return validationFailure('Audit events are append-only and cannot be updated.');
  }

  async deleteById() {
    return validationFailure('Audit events are append-only and cannot be deleted.');
  }
}
