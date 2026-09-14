import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const source = path => readFile(resolve(root, path), 'utf8');
const exists = path => access(resolve(root, path));
const pathOnly = value => String(value || '').split('?')[0];

function arrayBlock(text, name) {
  const match = text.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\];`));
  assert.ok(match, `${name} must remain statically auditable`);
  return match[1];
}

function attrs(text, attribute) {
  return [...text.matchAll(new RegExp(`${attribute}="([^"]+)"`, 'g'))].map(match => match[1]);
}

function controllerBlock(text, name) {
  const marker = `window.${name} = Object.freeze({`;
  const start = text.indexOf(marker);
  assert.notEqual(start, -1, `${name} canonical contract is missing`);
  const end = text.indexOf('\n    });', start);
  assert.notEqual(end, -1, `${name} canonical contract is not statically bounded`);
  return text.slice(start, end);
}

function assertControllerMethods(text, name, methods) {
  const block = controllerBlock(text, name);
  for (const method of methods) {
    assert.match(block, new RegExp(`\\b${method}\\b\\s*(?::|,)`), `${name}.${method} is missing`);
  }
}

test('all active middleware assets exist and every active JavaScript file parses', async () => {
  const middleware = await source('functions/_middleware.js');
  const styles = attrs(arrayBlock(middleware, 'UI_STYLESHEETS'), 'href').map(pathOnly);
  const scripts = attrs(arrayBlock(middleware, 'UI_HEAD_SCRIPTS'), 'src').map(pathOnly);
  assert.deepEqual(styles, ['/css/military-glass-terminal.css']);
  assert.equal(scripts.length, 27);
  for (const asset of [...styles, ...scripts]) await exists(`public${asset}`);
  for (const asset of scripts) {
    const result = spawnSync(process.execPath, ['--check', resolve(root, `public${asset}`)], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${asset} failed parse check: ${result.stderr}`);
  }
});

test('all six operational routes and their critical DOM surfaces remain present', async () => {
  const html = await source('public/index.html');
  for (const id of ['page-board', 'page-airport', 'page-input', 'page-processing', 'page-archives']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `${id} missing from base DOM`);
  }
  for (const id of [
    'active-buses', 'col-empty', 'col-open', 'col-closed',
    'airport-form', 'airport-bus-log-body',
    'wg-batch-input', 'batch-grid-wrapper', 'batch-rows-container', 'init-wg-btn',
    'proc-dorm-grid', 'dorm-modal', 'dorm-edit-modal',
    'archive-history', 'local-bus-modal', 'airport-bus-edit-modal', 'confirm-dialog'
  ]) assert.match(html, new RegExp(`id=["']${id}["']`), `${id} missing from base DOM`);

  const squadron = await source('public/js/prc-dash-final-audit.js');
  assert.match(squadron, /page-squadron/);
  assert.match(squadron, /gate-squadron-page/);
});

test('canonical workflow owners retain the required operational function contracts', async () => {
  const status = await source('public/js/gate-status-board-controller.js');
  assertControllerMethods(status, 'GateStatusBoardController', [
    'render', 'scheduleRender', 'renderDormColumns', 'renderActiveBuses',
    'updateBoardTimers', 'computeElapsedTimer', 'ensureTimerOwner',
    'restartTimerOwner', 'repairSurfaces', 'diagnostics', 'getDorms', 'getActiveBuses'
  ]);

  const processing = await source('public/js/gate-processing-controller.js');
  assertControllerMethods(processing, 'GateProcessingController', [
    'render', 'scheduleRender', 'openDormModal', 'closeDormModal', 'openDorm',
    'closeDorm', 'reopenDorm', 'openDormEditModal', 'closeDormEditModal',
    'saveLoad', 'saveAssignedAirman', 'updateDorm', 'refresh'
  ]);

  const buses = await source('public/js/gate-bus-workflow-controller.js');
  assertControllerMethods(buses, 'GateBusWorkflowController', [
    'renderBusLog', 'openBusModal', 'closeBusModal', 'openLocalBusModal',
    'closeLocalBusModal', 'confirmBusArrival', 'refresh', 'getEditableBuses'
  ]);
  assert.match(buses, /function createAirport\(/);
  assert.match(buses, /function createLocal\(/);
  assert.match(buses, /function updateBus\(/);

  const input = await source('public/js/gate-input-page-controller.js');
  assertControllerMethods(input, 'GateInputPageController', [
    'renderBatchGrid', 'clearBatchRow', 'initializeWeekGroup', 'returnToBoard',
    'refresh', 'collectReceivingWindows', 'validateReceivingWindows',
    'preflightInitialization', 'findDuplicateDormIdentity', 'buildDormPayload', 'getRows'
  ]);

  const archive = await source('public/js/gate-archive-controller.js');
  assertControllerMethods(archive, 'GateArchiveController', [
    'buildArchivePayload', 'runSafeCloseout', 'initiateCloseout', 'renderArchives',
    'openArchiveEditModal', 'closeArchiveEditModal', 'printArchiveReport',
    'printCurrentSummaryReport', 'refresh'
  ]);

  const shell = await source('public/js/gate-app-shell-controller.js');
  assertControllerMethods(shell, 'GateAppShell', [
    'go', 'renderNav', 'allowedPages', 'pageIsAllowed', 'currentPage', 'setDrawer', 'sync'
  ]);

  const guard = await source('public/js/gate-permission-guard.js');
  assertControllerMethods(guard, 'GatePermissionGuard', [
    'role', 'isInstructor', 'allowedPagesForRole', 'pageIsAllowed', 'enforce'
  ]);

  const metrics = await source('public/js/gate-premium-metrics-controller.js');
  assertControllerMethods(metrics, 'GatePremiumMetricsController', [
    'sync', 'syncLocalClock', 'restartLiveClock'
  ]);
});

test('login, session, and authentication surfaces remain reachable', async () => {
  const redirect = await source('public/login.html');
  const login = await source('public/login/index.html');
  assert.match(redirect, /url=\/login\//);
  assert.match(login, /id="login-form"/);
  assert.match(login, /id="username"/);
  assert.match(login, /id="password"/);
  assert.match(login, /fetch\('\/api\/login'/);
  assert.match(login, /\/css\/military-glass-terminal\.css/);
  await exists('functions/api/login.js');
  await exists('functions/api/logout.js');
  await exists('functions/api/session.js');
});

test('backend CRUD, session, SAT, and archive endpoints remain present without changing persistence', async () => {
  for (const path of [
    'functions/api/records.js', 'functions/api/records-contract.mjs',
    'functions/api/session.js', 'functions/api/session-contract.mjs',
    'functions/api/login.js', 'functions/api/logout.js', 'functions/api/ping.js',
    'functions/api/sat-arrivals.js', 'functions/api/archive-delete.js'
  ]) await exists(path);
  const records = await source('functions/api/records.js');
  for (const method of ['Get', 'Post', 'Put', 'Delete']) {
    assert.match(records, new RegExp(`export async function onRequest${method}`));
  }
  assert.match(records, /\.prepare\([\s\S]*?\.bind\(/);
});

test('authoritative records refresh contract remains live and mutation-confirmed', async () => {
  const html = await source('public/index.html');
  assert.match(html, /const API_URL = ['"]\/api\/records['"]/);
  assert.match(html, /await refresh\(true\);[\s\S]*setInterval\(\(\) => \{[\s\S]*refresh\(\)/);
  assert.match(html, /\}, 3000\);/);
  assert.ok((html.match(/if \(result\.isOk\) \{\s*await refresh\(true\);\s*\}/g) || []).length >= 3);
});

test('canonical CSS preserves desktop/mobile shell ownership and accepted phone workflows', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const shell = await source('public/js/gate-app-shell-controller.js');
  const mediaMatch = shell.match(/const MOBILE_MEDIA = '([^']+)'/);
  assert.ok(mediaMatch, 'GateAppShell mobile media contract is missing');
  assert.ok(css.includes(`@media ${mediaMatch[1]} {`), 'CSS mobile shell breakpoint must match GateAppShell');

  assert.match(css, /#mobile-menu-trigger,[\s\S]*#gate-mobile-nav-sheet,[\s\S]*display:\s*none/);
  assert.doesNotMatch(css, /#week-group-display,\s*#mobile-menu-trigger\s*\{\s*display:\s*inline-flex/);
  assert.match(css, /#mobile-menu-trigger\s*\{[\s\S]*display:\s*inline-flex[\s\S]*visibility:\s*visible[\s\S]*pointer-events:\s*auto/);
  assert.match(css, /gate-mobile-drawer-open #gate-mobile-menu-scrim\s*\{[\s\S]*display:\s*block[\s\S]*visibility:\s*visible[\s\S]*pointer-events:\s*auto/);
  assert.match(css, /#gate-mobile-nav-sheet\.gate-mobile-sheet-open[\s\S]*display:\s*grid[\s\S]*visibility:\s*visible[\s\S]*pointer-events:\s*auto/);
  assert.match(css, /#main-nav-menu,[\s\S]*display:\s*none[\s\S]*visibility:\s*hidden/);
  assert.match(css, /#page-airport #airport-form input,[\s\S]*font-size:\s*16px/);
  assert.match(css, /#page-airport \.surface:has\(#airport-bus-log-body\)[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /button::before[\s\S]*content:\s*"BACK"/);
});

test('background is route-scoped and the global tactical grid is retired', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  assert.match(css, /body::before\s*\{[\s\S]*content:\s*none[\s\S]*display:\s*none/);
  assert.match(css, /body\.gate-app-shell-ready\.gate-watermark-page::after/);
  assert.doesNotMatch(css, /background-size:\s*32px 32px,\s*32px 32px/);
});

test('runtime workflows are keyed to the canonical runtime instead of deleted CSS assets', async () => {
  for (const path of [
    '.github/workflows/runtime-record-integrity-tests.yml',
    '.github/workflows/build-2-audit-remediation-gate-1.yml'
  ]) {
    const workflow = await source(path);
    assert.match(workflow, /public\/css\/military-glass-terminal\.css/);
    assert.match(workflow, /public\/js\/\*\*/);
    assert.doesNotMatch(workflow, /public\/css\/(?:gate-utilities-access|gate-premium-metrics|gate-ui-ownership-correction|gate-fullscreen-board-contract)\.css/);
  }
});
