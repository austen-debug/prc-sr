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

test('Status Board owns elapsed calculation and second-aligned timer scheduling', async () => {
  const controller = await source('public/js/gate-status-board-controller.js');

  assert.match(controller, /function computeElapsedTimer\(openedAt, nowMs = Date\.now\(\)\)/);
  assert.match(controller, /1000 - \(Date\.now\(\) % 1000\)/);
  assert.match(controller, /function restartTimerOwner\(\)/);
  assert.match(controller, /clockPrecision: 'second'/);
  assert.match(controller, /window\.getElapsedTimer = computeElapsedTimer/);
  assert.doesNotMatch(controller, /typeof getElapsedTimer !== 'function'/);
  assert.doesNotMatch(controller, /getElapsedTimer\(openedAt\)/);
});

test('Status Board timers are rebound to authoritative open dorm records', async () => {
  const controller = await source('public/js/gate-status-board-controller.js');

  assert.match(controller, /const openDorms = getDorms\(\)\.filter/);
  assert.match(controller, /card\.dataset\.state = 'open'/);
  assert.match(controller, /timer\.dataset\.opened = String\(dorm\.opened_at \|\| ''\)/);
  assert.match(controller, /timer\.dataset\.dormId = String\(dorm\.__backendId \|\| ''\)/);
  assert.match(controller, /computeElapsedTimer\(dorm\.opened_at\)/);
  assert.match(controller, /timerRecordMismatches/);
  assert.match(controller, /invalidOpenTimestamps/);
});

test('Processing open, close, and reopen remain timestamp-bound to the canonical elapsed global', async () => {
  const processing = await source('public/js/gate-processing-controller.js');
  const controller = await source('public/js/gate-status-board-controller.js');

  assert.match(processing, /if \(typeof getElapsedTimer === 'function' && dorm\.opened_at\)/);
  assert.match(processing, /const timer = getElapsedTimer\(dorm\.opened_at\)/);
  assert.match(processing, /opened_at: now/);
  assert.match(processing, /closed_timer: finalTime/);
  assert.match(processing, /opened_at: reopenedOpenedAt/);
  assert.match(controller, /try \{ getElapsedTimer = computeElapsedTimer; \} catch \(_\) \{\}/);
});

test('Middleware versions the timer lifecycle owner', async () => {
  const middleware = await source('functions/_middleware.js');
  assert.match(middleware, /gate-status-board-controller\.js\?v=dorm-timer-record-lifecycle-20260722/);
});
