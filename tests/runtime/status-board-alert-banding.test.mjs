import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = file => readFile(resolve(root, file), 'utf8');
const controller = await source('public/js/gate-status-board-controller.js');
const css = await source('public/css/military-glass-terminal.css');
const processing = await source('public/js/gate-processing-controller.js');
const overtime = await source('public/js/prc-dash-overtime-audit.js');

const start = controller.indexOf('  function applyTimerVisualState(');
const end = controller.indexOf('  function ensureTimerElement(', start);
assert.ok(start >= 0 && end > start);
const applyTimerVisualState = new Function(controller.slice(start, end) + '\nreturn applyTimerVisualState;')();

function fixture() {
  const classes = new Set(['gate-dorm-timer', 'timer-display']);
  const timer = {
    dataset: {},
    classList: {
      toggle(name, active) { if (active) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); }
    }
  };
  let bandStateChanges = 0;
  const card = { dataset: new Proxy({}, {
    set(target, key, val) { if (key === 'gateTimeAlert') bandStateChanges++; target[key] = val; return true; }
  }) };
  return { timer, card, classes, get bandStateChanges() { return bandStateChanges; } };
}

test('39:59, 40:00, 49:59, 50:00, 59:59, and 60:00 use the intended Status Board states', () => {
  const f = fixture();
  const samples = [
    [2399, 'normal', false, false, false],
    [2400, 'warning', true, false, false],
    [2999, 'warning', true, false, false],
    [3000, 'critical', false, true, false],
    [3599, 'critical', false, true, false],
    [3600, 'overtime', false, true, true],
    [5000, 'overtime', false, true, true]
  ];
  for (const [seconds, state, amber, red, flash] of samples) {
    applyTimerVisualState(f.timer, f.card, { valid: true, minutes: Math.floor(seconds / 60) });
    assert.equal(f.card.dataset.gateTimeAlert, state, 'Band level at ' + seconds);
    assert.equal(f.timer.dataset.timerVisualState, state);
    assert.equal(f.classes.has('timer-yellow'), amber, 'Amber at ' + seconds);
    assert.equal(f.classes.has('timer-red'), red, 'Red at ' + seconds);
    assert.equal(f.classes.has('timer-flash'), flash, 'Timer flash at ' + seconds);
  }
  assert.equal(f.bandStateChanges, 4, 'Only normal→warning→critical→overtime trigger band state changes');
  applyTimerVisualState(f.timer, f.card, { valid: false, minutes: 800 });
  assert.equal(f.card.dataset.gateTimeAlert, 'normal', 'Invalid timestamp must not alert');
  assert.equal(f.classes.has('timer-flash'), false);
});

test('the alert is computed once per tick, without replacing or resizing a card', () => {
  const segment = controller.slice(controller.indexOf('  function updateBoardTimers()'), controller.indexOf('  function canonicalTimerTick()'));
  assert.match(segment, /const elapsed = computeElapsedTimer\(dorm.opened_at\)/);
  assert.match(segment, /applyTimerVisualState\(timer, card, elapsed\)/);
  assert.match(segment, /if \(timer.textContent !== elapsed.text\) timer.textContent = elapsed.text/);
  assert.doesNotMatch(segment, /card\.innerHTML|card\.outerHTML|replaceWith|appendChild|dataSdk\.(?:create|update|delete)/);
  assert.match(controller, /if \(card.dataset.gateTimeAlert !== visualState\) card.dataset.gateTimeAlert = visualState/);
});

test('Status Board only: masked inner band never mutates female identity rules or content geometry', () => {
  assert.match(css, /#page-board #col-open \.gate-dorm-card\[data-gate-time-alert="warning"\]/);
  assert.match(css, /#page-board #col-open \.gate-dorm-card:is\(/);
  assert.match(css, /inset: 6px/);
  assert.match(css, /pointer-events: none/);
  assert.match(css, /mask-composite: exclude/);
  assert.match(css, /-webkit-mask-composite: xor/);
  assert.match(css, /@keyframes gate-board-alert-orbit/);
  const begin = css.indexOf('/*\n * STATUS BOARD ONLY: inset elapsed-time alert orbit.');
  const end = css.indexOf('/* Timer states.', begin);
  assert.ok(begin > 0 && end > begin);
  const band = css.slice(begin, end);
  assert.doesNotMatch(band, /#page-squadron|#page-processing|border-female|box-shadow:\s*|grid-template|padding:\s*(?:\.8rem|1rem)/);
  assert.match(band, /--gate-board-alert-color: var\(--mg-yellow\)/);
  assert.match(band, /--gate-board-alert-color: var\(--mg-red\)/);
  const femaleBoard = css.slice(css.indexOf('#page-board .gate-dorm-card.border-female,'), css.indexOf('/* Timer states.') + 10);
  assert.match(femaleBoard, /--gate-flag-female-red/);
  assert.match(femaleBoard, /--gate-female-ring-mix/);
  assert.match(femaleBoard, /var\(--mg-shadow-soft\)/);
  assert.match(css, /#page-processing #proc-dorm-grid \.proc-card\.border-female \{/);
  assert.match(css, /--gate-female-halo/);
  assert.match(processing, /data-gate-time-alert/);
  assert.doesNotMatch(processing, /gate-board-alert-angle/);
  assert.match(css, /#page-processing #proc-dorm-grid \.gate-processing-card\[data-state="open"\]/);
});

test('audio persistence remains in the existing overtime controller at 60 minutes', () => {
  assert.match(controller, /elapsed\.valid && elapsed\.minutes >= 60/);
  assert.match(controller, /triggerOvertimeSoundIfNeeded\(id\)/);
  assert.match(overtime, /const OVERTIME_THRESHOLD_MS = 60 \* 60 \* 1000/);
  assert.match(overtime, /localOvertimeInProgress\.has\(targetDormId\)/);
  assert.match(overtime, /hasOvertimeSoundEvent\(targetDormId\)/);
  assert.match(overtime, /await createOvertimeSoundEvent\(dorm\)/);
  assert.doesNotMatch(controller, /dataSdk\.update/);
});

test('new asset revisions load together while Processing and Squadron keep their owners', async () => {
  const middleware = await source('functions/_middleware.js');
  const inventory = JSON.parse(await source('docs/build-2/ACTIVE_RUNTIME_BUDGET.json'));
  const standalone = await source('public/squadron/index.html');
  const cssUrl = inventory.currentDirectStyles.find(url => url.startsWith('/css/military-glass-terminal.css?v='));
  assert.ok(cssUrl, 'Canonical stylesheet absent from active runtime inventory');
  const jsUrl = '/js/gate-status-board-controller.js?v=status-board-reference-20261016-v1';
  for (const asset of [cssUrl, jsUrl]) {
    assert.ok(middleware.includes(asset), 'Middleware missing ' + asset);
    assert.ok(asset === cssUrl
      ? inventory.currentDirectStyles.includes(asset)
      : inventory.currentDirectScripts.includes(asset));
  }
  assert.ok(standalone.includes(cssUrl), 'Squadron requires the same single canonical stylesheet URL');
  assert.ok(middleware.includes('/js/gate-processing-controller.js?v=processing-dorm-cards-20261016-v2'));
  assert.ok(middleware.includes('/js/prc-dash-overtime-audit.js'));
});
