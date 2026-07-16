import {
  renderGateBusCard,
  renderGateDormCard,
  renderGateMetricCard,
  renderGateStatusPill
} from '../../components/index.mjs';
import { POSTURE_IDS, getPosture } from '../../responsive/posture-registry.mjs';
import {
  STATUS_BOARD_DEPLOYMENT_PREREQUISITES,
  STATUS_BOARD_MANUAL_CHECKS,
  STATUS_BOARD_POSTURE_CONTRACTS,
  buildStatusBoardEvidenceReview,
  createShadowEvidenceLedger,
  normalizeDeploymentEvidenceEntry,
  normalizeManualEvidenceEntry,
  validateStatusBoardEvidenceReview
} from '../index.mjs';
import { REVIEW_CONNECTION_STATES, STATUS_BOARD_REVIEW_FIXTURE } from './fixtures.mjs';

const POSTURE_DIMENSIONS = Object.freeze({
  'desktop-landscape': Object.freeze({ width: 1440, height: 900 }),
  'desktop-vertical': Object.freeze({ width: 1024, height: 1280 }),
  'tablet-landscape': Object.freeze({ width: 1024, height: 768 }),
  'tablet-portrait': Object.freeze({ width: 768, height: 1024 }),
  'phone-landscape': Object.freeze({ width: 844, height: 390 }),
  'phone-portrait': Object.freeze({ width: 390, height: 844 })
});

const postureSelect = document.getElementById('review-posture');
const themeSelect = document.getElementById('review-theme');
const connectionSelect = document.getElementById('review-connection');
const fullscreenButton = document.getElementById('review-fullscreen');
const refreshButton = document.getElementById('review-refresh');
const announcement = document.getElementById('review-announcement');
const viewport = document.getElementById('review-viewport');
const board = document.getElementById('review-board');
const postureDescription = document.getElementById('review-posture-description');
const manualChecksRoot = document.getElementById('manual-checks');
const deploymentChecksRoot = document.getElementById('deployment-checks');
const environmentInput = document.getElementById('review-environment');
const methodInput = document.getElementById('review-method');
const reviewerRoleInput = document.getElementById('review-role');
const ledgerInput = document.getElementById('review-ledger');
const dispositionsInput = document.getElementById('review-dispositions');
const output = document.getElementById('review-output');
const evaluateButton = document.getElementById('review-evaluate');
const resetButton = document.getElementById('review-reset');

let fullscreenReturnFocus = null;
let connectionState = 'current';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function announce(message) {
  announcement.textContent = String(message || '');
}

function postureOptions() {
  postureSelect.innerHTML = POSTURE_IDS.map(id => {
    const posture = getPosture(id);
    return `<option value="${escapeHtml(id)}">${escapeHtml(posture.label)}</option>`;
  }).join('');
  postureSelect.value = 'desktop-landscape';
}

function connectionOptions() {
  connectionSelect.innerHTML = REVIEW_CONNECTION_STATES
    .map(state => `<option value="${escapeHtml(state.id)}">${escapeHtml(state.label)}</option>`)
    .join('');
  connectionSelect.value = connectionState;
}

function groupedDormMarkup() {
  const states = ['empty', 'open', 'closed'];
  return states.map(state => {
    const cards = STATUS_BOARD_REVIEW_FIXTURE.dorms
      .filter(dorm => dorm.state === state)
      .map(renderGateDormCard)
      .join('');
    return `<section class="review-board__state-region" aria-labelledby="review-${state}-title"><h3 id="review-${state}-title">${escapeHtml(state[0].toUpperCase() + state.slice(1))}</h3><div class="review-board__state-list">${cards || '<p>No review fixtures in this state.</p>'}</div></section>`;
  }).join('');
}

function connectionContract(id = connectionState) {
  return REVIEW_CONNECTION_STATES.find(state => state.id === id) || REVIEW_CONNECTION_STATES[0];
}

