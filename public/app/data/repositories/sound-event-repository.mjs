import { normalizeWeekGroup } from '../../domain/normalization.mjs';
import { BaseRepository } from './base-repository.mjs';
import { repositoryOk, validationFailure } from '../repository-result.mjs';

export class GateSoundEventRepository extends BaseRepository {
  constructor({ client }) {
    super({ client, type: 'sound_event' });
  }

  async clearWeekGroup(weekGroup, command = {}) {
    const requestedWeekGroup = normalizeWeekGroup(weekGroup);
    if (!requestedWeekGroup) return validationFailure('Week Group is required to clear sound events.');
    const records = await this.list({ weekGroup: requestedWeekGroup });
    if (!records.ok) return records;

    const deletedIds = [];
    for (const record of records.data) {
      const result = await this.deleteById(record.id, command);
      if (!result.ok) return result;
      deletedIds.push(record.id);
    }
    return repositoryOk(Object.freeze(deletedIds), {
      deleted: deletedIds.length,
      capabilities: this.client.capabilities
    });
  }
}
