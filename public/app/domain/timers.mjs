import { normalizeText } from './normalization.mjs';

function toEpoch(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(normalizeText(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseElapsedMMSS(value) {
  const match = /^(\d+):([0-5]\d)$/.exec(normalizeText(value));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatElapsedMMSS(totalSeconds = 0) {
  const seconds = Math.max(0, Math.trunc(Number(totalSeconds) || 0));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function calculateElapsedSeconds({ openedAt, closedAt, closedTimer, now } = {}) {
  const preserved = parseElapsedMMSS(closedTimer);
  if (preserved !== null) return Object.freeze({ seconds: preserved, source: 'closed_timer' });

  const start = toEpoch(openedAt);
  const end = toEpoch(closedAt) ?? toEpoch(now);
  if (start === null || end === null || end < start) return Object.freeze({ seconds: 0, source: 'unavailable' });
  return Object.freeze({
    seconds: Math.floor((end - start) / 1000),
    source: closedAt ? 'timestamps' : 'running_clock'
  });
}

export function calculateTimerState({
  state = 'empty',
  openedAt = null,
  closedAt = null,
  closedTimer = '',
  now = null,
  overtimeThresholdSeconds = 15 * 60
} = {}) {
  const normalizedState = normalizeText(state).toLowerCase();
  const elapsed = calculateElapsedSeconds({ openedAt, closedAt, closedTimer, now });
  const running = normalizedState === 'open' && elapsed.source === 'running_clock';
  const overtime = running && elapsed.seconds >= Math.max(0, Number(overtimeThresholdSeconds) || 0);
  return Object.freeze({
    state: normalizedState || 'empty',
    running,
    overtime,
    elapsedSeconds: elapsed.seconds,
    display: formatElapsedMMSS(elapsed.seconds),
    source: elapsed.source
  });
}
