import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizePersistedRecords } from '../../../public/app/data/record-normalizer.mjs';
import {
  buildCurrentSummaryModel,
  buildStatusBoardSummary
} from '../../../public/app/domain/index.mjs';
import {
  validatePermissionRegistry,
  validateRouteRegistry
} from '../../../public/app/shell/index.mjs';
import {
  createSyncState,
  validateSyncState,
  canPerformCriticalWrite
} from '../../../public/app/synchronization/index.mjs';
import {
  GATE_STATIC_SHELL_ASSETS,
  validateCachePolicy
} from '../../../public/app/offline/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, '../../..');

async function repositoryFile(path) {
  return readFile(resolve(repositoryRoot, path), 'utf8');
}

async function repositoryJson(path) {
  return JSON.parse(await repositoryFile(path));
}

const requiredFoundationSources = Object.freeze([
  'public/app/domain/week-groups.mjs',
  'public/app/domain/arrivals.mjs',
  'public/app/domain/buses.mjs',
  'public/app/domain/dorms.mjs',
  'public/app/domain/processing.mjs',
  'public/app/domain/timers.mjs',
  'public/app/domain/reports.mjs',
  'public/app/domain/archives.mjs',
  'public/app/domain/summaries.mjs',
  'public/app/data/canonical-entity.mjs',
  'public/app/data/provenance.mjs',
  'public/app/data/repositories/audit-repository.mjs',
  'public/app/workflows/initialize-week-group.mjs',
  'public/app/workflows/arrival-workflows.mjs',
  'public/app/workflows/dorm-workflows.mjs',
  'public/app/workflows/archive-workflows.mjs',
  'public/app/synchronization/sync-state.mjs',
  'public/app/synchronization/invalidation-channel.mjs',
  'public/app/synchronization/sync-coordinator.mjs',
  'public/app/synchronization/guarded-records-client.mjs',
  'public/app/offline/cache-policy.mjs',
  'public/gate-build-2-sw.js'
]);

const gateReports = Object.freeze([
  'docs/build-2/GATE_A_EXECUTION_REPORT.md',
  'docs/build-2/GATE_B_EXECUTION_REPORT.md',
  'docs/build-2/GATE_C_EXECUTION_REPORT.md',
  'docs/build-2/GATE_D_EXECUTION_REPORT.md',
  'docs/build-2/GATE_E_EXECUTION_REPORT.md'
]);

test('all corrected foundation source owners exist', async () => {
  await Promise.all(requiredFoundationSources.map(path => access(resolve(repositoryRoot, path))));
});

test('Gates A through E are formally complete before Gate F closes', async () => {
  for (const path of gateReports) {
    const source = await repositoryFile(path);
    assert.match(source, /Status:\s+COMPLETE(?:\s*\/\s*STAGED)?/i, `${path} must be complete.`);
  }
});

test('the historical receiving fixture remains exact through canonical normalization and shared summaries', async () => {
  const fixture = await repositoryJson('tests/build-2/fixtures/B2-P1-F001-receiving-parity.json');
  const records = normalizePersistedRecords(fixture.records, { timeZone: 'America/Chicago' }).records;
  const status = buildStatusBoardSummary({
    records,
    weekGroup: fixture.weekGroup,
    now: '2026-01-08T06:00:00Z'
  });
  const current = buildCurrentSummaryModel({
    records,
    weekGroup: fixture.weekGroup,
    windows: fixture.receivingWindows,
    generatedAt: '2026-01-08T06:00:00Z'
  });

  assert.equal(status.dorms.capacity.total, 911);
  assert.equal(status.arrivals.confirmed.total, 857);
  assert.equal(current.report.nights[0].totalProcessed, 818);
  assert.equal(current.report.nights[1].totalProcessed, 39);
  assert.equal(current.report.nights[1].cumulativeTotalProcessed, 857);
});

test('route, permission, synchronization, and cache registries are internally valid', () => {
  assert.deepEqual(validateRouteRegistry(), { valid: true, errors: [] });
  assert.deepEqual(validatePermissionRegistry(), { valid: true, errors: [] });
  assert.deepEqual(validateCachePolicy(), { valid: true, errors: [] });

  const current = createSyncState({
    status: 'current',
    online: true,
    authoritative: true,
    stale: false,
    refreshRequired: false,
    lastSyncedAt: '2026-07-16T00:00:00Z'
  });
  const offline = createSyncState({
    status: 'offline',
    online: false,
    lastSyncedAt: '2026-07-16T00:00:00Z'
  });

  assert.deepEqual(validateSyncState(current), { valid: true, errors: [] });
  assert.deepEqual(validateSyncState(offline), { valid: true, errors: [] });
  assert.equal(canPerformCriticalWrite(current), true);
  assert.equal(canPerformCriticalWrite(offline), false);
});

