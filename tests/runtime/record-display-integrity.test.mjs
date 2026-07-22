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

test('canonical display contract preserves explicit Input order and legacy creation order', async () => {
  const contractSource = await source('public/js/gate-record-display-contract.js');
  const sandbox = { window: {} };
  vm.runInNewContext(contractSource, sandbox, { filename: 'gate-record-display-contract.js' });
  const contract = sandbox.window.GateRecordDisplay;

  const explicit = contract.sortDorms([
    { __backendId: 'b', week_group: 'WG', sdq: '2', dorm_name: 'Alpha', display_order: 2 },
    { __backendId: 'a', week_group: 'WG', sdq: '1', dorm_name: 'Zulu', display_order: 1 }
  ]);
  assert.deepEqual(Array.from(explicit, record => record.__backendId), ['a', 'b']);

  const legacy = contract.sortDorms([
    { __backendId: 'later', week_group: 'WG', sdq: '1', dorm_name: 'Alpha', created_at: '2026-07-14T02:00:00Z' },
    { __backendId: 'earlier', week_group: 'WG', sdq: '9', dorm_name: 'Zulu', created_at: '2026-07-14T01:00:00Z' }
  ]);
  assert.deepEqual(Array.from(legacy, record => record.__backendId), ['earlier', 'later']);

  const tiedLegacy = contract.sortDorms([
    { __backendId: 'first-source-record', week_group: 'WG', sdq: '9', dorm_name: 'Zulu', created_at: '2026-07-14T01:00:00Z' },
    { __backendId: 'second-source-record', week_group: 'WG', sdq: '1', dorm_name: 'Alpha', created_at: '2026-07-14T01:00:00Z' }
  ]);
  assert.deepEqual(Array.from(tiedLegacy, record => record.__backendId), ['first-source-record', 'second-source-record']);

  assert.equal(contract.dormIdentityKey({ week_group: 'wg', sdq: ' 321 TRS ', dorm_name: 'a-1' }), 'WG::321 TRS::A-1');
  const flags = contract.normalizeDormFlags({ band: 'true', space_force: 'true' });
  assert.equal(flags.band, false);
  assert.equal(flags.spaceForce, true);
});

test('active dorm consumers use the canonical record display contract', async () => {
  const status = await source('public/js/gate-status-board-controller.js');
  const processing = await source('public/js/gate-processing-controller.js');
  const squadron = await source('public/js/prc-dash-final-audit.js');

  for (const [name, contents] of Object.entries({ status, processing, squadron })) {
    assert.match(contents, /GateRecordDisplay/);
    assert.match(contents, /sortDorms/);
    assert.doesNotMatch(contents, /sort\(\(a, b\) => String\(a\.dorm_name/);
    assert.doesNotMatch(contents, /sort\(\(a, b\) => String\(b\.dorm_name/);
    assert.ok(contents.length > 500, `${name} source should be present`);
  }
});

test('Input owns dorm identity and never re-matches a created dorm to the live grid', async () => {
  const input = await source('public/js/gate-input-page-controller.js');

  assert.match(input, /display_order:\s*displayOrder/);
  assert.match(input, /source_row_index:\s*Number\(row\.rowIndex\)/);
  assert.match(input, /dorm_identity:\s*identity/);
  assert.match(input, /matchingDormIdentity/);
  assert.doesNotMatch(input, /findBatchRowForDormPayload/);
  assert.doesNotMatch(input, /liveDorms\.find\(item => String\(item\.dorm_name/);
});

test('dorm designation validation is identity-bound, card-scoped, and non-observing', async () => {
  const flags = await source('public/js/prc-dash-dorm-flag-validation.js');

  assert.match(flags, /cardDormId/);
  assert.match(flags, /dormById/);
  assert.match(flags, /#page-board \.dorm-card\[data-dorm-id\]/);
  assert.match(flags, /#proc-dorm-grid \.proc-card\[data-dorm-id\]/);
  assert.doesNotMatch(flags, /#page-board \[data-dorm-id\]/);
  assert.doesNotMatch(flags, /dorms\[index\]/);
  assert.doesNotMatch(flags, /MutationObserver/);
  assert.doesNotMatch(flags, /getDormFromCard/);
});

test('middleware loads the record display contract before all dorm consumers', async () => {
  const middleware = await source('functions/_middleware.js');
  const recordContract = middleware.indexOf('/js/gate-record-display-contract.js');
  const components = middleware.indexOf('/js/gate-component-contracts.js');
  const status = middleware.indexOf('/js/gate-status-board-controller.js');
  const processing = middleware.indexOf('/js/gate-processing-controller.js');
  const input = middleware.indexOf('/js/gate-input-page-controller.js');

  assert.ok(recordContract >= 0);
  assert.ok(recordContract < components);
  assert.ok(recordContract < status);
  assert.ok(recordContract < processing);
  assert.ok(recordContract < input);
  assert.match(middleware, /gate-record-display-contract\.js\?v=record-display-integrity-20260714b/);
  assert.match(middleware, /prc-dash-dorm-flag-validation\.js\?v=record-display-integrity-20260714b/);
});

test('Status Board uses one canonical timer and direct-surface integrity owner', async () => {
  const status = await source('public/js/gate-status-board-controller.js');
  const middleware = await source('functions/_middleware.js');

  assert.match(status, /function ensureTimerOwner\(\)/);
  assert.match(status, /window\.updateTimers = canonicalTimerTick/);
  assert.match(status, /try \{ updateTimers = canonicalTimerTick; \}/);
  assert.match(status, /function hasCompleteDormMarkup\(dorms\)/);
  assert.match(status, /function repairStatusBoardSurfaces\(\)/);
  assert.match(status, /SURFACE_IDS\s*=\s*Object\.freeze\(\['col-empty', 'col-open', 'col-closed', 'active-buses'\]\)/);
  assert.match(status, /surfaceObserver\.observe\(surface, \{ childList: true \}\)/);
  assert.doesNotMatch(status, /observe\(board, \{ childList: true, subtree: true \}\)/);
  assert.match(status, /renderStatusBoard\(\{ force: true \}\)/);
  assert.doesNotMatch(status, /activeBusObserver|bodyObserver|boardObserver/);
  assert.doesNotMatch(middleware, /gate-status-board-timer-visual-stability\.js/);
  assert.match(middleware, /gate-status-board-controller\.js\?v=status-board-incremental-render-20260721/);
});
