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
  const executable = `${middleware.replace('export async function onRequest', 'async function onRequest')}\nglobalThis.__gateTransform = applyStatusBoardMetricSourceRefactor;`;
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
  const utilities = await source('public/css/gate-utilities-access.css');
  const controller = await source('public/js/gate-status-board-controller.js');

  assert.match(utilities, /#page-board \.gate-dorm-timer[\s\S]*inline-size:\s*7ch\s*!important/);
  assert.match(utilities, /font-family:[\s\S]*ui-monospace/);
  assert.match(utilities, /font-feature-settings:\s*"tnum" 1/);
  assert.match(utilities, /letter-spacing:\s*0\s*!important/);
  assert.match(utilities, /contain:\s*layout paint\s*!important/);
  assert.match(controller, /timer\.classList\.remove\('timer-flash'\)/);
});

test('Status Board metrics scale to their own card containers', async () => {
  const metricsCss = await source('public/css/gate-premium-metrics.css');

  assert.match(metricsCss, /container-type:\s*inline-size/);
  assert.match(metricsCss, /container-name:\s*gate-status-metric/);
  assert.match(metricsCss, /font-size:\s*clamp\(2rem, 13cqi, 5rem\)/);
  assert.match(metricsCss, /font-size:\s*clamp\(1\.55rem, 14cqi, 2\.7rem\)/);
  assert.match(metricsCss, /font-variant-numeric:\s*tabular-nums/);
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

test('Runtime compositing guard no longer owns Status Board layers', async () => {
  const renderGuard = await source('public/js/gate-render-stability-fix.js');
  const utilities = await source('public/css/gate-utilities-access.css');

  assert.doesNotMatch(renderGuard, /#page-board\.active/);
  assert.doesNotMatch(renderGuard, /#page-board[^`]*translateZ\(0\)/);
  assert.match(renderGuard, /statusBoardExcluded:\s*true/);
  assert.match(utilities, /#page-board \.metric-card[\s\S]*backdrop-filter:\s*none\s*!important/);
  assert.match(utilities, /#page-board \.gate-active-buses-block[\s\S]*backdrop-filter:\s*none\s*!important/);
});
