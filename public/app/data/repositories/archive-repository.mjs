import {
  normalizeText,
  normalizeTimestamp,
  normalizeWeekGroup,
  toNonNegativeNumber
} from '../../domain/normalization.mjs';
import { BaseRepository } from './base-repository.mjs';
import { validationFailure } from '../repository-result.mjs';

export class GateArchiveRepository extends BaseRepository {
  constructor({ client }) {
    super({ client, type: 'archive' });
  }

  async createSnapshot(command = {}) {
    const weekGroup = normalizeWeekGroup(command.weekGroup);
    const archivedAt = normalizeTimestamp(command.archivedAt) || new Date().toISOString();
    const busData = Array.isArray(command.busData) ? command.busData : null;
    const dormData = Array.isArray(command.dormData) ? command.dormData : null;
    if (!weekGroup) return validationFailure('Week Group is required to create an archive snapshot.');
    if (!busData || !dormData) return validationFailure('Archive snapshots require busData and dormData arrays.');

    const totalExpected = toNonNegativeNumber(command.totalExpected);
    const totalArrived = toNonNegativeNumber(command.totalArrived);
    const totalLoaded = toNonNegativeNumber(command.totalLoaded);
    const femaleTotal = toNonNegativeNumber(command.femaleTotal);
    const naturalizationTotal = toNonNegativeNumber(command.naturalizationTotal);
    const spaceForceTotal = toNonNegativeNumber(command.spaceForceTotal);

    if (totalLoaded > totalExpected) {
      return validationFailure('Archive loaded total cannot exceed projected total.', { totalLoaded, totalExpected });
    }
    if (femaleTotal > totalArrived || naturalizationTotal > totalArrived || spaceForceTotal > totalArrived) {
      return validationFailure('Archive subgroup totals cannot exceed confirmed-arrived total.');
    }

    return this.createRaw({
      week_group: weekGroup,
      archived_at: archivedAt,
      archive_schema_version: normalizeText(command.archiveSchemaVersion || 'build-2-v1'),
      closeout_safety_version: normalizeText(command.closeoutSafetyVersion || 'verified-create-before-delete'),
      total_expected: totalExpected,
      total_arrived: totalArrived,
      total_loaded: totalLoaded,
      female_total: femaleTotal,
      nat_total: naturalizationTotal,
      space_force_total: spaceForceTotal,
      arrived_space_force_total: spaceForceTotal,
      bus_data: busData,
      dorm_data: dormData,
      notes: normalizeText(command.notes),
      ...(command.receivingWindows || {})
    });
  }

  async deleteSnapshot(id, command = {}) {
    return this.deleteById(id, {
      requireConflictDetection: Boolean(command.requireConflictDetection)
    });
  }
}
