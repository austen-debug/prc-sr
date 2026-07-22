import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
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

test('Metric synchronization is change-only and minute-aligned', async () => {
  const metricsController = await source('public/js/gate-premium-metrics-controller.js');

  assert.match(metricsController, /if \(element\.textContent === next\) return false/);
  assert.match(metricsController, /60000 - \(Date\.now\(\) % 60000\)/);
  assert.doesNotMatch(metricsController, /setInterval\(schedule,\s*1000\)/);
  assert.match(metricsController, /clockPrecision:\s*'minute'/);
});

test('Served source delegates Status Board rendering and removes one-second metric churn', async () => {
  const middleware = await source('functions/_middleware.js');

  assert.match(middleware, /GateStatusBoardController\?\.renderActiveBuses/);
  assert.match(middleware, /GateStatusBoardController\?\.renderDormColumns/);
  assert.match(middleware, /setInterval\(updateAirportMetric, 60000\)/);
  assert.match(middleware, /lastEl\.textContent !== String\(lastAirport\)/);
  assert.match(middleware, /el\.classList\.remove\('timer-flash'\)/);
  assert.match(middleware, /status-board-incremental-render-20260721/);
  assert.match(middleware, /metric-minute-cadence-20260721/);
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
