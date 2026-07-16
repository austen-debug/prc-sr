import {
  freezeShadow,
  shadowText,
  STATUS_BOARD_SHADOW_METRICS,
  STATUS_BOARD_SHADOW_STATUSES,
  STATUS_BOARD_SHADOW_VERSION
} from './contracts.mjs';
import { createShadowEvidenceLedger } from './evidence-ledger.mjs';
import { normalizeManualEvidenceEntry } from './manual-evidence.mjs';
import { normalizeDeploymentEvidenceEntry } from './deployment-evidence.mjs';
import { normalizeMismatchDisposition } from './mismatch-disposition.mjs';
import {
  buildStatusBoardEvidenceReview,
  validateStatusBoardEvidenceReview
} from './review-evaluator.mjs';
import { STATUS_BOARD_EVIDENCE_REVIEW_VERSION } from './review-contract.mjs';

export const STATUS_BOARD_EVIDENCE_ARTIFACT_VERSION = '3A-C.1.0';
export const STATUS_BOARD_EVIDENCE_ARTIFACT_KIND = 'gate-status-board-evidence';

const ARTIFACT_CONTEXTS = Object.freeze(['live-shadow', 'controlled-review', 'combined']);
const FORBIDDEN_KEYS = new Set([
  'weekGroup',
  'records',
  'record',
  'payload',
  'raw',
  'allData',
  'trainee',
  'airman',
  'name',
  'reviewerName',
  'email',
  'phone',
  'dodId',
  'ssn',
  'secret',
  'token',
  'password',
  'credential',
  'cookie'
]);
const SENSITIVE_TEXT_PATTERNS = Object.freeze([
  Object.freeze({ label: 'email address', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i }),
  Object.freeze({ label: 'Social Security number', pattern: /\b\d{3}-\d{2}-\d{4}\b/ }),
  Object.freeze({ label: 'telephone number', pattern: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/ }),
  Object.freeze({ label: 'long numeric identifier', pattern: /\b\d{9,12}\b/ }),
  Object.freeze({ label: 'credential assignment', pattern: /\b(?:secret|token|password|credential|cookie|authorization)\s*[:=]/i }),
  Object.freeze({ label: 'bearer token', pattern: /\bbearer\s+[A-Z0-9._~+\/-]+/i })
]);

function validTimestamp(value) {
  return Boolean(shadowText(value)) && Number.isFinite(Date.parse(value));
}

function limitedText(value, maximum) {
  return shadowText(value).slice(0, maximum);
}

function assertSafeText(label, value) {
  const text = shadowText(value);
  for (const rule of SENSITIVE_TEXT_PATTERNS) {
    if (rule.pattern.test(text)) throw new TypeError(`${label} contains a prohibited ${rule.label}.`);
  }
  return text;
}

function sanitizeRole(value, label = 'Role') {
  return assertSafeText(label, limitedText(value, 80));
}

function sanitizeReference(value, label = 'Reference') {
  return assertSafeText(label, limitedText(value, 240));
}

function sanitizeNotes(value, label = 'Notes') {
  return assertSafeText(label, limitedText(value, 500));
}

function sanitizeSample(raw = {}) {
  const capturedAt = shadowText(raw.capturedAt);
  if (!validTimestamp(capturedAt)) throw new TypeError('Every retained shadow sample requires a valid capturedAt timestamp.');
  const status = shadowText(raw.status).toLowerCase() || 'unavailable';
  if (!STATUS_BOARD_SHADOW_STATUSES.includes(status)) throw new TypeError(`Invalid retained sample status: ${status}.`);
  const blockingMetrics = [...new Set((Array.isArray(raw.blockingMetrics) ? raw.blockingMetrics : [])
    .map(shadowText)
    .filter(Boolean))];
  for (const metric of blockingMetrics) {
    if (!STATUS_BOARD_SHADOW_METRICS.includes(metric)) throw new TypeError(`Invalid blocking metric in retained sample: ${metric}.`);
  }
  return freezeShadow({
    capturedAt,
    status,
    exact: Math.max(0, Math.trunc(Number(raw.exact) || 0)),
    tolerated: Math.max(0, Math.trunc(Number(raw.tolerated) || 0)),
    mismatched: Math.max(0, Math.trunc(Number(raw.mismatched) || 0)),
    blockingMetrics
  });
}

export function sanitizeShadowEvidenceLedger(ledger = createShadowEvidenceLedger()) {
  const samples = (Array.isArray(ledger?.samples) ? ledger.samples : []).slice(-120).map(sanitizeSample);
  return freezeShadow({
    contractVersion: STATUS_BOARD_SHADOW_VERSION,
    sourceStorage: 'memory-only',
    retainedStorage: 'caller-managed-artifact',
    weekGroupIncluded: false,
    operationalRecordsIncluded: false,
    samples
  });
}

