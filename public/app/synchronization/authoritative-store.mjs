function cloneRecords(records = []) {
  return Object.freeze([...(Array.isArray(records) ? records : [])]);
}

function freezeSnapshot(snapshot) {
  return Object.freeze({
    ...snapshot,
    records: cloneRecords(snapshot.records)
  });
}

export function createAuthoritativeSnapshotStore() {
  let snapshot = freezeSnapshot({
    version: 0,
    records: [],
    lastSyncedAt: null,
    stale: true,
    reason: 'not_synchronized'
  });
  const listeners = new Set();

  function publish(previous) {
    for (const listener of listeners) listener(snapshot, previous);
  }

  return Object.freeze({
    read() {
      return snapshot;
    },

    replace(records, { synchronizedAt } = {}) {
      const previous = snapshot;
      snapshot = freezeSnapshot({
        version: previous.version + 1,
        records,
        lastSyncedAt: synchronizedAt || previous.lastSyncedAt,
        stale: false,
        reason: null
      });
      publish(previous);
      return snapshot;
    },

    markStale(reason = 'refresh_required') {
      if (snapshot.stale && snapshot.reason === reason) return snapshot;
      const previous = snapshot;
      snapshot = freezeSnapshot({ ...snapshot, stale: true, reason });
      publish(previous);
      return snapshot;
    },

    clear() {
      const previous = snapshot;
      snapshot = freezeSnapshot({
        version: previous.version + 1,
        records: [],
        lastSyncedAt: null,
        stale: true,
        reason: 'cleared'
      });
      publish(previous);
      return snapshot;
    },

    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('A snapshot listener is required.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  });
}
