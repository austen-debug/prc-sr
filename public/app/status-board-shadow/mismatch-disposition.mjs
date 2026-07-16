import {
  freezeShadow,
  shadowText,
  STATUS_BOARD_SHADOW_METRICS
} from './contracts.mjs';

export const MISMATCH_DISPOSITION_STATUSES = Object.freeze([
  'resolved',
  'accepted-canonical',
  'accepted-legacy',
  'deferred-blocking'
]);

function validTimestamp(value) {
  return Boolean(shadowText(value)) && Number.isFinite(Date.parse(value));
}

export function normalizeMismatchDisposition(input = {}) {
  const metric = shadowText(input.metric);
  const status = shadowText(input.status).toLowerCase();
  if (!STATUS_BOARD_SHADOW_METRICS.includes(metric)) throw new TypeError(`Unknown mismatch metric: ${metric || 'missing'}.`);
  if (!MISMATCH_DISPOSITION_STATUSES.includes(status)) throw new TypeError(`Invalid mismatch disposition for ${metric}.`);

  const decidedAt = shadowText(input.decidedAt);
  const decisionReference = shadowText(input.decisionReference).slice(0, 240);
  const rationale = shadowText(input.rationale).slice(0, 500);
  const decisionOwnerRole = shadowText(input.decisionOwnerRole).slice(0, 80);
  const sourceOfTruth = shadowText(input.sourceOfTruth).toLowerCase();

  if (status !== 'deferred-blocking') {
    if (!validTimestamp(decidedAt)) throw new TypeError(`${metric} disposition requires a valid decidedAt timestamp.`);
    if (!decisionReference) throw new TypeError(`${metric} disposition requires a decisionReference.`);
    if (!rationale) throw new TypeError(`${metric} disposition requires a rationale.`);
    if (!decisionOwnerRole) throw new TypeError(`${metric} disposition requires a decisionOwnerRole.`);
  }
  if (status === 'accepted-canonical' && sourceOfTruth !== 'canonical') {
    throw new TypeError(`${metric} accepted-canonical disposition must identify canonical as the source of truth.`);
  }
  if (status === 'accepted-legacy' && sourceOfTruth !== 'legacy') {
    throw new TypeError(`${metric} accepted-legacy disposition must identify legacy as the source of truth.`);
  }

  return freezeShadow({
    metric,
    status,
    decidedAt: status === 'deferred-blocking' ? '' : decidedAt,
    decisionReference,
    rationale,
    decisionOwnerRole,
    sourceOfTruth: sourceOfTruth || ''
  });
}

export function evaluateMismatchDispositions({ blockingCounts = {}, dispositions = [] } = {}) {
  const normalized = new Map();
  for (const raw of Array.isArray(dispositions) ? dispositions : []) {
    const disposition = normalizeMismatchDisposition(raw);
    normalized.set(disposition.metric, disposition);
  }

  const activeMetrics = Object.entries(blockingCounts || {})
    .filter(([, count]) => Number(count) > 0)
    .map(([metric]) => metric);
  const checks = activeMetrics.map(metric => {
    const disposition = normalized.get(metric) || null;
    const resolved = Boolean(disposition && disposition.status !== 'deferred-blocking');
    return freezeShadow({
      metric,
      occurrences: Number(blockingCounts[metric] || 0),
      status: disposition?.status || 'unresolved',
      resolved,
      decisionReference: disposition?.decisionReference || '',
      decisionOwnerRole: disposition?.decisionOwnerRole || '',
      sourceOfTruth: disposition?.sourceOfTruth || ''
    });
  });

  return freezeShadow({
    checks,
    activeMismatchCount: activeMetrics.length,
    unresolved: checks.filter(check => !check.resolved).map(check => check.metric),
    allActiveMismatchesDisposed: checks.every(check => check.resolved)
  });
}
