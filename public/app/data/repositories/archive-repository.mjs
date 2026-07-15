import {
  normalizeText,
  normalizeTimestamp,
  normalizeWeekGroup,
  toNonNegativeNumber
} from '../../domain/normalization.mjs';
import { BaseRepository } from './base-repository.mjs';
import { repositoryOk, validationFailure } from '../repository-result.mjs';

export const ARCHIVE_KINDS = Object.freeze(['closeout', 'amendment']);

export class GateArchiveRepository extends BaseRepository {
  constructor({ client }) {
    super({ client, type: 'archive' });
  }

  async findByOperation(operationId) {
    const requested = normalizeText(operationId);
    if (!requested) return validationFailure('Archive operation id is required.');
    const result = await this.list();
    if (!result.ok) return result;
    const record = result.data.find(item => normalizeText(item.payload?.operationId) === requested) || null;
    return repositoryOk(record, {
      found: Boolean(record),
      capabilities: this.client.capabilities
    });
  }

  async createSnapshot(command = {}) {
    const weekGroup = normalizeWeekGroup(command.weekGroup);
    const archivedAt = normalizeTimestamp(command.archivedAt) || new Date().toISOString();
    const busData = Array.isArray(command.busData) ? command.busData : null;
    const dormData = Array.isArray(command.dormData) ? command.dormData : null;
    const archiveKind = ARCHIVE_KINDS.includes(normalizeText(command.archiveKind).toLowerCase())
      ? normalizeText(command.archiveKind).toLowerCase()
      : 'closeout';
    const operationId = normalizeText(command.operationId);
    const parentArchiveId = normalizeText(command.parentArchiveId);
    const amendmentReason = normalizeText(command.amendmentReason);
    const amendmentNumber = toNonNegativeNumber(command.amendmentNumber);

    if (!weekGroup) return validationFailure('Week Group is required to create an archive snapshot.');
    if (!busData || !dormData) return validationFailure('Archive snapshots require busData and dormData arrays.');
    if (!operationId) return validationFailure('Archive snapshots require an operation id.');
    if (archiveKind === 'amendment' && (!parentArchiveId || !amendmentReason)) {
      return validationFailure('Archive amendments require a parent archive id and amendment reason.');
    }

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
      archive_kind: archiveKind,
      operation_id: operationId,
      parent_archive_id: parentArchiveId,
      amendment_reason: amendmentReason,
      amendment_number: amendmentNumber,
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
    }, { actorRole: command.actorRole, timestamp: archivedAt });
  }

  async deleteSnapshot(id, command = {}) {
    return this.deleteById(id, {
      actorRole: command.actorRole,
      timestamp: command.updatedAt,
      requireConflictDetection: command.requireConflictDetection
    });
  }
}
