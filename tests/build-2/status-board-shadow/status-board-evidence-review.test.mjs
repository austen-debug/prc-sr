import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  appendShadowEvidence,
  buildStatusBoardEvidenceReview,
  createShadowEvidenceLedger,
  normalizeDeploymentEvidenceEntry,
  normalizeManualEvidenceEntry,
  STATUS_BOARD_DEPLOYMENT_PREREQUISITES,
  STATUS_BOARD_MANUAL_CHECKS,
  STATUS_BOARD_REVIEW_POLICY,
  validateStatusBoardEvidenceReview,
  validateStatusBoardRollbackContract
} from '../../../public/app/status-board-shadow/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');

function passingLedger({ count = 10, intervalMs = 30000 } = {}) {
  let ledger = createShadowEvidenceLedger({ maxSamples: 120 });
  const base = Date.parse('2026-07-15T12:00:00.000Z');
  for (let index = 0; index < count; index += 1) {
    ledger = appendShadowEvidence(ledger, {
      capturedAt: new Date(base + index * intervalMs).toISOString(),
      weekGroup: '26-28',
      status: 'exact',
      summary: { exact: 9, tolerated: 0, mismatched: 0 },
      blockingMetrics: []
    });
  }
  return ledger;
}

function manualPassingEvidence() {
  return STATUS_BOARD_MANUAL_CHECKS.map((check, index) => ({
    checkId: check.id,
    status: 'pass',
    observedAt: new Date(Date.parse('2026-07-15T13:00:00.000Z') + index * 1000).toISOString(),
    environment: 'controlled Status Board review',
    method: 'Manual route validation against the governing checklist.',
    artifactReference: `review-artifact:${check.id}`,
    reviewerRole: 'operations evaluator'
  }));
}

function deploymentPassingEvidence() {
  return STATUS_BOARD_DEPLOYMENT_PREREQUISITES.map((item, index) => ({
    prerequisiteId: item.id,
    status: 'pass',
    observedAt: new Date(Date.parse('2026-07-15T14:00:00.000Z') + index * 1000).toISOString(),
    environment: 'controlled Status Board review',
    method: 'Environment verification procedure.',
    artifactReference: `deployment-artifact:${item.id}`,
    operatorRole: 'deployment evaluator'
  }));
}

test('review policy preserves the Phase 3A sustained-evidence minimums', () => {
  assert.equal(STATUS_BOARD_REVIEW_POLICY.liveParity.minimumSamples, 10);
  assert.equal(STATUS_BOARD_REVIEW_POLICY.liveParity.minimumConsecutivePassing, 5);
  assert.equal(STATUS_BOARD_REVIEW_POLICY.liveParity.minimumObservationMs, 270000);
  assert.equal(STATUS_BOARD_REVIEW_POLICY.authorization.phase3BAuthorizedByEvaluator, false);
});

test('burst samples do not satisfy sustained live parity', () => {
  const review = buildStatusBoardEvidenceReview({
    ledger: passingLedger({ count: 10, intervalMs: 1000 })
  });
  assert.equal(review.status, 'collecting');
  assert.equal(review.liveParity.requirements.sampleCount, true);
  assert.equal(review.liveParity.requirements.consecutivePassing, true);
  assert.equal(review.liveParity.requirements.observationDuration, false);
  assert.equal(review.phase3BAuthorized, false);
});

test('complete retained evidence permits authorization review but never authorizes Phase 3B', () => {
  const review = buildStatusBoardEvidenceReview({
    ledger: passingLedger(),
    manualEvidence: manualPassingEvidence(),
    deploymentEvidence: deploymentPassingEvidence(),
    evaluatedAt: '2026-07-15T15:00:00.000Z'
  });
  assert.equal(review.status, 'ready-for-authorization-review');
  assert.equal(review.authorizationReviewPermitted, true);
  assert.equal(review.phase3BAuthorized, false);
  assert.equal(review.productionRouteActivated, false);
  assert.equal(review.build1RetirementAuthorized, false);
  assert.equal(review.explicitGovernanceDecisionRequired, true);
  assert.deepEqual(review.blockers, []);
  assert.deepEqual(review.pending, []);
  assert.deepEqual(validateStatusBoardEvidenceReview(review), { valid: true, errors: [] });
});

