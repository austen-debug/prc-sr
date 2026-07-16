import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  appendShadowEvidence,
  buildCanonicalStatusBoardSnapshot,
  buildLegacyStatusBoardSnapshot,
  buildStatusBoardRouteReadinessEvidence,
  compareStatusBoardSnapshots,
  createShadowEvidenceLedger,
  createStatusBoardShadowSyncAdapter,
  runStatusBoardShadow,
  STATUS_BOARD_POSTURE_CONTRACTS,
  summarizeShadowEvidence,
  validateStatusBoardRouteContract
} from '../../../public/app/status-board-shadow/index.mjs';
import {
  createAuthoritativeSnapshotStore,
  createSynchronizationCoordinator
} from '../../../public/app/synchronization/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const historicalFixture = JSON.parse(await readFile(resolve(root, 'tests/build-2/fixtures/B2-P1-F001-receiving-parity.json'), 'utf8'));
const routeFixture = JSON.parse(await readFile(resolve(here, 'fixtures/B2-P3A-F001-route-readiness.json'), 'utf8'));

function dormInputsFromCanonical(snapshot) {
  return Object.entries(snapshot.dorms.idsByState).flatMap(([state, ids]) => ids.map(id => ({ id, state })));
}

function legacyFromCanonical(snapshot, overrides = {}) {
  return buildLegacyStatusBoardSnapshot({
    weekGroup: snapshot.weekGroup,
    capturedAt: snapshot.capturedAt,
    arrived: snapshot.metrics.arrived,
    expected: snapshot.metrics.expected,
    lastArrival: snapshot.metrics.lastArrival,
    activeBusIds: snapshot.activeBusIds,
    dorms: dormInputsFromCanonical(snapshot),
    timers: snapshot.timers,
    ...overrides
  });
}

test('historical Status Board truth remains exact through the canonical shadow snapshot', () => {
  const canonical = buildCanonicalStatusBoardSnapshot({
    records: historicalFixture.records,
    weekGroup: historicalFixture.weekGroup,
    capturedAt: '2026-07-09T17:00:00.000Z'
  });
  assert.equal(canonical.metrics.expected, 911);
  assert.equal(canonical.metrics.arrived, 857);
  assert.equal(canonical.dorms.counts.empty, 16);
  assert.equal(canonical.normalization.recordCount, historicalFixture.records.length);

  const comparison = compareStatusBoardSnapshots({
    legacy: legacyFromCanonical(canonical),
    canonical
  });
  assert.equal(comparison.status, 'exact');
  assert.deepEqual(comparison.blockingMetrics, []);
});

test('shadow runner remains read-only and does not activate a production route', () => {
  const canonical = buildCanonicalStatusBoardSnapshot({
    records: historicalFixture.records,
    weekGroup: historicalFixture.weekGroup,
    capturedAt: '2026-07-09T17:00:00.000Z'
  });
  const result = runStatusBoardShadow({
    legacySnapshot: legacyFromCanonical(canonical),
    records: historicalFixture.records,
    weekGroup: historicalFixture.weekGroup,
    capturedAt: '2026-07-09T17:00:00.000Z'
  });
  assert.equal(result.mode, 'shadow');
  assert.equal(result.readOnly, true);
  assert.equal(result.productionRouteActivated, false);
  assert.equal(result.status, 'exact');
});

test('arrived records without a valid arrival timestamp are reported as a blocking divergence', () => {
  const records = [
    { __backendId: 'cfg', type: 'config', key: 'week_group', value: 'WG-1' },
    { __backendId: 'dorm-1', type: 'dorm', week_group: 'WG-1', dorm_name: 'A1', state: 'empty', max_load: 10 },
    { __backendId: 'bus-1', type: 'bus', week_group: 'WG-1', bus_id: '1', status: 'arrived', otw_count: 10 }
  ];
  const canonical = buildCanonicalStatusBoardSnapshot({ records, weekGroup: 'WG-1', capturedAt: '2026-07-15T12:00:00Z' });
  const legacy = buildLegacyStatusBoardSnapshot({
    weekGroup: 'WG-1',
    capturedAt: '2026-07-15T12:00:00Z',
    arrived: 10,
    expected: 10,
    lastArrival: '—',
    activeBusIds: [],
    dorms: [{ id: 'dorm-1', state: 'empty' }],
    timers: [{ dormId: 'dorm-1', display: '00:00', tone: 'settled', overtime: false }]
  });
  const comparison = compareStatusBoardSnapshots({ legacy, canonical });
  assert.equal(canonical.metrics.arrived, 0);
  assert.equal(comparison.status, 'divergent');
  assert.ok(comparison.blockingMetrics.includes('arrived'));
});

