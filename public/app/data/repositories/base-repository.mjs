import { normalizeWeekGroup, normalizeText } from '../../domain/normalization.mjs';
import { restoreBuild1Record } from '../record-normalizer.mjs';
import {
  GateRepositoryError,
  RepositoryErrorCode,
  repositoryFailure,
  repositoryOk
} from '../repository-result.mjs';

export class BaseRepository {
  constructor({ client, type }) {
    if (!client) throw new TypeError('A records client is required.');
    this.client = client;
    this.type = normalizeText(type).toLowerCase();
    if (!this.type) throw new TypeError('A repository record type is required.');
  }

  async list({ weekGroup = '' } = {}) {
    const result = await this.client.list();
    if (!result.ok) return result;
    const requestedWeekGroup = normalizeWeekGroup(weekGroup);
    const records = result.data.records.filter(record => (
      record.type === this.type && (!requestedWeekGroup || record.weekGroup === requestedWeekGroup)
    ));
    const recordIds = new Set(records.map(record => record.id));
    const warnings = result.data.warnings.filter(warning => recordIds.has(warning.recordId));
    return repositoryOk(Object.freeze(records), {
      warnings: Object.freeze(warnings),
      capabilities: this.client.capabilities
    });
  }

  async getById(id) {
    const normalizedId = normalizeText(id);
    if (!normalizedId) {
      return repositoryFailure(new GateRepositoryError(
        RepositoryErrorCode.VALIDATION,
        'A record id is required.'
      ));
    }

    const result = await this.list();
    if (!result.ok) return result;
    const record = result.data.find(item => item.id === normalizedId);
    if (!record) {
      return repositoryFailure(new GateRepositoryError(
        RepositoryErrorCode.NOT_FOUND,
        `${this.type} record ${normalizedId} was not found.`,
        { status: 404 }
      ));
    }
    return repositoryOk(record, { capabilities: this.client.capabilities });
  }

  async createRaw(rawRecord) {
    return this.client.create({ ...rawRecord, type: this.type });
  }

  async updateEnvelope(envelope, rawPatch = {}, options = {}) {
    if (!envelope?.id) {
      return repositoryFailure(new GateRepositoryError(
        RepositoryErrorCode.VALIDATION,
        'A persisted record envelope is required for update.'
      ));
    }

    const raw = {
      ...restoreBuild1Record(envelope),
      ...rawPatch,
      __backendId: envelope.id,
      type: this.type
    };

    return this.client.update(raw, {
      expectedRecordVersion: envelope.recordVersion,
      requireConflictDetection: Boolean(options.requireConflictDetection)
    });
  }

  async deleteById(id, options = {}) {
    const existing = await this.getById(id);
    if (!existing.ok) return existing;
    return this.client.delete(
      { __backendId: existing.data.id, type: this.type },
      {
        expectedRecordVersion: existing.data.recordVersion,
        requireConflictDetection: Boolean(options.requireConflictDetection)
      }
    );
  }
}
