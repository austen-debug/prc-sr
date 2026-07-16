import { freezeShadow, shadowText } from './contracts.mjs';
import {
  STATUS_BOARD_DEPLOYMENT_PREREQUISITE_IDS,
  STATUS_BOARD_DEPLOYMENT_PREREQUISITES
} from './review-contract.mjs';

const ALLOWED_STATUSES = Object.freeze(['pass', 'fail', 'pending']);
const PROHIBITED_KEYS = Object.freeze(['secret', 'token', 'password', 'credential', 'cookie']);

function validTimestamp(value) {
  return Boolean(shadowText(value)) && Number.isFinite(Date.parse(value));
}

function limited(value, maximum) {
  return shadowText(value).slice(0, maximum);
}

export function normalizeDeploymentEvidenceEntry(input = {}) {
  const prohibited = PROHIBITED_KEYS.filter(key => Object.prototype.hasOwnProperty.call(input || {}, key));
  if (prohibited.length) throw new TypeError(`Deployment evidence contains prohibited secret fields: ${prohibited.join(', ')}.`);

  const prerequisiteId = shadowText(input.prerequisiteId);
  const status = shadowText(input.status).toLowerCase() || 'pending';
  if (!STATUS_BOARD_DEPLOYMENT_PREREQUISITE_IDS.includes(prerequisiteId)) {
    throw new TypeError(`Unknown deployment prerequisite: ${prerequisiteId || 'missing'}.`);
  }
  if (!ALLOWED_STATUSES.includes(status)) throw new TypeError(`Invalid deployment evidence status for ${prerequisiteId}.`);

  const observedAt = shadowText(input.observedAt);
  if (status !== 'pending' && !validTimestamp(observedAt)) throw new TypeError(`${prerequisiteId} requires a valid observedAt timestamp.`);

  return freezeShadow({
    prerequisiteId,
    status,
    observedAt: status === 'pending' ? '' : observedAt,
    environment: limited(input.environment, 120),
    method: limited(input.method, 240),
    artifactReference: limited(input.artifactReference, 240),
    operatorRole: limited(input.operatorRole, 80),
    notes: limited(input.notes, 500)
  });
}

export function summarizeDeploymentEvidence(entries = []) {
  const latest = new Map();
  for (const raw of Array.isArray(entries) ? entries : []) {
    const entry = normalizeDeploymentEvidenceEntry(raw);
    const current = latest.get(entry.prerequisiteId);
    const currentTime = current?.observedAt ? Date.parse(current.observedAt) : -1;
    const entryTime = entry.observedAt ? Date.parse(entry.observedAt) : -1;
    if (!current || entryTime >= currentTime) latest.set(entry.prerequisiteId, entry);
  }

  const checks = STATUS_BOARD_DEPLOYMENT_PREREQUISITES.map(contract => {
    const entry = latest.get(contract.id);
    return freezeShadow({
      id: contract.id,
      label: contract.label,
      status: entry?.status || 'pending',
      observedAt: entry?.observedAt || '',
      environment: entry?.environment || '',
      method: entry?.method || '',
      artifactReference: entry?.artifactReference || '',
      operatorRole: entry?.operatorRole || ''
    });
  });

  const failed = checks.filter(check => check.status === 'fail').map(check => check.id);
  const pending = checks.filter(check => check.status !== 'pass').map(check => check.id);
  return freezeShadow({
    checks,
    passed: checks.filter(check => check.status === 'pass').length,
    failed,
    pending,
    allPassing: failed.length === 0 && pending.length === 0
  });
}
