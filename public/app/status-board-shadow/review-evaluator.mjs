import { freezeShadow, shadowText } from './contracts.mjs';
import { summarizeShadowEvidence } from './evidence-ledger.mjs';
import { summarizeManualEvidence } from './manual-evidence.mjs';
import { evaluateMismatchDispositions } from './mismatch-disposition.mjs';
import { summarizeDeploymentEvidence } from './deployment-evidence.mjs';
import {
  STATUS_BOARD_EVIDENCE_REVIEW_VERSION,
  STATUS_BOARD_REVIEW_POLICY
} from './review-contract.mjs';
import { validateStatusBoardRollbackContract } from './rollback-contract.mjs';

function evidenceWindow(samples = []) {
  const timestamps = (Array.isArray(samples) ? samples : [])
    .map(sample => Date.parse(sample?.capturedAt || ''))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!timestamps.length) return freezeShadow({ start: '', end: '', durationMs: 0 });
  const start = timestamps[0];
  const end = timestamps[timestamps.length - 1];
  return freezeShadow({
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    durationMs: Math.max(0, end - start)
  });
}

export function buildLiveParityAssessment(ledger, policy = STATUS_BOARD_REVIEW_POLICY.liveParity) {
  const summary = summarizeShadowEvidence(ledger, {
    minimumSamples: policy.minimumSamples,
    minimumConsecutivePassing: policy.minimumConsecutivePassing
  });
  const window = evidenceWindow(ledger?.samples || []);
  const blockingMetrics = Object.keys(summary.blockingCounts || {});
  const requirements = freezeShadow({
    sampleCount: summary.sampleCount >= policy.minimumSamples,
    consecutivePassing: summary.consecutivePassing >= policy.minimumConsecutivePassing,
    observationDuration: window.durationMs >= policy.minimumObservationMs,
    zeroBlockingMetrics: blockingMetrics.length === 0
  });
  const passed = Object.values(requirements).every(Boolean);
  return freezeShadow({
    status: blockingMetrics.length ? 'blocked' : (passed ? 'pass' : 'collecting'),
    passed,
    summary,
    window,
    blockingMetrics,
    requirements,
    policy
  });
}

function prefixed(prefix, values = []) {
  return values.map(value => `${prefix}:${value}`);
}

export function buildStatusBoardEvidenceReview({
  ledger,
  manualEvidence = [],
  mismatchDispositions = [],
  deploymentEvidence = [],
  evaluatedAt = new Date().toISOString()
} = {}) {
  const liveParity = buildLiveParityAssessment(ledger);
  const mismatches = evaluateMismatchDispositions({
    blockingCounts: liveParity.summary.blockingCounts,
    dispositions: mismatchDispositions
  });
  const manual = summarizeManualEvidence(manualEvidence);
  const deployment = summarizeDeploymentEvidence(deploymentEvidence);
  const rollback = validateStatusBoardRollbackContract();

  const blockers = [
    ...prefixed('live', liveParity.blockingMetrics),
    ...prefixed('mismatch', mismatches.unresolved),
    ...prefixed('manual', manual.failed),
    ...prefixed('deployment', deployment.failed),
    ...(rollback.valid ? [] : prefixed('rollback', rollback.errors))
  ];
  const pending = [
    ...(liveParity.status === 'collecting' ? ['live:minimum-window'] : []),
    ...prefixed('manual', manual.pending),
    ...prefixed('deployment', deployment.pending)
  ];

  const status = blockers.length
    ? 'blocked'
    : (!liveParity.passed || !manual.allRequiredPassing || !deployment.allPassing || !rollback.valid)
      ? 'collecting'
      : 'ready-for-authorization-review';

  const authorizationReviewPermitted = status === 'ready-for-authorization-review';
  return freezeShadow({
    contractVersion: STATUS_BOARD_EVIDENCE_REVIEW_VERSION,
    route: 'board',
    evaluatedAt: shadowText(evaluatedAt),
    status,
    authorizationReviewPermitted,
    explicitGovernanceDecisionRequired: true,
    phase3BAuthorized: false,
    productionRouteActivated: false,
    build1RetirementAuthorized: false,
    liveParity,
    mismatches,
    manual,
    deployment,
    rollback,
    blockers,
    pending,
    nextAction: status === 'blocked'
      ? 'Resolve blocking parity, manual, deployment, or rollback evidence before continuing.'
      : status === 'collecting'
        ? 'Continue sustained live shadow collection and complete all manual and environment evidence.'
        : 'Submit the retained evidence packet for a separate Phase 3B authorization decision.'
  });
}

export const buildStatusBoardEvidenceReviewPacket = buildStatusBoardEvidenceReview;

export function validateStatusBoardEvidenceReview(review) {
  const errors = [];
  if (review?.route !== 'board') errors.push('Evidence review must target the Status Board route.');
  if (!['collecting', 'blocked', 'ready-for-authorization-review'].includes(review?.status)) errors.push('Invalid evidence review status.');
  if (review?.phase3BAuthorized !== false) errors.push('Evidence evaluator may not authorize Phase 3B.');
  if (review?.productionRouteActivated !== false) errors.push('Evidence evaluator may not activate production.');
  if (review?.build1RetirementAuthorized !== false) errors.push('Evidence evaluator may not authorize Build 1 retirement.');
  if (review?.explicitGovernanceDecisionRequired !== true) errors.push('Explicit governance decision must remain required.');
  return freezeShadow({ valid: errors.length === 0, errors });
}
