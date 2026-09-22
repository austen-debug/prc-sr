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

  for (const [name, contents] of Object.entries({ status, processing })) {
    assert.match(contents, /GateRecordDisplay/);
    assert.match(contents, /sortDorms/);
    assert.doesNotMatch(contents, /sort\(\(a, b\) => String\(a\.dorm_name/);
    assert.doesNotMatch(contents, /sort\(\(a, b\) => String\(b\.dorm_name/);
    assert.ok(contents.length > 500, name + ' source should be present');
  }
  // Squadron consumes the restricted server snapshot; never loads a second copy of raw records.
  assert.match(squadron, /\/api\/squadron-board/);
  assert.match(squadron, /function renderDormCards\(board\)/);
  assert.doesNotMatch(squadron, /function dormsForActiveWeek|function recordsByType/);
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

test('Input dorm loads accept 1 through 100 consistently in field and preflight validation', async () => {
  const input = await source('public/js/gate-input-page-controller.js');

  assert.match(input, /class="batch-load[\s\S]*?min="1"\s+max="100"/);
  assert.match(input, /n\(row\.load\)\s*>\s*100/);
  assert.match(input, /Dorm loads must be between 1 and 100\./);
  assert.doesNotMatch(input, /n\(row\.load\)\s*>\s*60/);
  assert.doesNotMatch(input, /Dorm loads must be between 1 and 60\./);
});

test('Processing Space Force marker is bound to the canonical persistent card class', async () => {
  const processing = await source('public/js/gate-processing-controller.js');
  const css = await source('public/css/military-glass-terminal.css');

  assert.match(processing, /const spaceForce = normalizedFlags \? normalizedFlags\.spaceForce/);
  assert.match(processing, /spaceForce \? 'border-space-force'/);
  assert.match(css, /#page-processing \.proc-card\.border-space-force > \.text-xl\.font-black\.font-tabular::before/);
  assert.match(css, /content:\s*["']SPACE FORCE["']/);
  assert.match(css, /#page-processing \.proc-card\.border-space-force \.gate-dorm-flags\s*\{[\s\S]*?display:\s*none/);
});

test('Processing emits combined designation classes without a post-render repair flash', async () => {
  const processing = await source('public/js/gate-processing-controller.js');
  const cardStart = processing.indexOf('function processingCard(dorm)');
  const cardEnd = processing.indexOf('function renderProcessingPageCanonical', cardStart);
  const card = processing.slice(cardStart, cardEnd);

  assert.match(card, /const borderClasses\s*=\s*\[/);
  assert.match(card, /female \? 'border-female' : ''/);
  assert.match(card, /spaceForce \? 'border-space-force' : ''/);
  assert.match(card, /!spaceForce && band \? 'border-band' : ''/);
  assert.match(card, /proc-card \$\{borderClasses\} \$\{closedClass\}/);
  assert.doesNotMatch(card, /const borderClass = female \? 'border-female' : \(spaceForce/);
});

test('Processing female highlight is pronounced and scoped to the Processing grid', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const match = css.match(/#page-processing #proc-dorm-grid \.proc-card\.border-female\s*\{([\s\S]*?)\}/);

  assert.ok(match, 'Processing female-card selector must exist');
  assert.match(match[1], /border-width:\s*3px/);
  assert.match(match[1], /border-color:\s*var\(--gate-flag-female-red\)/);
  assert.match(match[1], /box-shadow:\s*var\(--mg-inset-edge\),\s*var\(--gate-female-halo\),\s*var\(--mg-shadow-soft\)/);
  assert.match(css, /--gate-female-halo:\s*0 0 20px rgba\(255,\s*77,\s*71,\s*0\.22\)/);
  assert.doesNotMatch(match[0], /#page-board|#page-squadron/);
});

test('dorm designation validation is identity-bound, card-scoped, non-observing, and does not duplicate Processing designators', async () => {
  const flags = await source('public/js/prc-dash-dorm-flag-validation.js');
  const setFlagsStart = flags.indexOf('function setFlags(card, dorm)');
  const setFlagsEnd = flags.indexOf('function validateCards()', setFlagsStart);
  const setFlagsSource = flags.slice(setFlagsStart, setFlagsEnd);

  assert.match(flags, /cardDormId/);
  assert.match(flags, /dormById/);
  assert.match(flags, /#page-board \.dorm-card\[data-dorm-id\]/);
  assert.match(flags, /#proc-dorm-grid \.proc-card\[data-dorm-id\]/);
  assert.doesNotMatch(flags, /#page-board \[data-dorm-id\]/);
  assert.doesNotMatch(flags, /dorms\[index\]/);
  assert.doesNotMatch(flags, /MutationObserver/);
  assert.doesNotMatch(flags, /getDormFromCard/);
  assert.match(setFlagsSource, /const isProcessingCard = Boolean\(card\.closest\('#page-processing, #proc-dorm-grid'\)\)/);
  assert.match(setFlagsSource, /const indicatorMode = isBoardCard \? 'banner' : \(isProcessingCard \? 'class' : 'chip'\)/);
  const processingGuard = setFlagsSource.indexOf('if (!shouldShowIndicator || isProcessingCard) return;');
  const chipInjection = setFlagsSource.indexOf('const html = flagHtml(flags);');
  assert.ok(processingGuard >= 0, 'Processing cards must stop before validator chip injection');
  assert.ok(chipInjection > processingGuard, 'Processing guard must run before generic chip injection');
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
  assert.match(middleware, /prc-dash-dorm-flag-validation\.js\?v=processing-band-designator-20260915/);
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
  assert.match(middleware, /gate-status-board-controller\.js\?v=dorm-timer-record-lifecycle-20260722/);
});

test('shared overtime controller only paints Squadron timers and delegates styling to canonical CSS', async () => {
  const overtime = await source('public/js/prc-dash-overtime-audit.js');
  const css = await source('public/css/military-glass-terminal.css');
  const displayStart = overtime.indexOf('function updateTimerDisplays()');
  const displayEnd = overtime.indexOf('async function markDormOvertimeSent', displayStart);
  const display = overtime.slice(displayStart, displayEnd);

  assert.match(display, /#page-squadron \.timer-display\[data-opened\]/);
  assert.doesNotMatch(display, /querySelectorAll\('\.timer-display\[data-opened\]'\)/);
  assert.doesNotMatch(display, /#page-board|#page-processing/);
  assert.match(css, /#page-squadron \.timer-display\.timer-yellow/);
  assert.match(css, /#page-squadron \.timer-display\.timer-red/);
  assert.doesNotMatch(overtime, /createElement\(['"]style['"]\)/);
  assert.match(overtime, /military-glass-terminal\.css/);
  assert.match(overtime, /auditOpenDormsForOvertime/);
  assert.match(overtime, /processSoundEventsDeduped/);
});

test('SAT arrivals controller is single-purpose and legacy Status-header compatibility stays retired', async () => {
  const sat = await source('public/js/gate-sat-arrivals-controller.js');
  const index = await source('public/index.html');
  const middleware = await source('functions/_middleware.js');

  assert.match(sat, /window\.GateSatArrivalsBoard = Object\.freeze/);
  assert.match(sat, /fetch\('\/api\/sat-arrivals'/);
  assert.doesNotMatch(sat, /GateStatusHeaderCompatibility|ensureHeaderStylesheet|metric-arrived-v3|metric-airport/);
  assert.doesNotMatch(index, /id="metric-arrived"|id="metric-airport"/);
  assert.doesNotMatch(middleware, /prc-dash-sat-arrivals\.js/);
  assert.match(middleware, /gate-sat-arrivals-controller\.js\?v=repo-audit-20260922/);
});

test('airport bus persistence refreshes Status Board before auxiliary sound persistence', async () => {
  const workflow = await source('public/js/gate-bus-workflow-controller.js');
  const recordsApi = await source('functions/api/records.js');
  const createStart = workflow.indexOf('async function createAirport(form)');
  const createEnd = workflow.indexOf('async function createLocal(form)');
  const createAirport = workflow.slice(createStart, createEnd);

  const cacheIndex = createAirport.indexOf('updateCache(result.data || payload)');
  const refreshIndex = createAirport.indexOf("refreshAllSurfaces('airport-dispatch')");
  const soundIndex = createAirport.indexOf("createSoundEvent('bus_dispatch'");

  assert.ok(cacheIndex >= 0, 'persisted bus must enter the local authoritative cache');
  assert.ok(refreshIndex > cacheIndex, 'Status Board refresh must follow the persisted bus cache update');
  assert.ok(soundIndex > refreshIndex, 'auxiliary sound persistence must not gate Status Board rendering');
  assert.doesNotMatch(createAirport, /await\s+createSoundEvent/);
  assert.match(workflow, /GateActiveBusController\?\.render\?\.\(\{ force: true \}\)/);
  assert.match(recordsApi, /await env\.DB\.prepare\([\s\S]*INSERT INTO records[\s\S]*\.run\(\);[\s\S]*return jsonResponse\(\{ isOk: true, data: storedRecord \}, 201/);
});
