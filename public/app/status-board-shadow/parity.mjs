import {
  freezeShadow,
  parseTimerDisplay,
  shadowText,
  STATUS_BOARD_SHADOW_VERSION,
  STATUS_BOARD_TIMER_POLICY
} from './contracts.mjs';

function sameArray(left = [], right = []) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameObject(left = {}, right = {}) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function check(metric, legacy, canonical, status, { blocking = true, detail = '' } = {}) {
  return Object.freeze({ metric, legacy, canonical, status, blocking, detail });
}

function timerMap(timers = []) {
  return new Map((Array.isArray(timers) ? timers : []).map(timer => [timer.dormId, timer]));
}

function compareTimerDisplay(legacyTimers, canonicalTimers, policy) {
  const legacy = timerMap(legacyTimers);
  const canonical = timerMap(canonicalTimers);
  const ids = [...new Set([...legacy.keys(), ...canonical.keys()])].sort();
  const missing = [];
  const mismatched = [];
  const tolerated = [];

  for (const id of ids) {
    const left = legacy.get(id);
    const right = canonical.get(id);
    if (!left || !right) {
      missing.push(id);
      continue;
    }
    const leftSeconds = parseTimerDisplay(left.display);
    const rightSeconds = parseTimerDisplay(right.display);
    if (leftSeconds === null || rightSeconds === null) {
      if (shadowText(left.display) !== shadowText(right.display)) mismatched.push(id);
      continue;
    }
    const delta = Math.abs(leftSeconds - rightSeconds);
    if (delta > policy.displayToleranceSeconds) mismatched.push(id);
    else if (delta > 0) tolerated.push(id);
  }

  if (missing.length || mismatched.length) {
    return check('timerDisplay',
      { count: legacy.size },
      { count: canonical.size },
      'mismatch',
      { detail: `Missing: ${missing.join(', ') || 'none'}; outside tolerance: ${mismatched.join(', ') || 'none'}` }
    );
  }
  if (tolerated.length) {
    return check('timerDisplay',
      { count: legacy.size },
      { count: canonical.size },
      'tolerated',
      { blocking: false, detail: `Within ${policy.displayToleranceSeconds}s tolerance: ${tolerated.join(', ')}` }
    );
  }
  return check('timerDisplay', { count: legacy.size }, { count: canonical.size }, 'exact', { blocking: false });
}

function compareTimerProperty(metric, legacyTimers, canonicalTimers, property) {
  const legacy = timerMap(legacyTimers);
  const canonical = timerMap(canonicalTimers);
  const ids = [...new Set([...legacy.keys(), ...canonical.keys()])].sort();
  const differences = ids.filter(id => !legacy.has(id) || !canonical.has(id) || legacy.get(id)?.[property] !== canonical.get(id)?.[property]);
  return differences.length
    ? check(metric, { count: legacy.size }, { count: canonical.size }, 'mismatch', { detail: `Different dorms: ${differences.join(', ')}` })
    : check(metric, { count: legacy.size }, { count: canonical.size }, 'exact', { blocking: false });
}

export function compareStatusBoardSnapshots({
  legacy,
  canonical,
  timerPolicy = STATUS_BOARD_TIMER_POLICY
} = {}) {
  if (!legacy || !canonical) {
    return freezeShadow({
      contractVersion: STATUS_BOARD_SHADOW_VERSION,
      status: 'unavailable',
      weekGroup: shadowText(legacy?.weekGroup || canonical?.weekGroup),
      capturedAt: shadowText(legacy?.capturedAt || canonical?.capturedAt),
      checks: [],
      summary: { total: 0, exact: 0, tolerated: 0, mismatched: 0, unavailable: 1 },
      blockingMetrics: ['snapshot']
    });
  }

  const checks = [
    check('arrived', legacy.metrics.arrived, canonical.metrics.arrived, legacy.metrics.arrived === canonical.metrics.arrived ? 'exact' : 'mismatch'),
    check('expected', legacy.metrics.expected, canonical.metrics.expected, legacy.metrics.expected === canonical.metrics.expected ? 'exact' : 'mismatch'),
    check('lastArrival', legacy.metrics.lastArrival, canonical.metrics.lastArrival, legacy.metrics.lastArrival === canonical.metrics.lastArrival ? 'exact' : 'mismatch', {
      detail: legacy.metrics.lastArrival === canonical.metrics.lastArrival ? '' : 'Build 1 displays last_airport configuration while Build 2 derives the latest confirmed arrival.'
    }),
    check('activeBusIds', legacy.activeBusIds, canonical.activeBusIds, sameArray(legacy.activeBusIds, canonical.activeBusIds) ? 'exact' : 'mismatch'),
    check('dormStateCounts', legacy.dorms.counts, canonical.dorms.counts, sameObject(legacy.dorms.counts, canonical.dorms.counts) ? 'exact' : 'mismatch'),
    check('dormIdsByState', legacy.dorms.idsByState, canonical.dorms.idsByState, sameObject(legacy.dorms.idsByState, canonical.dorms.idsByState) ? 'exact' : 'mismatch'),
    compareTimerDisplay(legacy.timers, canonical.timers, timerPolicy),
    compareTimerProperty('timerTone', legacy.timers, canonical.timers, 'tone'),
    compareTimerProperty('timerOvertime', legacy.timers, canonical.timers, 'overtime')
  ];

  const summary = {
    total: checks.length,
    exact: checks.filter(item => item.status === 'exact').length,
    tolerated: checks.filter(item => item.status === 'tolerated').length,
    mismatched: checks.filter(item => item.status === 'mismatch').length,
    unavailable: checks.filter(item => item.status === 'unavailable').length
  };
  const blockingMetrics = checks.filter(item => item.blocking && ['mismatch', 'unavailable'].includes(item.status)).map(item => item.metric);
  const status = blockingMetrics.length
    ? 'divergent'
    : summary.unavailable
      ? 'unavailable'
      : summary.tolerated
        ? 'tolerated'
        : 'exact';

  return freezeShadow({
    contractVersion: STATUS_BOARD_SHADOW_VERSION,
    status,
    weekGroup: canonical.weekGroup || legacy.weekGroup,
    capturedAt: canonical.capturedAt || legacy.capturedAt,
    checks,
    summary,
    blockingMetrics
  });
}
