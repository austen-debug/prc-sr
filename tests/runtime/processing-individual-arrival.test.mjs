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

test('Processing individual arrival uses a distinct trainee_arrival record type', async () => {
  const controller = await source('public/js/gate-processing-arrival-controller.js');

  assert.match(controller, /type:\s*'trainee_arrival'/);
  assert.match(controller, /arrival_method:\s*'individual'/);
  assert.match(controller, /status:\s*'arrived'/);
  assert.match(controller, /window\.dataSdk\.create\(payload\)/);
  assert.doesNotMatch(controller, /type:\s*'bus'/);
});

test('Processing ADD menu retains Local Bus and adds quick Trainee action', async () => {
  const controller = await source('public/js/gate-processing-arrival-controller.js');

  assert.match(controller, /data-processing-add-action="local"/);
  assert.match(controller, /data-processing-add-action="trainee"/);
  assert.match(controller, /window\.openLocalBusModal\?\.\(\)/);
  assert.match(controller, /ADD \$\{count\} \$\{count === 1 \? 'TRAINEE' : 'TRAINEES'\}/);
});

test('Arrived metric includes arrived buses plus individual trainee arrivals', async () => {
  const metrics = await source('public/js/gate-premium-metrics-controller.js');

  assert.match(metrics, /record\?\.type === 'trainee_arrival'/);
  assert.match(metrics, /record\.status === 'arrived'/);
  assert.match(metrics, /individualArrived/);
  assert.match(metrics, /const totalArrived = busArrived \+ individualArrived/);
});

test('Middleware loads Processing individual arrival controller', async () => {
  const middleware = await source('functions/_middleware.js');
  const processing = middleware.indexOf('/js/gate-processing-controller.js');
  const arrival = middleware.indexOf('/js/gate-processing-arrival-controller.js');
  const bus = middleware.indexOf('/js/gate-bus-workflow-controller.js');

  assert.ok(processing >= 0);
  assert.ok(arrival > processing);
  assert.ok(bus > arrival);
  assert.match(middleware, /gate-processing-arrival-controller\.js\?v=individual-arrival-20260811/);
});
