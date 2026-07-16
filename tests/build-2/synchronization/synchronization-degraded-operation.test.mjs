import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { repositoryOk } from '../../../public/app/data/repository-result.mjs';
import { createShellStore, selectConnectivityAnnouncement } from '../../../public/app/shell/index.mjs';
import {
  canPerformCriticalWrite,
  createAuthoritativeSnapshotStore,
  createBroadcastInvalidationChannel,
  createGuardedRecordsClient,
  createInvalidationNotice,
  createSyncState,
  createSynchronizationCoordinator,
  reduceSyncState,
  validateInvalidationNotice,
  validateSyncState,
  connectSynchronizationToShell
} from '../../../public/app/synchronization/index.mjs';
import {
  GATE_STATIC_SHELL_ASSETS,
  isAuthoritativeApiRequest,
  isCacheableShellRequest,
  validateCachePolicy
} from '../../../public/app/offline/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, '../../..');
const tick = () => new Promise(resolveTick => setTimeout(resolveTick, 0));

async function repositoryFile(path) {
  return readFile(resolve(repositoryRoot, path), 'utf8');
}

function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    emit(type) {
      for (const listener of listeners.get(type) || []) listener({ type });
    }
  };
}

function createManualChannel() {
  let listener = null;
  const published = [];
  return {
    published,
    subscribe(next) { listener = next; return () => { listener = null; }; },
    publish(notice) { published.push(notice); return true; },
    emit(notice) { listener?.(notice); }
  };
}

class FakeBroadcastChannel {
  static channels = new Map();
  constructor(name) {
    this.name = name;
    this.onmessage = null;
    if (!FakeBroadcastChannel.channels.has(name)) FakeBroadcastChannel.channels.set(name, new Set());
    FakeBroadcastChannel.channels.get(name).add(this);
  }
  postMessage(data) {
    for (const instance of FakeBroadcastChannel.channels.get(this.name) || []) {
      if (instance !== this) instance.onmessage?.({ data });
    }
  }
  close() {
    FakeBroadcastChannel.channels.get(this.name)?.delete(this);
  }
}

test('synchronization state is deterministic and critical writes require current authoritative data', () => {
  const initial = createSyncState({ online: true });
  const syncing = reduceSyncState(initial, { type: 'sync.started', startedAt: '2026-07-15T20:00:00Z' });
  const current = reduceSyncState(syncing, { type: 'sync.succeeded', completedAt: '2026-07-15T20:00:02Z' });
  const stale = reduceSyncState(current, { type: 'time.checked', checkedAt: '2026-07-15T20:06:00Z' });
  assert.equal(canPerformCriticalWrite(initial), false);
  assert.equal(canPerformCriticalWrite(syncing), false);
  assert.equal(canPerformCriticalWrite(current), true);
  assert.equal(canPerformCriticalWrite(stale), false);
  assert.deepEqual(validateSyncState(current), { valid: true, errors: [] });
  assert.equal(stale.status, 'stale');
});

test('cross-tab notices contain identifiers only and reject operational payloads', () => {
  const notice = createInvalidationNotice({
    entityType: 'bus', entityId: 'bus-1', weekGroup: 'WG', operationId: 'op-1',
    occurredAt: '2026-07-15T20:00:00Z', originId: 'tab-a'
  });
  assert.deepEqual(Object.keys(notice), ['kind', 'contractVersion', 'entityType', 'entityId', 'weekGroup', 'operationId', 'occurredAt', 'originId']);
  assert.deepEqual(validateInvalidationNotice({ ...notice, records: [{ total: 44 }] }).valid, false);
  assert.throws(() => createInvalidationNotice({ ...notice, data: { total: 44 } }), /prohibited fields/i);
});

test('BroadcastChannel invalidation ignores the sender and informs other tabs', () => {
  const a = createBroadcastInvalidationChannel({ BroadcastChannelImpl: FakeBroadcastChannel, originId: 'tab-a' });
  const b = createBroadcastInvalidationChannel({ BroadcastChannelImpl: FakeBroadcastChannel, originId: 'tab-b' });
  const receivedA = [];
  const receivedB = [];
  a.subscribe(notice => receivedA.push(notice));
  b.subscribe(notice => receivedB.push(notice));
  a.publish({ entityType: 'dorm', entityId: 'dorm-1', weekGroup: 'WG', occurredAt: '2026-07-15T20:00:00Z' });
  assert.equal(receivedA.length, 0);
  assert.equal(receivedB.length, 1);
  assert.equal(receivedB[0].entityId, 'dorm-1');
  a.close();
  b.close();
});

test('coordinator refetches authoritative records after cross-tab invalidation', async () => {
  const store = createAuthoritativeSnapshotStore();
  const channel = createManualChannel();
  const eventTarget = createEventTarget();
  let listCalls = 0;
  const client = {
    async list() {
      listCalls += 1;
      return repositoryOk({ records: Object.freeze([{ id: `record-${listCalls}` }]), warnings: Object.freeze([]) });
    }
  };
  const times = ['2026-07-15T20:00:00Z', '2026-07-15T20:00:01Z', '2026-07-15T20:01:00Z', '2026-07-15T20:01:01Z'];
  const coordinator = createSynchronizationCoordinator({
    client, channel, store, eventTarget, navigatorLike: { onLine: true }, now: () => times.shift()
  });
  const started = await coordinator.start();
  assert.equal(started.ok, true);
  assert.equal(coordinator.getState().status, 'current');
  assert.equal(store.read().records[0].id, 'record-1');

  channel.emit(createInvalidationNotice({
    entityType: 'bus', entityId: 'bus-1', weekGroup: 'WG', occurredAt: '2026-07-15T20:00:30Z', originId: 'tab-b'
  }));
  await tick();
  assert.equal(listCalls, 2);
  assert.equal(coordinator.getState().status, 'current');
  assert.equal(store.read().records[0].id, 'record-2');
  coordinator.stop();
});