test('static-shell cache assets exist and exclude authoritative or operational data', async () => {
  for (const asset of GATE_STATIC_SHELL_ASSETS) {
    assert.match(asset, /^\/app\//);
    assert.doesNotMatch(asset, /api|record|archive|audit|workflow|fixture/i);
    await access(resolve(repositoryRoot, `public${asset}`));
  }

  const worker = await repositoryFile('public/gate-build-2-sw.js');
  assert.match(worker, /isAuthoritativeApiRequest/);
  assert.doesNotMatch(worker, /backgroundSync|sync\.register|pendingWrites|queuedWrites|mutationQueue/);
});

test('schema and migration define equivalent append-only audit triggers', async () => {
  const schema = await repositoryFile('schema.sql');
  const migration = await repositoryFile('migrations/0002_gate_c_append_only_audit.sql');
  for (const trigger of ['prevent_audit_event_update', 'prevent_audit_event_delete']) {
    assert.match(schema, new RegExp(trigger));
    assert.match(migration, new RegExp(trigger));
  }
  assert.match(schema, /audit events are append-only/);
  assert.match(migration, /audit events are append-only/);
});

test('governing documents distinguish foundation exit, shadow authorization, and production deployment', async () => {
  const corrected = await repositoryFile('docs/build-2/CORRECTED_PHASE_1_EXIT_DECISION.md');
  const prerequisites = await repositoryFile('docs/build-2/DEPLOYMENT_PREREQUISITES.md');
  const shadow = await repositoryFile('docs/build-2/STATUS_BOARD_SHADOW_MIGRATION_AUTHORIZATION.md');
  const baseline = await repositoryFile('docs/build-2/PROGRAM_INTENT_BASELINE.md');

  assert.match(corrected, /FOUNDATION EXIT APPROVED/i);
  assert.match(corrected, /does\s+\*{0,2}not\*{0,2}\s+activate a Build 2 route/i);
  assert.match(prerequisites, /Not independently verified in Gate F/i);
  assert.match(prerequisites, /do\s+\*{0,2}not\*{0,2}\s+block a hidden, read-only Status Board shadow calculation/i);
  assert.match(shadow, /hidden, read-only/i);
  assert.match(shadow, /may not[\s\S]*replace or alter the visible Build 1 Status Board/i);
  assert.match(baseline, /1\. Status Board[\s\S]*2\. Processing[\s\S]*3\. Airport[\s\S]*4\. Input[\s\S]*5\. Archives and Reports[\s\S]*6\. Squadron Board/);
});

test('Build 1 remains isolated from every staged Build 2 foundation and service worker', async () => {
  const middleware = await repositoryFile('functions/_middleware.js');
  const index = await repositoryFile('public/index.html');
  const build1SourcePaths = [
    'public/js',
    'functions/_middleware.js',
    'public/index.html'
  ];

  assert.doesNotMatch(middleware, /\/app\/(domain|data|design|components|shell|responsive|accessibility|workflows|synchronization|offline)\//);
  assert.doesNotMatch(middleware, /gate-build-2-sw/);
  assert.doesNotMatch(index, /gate-build-2-sw|registerGateShellServiceWorker|app\/synchronization/);

  const gateFWorkflow = await repositoryFile('.github/workflows/build-2-gate-f-tests.yml');
  for (const path of build1SourcePaths) assert.match(gateFWorkflow, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('Gate F authorizes only Status Board shadow migration and retains production blocks', async () => {
  const report = await repositoryFile('docs/build-2/GATE_F_EXECUTION_REPORT.md');
  assert.match(report, /AUTHORIZED — hidden, read-only Status Board shadow migration/);
  assert.match(report, /NOT AUTHORIZED — visible Build 2 production route activation/);
  assert.match(report, /NOT AUTHORIZED — Build 2 production critical writes/);
  assert.match(report, /Phase 3A — Status Board Shadow Migration/);
});
