import { freezeShadow, shadowText, STATUS_BOARD_SHADOW_VERSION } from './contracts.mjs';

function normalizeLimit(value, fallback = 120) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : fallback;
}

export function createShadowEvidenceLedger({ maxSamples = 120 } = {}) {
  return freezeShadow({
    contractVersion: STATUS_BOARD_SHADOW_VERSION,
    storage: 'memory-only',
    maxSamples: normalizeLimit(maxSamples),
    samples: []
  });
}

export function appendShadowEvidence(ledger, result) {
  const current = ledger || createShadowEvidenceLedger();
  const sample = Object.freeze({
    capturedAt: shadowText(result?.capturedAt),
    weekGroup: shadowText(result?.weekGroup),
    status: shadowText(result?.status) || 'unavailable',
    exact: Number(result?.summary?.exact || 0),
    tolerated: Number(result?.summary?.tolerated || 0),
    mismatched: Number(result?.summary?.mismatched || 0),
    blockingMetrics: Object.freeze([...(result?.blockingMetrics || [])])
  });
  const samples = [...(current.samples || []), sample].slice(-normalizeLimit(current.maxSamples));
  return freezeShadow({ ...current, samples });
}

export function summarizeShadowEvidence(ledger, {
  minimumSamples = 10,
  minimumConsecutivePassing = 5
} = {}) {
  const samples = Array.isArray(ledger?.samples) ? ledger.samples : [];
  let consecutivePassing = 0;
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    if (['exact', 'tolerated'].includes(samples[index].status) && samples[index].blockingMetrics.length === 0) consecutivePassing += 1;
    else break;
  }
  const blockingCounts = {};
  for (const sample of samples) {
    for (const metric of sample.blockingMetrics) blockingCounts[metric] = (blockingCounts[metric] || 0) + 1;
  }
  const passingSamples = samples.filter(sample => ['exact', 'tolerated'].includes(sample.status) && sample.blockingMetrics.length === 0).length;
  const requiredSamples = normalizeLimit(minimumSamples, 10);
  const requiredConsecutive = normalizeLimit(minimumConsecutivePassing, 5);
  return freezeShadow({
    sampleCount: samples.length,
    passingSamples,
    parityRate: samples.length ? passingSamples / samples.length : 0,
    consecutivePassing,
    blockingCounts,
    readyForActivationReview: samples.length >= requiredSamples && consecutivePassing >= requiredConsecutive && Object.keys(blockingCounts).length === 0,
    requirements: {
      minimumSamples: requiredSamples,
      minimumConsecutivePassing: requiredConsecutive,
      zeroBlockingMetrics: true
    }
  });
}