function renderBoard() {
  const currentConnection = connectionContract();
  const degraded = currentConnection.id === 'current'
    ? '<section class="review-board__degraded" hidden></section>'
    : `<section class="review-board__degraded" role="status" aria-live="polite"><strong>${escapeHtml(currentConnection.label)}</strong><span>${escapeHtml(currentConnection.message)}</span><small>Last synchronized ${escapeHtml(STATUS_BOARD_REVIEW_FIXTURE.lastSynchronizedAt)}</small></section>`;

  board.dataset.reviewState = currentConnection.id;
  board.setAttribute('aria-readonly', currentConnection.readOnly ? 'true' : 'false');
  board.innerHTML = [
    `<header class="review-board__banner"><div><p class="review-eyebrow">Gateway Arrival Tracking Environment</p><h2>GATE Status Board</h2><p>Week Group ${escapeHtml(STATUS_BOARD_REVIEW_FIXTURE.weekGroup)}</p></div><div>${renderGateStatusPill({ state: currentConnection.id === 'current' ? 'saved' : 'stale', label: currentConnection.label, live: false })}<button id="review-fullscreen-exit" class="gate-button gate-button--secondary" type="button" hidden>Exit fullscreen</button></div></header>`,
    '<nav class="review-board__nav" aria-label="Primary"><ul><li><a href="#review-board" aria-current="page">Status Board</a></li><li><a href="#review-board">Airport</a></li><li><a href="#review-board">Input</a></li><li><a href="#review-board">Processing</a></li><li><a href="#review-board">Archives</a></li><li><a href="#review-board">Squadron Board</a></li></ul></nav>',
    degraded,
    `<main aria-labelledby="review-route-heading"><section class="review-board__section"><h2 id="review-route-heading">Status Board</h2><div class="review-board__metrics">${STATUS_BOARD_REVIEW_FIXTURE.metrics.map(renderGateMetricCard).join('')}</div></section><section class="review-board__section" aria-labelledby="review-active-buses-title"><h2 id="review-active-buses-title">Active buses en route</h2><div class="review-board__buses">${STATUS_BOARD_REVIEW_FIXTURE.buses.map(renderGateBusCard).join('')}</div></section><section class="review-board__section" aria-labelledby="review-dorms-title"><h2 id="review-dorms-title">Dorm processing status</h2><div class="review-board__dorms">${groupedDormMarkup()}</div></section></main>`
  ].join('');

  document.getElementById('review-fullscreen-exit')?.addEventListener('click', exitFullscreen);
}

function applyPosture(id) {
  const posture = getPosture(id);
  const dimensions = POSTURE_DIMENSIONS[posture.id];
  const route = STATUS_BOARD_POSTURE_CONTRACTS[posture.id];
  document.documentElement.dataset.gateDensity = posture.shell.defaultDensity;
  viewport.style.setProperty('--review-viewport-inline', `${dimensions.width}px`);
  viewport.style.setProperty('--review-viewport-block', `${dimensions.height}px`);
  board.style.setProperty('--review-viewport-inline', `${dimensions.width}px`);
  board.style.setProperty('--review-viewport-block', `${dimensions.height}px`);
  board.style.setProperty('--review-metric-columns', String(route.metricColumns));
  board.style.setProperty('--review-dorm-columns', route.dormPresentation.startsWith('three-columns') ? '3' : '1');
  board.dataset.reviewPosture = posture.id;
  postureDescription.textContent = `${posture.label}: ${dimensions.width} × ${dimensions.height}; ${route.dormPresentation}; ${route.activeBusPresentation}; ${route.fullscreen}.`;
  announce(`${posture.label} review posture selected.`);
}

function checkMarkup(item, kind) {
  const id = `${kind}-${item.id.replaceAll('.', '-')}`;
  const detail = item.posture ? `<small>${escapeHtml(item.posture)}</small>` : '';
  return `<div class="review-check" data-review-${kind}="${escapeHtml(item.id)}"><div class="review-check__row"><label for="${id}-status">${escapeHtml(item.label)}${detail}</label><select id="${id}-status" data-review-status><option value="pending">Pending</option><option value="pass">Pass</option><option value="fail">Fail</option></select></div><label for="${id}-artifact">Artifact reference</label><input id="${id}-artifact" data-review-artifact type="text" maxlength="240" placeholder="Issue comment, screenshot, test log, or controlled artifact reference"></div>`;
}

function renderEvidenceForms() {
  manualChecksRoot.className = 'review-check-list';
  deploymentChecksRoot.className = 'review-check-list';
  manualChecksRoot.innerHTML = STATUS_BOARD_MANUAL_CHECKS.map(item => checkMarkup(item, 'manual')).join('');
  deploymentChecksRoot.innerHTML = STATUS_BOARD_DEPLOYMENT_PREREQUISITES.map(item => checkMarkup(item, 'deployment')).join('');
}

function parseJsonInput(element, fallback) {
  const source = element.value.trim();
  if (!source) return fallback;
  return JSON.parse(source);
}

function evidenceMetadata() {
  return {
    environment: environmentInput.value.trim(),
    method: methodInput.value.trim(),
    reviewerRole: reviewerRoleInput.value.trim()
  };
}