test('missing manual and environment evidence keeps review open', () => {
  const review = buildStatusBoardEvidenceReview({ ledger: passingLedger() });
  assert.equal(review.status, 'collecting');
  assert.ok(review.pending.includes('manual:responsive.desktop-landscape'));
  assert.ok(review.pending.includes('deployment:controlled-environment-identified'));
  assert.equal(review.authorizationReviewPermitted, false);
});

test('a manual failure blocks review', () => {
  const manual = manualPassingEvidence();
  manual[0] = { ...manual[0], status: 'fail' };
  const review = buildStatusBoardEvidenceReview({
    ledger: passingLedger(),
    manualEvidence: manual,
    deploymentEvidence: deploymentPassingEvidence()
  });
  assert.equal(review.status, 'blocked');
  assert.ok(review.blockers.includes(`manual:${STATUS_BOARD_MANUAL_CHECKS[0].id}`));
});

test('blocking parity remains blocking even after a documented disposition', () => {
  let ledger = passingLedger();
  ledger = appendShadowEvidence(ledger, {
    capturedAt: '2026-07-15T12:05:00.000Z',
    weekGroup: '26-28',
    status: 'divergent',
    summary: { exact: 8, tolerated: 0, mismatched: 1 },
    blockingMetrics: ['lastArrival']
  });
  const review = buildStatusBoardEvidenceReview({
    ledger,
    manualEvidence: manualPassingEvidence(),
    deploymentEvidence: deploymentPassingEvidence(),
    mismatchDispositions: [{
      metric: 'lastArrival',
      status: 'accepted-canonical',
      decidedAt: '2026-07-15T12:10:00.000Z',
      decisionReference: 'decision:status-board-last-arrival',
      rationale: 'The canonical confirmed-arrival timestamp is the approved source of truth.',
      decisionOwnerRole: 'program authority',
      sourceOfTruth: 'canonical'
    }]
  });
  assert.equal(review.mismatches.allActiveMismatchesDisposed, true);
  assert.equal(review.status, 'blocked');
  assert.ok(review.blockers.includes('live:lastArrival'));
  assert.equal(review.phase3BAuthorized, false);
});

test('manual evidence rejects identity-bearing fields', () => {
  assert.throws(() => normalizeManualEvidenceEntry({
    checkId: 'accessibility.keyboard-route',
    status: 'pass',
    observedAt: '2026-07-15T12:00:00.000Z',
    name: 'Prohibited identity'
  }), /prohibited identity fields/i);
});

test('deployment evidence rejects secret-bearing fields', () => {
  assert.throws(() => normalizeDeploymentEvidenceEntry({
    prerequisiteId: 'session-role-bindings-verified',
    status: 'pass',
    observedAt: '2026-07-15T12:00:00.000Z',
    secret: 'must-not-be-retained'
  }), /prohibited secret fields/i);
});

test('rollback contract returns directly to Build 1-only execution without record changes', () => {
  assert.deepEqual(validateStatusBoardRollbackContract(), { valid: true, errors: [] });
});

test('active bridge exposes review diagnostics without persistence, routing, or rendering authority', async () => {
  const bridge = await readFile(resolve(root, 'public/js/gate-status-board-shadow-controller.js'), 'utf8');
  const routeRegistry = await readFile(resolve(root, 'public/app/shell/route-registry.mjs'), 'utf8');
  const index = await readFile(resolve(root, 'public/app/status-board-shadow/index.mjs'), 'utf8');

  assert.match(bridge, /evidenceReviewVersion: '3A-R\.1\.0'/);
  assert.match(bridge, /getEvidenceReview: buildEvidenceReview/);
  assert.match(bridge, /phase3BAuthorized: false/);
  assert.doesNotMatch(bridge, /\bfetch\s*\(|localStorage|sessionStorage|indexedDB|serviceWorker|innerHTML\s*=|textContent\s*=|insertAdjacentHTML|appendChild|replaceChildren/);
  assert.doesNotMatch(routeRegistry, /evidence-review|status-board-shadow/i);
  assert.match(index, /review-evaluator\.mjs/);
  assert.match(index, /rollback-contract\.mjs/);
});
