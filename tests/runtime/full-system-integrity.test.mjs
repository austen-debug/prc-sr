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

test('canonical page and workflow owners remain exposed', async () => {
  const contracts = [
    ['public/js/gate-status-board-controller.js', /window\.GateStatusBoardController\s*=\s*Object\.freeze/],
    ['public/js/gate-processing-controller.js', /window\.GateProcessingController\s*=\s*Object\.freeze/],
    ['public/js/gate-bus-workflow-controller.js', /window\.GateBusWorkflowController\s*=\s*Object\.freeze/],
    ['public/js/gate-input-page-controller.js', /window\.GateInputPageController\s*=\s*Object\.freeze/],
    ['public/js/gate-archive-controller.js', /window\.GateArchiveController\s*=\s*Object\.freeze/],
    ['public/js/gate-app-shell-controller.js', /window\.GateAppShell/],
    ['public/js/gate-permission-guard.js', /window\.GatePermissionGuard/],
    ['public/js/gate-premium-metrics-controller.js', /window\.GatePremiumMetricsController/]
  ];
  for (const [path, pattern] of contracts) {
    assert.match(await source(path), pattern, `${path} lost its canonical global`);
  }
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
  assert.match(css, /#mobile-menu-trigger,[\s\S]*#gate-mobile-nav-sheet,[\s\S]*display:\s*none/);
  assert.doesNotMatch(css, /#week-group-display,\s*#mobile-menu-trigger\s*\{\s*display:\s*inline-flex/);
  assert.match(css, /@media \(max-width:\s*767px\)[\s\S]*#gate-mobile-nav-sheet\.gate-mobile-sheet-open[\s\S]*display:\s*grid/);
  assert.match(css, /@media \(max-width:\s*767px\)[\s\S]*#main-nav-menu,[\s\S]*display:\s*none/);
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

test('runtime workflows are keyed to the canonical stylesheet', async () => {
  for (const path of [
    '.github/workflows/runtime-record-integrity-tests.yml',
    '.github/workflows/build-2-audit-remediation-gate-1.yml'
  ]) {
    const workflow = await source(path);
    assert.match(workflow, /public\/css\/military-glass-terminal\.css/);
    assert.doesNotMatch(workflow, /public\/css\/(?:gate-utilities-access|gate-premium-metrics|gate-ui-ownership-correction|gate-fullscreen-board-contract)\.css/);
  }
});