function sanitizeManualEvidence(entries = []) {
  return freezeShadow((Array.isArray(entries) ? entries : []).map((raw, index) => {
    const entry = normalizeManualEvidenceEntry(raw);
    return freezeShadow({
      ...entry,
      environment: sanitizeReference(entry.environment, `Manual evidence ${index + 1} environment`),
      method: sanitizeReference(entry.method, `Manual evidence ${index + 1} method`),
      artifactReference: sanitizeReference(entry.artifactReference, `Manual evidence ${index + 1} artifact reference`),
      reviewerRole: sanitizeRole(entry.reviewerRole, `Manual evidence ${index + 1} reviewer role`),
      notes: sanitizeNotes(entry.notes, `Manual evidence ${index + 1} notes`)
    });
  }));
}

function sanitizeDeploymentEvidence(entries = []) {
  return freezeShadow((Array.isArray(entries) ? entries : []).map((raw, index) => {
    const entry = normalizeDeploymentEvidenceEntry(raw);
    return freezeShadow({
      ...entry,
      environment: sanitizeReference(entry.environment, `Deployment evidence ${index + 1} environment`),
      method: sanitizeReference(entry.method, `Deployment evidence ${index + 1} method`),
      artifactReference: sanitizeReference(entry.artifactReference, `Deployment evidence ${index + 1} artifact reference`),
      operatorRole: sanitizeRole(entry.operatorRole, `Deployment evidence ${index + 1} operator role`),
      notes: sanitizeNotes(entry.notes, `Deployment evidence ${index + 1} notes`)
    });
  }));
}

function sanitizeMismatchDispositions(entries = []) {
  return freezeShadow((Array.isArray(entries) ? entries : []).map((raw, index) => {
    const entry = normalizeMismatchDisposition(raw);
    return freezeShadow({
      ...entry,
      decisionReference: sanitizeReference(entry.decisionReference, `Mismatch disposition ${index + 1} decision reference`),
      rationale: sanitizeNotes(entry.rationale, `Mismatch disposition ${index + 1} rationale`),
      decisionOwnerRole: sanitizeRole(entry.decisionOwnerRole, `Mismatch disposition ${index + 1} owner role`)
    });
  }));
}

function walkForForbiddenKeys(value, path = 'artifact', errors = []) {
  if (!value || typeof value !== 'object') return errors;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_KEYS.has(key)) errors.push(`Forbidden field retained at ${childPath}.`);
    walkForForbiddenKeys(child, childPath, errors);
  }
  return errors;
}

function walkForSensitiveText(value, path = 'artifact', errors = []) {
  if (typeof value === 'string') {
    for (const rule of SENSITIVE_TEXT_PATTERNS) {
      if (rule.pattern.test(value)) errors.push(`Prohibited ${rule.label} detected at ${path}.`);
    }
    return errors;
  }
  if (!value || typeof value !== 'object') return errors;
  for (const [key, child] of Object.entries(value)) walkForSensitiveText(child, `${path}.${key}`, errors);
  return errors;
}

export function buildStatusBoardEvidenceArtifact({
  ledger = createShadowEvidenceLedger(),
  manualEvidence = [],
  mismatchDispositions = [],
  deploymentEvidence = [],
  context = 'live-shadow',
  collectionReference = '',
  collectorRole = '',
  generatedAt = new Date().toISOString()
} = {}) {
  const normalizedContext = shadowText(context).toLowerCase();
  if (!ARTIFACT_CONTEXTS.includes(normalizedContext)) throw new TypeError(`Invalid evidence artifact context: ${normalizedContext || 'missing'}.`);
  if (!validTimestamp(generatedAt)) throw new TypeError('Evidence artifact requires a valid generatedAt timestamp.');

  const sanitizedLedger = sanitizeShadowEvidenceLedger(ledger);
  const sanitizedManual = sanitizeManualEvidence(manualEvidence);
  const sanitizedMismatches = sanitizeMismatchDispositions(mismatchDispositions);
  const sanitizedDeployment = sanitizeDeploymentEvidence(deploymentEvidence);
  const review = buildStatusBoardEvidenceReview({
    ledger: sanitizedLedger,
    manualEvidence: sanitizedManual,
    mismatchDispositions: sanitizedMismatches,
    deploymentEvidence: sanitizedDeployment,
    evaluatedAt: generatedAt
  });
  const reviewValidation = validateStatusBoardEvidenceReview(review);
  if (!reviewValidation.valid) throw new TypeError(reviewValidation.errors.join(' '));

  const artifact = freezeShadow({
    artifactKind: STATUS_BOARD_EVIDENCE_ARTIFACT_KIND,
    artifactVersion: STATUS_BOARD_EVIDENCE_ARTIFACT_VERSION,
    shadowContractVersion: STATUS_BOARD_SHADOW_VERSION,
    reviewContractVersion: STATUS_BOARD_EVIDENCE_REVIEW_VERSION,
    generatedAt: new Date(generatedAt).toISOString(),
    context: normalizedContext,
    collectionReference: sanitizeReference(collectionReference, 'Collection reference'),
    collectorRole: sanitizeRole(collectorRole, 'Collector role'),
    route: 'board',
    source: freezeShadow({
      mode: normalizedContext,
      operationalRecordsIncluded: false,
      weekGroupIncluded: false,
      browserPersistenceUsed: false,
      networkTransferPerformed: false
    }),
    liveEvidence: sanitizedLedger,
    manualEvidence: sanitizedManual,
    mismatchDispositions: sanitizedMismatches,
    deploymentEvidence: sanitizedDeployment,
    review,
    authorization: freezeShadow({
      phase3BAuthorized: false,
      productionRouteActivated: false,
      productionWritesAuthorized: false,
      build1RetirementAuthorized: false,
      explicitGovernanceDecisionRequired: true
    })
  });

  const validation = validateStatusBoardEvidenceArtifact(artifact);
  if (!validation.valid) throw new TypeError(validation.errors.join(' '));
  return artifact;
}

