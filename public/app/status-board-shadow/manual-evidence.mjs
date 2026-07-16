import { freezeShadow, shadowText } from './contracts.mjs';
import {
  STATUS_BOARD_MANUAL_CHECK_IDS,
  STATUS_BOARD_MANUAL_CHECKS
} from './review-contract.mjs';

const ALLOWED_STATUSES = Object.freeze(['pass', 'fail', 'pending']);
const PROHIBITED_KEYS = Object.freeze([
  'name',
  'reviewerName',
  'email',
  'phone',
  'trainee',
  'airman',
  'dodId',
  'ssn'
]);

function limitedText(value, maximum = 500) {
  return shadowText(value).slice(0, maximum);
}

function validTimestamp(value) {
  return Boolean(shadowText(value)) && Number.isFinite(Date.parse(value));
}

function rejectProhibitedFields(entry) {
  const prohibited = PROHIBITED_KEYS.filter(key => Object.prototype.hasOwnProperty.call(entry || {}, key));
  if (prohibited.length) throw new TypeError(`Manual evidence contains prohibited identity fields: ${prohibited.join(', ')}.`);
}

export function normalizeManualEvidenceEntry(entry = {}) {
  rejectProhibitedFields(entry);
  const checkId = shadowText(entry.checkId);
  const status = shadowText(entry.status).toLowerCase() || 'pending';
  if (!STATUS_BOARD_MANUAL_CHECK_IDS.includes(checkId)) throw new TypeError(`Unknown manual evidence check: ${checkId || 'missing'}.`);
  if (!ALLOWED_STATUSES.includes(status)) throw new TypeError(`Invalid manual evidence status for ${checkId}.`);
  const observedAt = shadowText(entry.observedAt);
  if (status !== 'pending' && !validTimestamp(observedAt)) throw new TypeError(`${checkId} requires a valid observedAt timestamp.`);

  return freezeShadow({
    checkId,
    status,
    observedAt: status === 'pending' ? '' : observedAt,
    environment: limitedText(entry.environment, 120),
    method: limitedText(entry.method, 240),
    artifactReference: limitedText(entry.artifactReference, 240),
    reviewerRole: limitedText(entry.reviewerRole, 80),
    notes: limitedText(entry.notes, 500)
  });
}

function latestEntryByCheck(entries = []) {
  const latest = new Map();
  for (const raw of Array.isArray(entries) ? entries : []) {
    const entry = normalizeManualEvidenceEntry(raw);
    const current = latest.get(entry.checkId);
    const currentTime = current?.observedAt ? Date.parse(current.observedAt) : -1;
    const entryTime = entry.observedAt ? Date.parse(entry.observedAt) : -1;
    if (!current || entryTime >= currentTime) latest.set(entry.checkId, entry);
  }
  return latest;
}

export function summarizeManualEvidence(entries = []) {
  const latest = latestEntryByCheck(entries);
  const checks = STATUS_BOARD_MANUAL_CHECKS.map(contract => {
    const entry = latest.get(contract.id);
    return freezeShadow({
      id: contract.id,
      category: contract.category,
      posture: contract.posture || '',
      label: contract.label,
      required: contract.required,
      status: entry?.status || 'pending',
      observedAt: entry?.observedAt || '',
      environment: entry?.environment || '',
      method: entry?.method || '',
      artifactReference: entry?.artifactReference || '',
      reviewerRole: entry?.reviewerRole || ''
    });
  });

  const categories = {};
  for (const check of checks) {
    if (!categories[check.category]) categories[check.category] = { pass: 0, fail: 0, pending: 0 };
    categories[check.category][check.status] += 1;
  }
  const failed = checks.filter(check => check.status === 'fail').map(check => check.id);
  const pending = checks.filter(check => check.required && check.status === 'pending').map(check => check.id);

  return freezeShadow({
    checks,
    categories,
    passed: checks.filter(check => check.status === 'pass').length,
    failed,
    pending,
    allRequiredPassing: failed.length === 0 && pending.length === 0
  });
}
