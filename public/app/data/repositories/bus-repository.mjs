import {
  normalizeText,
  normalizeTimestamp,
  normalizeWeekGroup,
  toNonNegativeNumber
} from '../../domain/normalization.mjs';
import { BaseRepository } from './base-repository.mjs';
import { repositoryOk, validationFailure } from '../repository-result.mjs';

function countSet(command = {}) {
  const total = toNonNegativeNumber(command.total ?? command.otwCount);
  const female = toNonNegativeNumber(command.female);
  const naturalization = toNonNegativeNumber(command.naturalization);
  const spaceForce = toNonNegativeNumber(command.spaceForce);
  return { total, female, naturalization, spaceForce };
}

function validateCounts(counts) {
  if (counts.total < 1 || counts.total > 44) return 'Bus total must be between 1 and 44.';
  if (counts.female > counts.total) return 'Female count cannot exceed the bus total.';
  if (counts.naturalization > counts.total) return 'Naturalization count cannot exceed the bus total.';
  if (counts.spaceForce > counts.total) return 'Space Force count cannot exceed the bus total.';
  return '';
}

function commandTimestamp(value, fallback = new Date().toISOString()) {
  return normalizeTimestamp(value) || fallback;
}

export class GateBusRepository extends BaseRepository {
  constructor({ client }) {
    super({ client, type: 'bus' });
  }

  async listActive(options = {}) {
    const result = await this.list(options);
    if (!result.ok) return result;
    return repositoryOk(Object.freeze(result.data.filter(record => record.payload.active)), result.meta);
  }

  async listConfirmed(options = {}) {
    const result = await this.list(options);
    if (!result.ok) return result;
    return repositoryOk(Object.freeze(result.data.filter(record => record.payload.confirmedArrival)), result.meta);
  }

  async createAirportBus(command = {}) {
    const weekGroup = normalizeWeekGroup(command.weekGroup);
    const busId = normalizeText(command.busId);
    const counts = countSet(command);
    const validationError = validateCounts(counts);
    if (!weekGroup) return validationFailure('Week Group is required to dispatch an airport bus.');
    if (!busId) return validationFailure('Bus number is required.');
    if (validationError) return validationFailure(validationError, counts);

    const departedAt = commandTimestamp(command.departedAt);
    return this.createRaw({
      week_group: weekGroup,
      bus_id: busId,
      bus_type: 'airport',
      destination: '',
      originating_destination: '',
      otw_count: counts.total,
      female_count: counts.female,
      nat_count: counts.naturalization,
      space_force_count: counts.spaceForce,
      status: 'active',
      departed_at: departedAt,
      arrived_at: ''
    }, { actorRole: command.actorRole, timestamp: departedAt });
  }

  async createLocalArrival(command = {}) {
    const weekGroup = normalizeWeekGroup(command.weekGroup);
    const destination = normalizeText(command.destination);
    const counts = countSet(command);
    const validationError = validateCounts(counts);
    if (!weekGroup) return validationFailure('Week Group is required to create a local arrival.');
    if (!destination) return validationFailure('Originating destination is required.');
    if (validationError) return validationFailure(validationError, counts);

    const arrivedAt = commandTimestamp(command.arrivedAt);
    return this.createRaw({
      week_group: weekGroup,
      bus_id: '',
      bus_type: 'local',
      destination,
      originating_destination: destination,
      otw_count: counts.total,
      female_count: counts.female,
      nat_count: counts.naturalization,
      space_force_count: counts.spaceForce,
      status: 'arrived',
      departed_at: arrivedAt,
      arrived_at: arrivedAt
    }, { actorRole: command.actorRole, timestamp: arrivedAt });
  }

  async confirmArrival(id, command = {}) {
    const existing = await this.getById(id);
    if (!existing.ok) return existing;
    if (existing.data.payload.confirmedArrival) return repositoryOk(existing.data, { unchanged: true });
    if (!existing.data.payload.active) return validationFailure('Only an active bus may be confirmed arrived.');

    const arrivedAt = commandTimestamp(command.arrivedAt);
    return this.updateEnvelope(existing.data, {
      status: 'arrived',
      arrived_at: arrivedAt
    }, {
      actorRole: command.actorRole,
      timestamp: arrivedAt,
      requireConflictDetection: Boolean(command.requireConflictDetection)
    });
  }

  async updateCounts(id, command = {}) {
    const existing = await this.getById(id);
    if (!existing.ok) return existing;
    const counts = countSet(command);
    const validationError = validateCounts(counts);
    if (validationError) return validationFailure(validationError, counts);
    const updatedAt = commandTimestamp(command.updatedAt);

    return this.updateEnvelope(existing.data, {
      otw_count: counts.total,
      female_count: counts.female,
      nat_count: counts.naturalization,
      space_force_count: counts.spaceForce
    }, {
      actorRole: command.actorRole,
      timestamp: updatedAt,
      requireConflictDetection: Boolean(command.requireConflictDetection)
    });
  }
}
