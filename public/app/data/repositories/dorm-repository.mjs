import { normalizeText, normalizeTimestamp, normalizeWeekGroup, toNonNegativeNumber } from '../../domain/normalization.mjs';
import { BaseRepository } from './base-repository.mjs';
import { repositoryOk, validationFailure } from '../repository-result.mjs';

const TIMER = /^\d{1,4}:\d{2}$/;
const at = value => normalizeTimestamp(value) || new Date().toISOString();

export class GateDormRepository extends BaseRepository {
  constructor({ client }) { super({ client, type: 'dorm' }); }

  async createDorm(command = {}) {
    const weekGroup = normalizeWeekGroup(command.weekGroup);
    const name = normalizeText(command.name);
    const capacity = toNonNegativeNumber(command.capacity);
    const spaceForce = Boolean(command.spaceForce);
    if (!weekGroup || !name) return validationFailure('Week Group and dorm name are required.');
    if (capacity < 1 || capacity > 60) return validationFailure('Dorm capacity must be between 1 and 60.');
    if (command.band && spaceForce) return validationFailure('A dorm cannot be both Band and Space Force.');
    const createdAt = at(command.createdAt);
    return this.createRaw({
      week_group: weekGroup, dorm_name: name, sdq: normalizeText(command.sdq),
      section: normalizeText(command.section), inter_sec: normalizeText(command.interSection),
      sex: normalizeText(command.sex || 'male').toLowerCase(),
      band: command.band ? 'true' : 'false', space_force: spaceForce ? 'true' : 'false',
      is_space_force: spaceForce ? 'true' : 'false', max_load: capacity, current_load: 0,
      state: 'empty', phase: '', opened_at: '', closed_at: '', closed_timer: '',
      assigned_airman: '', auditorium_location: '', notes: '',
      overtime_sound_sent: 'false', overtime_sound_at: '',
      ...(command.receivingWindows || {})
    }, { actorRole: command.actorRole, timestamp: createdAt });
  }

  async updateLoad(id, command = {}) {
    const current = await this.getById(id);
    if (!current.ok) return current;
    const load = toNonNegativeNumber(command.load);
    if (load > current.data.payload.capacity) {
      return validationFailure('Dorm load cannot exceed dorm capacity.', { load, capacity: current.data.payload.capacity });
    }
    const updatedAt = at(command.updatedAt);
    return this.updateEnvelope(current.data, { current_load: load }, {
      ...command,
      actorRole: command.actorRole,
      timestamp: updatedAt
    });
  }

  async open(id, command = {}) {
    const current = await this.getById(id);
    if (!current.ok) return current;
    if (current.data.payload.state === 'open') return repositoryOk(current.data, { unchanged: true });
    if (current.data.payload.state === 'closed') return validationFailure('Use the explicit reopen command for a closed dorm.');
    const openedAt = at(command.openedAt);
    return this.updateEnvelope(current.data, {
      state: 'open', phase: normalizeText(command.phase || 'OPEN'), opened_at: openedAt,
      closed_at: '', closed_timer: ''
    }, { ...command, actorRole: command.actorRole, timestamp: openedAt });
  }

  async close(id, command = {}) {
    const current = await this.getById(id);
    if (!current.ok) return current;
    if (current.data.payload.state === 'closed') return repositoryOk(current.data, { unchanged: true });
    if (current.data.payload.state !== 'open') return validationFailure('Only an open dorm may be closed.');
    const closedTimer = normalizeText(command.closedTimer);
    if (closedTimer && !TIMER.test(closedTimer)) return validationFailure('Final processing time must use MM:SS format.');
    const closedAt = at(command.closedAt);
    return this.updateEnvelope(current.data, {
      state: 'closed', phase: 'Closed', closed_at: closedAt,
      closed_timer: closedTimer
    }, { ...command, actorRole: command.actorRole, timestamp: closedAt });
  }

  async reopen(id, command = {}) {
    const current = await this.getById(id);
    if (!current.ok) return current;
    if (current.data.payload.state !== 'closed') return validationFailure('Only a closed dorm may be reopened.');
    const openedAt = at(command.openedAt);
    return this.updateEnvelope(current.data, {
      state: 'open', phase: normalizeText(command.phase || 'OPEN'), opened_at: openedAt,
      closed_at: '', closed_timer: '', manual_reopen_override: true
    }, { ...command, actorRole: command.actorRole, timestamp: openedAt });
  }

  async correctFinalTime(id, command = {}) {
    const current = await this.getById(id);
    if (!current.ok) return current;
    if (current.data.payload.state !== 'closed') return validationFailure('Final time may be corrected only for a closed dorm.');
    const closedTimer = normalizeText(command.closedTimer);
    if (!TIMER.test(closedTimer)) return validationFailure('Final processing time must use MM:SS format.');
    const updatedAt = at(command.updatedAt);
    return this.updateEnvelope(current.data, {
      closed_timer: closedTimer, manual_closed_timer_override: true
    }, { ...command, actorRole: command.actorRole, timestamp: updatedAt });
  }
}