function collectManualEvidence() {
  const shared = evidenceMetadata();
  return [...manualChecksRoot.querySelectorAll('[data-review-manual]')].map(container => {
    const status = container.querySelector('[data-review-status]').value;
    return normalizeManualEvidenceEntry({
      checkId: container.dataset.reviewManual,
      status,
      observedAt: status === 'pending' ? '' : new Date().toISOString(),
      environment: shared.environment,
      method: shared.method,
      artifactReference: container.querySelector('[data-review-artifact]').value.trim(),
      reviewerRole: shared.reviewerRole
    });
  });
}

function collectDeploymentEvidence() {
  const shared = evidenceMetadata();
  return [...deploymentChecksRoot.querySelectorAll('[data-review-deployment]')].map(container => {
    const status = container.querySelector('[data-review-status]').value;
    return normalizeDeploymentEvidenceEntry({
      prerequisiteId: container.dataset.reviewDeployment,
      status,
      observedAt: status === 'pending' ? '' : new Date().toISOString(),
      environment: shared.environment,
      method: shared.method,
      artifactReference: container.querySelector('[data-review-artifact]').value.trim(),
      operatorRole: shared.reviewerRole
    });
  });
}

function evaluatePacket() {
  try {
    const ledger = parseJsonInput(ledgerInput, createShadowEvidenceLedger());
    const mismatchDispositions = parseJsonInput(dispositionsInput, []);
    if (!Array.isArray(mismatchDispositions)) throw new TypeError('Mismatch dispositions must be a JSON array.');
    const review = buildStatusBoardEvidenceReview({
      ledger,
      manualEvidence: collectManualEvidence(),
      mismatchDispositions,
      deploymentEvidence: collectDeploymentEvidence()
    });
    const validation = validateStatusBoardEvidenceReview(review);
    if (!validation.valid) throw new TypeError(validation.errors.join(' '));
    output.value = JSON.stringify(review, null, 2);
    announce(`Evidence packet evaluated: ${review.status}. Phase 3B remains unauthorized.`);
  } catch (error) {
    output.value = '';
    announce(`Evidence packet error: ${String(error?.message || error)}`);
  }
}

function resetEvidenceForm() {
  for (const select of document.querySelectorAll('[data-review-status]')) select.value = 'pending';
  for (const input of document.querySelectorAll('[data-review-artifact]')) input.value = '';
  ledgerInput.value = '';
  dispositionsInput.value = '';
  output.value = '';
  announce('Evidence form reset. No evidence was persisted.');
}

async function enterFullscreen() {
  if (!board.requestFullscreen) {
    announce('Fullscreen API is unavailable in this environment.');
    return;
  }
  fullscreenReturnFocus = fullscreenButton;
  await board.requestFullscreen();
}

async function exitFullscreen() {
  if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
}

function handleFullscreenChange() {
  const active = document.fullscreenElement === board;
  fullscreenButton.textContent = active ? 'Fullscreen active' : 'Enter fullscreen';
  fullscreenButton.disabled = active;
  const exitButton = document.getElementById('review-fullscreen-exit');
  if (exitButton) {
    exitButton.hidden = !active;
    if (active) exitButton.focus();
  }
  if (!active && fullscreenReturnFocus) {
    fullscreenReturnFocus.focus();
    fullscreenReturnFocus = null;
    announce('Fullscreen exited. Focus returned to the initiating control.');
  }
}

postureSelect.addEventListener('change', event => applyPosture(event.target.value));
themeSelect.addEventListener('change', event => {
  document.documentElement.dataset.gateTheme = event.target.value;
  announce(`${event.target.value} theme selected.`);
});
connectionSelect.addEventListener('change', event => {
  connectionState = event.target.value;
  renderBoard();
  applyPosture(postureSelect.value);
  const current = connectionContract();
  announce(`${current.label}. ${current.message}`);
});
fullscreenButton.addEventListener('click', enterFullscreen);
refreshButton.addEventListener('click', () => {
  connectionState = 'current';
  connectionSelect.value = 'current';
  renderBoard();
  applyPosture(postureSelect.value);
  announce('Authoritative refresh simulated. Current state restored.');
});
evaluateButton.addEventListener('click', evaluatePacket);
resetButton.addEventListener('click', resetEvidenceForm);
document.addEventListener('fullscreenchange', handleFullscreenChange);

postureOptions();
connectionOptions();
renderEvidenceForms();
renderBoard();
applyPosture(postureSelect.value);
announce('Fixture-only evidence harness loaded. Phase 3B remains unauthorized.');