export function validateStatusBoardEvidenceArtifact(artifact) {
  const errors = [];
  if (artifact?.artifactKind !== STATUS_BOARD_EVIDENCE_ARTIFACT_KIND) errors.push('Invalid evidence artifact kind.');
  if (artifact?.artifactVersion !== STATUS_BOARD_EVIDENCE_ARTIFACT_VERSION) errors.push('Invalid evidence artifact version.');
  if (!validTimestamp(artifact?.generatedAt)) errors.push('Evidence artifact generatedAt is invalid.');
  if (!ARTIFACT_CONTEXTS.includes(artifact?.context)) errors.push('Evidence artifact context is invalid.');
  if (artifact?.route !== 'board') errors.push('Evidence artifact must target the Status Board route.');
  if (artifact?.source?.operationalRecordsIncluded !== false) errors.push('Evidence artifact may not include operational records.');
  if (artifact?.source?.weekGroupIncluded !== false) errors.push('Evidence artifact may not retain Week Group identifiers.');
  if (artifact?.source?.browserPersistenceUsed !== false) errors.push('Evidence artifact may not rely on browser persistence.');
  if (artifact?.source?.networkTransferPerformed !== false) errors.push('Evidence artifact builder may not transfer evidence over the network.');
  if (artifact?.authorization?.phase3BAuthorized !== false) errors.push('Evidence artifact may not authorize Phase 3B.');
  if (artifact?.authorization?.productionRouteActivated !== false) errors.push('Evidence artifact may not activate production.');
  if (artifact?.authorization?.productionWritesAuthorized !== false) errors.push('Evidence artifact may not authorize production writes.');
  if (artifact?.authorization?.build1RetirementAuthorized !== false) errors.push('Evidence artifact may not authorize Build 1 retirement.');
  if (artifact?.authorization?.explicitGovernanceDecisionRequired !== true) errors.push('Evidence artifact must require an explicit governance decision.');
  errors.push(...walkForForbiddenKeys(artifact));
  errors.push(...walkForSensitiveText(artifact));
  const reviewValidation = validateStatusBoardEvidenceReview(artifact?.review);
  if (!reviewValidation.valid) errors.push(...reviewValidation.errors);
  return freezeShadow({ valid: errors.length === 0, errors: freezeShadow(errors) });
}

export function serializeStatusBoardEvidenceArtifact(artifact) {
  const validation = validateStatusBoardEvidenceArtifact(artifact);
  if (!validation.valid) throw new TypeError(validation.errors.join(' '));
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

export function parseStatusBoardEvidenceArtifact(value) {
  const artifact = typeof value === 'string' ? JSON.parse(value) : value;
  const validation = validateStatusBoardEvidenceArtifact(artifact);
  if (!validation.valid) throw new TypeError(validation.errors.join(' '));
  return freezeShadow(artifact);
}

export function buildStatusBoardEvidenceFilename(artifact) {
  const validation = validateStatusBoardEvidenceArtifact(artifact);
  if (!validation.valid) throw new TypeError(validation.errors.join(' '));
  const stamp = artifact.generatedAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `gate-status-board-evidence-${stamp}.json`;
}

export function prepareStatusBoardEvidenceDownload(artifact) {
  const content = serializeStatusBoardEvidenceArtifact(artifact);
  return freezeShadow({
    filename: buildStatusBoardEvidenceFilename(artifact),
    contentType: 'application/json',
    bytes: new TextEncoder().encode(content).byteLength,
    content,
    reviewStatus: artifact.review.status,
    phase3BAuthorized: false
  });
}
