export const STATUS_BOARD_SHADOW_VERSION = '3A.1.0';

export const STATUS_BOARD_TIMER_POLICY = Object.freeze({
  warningSeconds: 40 * 60,
  criticalSeconds: 50 * 60,
  overtimeSeconds: 60 * 60,
  displayToleranceSeconds: 2
});

export const STATUS_BOARD_SHADOW_STATUSES = Object.freeze([
  'exact',
  'tolerated',
  'divergent',
  'unavailable'
]);

export const STATUS_BOARD_SHADOW_METRICS = Object.freeze([
  'arrived',
  'expected',
  'lastArrival',
  'activeBusIds',
  'dormStateCounts',
  'dormIdsByState',
  'timerDisplay',
  'timerTone',
  'timerOvertime'
]);

export function shadowText(value) {
  return String(value ?? '').trim();
}

export function shadowNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sortedUnique(values = []) {
  return Object.freeze([...new Set((Array.isArray(values) ? values : []).map(shadowText).filter(Boolean))].sort());
}

export function timerTone(elapsedSeconds = 0, running = false, policy = STATUS_BOARD_TIMER_POLICY) {
  if (!running) return 'settled';
  const seconds = Math.max(0, shadowNumber(elapsedSeconds));
  if (seconds >= policy.criticalSeconds) return 'critical';
  if (seconds >= policy.warningSeconds) return 'warning';
  return 'normal';
}

export function parseTimerDisplay(value) {
  const match = /^(\d+):([0-5]\d)$/.exec(shadowText(value));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function freezeShadow(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeShadow(child);
  return value;
}
