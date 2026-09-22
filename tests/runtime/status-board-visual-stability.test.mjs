import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
}

async function transformedIndex() {
  const middleware = await source('functions/_middleware.js');
  const index = await source('public/index.html');
  // vm.Script tests the pure legacy HTML transformer, not the imported Pages session verifier.
  // Strip only the exact ESM import; retain all production transformation logic unchanged.
  const executable = `${middleware.replace("import { verifyRequestSession } from './api/session-contract.mjs';", '').replace('export async function onRequest', 'async function onRequest')}\nglobalThis.__gateTransform = applyStatusBoardMetricSourceRefactor;`;
  const sandbox = {
    console,
    TextEncoder,
    URL,
    Headers,
    Response,
    Request,
    crypto: globalThis.crypto,
    atob: globalThis.atob,
    btoa: globalThis.btoa
  };
  vm.runInNewContext(executable, sandbox, { filename: 'functions/_middleware.js' });
  return { middleware, transformed: sandbox.__gateTransform(index) };
}

test('Status Board observer is limited to direct canonical render surfaces', async () => {
  const controller = await source('public/js/gate-status-board-controller.js');

  assert.match(controller, /SURFACE_IDS\s*=\s*Object\.freeze\(\['col-empty', 'col-open', 'col-closed', 'active-buses'\]\)/);
  assert.match(controller, /surfaceObserver\.observe\(surface, \{ childList: true \}\)/);
  assert.doesNotMatch(controller, /observe\(board,\s*\{\s*childList:\s*true,\s*subtree:\s*true/);
  assert.doesNotMatch(controller, /addEventListener\('resize',[\s\S]*scheduleRender\(\{ force: true \}\)/);
  assert.doesNotMatch(controller, /addEventListener\('orientationchange',[\s\S]*scheduleRender\(\{ force: true \}\)/);
});

test('Status Board renders dorm states incrementally and exposes diagnostics', async () => {
  const controller = await source('public/js/gate-status-board-controller.js');

  assert.match(controller, /lastDormSignatures\s*=\s*new Map/);
  assert.match(controller, /signature === lastDormSignatures\.get\(state\) && complete/);
  assert.match(controller, /renderStats\.columnWrites/);
  assert.match(controller, /diagnostics/);
  assert.match(controller, /repairStatusBoardSurfaces/);
});

test('Status Board timer geometry is fixed-width and non-animated', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const controller = await source('public/js/gate-status-board-controller.js');

  assert.match(css, /\.gate-dorm-timer\s*\{[\s\S]*width:\s*6\.35ch[\s\S]*min-width:\s*6\.35ch/);
  assert.match(css, /\.gate-dorm-timer\s*\{[\s\S]*font-family:\s*var\(--mg-font-mono\)/);
  assert.match(css, /--mg-font-mono:\s*"IBM Plex Mono",\s*"JetBrains Mono",\s*"SFMono-Regular",\s*Consolas/);
  assert.match(css, /\.font-tabular,[\s\S]*font-feature-settings:\s*"tnum" 1/);
  assert.match(css, /\.timer-display,[\s\S]*animation:\s*none/);
  assert.match(controller, /timer\.classList\.remove\('timer-flash'\)/);
});

test('Status Board metrics use fluid bounded typography inside the canonical grid', async () => {
  const css = await source('public/css/military-glass-terminal.css');

  assert.match(css, /#page-board \.gate-metrics-container\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /#page-board \.metric-value,[\s\S]*font-size:\s*clamp\(1\.8rem,\s*2\.4vw,\s*3rem\)/);
  assert.match(css, /font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /@media \(max-width:\s*767px\)[\s\S]*metric-value[\s\S]*font-size:\s*clamp\(1\.65rem,\s*8vw,\s*2\.35rem\)/);
});

test('Metric synchronization is change-only and the Local clock is second-aligned', async () => {
  const metricsController = await source('public/js/gate-premium-metrics-controller.js');

  assert.match(metricsController, /if \(element\.textContent === next\) return false/);
  assert.match(metricsController, /1000 - \(Date\.now\(\) % 1000\)/);
  assert.match(metricsController, /const seconds = String\(now\.getSeconds\(\)\)\.padStart\(2, '0'\)/);
  assert.match(metricsController, /return `\$\{hours\}:\$\{minutes\}:\$\{seconds\}`/);
  assert.match(metricsController, /document\.addEventListener\('fullscreenchange', restartLiveClock\)/);
  assert.match(metricsController, /window\.addEventListener\('pageshow', restartLiveClock\)/);
  assert.doesNotMatch(metricsController, /setInterval\(schedule,\s*1000\)/);
  assert.match(metricsController, /isCanonicalLocalClockOwner:\s*true/);
  assert.match(metricsController, /clockPrecision:\s*'second'/);
  assert.match(metricsController, /clockFormat:\s*'HH:MM:SS'/);
});

test('Served source contains canonical Status Board rewrite contracts', async () => {
  const middleware = await source('functions/_middleware.js');

  assert.match(middleware, /GateStatusBoardController\?\.renderActiveBuses/);
  assert.match(middleware, /GateStatusBoardController\?\.renderDormColumns/);
  assert.match(middleware, /LOCAL metric live clock is owned by GatePremiumMetricsController/);
  assert.doesNotMatch(middleware, /setInterval\(updateAirportMetric,\s*(?:1000|60000)\)/);
  assert.match(middleware, /lastEl\.textContent !== String\(lastAirport\)/);
  assert.doesNotMatch(middleware, /const localEl = document\.getElementById\('stat-local'\)/);
  assert.match(middleware, /el\.classList\.remove\('timer-flash'\)/);
  assert.match(middleware, /dorm-timer-record-lifecycle-20260722/);
  assert.match(middleware, /metric-live-clock-20260722/);
});

test('Served HTML delegates Active Buses and dorm columns to the canonical owner', async () => {
  const { transformed } = await transformedIndex();

  assert.match(transformed, /window\.GateStatusBoardController\?\.renderActiveBuses/);
  assert.match(transformed, /window\.GateStatusBoardController\?\.renderDormColumns/);
});

test('Served HTML retires the legacy Local clock interval', async () => {
  const { transformed } = await transformedIndex();

  assert.match(transformed, /LOCAL metric live clock is owned by GatePremiumMetricsController/);
  assert.match(transformed, /lastEl && lastEl\.textContent !== String\(lastAirport\)/);
  assert.doesNotMatch(transformed, /setInterval\(updateAirportMetric,\s*(?:1000|60000)\)/);
  assert.doesNotMatch(transformed, /const localEl = document\.getElementById\('stat-local'\)/);
});

test('Active timer ownership disables the legacy flashing interval', async () => {
  const controller = await source('public/js/gate-status-board-controller.js');
  const middleware = await source('functions/_middleware.js');

  assert.match(controller, /window\.updateTimers = canonicalTimerTick/);
  assert.match(controller, /window\.clearInterval\(legacyInterval\)/);
  assert.match(controller, /timer\.classList\.remove\('timer-flash'\)/);
  assert.match(controller, /timer\.classList\.toggle\('timer-red', critical\)/);
  assert.doesNotMatch(middleware, /gate-status-board-timer-visual-stability\.js/);
});

test('Runtime compositing guard is retired and canonical CSS owns Status Board layers', async () => {
  const middleware = await source('functions/_middleware.js');
  const css = await source('public/css/military-glass-terminal.css');

  assert.doesNotMatch(middleware, /gate-render-stability-fix\.js/);
  assert.match(css, /#page-board \.metric-card\s*\{[\s\S]*overflow:\s*hidden/);
  assert.match(css, /#page-board \.gate-active-buses-block\s*\{[\s\S]*display:\s*grid/);
});
