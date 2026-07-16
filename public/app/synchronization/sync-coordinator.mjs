import { createSyncState, reduceSyncState } from './sync-state.mjs';

function text(value) {
  return String(value ?? '').trim();
}

function timestamp(now) {
  const value = typeof now === 'function' ? now() : new Date().toISOString();
  return text(value) || new Date().toISOString();
}

export function createSynchronizationCoordinator({
  client,
  channel,
  store,
  eventTarget = globalThis,
  navigatorLike = globalThis.navigator,
  now = () => new Date().toISOString(),
  staleAfterMs = 300000
} = {}) {
  if (!client || typeof client.list !== 'function') throw new TypeError('A readable records client is required.');
  if (!store || typeof store.replace !== 'function' || typeof store.markStale !== 'function') throw new TypeError('An authoritative snapshot store is required.');

  let state = createSyncState({
    online: navigatorLike?.onLine !== false,
    staleAfterMs
  });
  let started = false;
  let unsubscribeChannel = null;
  const listeners = new Set();

  function transition(event) {
    const previous = state;
    state = reduceSyncState(state, event);
    if (state !== previous) {
      for (const listener of listeners) listener(state, previous, event);
    }
    return state;
  }

  async function refetch({ reason = 'manual' } = {}) {
    if (state.online === false) {
      store.markStale('offline');
      return Object.freeze({ ok: false, state, snapshot: store.read(), reason: 'offline' });
    }

    const startedAt = timestamp(now);
    transition({ type: 'sync.started', startedAt, message: `Synchronizing authoritative records (${reason}).` });
    const result = await client.list();
    if (!result?.ok) {
      const errorCode = result?.error?.code || 'sync_failed';
      store.markStale(errorCode);
      transition({
        type: 'sync.failed',
        failedAt: timestamp(now),
        errorCode,
        message: result?.error?.message || 'Authoritative synchronization failed.'
      });
      return Object.freeze({ ok: false, state, snapshot: store.read(), error: result?.error || null });
    }

    const completedAt = timestamp(now);
    const records = result.data?.records || result.data || [];
    const snapshot = store.replace(records, { synchronizedAt: completedAt });
    transition({ type: 'sync.succeeded', completedAt });
    return Object.freeze({ ok: true, state, snapshot });
  }

  function receiveInvalidation(notice) {
    store.markStale('cross_tab_invalidation');
    transition({ type: 'invalidation.received', notice });
    void refetch({ reason: 'cross-tab invalidation' });
  }

  function handleOffline() {
    store.markStale('offline');
    transition({ type: 'connectivity.changed', online: false });
  }

  function handleOnline() {
    transition({ type: 'connectivity.changed', online: true });
    void refetch({ reason: 'connection restored' });
  }

  return Object.freeze({
    getState() {
      return state;
    },

    readSnapshot() {
      return store.read();
    },

    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('A synchronization listener is required.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async start({ initialRefetch = true } = {}) {
      if (started) return Object.freeze({ ok: true, state, snapshot: store.read(), unchanged: true });
      started = true;
      unsubscribeChannel = channel?.subscribe?.(receiveInvalidation) || null;
      eventTarget?.addEventListener?.('offline', handleOffline);
      eventTarget?.addEventListener?.('online', handleOnline);
      if (navigatorLike?.onLine === false) {
        handleOffline();
        return Object.freeze({ ok: false, state, snapshot: store.read(), reason: 'offline' });
      }
      return initialRefetch ? refetch({ reason: 'startup' }) : Object.freeze({ ok: true, state, snapshot: store.read() });
    },

    stop() {
      if (!started) return;
      started = false;
      unsubscribeChannel?.();
      unsubscribeChannel = null;
      eventTarget?.removeEventListener?.('offline', handleOffline);
      eventTarget?.removeEventListener?.('online', handleOnline);
    },

    refetch,

    checkFreshness(checkedAt = timestamp(now)) {
      return transition({ type: 'time.checked', checkedAt });
    },

    publishInvalidation(input = {}) {
      return channel?.publish?.({ ...input, occurredAt: input.occurredAt || timestamp(now) }) || false;
    }
  });
}