test('legacy last_airport display and canonical derived arrival are compared explicitly', () => {
  const records = [
    { __backendId: 'cfg', type: 'config', key: 'week_group', value: 'WG-2' },
    { __backendId: 'cfg-last', type: 'config', key: 'last_airport', value: '06:59' },
    { __backendId: 'bus-2', type: 'bus', week_group: 'WG-2', bus_id: '2', status: 'arrived', otw_count: 12, arrived_at: '2026-07-15T12:00:00Z' }
  ];
  const canonical = buildCanonicalStatusBoardSnapshot({ records, weekGroup: 'WG-2', capturedAt: '2026-07-15T12:01:00Z' });
  const legacy = buildLegacyStatusBoardSnapshot({
    weekGroup: 'WG-2', capturedAt: canonical.capturedAt, arrived: 12, expected: 0, lastArrival: '06:59', activeBusIds: [], dorms: [], timers: []
  });
  const comparison = compareStatusBoardSnapshots({ legacy, canonical });
  const last = comparison.checks.find(item => item.metric === 'lastArrival');
  assert.equal(last.status, 'mismatch');
  assert.match(last.detail, /last_airport configuration/i);
  assert.ok(comparison.blockingMetrics.includes('lastArrival'));
});

test('timer policy preserves 40-minute warning, 50-minute critical, and 60-minute overtime boundaries', () => {
  const records = [
    { __backendId: 'cfg', type: 'config', key: 'week_group', value: 'WG-T' },
    { __backendId: 'dorm-warning', type: 'dorm', week_group: 'WG-T', dorm_name: 'W', state: 'open', opened_at: '2026-07-15T00:00:00Z', max_load: 10 },
    { __backendId: 'dorm-critical', type: 'dorm', week_group: 'WG-T', dorm_name: 'C', state: 'open', opened_at: '2026-07-14T23:50:00Z', max_load: 10 },
    { __backendId: 'dorm-overtime', type: 'dorm', week_group: 'WG-T', dorm_name: 'O', state: 'open', opened_at: '2026-07-14T23:40:00Z', max_load: 10 }
  ];
  const canonical = buildCanonicalStatusBoardSnapshot({ records, weekGroup: 'WG-T', capturedAt: '2026-07-15T00:40:00Z' });
  const timers = Object.fromEntries(canonical.timers.map(timer => [timer.dormId, timer]));
  assert.equal(timers['dorm-warning'].tone, 'warning');
  assert.equal(timers['dorm-warning'].overtime, false);
  assert.equal(timers['dorm-critical'].tone, 'critical');
  assert.equal(timers['dorm-critical'].overtime, false);
  assert.equal(timers['dorm-overtime'].tone, 'critical');
  assert.equal(timers['dorm-overtime'].overtime, true);
});

test('timer display drift of two seconds is tolerated without creating an activation blocker', () => {
  const canonical = buildCanonicalStatusBoardSnapshot({
    records: [
      { __backendId: 'cfg', type: 'config', key: 'week_group', value: 'WG-3' },
      { __backendId: 'dorm-3', type: 'dorm', week_group: 'WG-3', dorm_name: 'A3', state: 'open', opened_at: '2026-07-15T00:00:00Z', max_load: 10 }
    ],
    weekGroup: 'WG-3',
    capturedAt: '2026-07-15T00:10:00Z'
  });
  const legacy = legacyFromCanonical(canonical, {
    timers: canonical.timers.map(timer => ({ ...timer, display: '09:58', elapsedSeconds: 598 }))
  });
  const comparison = compareStatusBoardSnapshots({ legacy, canonical });
  assert.equal(comparison.status, 'tolerated');
  assert.deepEqual(comparison.blockingMetrics, []);
});

test('evidence ledger remains memory-only and requires sustained zero-blocking parity', () => {
  let ledger = createShadowEvidenceLedger({ maxSamples: 20 });
  const passing = { capturedAt: '2026-07-15T00:00:00Z', weekGroup: 'WG-4', status: 'exact', summary: { exact: 9, tolerated: 0, mismatched: 0 }, blockingMetrics: [] };
  for (let index = 0; index < 10; index += 1) ledger = appendShadowEvidence(ledger, { ...passing, capturedAt: `2026-07-15T00:00:${String(index).padStart(2, '0')}Z` });
  const summary = summarizeShadowEvidence(ledger);
  assert.equal(ledger.storage, 'memory-only');
  assert.equal(summary.sampleCount, 10);
  assert.equal(summary.consecutivePassing, 10);
  assert.equal(summary.readyForActivationReview, true);

  ledger = appendShadowEvidence(ledger, { ...passing, status: 'divergent', blockingMetrics: ['arrived'], summary: { exact: 8, tolerated: 0, mismatched: 1 } });
  const blocked = summarizeShadowEvidence(ledger);
  assert.equal(blocked.readyForActivationReview, false);
  assert.equal(blocked.blockingCounts.arrived, 1);
});

