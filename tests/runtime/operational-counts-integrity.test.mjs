import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('existing lifecycle runtime owns the live ARRIVED/LOADED/AWAITING accounting contract', async () => {
  const hooks = await source('public/js/gate-ui-hooks.js');
  assert.match(hooks, /window\.GateOperationalCounts\s*=\s*Object\.freeze/);
  assert.match(hooks, /calculatePhysicalArrivalTotal/);
  assert.match(hooks, /calculateLoadedTotal/);
  assert.match(hooks, /awaitingAssignment:\s*Math\.max\(arrived - loaded, 0\)/);
  assert.match(hooks, /overAssigned:\s*Math\.max\(loaded - arrived, 0\)/);
});

test('Status and Processing consume the shared accounting contract without adding a runtime asset', async () => {
  const middleware = await source('functions/_middleware.js');
  const processing = await source('public/js/prc-dash-processing-loaded-summary.js');
  const status = await source('public/js/gate-premium-metrics-controller.js');

  assert.doesNotMatch(middleware, /gate-operational-counts\.js/);
  assert.match(processing, /GateOperationalCounts\?\.calculateAssignmentSummary/);
  assert.match(status, /GateOperationalCounts\?\.calculateAssignmentSummary/);
});

test('Processing load guard permits repairs but blocks increases in over-assignment', async () => {
  const processing = await source('public/js/gate-processing-controller.js');
  assert.match(processing, /proposedOverAssigned\s*>\s*accounting\.overAssigned/);
  assert.doesNotMatch(processing, /if \(requested > availableForDorm\)/);
});
