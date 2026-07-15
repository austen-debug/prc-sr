import { normalizeWeekGroup } from './normalization.mjs';
import { buildWeekGroupContext } from './week-groups.mjs';
import { buildArrivalSummary } from './arrivals.mjs';
import { buildBusLogSummary } from './buses.mjs';
import { buildDormSummary } from './dorms.mjs';
import { buildProcessingSummary } from './processing.mjs';
import { calculateTimerState } from './timers.mjs';

function buildTimerEntry(dorm, now, overtimeThresholdSeconds) {
  return Object.freeze({
    dormId: dorm.id,
    name: dorm.name,
    timer: calculateTimerState({
      state: dorm.state,
      openedAt: dorm.openedAt,
      closedAt: dorm.closedAt,
      closedTimer: dorm.closedTimer,
      now,
      overtimeThresholdSeconds
    })
  });
}

export function buildStatusBoardSummary({ records = [], weekGroup = '', now = null, overtimeThresholdSeconds = 900 } = {}) {
  const normalizedWeekGroup = normalizeWeekGroup(weekGroup);
  const dorms = buildDormSummary(records, normalizedWeekGroup);
  const allDorms = [...dorms.groups.empty, ...dorms.groups.open, ...dorms.groups.closed, ...dorms.groups.other];
  return Object.freeze({
    weekGroup: normalizedWeekGroup,
    context: buildWeekGroupContext(records, normalizedWeekGroup),
    arrivals: buildArrivalSummary(records, normalizedWeekGroup),
    buses: buildBusLogSummary(records, normalizedWeekGroup),
    dorms,
    timers: Object.freeze(allDorms.map(dorm => buildTimerEntry(dorm, now, overtimeThresholdSeconds)))
  });
}

export function buildSquadronBoardSummary(options = {}) {
  const status = buildStatusBoardSummary(options);
  const limitedDorms = Object.freeze(Object.fromEntries(
    Object.entries(status.dorms.groups).map(([state, dorms]) => [state, Object.freeze(dorms.map(dorm => Object.freeze({
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
    })))])
  ));
  return Object.freeze({
    weekGroup: status.weekGroup,
    arrivals: status.arrivals,
    stateCounts: status.dorms.stateCounts,
    dorms: limitedDorms,
    timers: status.timers
  });
}

export function buildOperationalProcessingSummary(records = [], weekGroup = '') {
  return buildProcessingSummary(records, weekGroup);
}
