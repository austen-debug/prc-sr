import { normalizeText, normalizeWeekGroup } from '../../domain/normalization.mjs';
import { normalizeLegacyConfigKey } from '../legacy-compatibility.mjs';
import { BaseRepository } from './base-repository.mjs';
import { repositoryOk, validationFailure } from '../repository-result.mjs';

const SECRET_KEY_PATTERN = /(?:password|secret|token|credential|username)$/i;

function normalizedKey(value) {
  return normalizeLegacyConfigKey(normalizeText(value));
}

export class GateConfigRepository extends BaseRepository {
  constructor({ client }) {
    super({ client, type: 'config' });
  }

  async getByKey(key) {
    const requested = normalizedKey(key);
    if (!requested) return validationFailure('Configuration key is required.');
    const result = await this.list();
    if (!result.ok) return result;
    const record = result.data.find(item => item.payload.key === requested) || null;
    return repositoryOk(record, { found: Boolean(record), capabilities: this.client.capabilities });
  }

  async set(key, value, command = {}) {
    const requested = normalizedKey(key);
    const normalizedValue = normalizeText(value);
    if (!requested) return validationFailure('Configuration key is required.');
    if (SECRET_KEY_PATTERN.test(requested)) {
      return validationFailure('Secrets and credentials must remain in server-side environment bindings, not persisted config records.');
    }

    const existing = await this.getByKey(requested);
    if (!existing.ok) return existing;
    const timestamp = command.updatedAt || command.createdAt || new Date().toISOString();
    if (!existing.data) {
      return this.createRaw({ key: requested, value: normalizedValue }, {
        actorRole: command.actorRole,
        timestamp
      });
    }

    return this.updateEnvelope(existing.data, {
      key: requested,
      value: normalizedValue
    }, {
      actorRole: command.actorRole,
      timestamp,
      requireConflictDetection: Boolean(command.requireConflictDetection)
    });
  }

  async getActiveWeekGroup() {
    const result = await this.getByKey('week_group');
    if (!result.ok) return result;
    return repositoryOk(normalizeWeekGroup(result.data?.payload?.value || ''), {
      found: Boolean(result.data),
      capabilities: this.client.capabilities
    });
  }

  async setActiveWeekGroup(weekGroup, command = {}) {
    const value = normalizeWeekGroup(weekGroup);
    if (!value) return validationFailure('Active Week Group is required.');
    return this.set('week_group', value, command);
  }
}
