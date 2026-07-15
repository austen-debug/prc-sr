import { normalizeWeekGroup } from './normalization.mjs';
import {
  calculateBusTotals,
  calculateManifestedBusTotals,
  selectActiveBuses,
  selectConfirmedArrivals
} from './operational-metrics.mjs';

export function groupBusesByOperationalState(records = [], weekGroup = '') {
  const active = Object.freeze([...selectActiveBuses(records, weekGroup)]);
  const arrived = Object.freeze([...selectConfirmedArrivals(records, weekGroup)]);
  return Object.freeze({ active, arrived });
}

export function buildBusLogSummary(records = [], weekGroup = '') {
  const groups = groupBusesByOperationalState(records, weekGroup);
  return Object.freeze({
    weekGroup: normalizeWeekGroup(weekGroup),
    manifested: calculateManifestedBusTotals(records, weekGroup),
    active: Object.freeze({ buses: groups.active, ...calculateBusTotals(groups.active) }),
    arrived: Object.freeze({ buses: groups.arrived, ...calculateBusTotals(groups.arrived) })
  });
}