test('offline operation preserves last-confirmed data and blocks writes without queuing', async () => {
  const store = createAuthoritativeSnapshotStore();
  store.replace([{ id: 'confirmed-1' }], { synchronizedAt: '2026-07-15T20:00:00Z' });
  let state = createSyncState({ status: 'current', online: true, authoritative: true, lastSyncedAt: '2026-07-15T20:00:00Z' });
  let writes = 0;
  const client = {
    capabilities: {},
    list: async () => repositoryOk({ records: [] }),
    create: async () => { writes += 1; return repositoryOk({ id: 'new' }); },
    update: async () => { writes += 1; return repositoryOk({ id: 'updated' }); },
    delete: async () => { writes += 1; return repositoryOk({ id: 'deleted' }); }
  };
  const guarded = createGuardedRecordsClient({ client, getSyncState: () => state });
  assert.equal((await guarded.create({})).ok, true);
  state = reduceSyncState(state, { type: 'connectivity.changed', online: false });
  store.markStale('offline');
  const blocked = await guarded.update({});
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error.code, 'degraded_read_only');
  assert.equal(blocked.error.details.queued, false);
  assert.equal(writes, 1);
  assert.equal(store.read().records[0].id, 'confirmed-1');
  assert.equal(store.read().stale, true);
  assert.equal(guarded.capabilities.offlineWriteQueue, false);
});

test('synchronization state bridges into explicit shell degraded-operation announcements', async () => {
  const store = createAuthoritativeSnapshotStore();
  const channel = createManualChannel();
  const eventTarget = createEventTarget();
  const coordinator = createSynchronizationCoordinator({
    client: { list: async () => repositoryOk({ records: [] }) },
    channel,
    store,
    eventTarget,
    navigatorLike: { onLine: true },
    now: () => '2026-07-15T20:00:00Z'
  });
  const shellStore = createShellStore({ role: 'instructor' });
  const disconnect = connectSynchronizationToShell({ coordinator, shellStore });
  await coordinator.start();
  assert.equal(shellStore.getState().connectivity.status, 'current');
  eventTarget.emit('offline');
  assert.equal(shellStore.getState().connectivity.readOnly, true);
  assert.match(selectConnectivityAnnouncement(shellStore.getState()), /Offline/i);
  disconnect();
  coordinator.stop();
});

test('cache policy permits static Build 2 shell assets and keeps APIs network-only', () => {
  assert.deepEqual(validateCachePolicy(), { valid: true, errors: [] });
  assert.equal(GATE_STATIC_SHELL_ASSETS.length > 5, true);
  assert.equal(isCacheableShellRequest({ method: 'GET', url: 'https://gate.test/app/shell/gate-shell.css' }), true);
  assert.equal(isCacheableShellRequest({ method: 'POST', url: 'https://gate.test/app/shell/gate-shell.css' }), false);
  assert.equal(isAuthoritativeApiRequest('https://gate.test/api/records'), true);
  assert.equal(isCacheableShellRequest({ method: 'GET', url: 'https://gate.test/api/records' }), false);
});

test('synchronization source has no operational local database or write queue', async () => {
  const source = [
    await repositoryFile('public/app/synchronization/sync-state.mjs'),
    await repositoryFile('public/app/synchronization/authoritative-store.mjs'),
    await repositoryFile('public/app/synchronization/invalidation-channel.mjs'),
    await repositoryFile('public/app/synchronization/guarded-records-client.mjs'),
    await repositoryFile('public/app/synchronization/sync-coordinator.mjs')
  ].join('\n');
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|IDBDatabase/i);
  assert.doesNotMatch(source, /queue(?:Write|Record|Mutation)|pendingWrites/i);
  assert.match(source, /offlineWriteQueue: false/);
});

test('service worker caches only the allowlisted shell and never intercepts API data into cache', async () => {
  const serviceWorker = await repositoryFile('public/gate-build-2-sw.js');
  assert.match(serviceWorker, /isAuthoritativeApiRequest/);
  assert.match(serviceWorker, /event\.respondWith\(fetch\(request\)\)/);
  assert.match(serviceWorker, /GATE_STATIC_SHELL_ASSETS/);
  assert.doesNotMatch(serviceWorker, /indexedDB|localStorage|\/api\/records.*cache|backgroundSync|sync\.register/i);
});

test('Build 1 runtime does not register Gate E synchronization or service-worker assets', async () => {
  const middleware = await repositoryFile('functions/_middleware.js');
  const index = await repositoryFile('public/index.html');
  assert.doesNotMatch(middleware, /app\/synchronization|app\/offline|gate-build-2-sw/);
  assert.doesNotMatch(index, /gate-build-2-sw|registerGateShellServiceWorker|app\/synchronization/);
});
