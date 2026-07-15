import { normalizeText, normalizeWeekGroup } from './normalization.mjs';
import { calculateAssignmentSummary, selectDorms } from './operational-metrics.mjs';
import { buildDormSummary } from './dorms.mjs';

export const DORM_TRANSITIONS = Object.freeze({
  open: Object.freeze(['empty']),
  close: Object.freeze(['open']),
  reopen: Object.freeze(['closed']),
  correctFinalTime: Object.freeze(['closed'])
});

export function normalizeProcessingPhase(value) {
  return normalizeText(value).toLowerCase().replace(/[_-]+/g, ' ');
}

export function groupDormsByPhase(records = [], weekGroup = '') {
  const groups = new Map();
  for (const dorm of selectDorms(records, weekGroup)) {
    const phase = normalizeProcessingPhase(dorm.phase) || 'unassigned';
    if (!groups.has(phase)) groups.set(phase, []);
    groups.get(phase).push(dorm);
  }
  return Object.freeze(Object.fromEntries(
    [...groups.entries()].map(([phase, dorms]) => [phase, Object.freeze(dorms)])
  ));
}

export function canTransitionDorm(dorm = {}, command = '') {
  const normalizedCommand = normalizeText(command);
  const allowedStates = DORM_TRANSITIONS[normalizedCommand];
  if (!allowedStates) return false;
  return allowedStates.includes(normalizeText(dorm.state).toLowerCase());
}

export function buildProcessingSummary(records = [], weekGroup = '') {
  return Object.freeze({
    weekGroup: normalizeWeekGroup(weekGroup),
    assignment: calculateAssignmentSummary(records, weekGroup),
    dorms: buildDormSummary(records, weekGroup),
    phases: groupDormsByPhase(records, weekGroup)
  });
}
