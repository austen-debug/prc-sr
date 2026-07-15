import { normalizeText, normalizeWeekGroup } from './normalization.mjs';
import {
  calculateCapacityTotals,
  calculateConfirmedArrivalTotals,
  calculateLoadTotals,
  selectConfirmedArrivals,
  selectDorms
} from './operational-metrics.mjs';
import { buildArchiveReportModel } from './reports.mjs';

export const ARCHIVE_SNAPSHOT_SCHEMA_VERSION = '2A.1.0';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function archiveBus(bus) {
  return {
    id: bus.id,
    busId: bus.busId,
    busType: bus.busType,
    status: bus.status,
    total: bus.total,
    female: bus.female,
    naturalization: bus.naturalization,
    spaceForce: bus.spaceForce,
    airForce: bus.airForce,
    arrivedAt: bus.arrivedAt,
    departedAt: bus.departedAt
  };
}

function archiveDorm(dorm) {
  return {
    id: dorm.id,
    name: dorm.name,
    sdq: dorm.sdq,
    state: dorm.state,
    phase: dorm.phase,
    capacity: dorm.capacity,
    load: dorm.load,
    spaceForce: dorm.spaceForce,
    openedAt: dorm.openedAt,
    closedAt: dorm.closedAt,
    closedTimer: dorm.closedTimer
  };
}

export function buildArchiveSnapshot({
  records = [],
  weekGroup = '',
  windows = {},
  archivedAt = '',
  generatedAt = archivedAt
} = {}) {
  const normalizedWeekGroup = normalizeWeekGroup(weekGroup);
  const archivedTimestamp = normalizeText(archivedAt);
  if (!normalizedWeekGroup) throw new TypeError('Week Group is required to build an archive snapshot.');
  if (!archivedTimestamp || !Number.isFinite(Date.parse(archivedTimestamp))) {
    throw new TypeError('A valid archivedAt timestamp is required to build an archive snapshot.');
  }

  const projected = calculateCapacityTotals(records, normalizedWeekGroup);
  const confirmed = calculateConfirmedArrivalTotals(records, normalizedWeekGroup);
  const loads = calculateLoadTotals(records, normalizedWeekGroup);
  const buses = selectConfirmedArrivals(records, normalizedWeekGroup).map(archiveBus);
  const dorms = selectDorms(records, normalizedWeekGroup).map(archiveDorm);
  const receivingDocument = buildArchiveReportModel({
    records,
    weekGroup: normalizedWeekGroup,
    windows,
    generatedAt,
    archivedAt: archivedTimestamp
  });

  return deepFreeze({
    schemaVersion: ARCHIVE_SNAPSHOT_SCHEMA_VERSION,
    weekGroup: normalizedWeekGroup,
    archivedAt: new Date(archivedTimestamp).toISOString(),
    projected: {
      total: projected.total,
      airForce: projected.airForce,
      spaceForce: projected.spaceForce
    },
    confirmed: {
      total: confirmed.total,
      airForce: confirmed.airForce,
      spaceForce: confirmed.spaceForce,
      female: confirmed.female,
      naturalization: confirmed.naturalization
    },
    loaded: {
      total: loads.loaded,
      capacity: loads.capacity
    },
    receivingWindows: { ...windows },
    buses,
    dorms,
    receivingDocument
  });
}

export function validateArchiveSnapshot(snapshot) {
  const errors = [];
  if (!snapshot || typeof snapshot !== 'object') errors.push('Archive snapshot is required.');
  if (snapshot?.schemaVersion !== ARCHIVE_SNAPSHOT_SCHEMA_VERSION) errors.push('Archive snapshot schema version is invalid.');
  if (!normalizeWeekGroup(snapshot?.weekGroup)) errors.push('Archive snapshot Week Group is required.');
  if (!Number.isFinite(Date.parse(snapshot?.archivedAt || ''))) errors.push('Archive snapshot archivedAt is invalid.');
  if (!Array.isArray(snapshot?.buses) || !Array.isArray(snapshot?.dorms)) errors.push('Archive snapshot records are invalid.');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
