import { normalizePersistedRecords } from '../data/record-normalizer.mjs';
import { buildStatusBoardSummary } from '../domain/summaries.mjs';
import {
  freezeShadow,
  shadowText,
  sortedUnique,
  timerTone,
  STATUS_BOARD_SHADOW_VERSION,
  STATUS_BOARD_TIMER_POLICY
} from './contracts.mjs';

export const STATUS_BOARD_OPERATIONAL_TIME_ZONE = 'America/Chicago';

export function formatOperationalTime(value, timeZone = STATUS_BOARD_OPERATIONAL_TIME_ZONE) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const hour = parts.find(part => part.type === 'hour')?.value;
  const minute = parts.find(part => part.type === 'minute')?.value;
  return hour && minute ? `${hour}:${minute}` : '—';
}

function canonicalTimers(summary) {
  return Object.freeze(summary.timers
    .map(entry => Object.freeze({
      dormId: shadowText(entry.dormId),
      display: entry.timer.display,
      elapsedSeconds: entry.timer.elapsedSeconds,
      tone: timerTone(entry.timer.elapsedSeconds, entry.timer.running),
      overtime: entry.timer.overtime
    }))
    .filter(entry => Boolean(entry.dormId))
    .sort((left, right) => left.dormId.localeCompare(right.dormId)));
}

function dormIdsByState(groups) {
  return Object.freeze(Object.fromEntries(['empty', 'open', 'closed', 'other'].map(state => [
    state,
    sortedUnique((groups?.[state] || []).map(dorm => dorm.id))
  ])));
}

export function buildCanonicalStatusBoardSnapshot({
  records = [],
  weekGroup = '',
  capturedAt = '',
  timeZone = STATUS_BOARD_OPERATIONAL_TIME_ZONE,
  timerPolicy = STATUS_BOARD_TIMER_POLICY
} = {}) {
  const normalization = normalizePersistedRecords(records, { timeZone });
  const summary = buildStatusBoardSummary({
    records: normalization.records,
    weekGroup,
    now: capturedAt,
    overtimeThresholdSeconds: timerPolicy.overtimeSeconds
  });
  const idsByState = dormIdsByState(summary.dorms.groups);
  const lastArrival = summary.arrivals.lastConfirmedArrival?.arrivedAt || '';

  return freezeShadow({
    contractVersion: STATUS_BOARD_SHADOW_VERSION,
    source: 'build-2-canonical',
    weekGroup: summary.weekGroup,
    capturedAt: shadowText(capturedAt),
    metrics: {
      arrived: summary.arrivals.confirmed.total,
      expected: summary.dorms.capacity.total,
      lastArrival: formatOperationalTime(lastArrival, timeZone)
    },
    activeBusIds: sortedUnique(summary.buses.active.buses.map(bus => bus.id)),
    dorms: {
      counts: {
        empty: summary.dorms.stateCounts.empty,
        open: summary.dorms.stateCounts.open,
        closed: summary.dorms.stateCounts.closed,
        other: summary.dorms.stateCounts.other
      },
      idsByState
    },
    timers: canonicalTimers(summary),
    normalization: {
      warningCount: normalization.warnings.length,
      recordCount: normalization.records.length
    }
  });
}