test('foreign invalidation triggers authoritative refetch and a fresh route-specific shadow comparison', async () => {
  let records = historicalFixture.records;
  let listCalls = 0;
  let channelListener = null;
  let clock = 0;
  const channel = {
    subscribe(listener) {
      channelListener = listener;
      return () => { channelListener = null; };
    }
  };
  const store = createAuthoritativeSnapshotStore();
  const coordinator = createSynchronizationCoordinator({
    client: {
      async list() {
        listCalls += 1;
        return { ok: true, data: { records } };
      }
    },
    channel,
    store,
    eventTarget: { addEventListener() {}, removeEventListener() {} },
    navigatorLike: { onLine: true },
    now: () => `2026-07-15T00:00:${String(clock++).padStart(2, '0')}Z`
  });
  const adapter = createStatusBoardShadowSyncAdapter({
    coordinator,
    weekGroup: historicalFixture.weekGroup,
    now: () => `2026-07-15T00:01:${String(clock++).padStart(2, '0')}Z`,
    captureLegacySnapshot: async ({ snapshot, capturedAt }) => {
      const canonical = buildCanonicalStatusBoardSnapshot({
        records: snapshot.records,
        weekGroup: historicalFixture.weekGroup,
        capturedAt
      });
      return legacyFromCanonical(canonical);
    }
  });

  await adapter.start();
  await adapter.whenIdle();
  assert.equal(listCalls, 1);
  assert.equal(adapter.getLatest().status, 'exact');
  const firstVersion = coordinator.readSnapshot().version;

  records = [...historicalFixture.records, {
    __backendId: 'bus-shadow-active',
    type: 'bus',
    week_group: historicalFixture.weekGroup,
    bus_id: 'SHADOW',
    status: 'active',
    otw_count: 25,
    departed_at: '2026-07-15T00:00:00Z'
  }];
  channelListener({ kind: 'records.invalidated', entityType: 'bus', entityId: 'bus-shadow-active' });
  for (let index = 0; index < 5 && listCalls < 2; index += 1) await new Promise(resolve => setImmediate(resolve));
  await adapter.whenIdle();

  assert.equal(listCalls, 2);
  assert.ok(coordinator.readSnapshot().version > firstVersion);
  assert.equal(adapter.getLatest().status, 'exact');
  assert.deepEqual(adapter.getLatest().canonicalSnapshot.activeBusIds, ['bus-shadow-active']);
  adapter.stop();
});

test('route readiness contract covers all six postures plus accessibility and fullscreen boundaries', () => {
  assert.deepEqual(validateStatusBoardRouteContract(), { valid: true, errors: [] });
  const evidence = buildStatusBoardRouteReadinessEvidence();
  assert.equal(evidence.postures.length, 6);
  assert.deepEqual(evidence.postures.map(item => item.posture.id), routeFixture.postures.map(item => item.id));
  for (const expected of routeFixture.postures) {
    const actual = STATUS_BOARD_POSTURE_CONTRACTS[expected.id];
    assert.equal(actual.metricColumns, expected.metricColumns);
    assert.equal(actual.dormPresentation, expected.dormPresentation);
    assert.equal(actual.activeBusPresentation, expected.activeBusPresentation);
    assert.equal(actual.fullscreen, expected.fullscreen);
  }
  assert.equal(evidence.accessibility.timerBehavior.automaticAnnouncement, false);
  assert.equal(evidence.accessibility.degradedStateAnnouncement.includesLastSynchronizedTime, true);
  assert.equal(evidence.fullscreen.focusRestoration, true);
  assert.equal(evidence.productionRouteActivated, false);
});

test('active bridge is observation-only and middleware loads exactly one hidden shadow controller', async () => {
  const bridge = await readFile(resolve(root, 'public/js/gate-status-board-shadow-controller.js'), 'utf8');
  const middleware = await readFile(resolve(root, 'functions/_middleware.js'), 'utf8');
  const routeRegistry = await readFile(resolve(root, 'public/app/shell/route-registry.mjs'), 'utf8');

  assert.match(bridge, /mode: 'shadow'/);
  assert.match(bridge, /readOnly: true/);
  assert.match(bridge, /productionRouteActivated: false/);
  assert.match(bridge, /import\('\/app\/status-board-shadow\/index\.mjs/);
  assert.doesNotMatch(bridge, /\bfetch\s*\(|localStorage|sessionStorage|indexedDB|serviceWorker|innerHTML\s*=|textContent\s*=|insertAdjacentHTML|appendChild|replaceChildren/);
  assert.doesNotMatch(bridge, /GateBusRepository|GateDormRepository|GateArchiveRepository|\.create\s*\(|\.update\s*\(|\.delete\s*\(/);

  const occurrences = (middleware.match(/gate-status-board-shadow-controller\.js/g) || []).length;
  assert.equal(occurrences, 1);
  assert.doesNotMatch(middleware, /status-board-shadow\/index\.mjs/);
  assert.doesNotMatch(routeRegistry, /shadow/i);
});
