export function shellEventFromSyncState(state, event = {}) {
  if (!state) return null;
  if (event.type === 'invalidation.received') {
    return Object.freeze({ type: 'sync.invalidated', message: state.message });
  }
  if (state.status === 'syncing') {
    return Object.freeze({ type: 'sync.started', startedAt: state.lastAttemptAt, message: state.message });
  }
  if (state.status === 'current') {
    return Object.freeze({
      type: 'sync.completed',
      completedAt: state.lastSyncedAt,
      connectivityMessage: state.message,
      message: 'Authoritative state current.'
    });
  }
  if (state.status === 'offline') {
    return Object.freeze({ type: 'connectivity.changed', online: false, lastSyncedAt: state.lastSyncedAt, message: state.message });
  }
  if (state.status === 'stale') {
    return Object.freeze({ type: 'sync.invalidated', message: state.message });
  }
  if (state.status === 'failed') {
    return Object.freeze({ type: 'sync.failed', failedAt: state.lastAttemptAt, message: state.message });
  }
  return Object.freeze({ type: 'connectivity.changed', online: state.online, lastSyncedAt: state.lastSyncedAt, message: state.message });
}

export function connectSynchronizationToShell({ coordinator, shellStore } = {}) {
  if (!coordinator || typeof coordinator.subscribe !== 'function') throw new TypeError('A synchronization coordinator is required.');
  if (!shellStore || typeof shellStore.dispatch !== 'function') throw new TypeError('A shell store is required.');
  return coordinator.subscribe((state, _previous, event) => {
    const shellEvent = shellEventFromSyncState(state, event);
    if (shellEvent) shellStore.dispatch(shellEvent);
  });
}
