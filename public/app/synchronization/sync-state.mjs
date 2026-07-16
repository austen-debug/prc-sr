export const SYNC_STATUSES = Object.freeze([
  'unknown',
  'syncing',
  'current',
  'offline',
  'stale',
  'failed'
]);

function text(value) {
  return String(value ?? '').trim();
}

function validTime(value) {
  const candidate = text(value);
  return candidate && Number.isFinite(Date.parse(candidate)) ? candidate : null;
}

function freeze(state) {
  return Object.freeze({ ...state });
}

export function createSyncState(input = {}) {
  const online = input.online !== false;
  const lastSyncedAt = validTime(input.lastSyncedAt);
  const status = SYNC_STATUSES.includes(input.status)
    ? input.status
    : online
      ? lastSyncedAt
        ? 'current'
        : 'unknown'
      : 'offline';
  const stale = Boolean(input.stale) || ['offline', 'stale', 'failed'].includes(status);
  const authoritative = input.authoritative === true || (status === 'current' && !stale);

  return freeze({
    contractVersion: 'E.1.0',
    status,
    online,
    authoritative,
    stale,
    refreshRequired: Boolean(input.refreshRequired),
    lastSyncedAt,
    lastAttemptAt: validTime(input.lastAttemptAt),
    staleAfterMs: Math.max(1000, Number(input.staleAfterMs) || 300000),
    message: text(input.message),
    errorCode: text(input.errorCode) || null
  });
}

export function reduceSyncState(state, event = {}) {
  const current = state || createSyncState();
  const type = text(event.type);

  if (type === 'connectivity.changed') {
    const online = Boolean(event.online);
    if (!online) {
      return freeze({
        ...current,
        status: 'offline',
        online: false,
        authoritative: false,
        stale: true,
        refreshRequired: true,
        message: text(event.message) || 'Offline. Showing last confirmed data.',
        errorCode: 'offline'
      });
    }
    return freeze({
      ...current,
      online: true,
      status: current.lastSyncedAt ? 'stale' : 'unknown',
      authoritative: false,
      stale: Boolean(current.lastSyncedAt),
      refreshRequired: true,
      message: text(event.message) || 'Connection restored. Refresh required.',
      errorCode: null
    });
  }

  if (type === 'sync.started') {
    return freeze({
      ...current,
      status: 'syncing',
      online: true,
      authoritative: false,
      stale: Boolean(current.lastSyncedAt),
      refreshRequired: true,
      lastAttemptAt: validTime(event.startedAt) || current.lastAttemptAt,
      message: text(event.message) || 'Synchronizing authoritative records.',
      errorCode: null
    });
  }

  if (type === 'sync.succeeded') {
    const completedAt = validTime(event.completedAt) || current.lastAttemptAt || current.lastSyncedAt;
    return freeze({
      ...current,
      status: 'current',
      online: true,
      authoritative: true,
      stale: false,
      refreshRequired: false,
      lastSyncedAt: completedAt,
      lastAttemptAt: completedAt,
      message: text(event.message) || 'Authoritative records synchronized.',
      errorCode: null
    });
  }

  if (type === 'sync.failed') {
    return freeze({
      ...current,
      status: current.online ? 'failed' : 'offline',
      authoritative: false,
      stale: true,
      refreshRequired: true,
      lastAttemptAt: validTime(event.failedAt) || current.lastAttemptAt,
      message: text(event.message) || 'Authoritative synchronization failed.',
      errorCode: text(event.errorCode) || 'sync_failed'
    });
  }

  if (type === 'invalidation.received') {
    return freeze({
      ...current,
      status: current.online ? 'stale' : 'offline',
      authoritative: false,
      stale: true,
      refreshRequired: true,
      message: 'Another GATE session changed operational records. Refresh required.',
      errorCode: null
    });
  }

  if (type === 'time.checked') {
    const checkedAt = validTime(event.checkedAt);
    if (!checkedAt || !current.lastSyncedAt || current.status !== 'current') return current;
    const age = Date.parse(checkedAt) - Date.parse(current.lastSyncedAt);
    if (age <= current.staleAfterMs) return current;
    return freeze({
      ...current,
      status: 'stale',
      authoritative: false,
      stale: true,
      refreshRequired: true,
      message: 'Authoritative data is older than the approved synchronization interval.',
      errorCode: 'stale_timeout'
    });
  }

  return current;
}

export function canPerformCriticalWrite(state) {
  return Boolean(
    state?.online === true &&
    state?.status === 'current' &&
    state?.authoritative === true &&
    state?.stale === false &&
    state?.refreshRequired === false
  );
}

export function validateSyncState(state) {
  const errors = [];
  if (!state || typeof state !== 'object') return Object.freeze({ valid: false, errors: Object.freeze(['Synchronization state is required.']) });
  if (!SYNC_STATUSES.includes(state.status)) errors.push('Invalid synchronization status.');
  if (state.authoritative && state.stale) errors.push('Stale state cannot be authoritative.');
  if (state.authoritative && !state.online) errors.push('Offline state cannot be authoritative.');
  if (state.status === 'current' && !state.lastSyncedAt) errors.push('Current state requires lastSyncedAt.');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
