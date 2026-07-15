import { normalizeText, normalizeWeekGroup } from './normalization.mjs';
import {
  calculateCapacityTotals,
  calculateLoadTotals,
  selectDorms
} from './operational-metrics.mjs';

export const DORM_STATES = Object.freeze(['empty', 'open', 'closed']);

export function normalizeDormState(value) {
  const state = normalizeText(value).toLowerCase();
  return DORM_STATES.includes(state) ? state : 'empty';
}

export function groupDormsByState(records = [], weekGroup = '') {
  const groups = { empty: [], open: [], closed: [], other: [] };
  for (const dorm of selectDorms(records, weekGroup)) {
    const state = normalizeText(dorm.state).toLowerCase();
    if (DORM_STATES.includes(state)) groups[state].push(dorm);
    else groups.other.push(dorm);
  }
  return Object.freeze({
    empty: Object.freeze(groups.empty),
    open: Object.freeze(groups.open),
    closed: Object.freeze(groups.closed),
    other: Object.freeze(groups.other)
  });
}

export function calculateDormStateCounts(records = [], weekGroup = '') {
  const groups = groupDormsByState(records, weekGroup);
  return Object.freeze({
    weekGroup: normalizeWeekGroup(weekGroup),
    empty: groups.empty.length,
    open: groups.open.length,
    closed: groups.closed.length,
    other: groups.other.length,
    total: groups.empty.length + groups.open.length + groups.closed.length + groups.other.length
  });
}

export function buildDormSummary(records = [], weekGroup = '') {
  return Object.freeze({
    weekGroup: normalizeWeekGroup(weekGroup),
    groups: groupDormsByState(records, weekGroup),
    stateCounts: calculateDormStateCounts(records, weekGroup),
    capacity: calculateCapacityTotals(records, weekGroup),
    loads: calculateLoadTotals(records, weekGroup)
  });
}
