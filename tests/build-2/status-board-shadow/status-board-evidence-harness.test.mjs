import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { POSTURE_IDS } from '../../../public/app/responsive/posture-registry.mjs';
import {
  STATUS_BOARD_DEPLOYMENT_PREREQUISITES,
  STATUS_BOARD_MANUAL_CHECKS,
  STATUS_BOARD_POSTURE_CONTRACTS
} from '../../../public/app/status-board-shadow/index.mjs';
import {
  REVIEW_CONNECTION_STATES,
  STATUS_BOARD_REVIEW_FIXTURE
} from '../../../public/app/status-board-shadow/review-harness/fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
}

test('evidence harness uses synthetic fixture data only', () => {
  assert.equal(STATUS_BOARD_REVIEW_FIXTURE.weekGroup, 'WG-REVIEW');
  assert.equal(STATUS_BOARD_REVIEW_FIXTURE.metrics.length, 4);
  assert.ok(STATUS_BOARD_REVIEW_FIXTURE.dorms.length >= 3);
  assert.ok(STATUS_BOARD_REVIEW_FIXTURE.buses.length >= 1);
  assert.equal(REVIEW_CONNECTION_STATES.map(item => item.id).join(','), 'current,stale,offline');
  assert.equal(JSON.stringify(STATUS_BOARD_REVIEW_FIXTURE).includes('allData'), false);
});

test('all six responsive posture contracts are available to the harness', () => {
  assert.equal(POSTURE_IDS.length, 6);
  assert.deepEqual(Object.keys(STATUS_BOARD_POSTURE_CONTRACTS).sort(), [...POSTURE_IDS].sort());
  for (const posture of POSTURE_IDS) {
    assert.ok(STATUS_BOARD_MANUAL_CHECKS.some(check => check.id === `responsive.${posture}`));
  }
});

test('manual and deployment evidence registries remain complete', () => {
  assert.ok(STATUS_BOARD_MANUAL_CHECKS.some(check => check.id === 'accessibility.screen-reader'));
  assert.ok(STATUS_BOARD_MANUAL_CHECKS.some(check => check.id === 'fullscreen.focus-restoration'));
  assert.ok(STATUS_BOARD_MANUAL_CHECKS.some(check => check.id === 'degraded.offline-readonly'));
  assert.ok(STATUS_BOARD_MANUAL_CHECKS.some(check => check.id === 'rollback.build1-smoke'));
  assert.ok(STATUS_BOARD_DEPLOYMENT_PREREQUISITES.some(check => check.id === 'feature-flag-default-off'));
  assert.ok(STATUS_BOARD_DEPLOYMENT_PREREQUISITES.some(check => check.id === 'service-worker-remains-inactive'));
});

test('harness is fixture-only, memory-only, and disconnected from operational persistence', async () => {
  const html = await source('public/app/status-board-shadow/review-harness/index.html');
  const script = await source('public/app/status-board-shadow/review-harness/review-harness.mjs');
  const combined = `${html}\n${script}`;

  assert.match(html, /No operational records · No API · No route activation/);
  assert.match(html, /Evidence packet builder/);
  assert.match(script, /buildStatusBoardEvidenceReview/);
  assert.match(script, /Phase 3B remains unauthorized/);
  assert.doesNotMatch(combined, /\/api\//);
  assert.doesNotMatch(combined, /\bfetch\s*\(/);
  assert.doesNotMatch(combined, /localStorage|sessionStorage|indexedDB|serviceWorker|CacheStorage/);
  assert.doesNotMatch(combined, /GateBusRepository|GateDormRepository|GateArchiveRepository|GateAuditRepository/);
  assert.doesNotMatch(combined, /\ballData\b|getActiveWG|prc_sr_session/);
});

test('harness provides accessible review controls and fullscreen focus restoration', async () => {
  const html = await source('public/app/status-board-shadow/review-harness/index.html');
  const script = await source('public/app/status-board-shadow/review-harness/review-harness.mjs');

  assert.match(html, /Skip to Status Board review surface/);
  assert.match(html, /aria-label="Evidence harness controls"/);
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(script, /requestFullscreen/);
  assert.match(script, /exitFullscreen/);
  assert.match(script, /fullscreenReturnFocus\.focus/);
  assert.match(script, /Last synchronized/);
  assert.match(script, /aria-readonly/);
});

test('harness is not loaded by active middleware and does not create a route', async () => {
  const middleware = await source('functions/_middleware.js');
  const routes = await source('public/app/shell/route-registry.mjs');

  assert.doesNotMatch(middleware, /review-harness/);
  assert.doesNotMatch(routes, /review-harness|evidence-harness/);
  assert.equal((routes.match(/id:\s*'/g) || []).length, 6);
});
