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

test('Individual arrival correction supports update and delete without bus mutation', async () => {
  const controller = await source('public/js/gate-processing-arrival-controller.js');

  assert.match(controller, /window\.dataSdk\.update\(payload\)/);
  assert.match(controller, /window\.dataSdk\.delete\(record\)/);
  assert.match(controller, /data-trainee-arrival-manage/);
  assert.match(controller, /Instructor entries can be corrected or deleted/);
  assert.doesNotMatch(controller, /bus_type\s*:/);
});

test('Processing accountability reconciles expected, bus, individual, arrived, and variance', async () => {
  const controller = await source('public/js/gate-processing-arrival-controller.js');

  assert.match(controller, /function accountability\(\)/);
  assert.match(controller, /const arrived = busArrived \+ individualArrived/);
  assert.match(controller, /variance:\s*arrived - expected/);
  assert.match(controller, /gate-accountability-expected/);
  assert.match(controller, /gate-accountability-bus/);
  assert.match(controller, /gate-accountability-individual/);
  assert.match(controller, /gate-accountability-arrived/);
  assert.match(controller, /gate-accountability-variance/);
  assert.match(controller, /BALANCED/);
  assert.match(controller, /RECONCILE/);
});

test('Arrived metric includes arrived buses plus individual trainee arrivals', async () => {
  const metrics = await source('public/js/gate-premium-metrics-controller.js');

  assert.match(metrics, /record\?\.type === 'trainee_arrival'/);
  assert.match(metrics, /record\.status === 'arrived'/);
  assert.match(metrics, /individualArrived/);
  assert.match(metrics, /const totalArrived = busArrived \+ individualArrived/);
});

test('Middleware loads Processing individual arrival controller without changing middleware auth contract', async () => {
  const middleware = await source('functions/_middleware.js');
  const processing = middleware.indexOf('/js/gate-processing-controller.js');
  const arrival = middleware.indexOf('/js/gate-processing-arrival-controller.js');
  const bus = middleware.indexOf('/js/gate-bus-workflow-controller.js');

  assert.ok(processing >= 0);
  assert.ok(arrival > processing);
  assert.ok(bus > arrival);
  assert.match(middleware, /gate-processing-arrival-controller\.js\?v=individual-arrival-20260811/);
  assert.match(middleware, /pathname\.endsWith\('\.js'\)/);
  assert.match(middleware, /jsonResponse\(\{ isOk: false, error: 'Unauthorized\.' \}, 401\)/);
  assert.match(middleware, /Response\.redirect\(`\$\{url\.origin\}\/login\/`, 302\)/);
});