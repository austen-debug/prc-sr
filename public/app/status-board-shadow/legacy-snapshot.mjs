import {
  freezeShadow,
  parseTimerDisplay,
  shadowNumber,
  shadowText,
  sortedUnique,
  STATUS_BOARD_SHADOW_VERSION,
  STATUS_BOARD_TIMER_POLICY
} from './contracts.mjs';

function normalizeState(value) {
  const state = shadowText(value).toLowerCase();
  return ['empty', 'open', 'closed'].includes(state) ? state : 'other';
}

function normalizeTimers(timers = []) {
  return Object.freeze((Array.isArray(timers) ? timers : [])
    .map(timer => {
      const display = shadowText(timer?.display) || '00:00';
      const elapsedSeconds = parseTimerDisplay(display);
      return Object.freeze({
        dormId: shadowText(timer?.dormId),
        display,
        elapsedSeconds,
        tone: shadowText(timer?.tone) || 'settled',
        overtime: Boolean(timer?.overtime) || (elapsedSeconds !== null && elapsedSeconds >= STATUS_BOARD_TIMER_POLICY.overtimeSeconds)
      });
    })
    .filter(timer => Boolean(timer.dormId))
    .sort((left, right) => left.dormId.localeCompare(right.dormId)));
}

export function buildLegacyStatusBoardSnapshot({
  weekGroup = '',
  capturedAt = '',
  arrived = 0,
  expected = 0,
  lastArrival = '—',
  activeBusIds = [],
  dorms = [],
  timers = []
} = {}) {
  const idsByState = { empty: [], open: [], closed: [], other: [] };
  for (const dorm of Array.isArray(dorms) ? dorms : []) {
    const id = shadowText(dorm?.id ?? dorm?.__backendId);
    if (!id) continue;
    idsByState[normalizeState(dorm?.state)].push(id);
  }
  for (const state of Object.keys(idsByState)) idsByState[state] = sortedUnique(idsByState[state]);

  const snapshot = {
    contractVersion: STATUS_BOARD_SHADOW_VERSION,
    source: 'build-1-visible',
    weekGroup: shadowText(weekGroup).toUpperCase(),
    capturedAt: shadowText(capturedAt),
    metrics: {
      arrived: shadowNumber(arrived),
      expected: shadowNumber(expected),
      lastArrival: shadowText(lastArrival) || '—'
    },
    activeBusIds: sortedUnique(activeBusIds),
    dorms: {
      counts: {
        empty: idsByState.empty.length,
        open: idsByState.open.length,
        closed: idsByState.closed.length,
        other: idsByState.other.length
      },
      idsByState
    },
    timers: normalizeTimers(timers)
  };

  return freezeShadow(snapshot);
}
