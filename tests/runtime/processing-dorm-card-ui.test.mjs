import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = name => readFile(resolve(root, name), 'utf8');
const processing = await source('public/js/gate-processing-controller.js');
const css = await source('public/css/military-glass-terminal.css');
const adapter = await source('public/js/prc-dash-auditorium-location.js');
const audio = await source('public/js/prc-dash-overtime-audit.js');

function section(content, a, b) {
  const from = content.indexOf(a), to = content.indexOf(b, from);
  assert.ok(from >= 0 && to > from, 'Missing function: ' + a);
  return content.slice(from, to);
}
const compile = new Function('recordDisplay', 'getElapsedTimer', 'esc', 'n',
  section(processing, '  // Presentation only.', '  function renderProcessingPageCanonical(') +
  '\nreturn { processingAlertState, processingCard };');
const { processingAlertState, processingCard } = compile(
  () => ({ normalizeDormFlags: d => ({ band: d.band === 'true', spaceForce: d.space_force === 'true' }) }),
  opened => {
    const total = Math.floor((Date.now() - new Date(opened).getTime()) / 1000);
    return { valid: Number.isFinite(total), minutes: Math.floor(total/60), text: String(Math.floor(total/60)) + ':' + String(total%60).padStart(2,'0') };
  },
  value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
  value => Number(value) || 0
);
function dorm(state, mins, extra = {}) {
  return { __backendId:'3A2', type:'dorm', dorm_name:'3A2', state, sdq:'321 TRS', section:'1', inter_sec:'4',
    sex:'female', band:'true', space_force:'false', current_load:47, max_load:47,
    assigned_airman:'AIRMAN', phase:'AUDITORIUM', auditorium_location:'BM',
    opened_at:new Date(Date.now() - mins * 60000 - 10000).toISOString(), closed_timer:'45:40', ...extra };
}

test('39:59, 40, 50, 60, invalid and closed record boundaries match the approved contract', () => {
  for (const [s, expected] of [[2399,'normal'],[2400,'warning'],[2999,'warning'],[3000,'critical'],[3599,'critical'],[3600,'overtime'],[4700,'overtime']])
    assert.equal(processingAlertState('open','2026-10-16T00:00:00Z',{valid:true,minutes:Math.floor(s/60)}), expected, String(s));
  assert.equal(processingAlertState('closed','2026-10-16T00:00:00Z',{valid:true,minutes:80}),'normal');
  assert.equal(processingAlertState('empty','2026-10-16T00:00:00Z',{valid:true,minutes:80}),'normal');
  assert.equal(processingAlertState('open','invalid',{valid:true,minutes:80}),'normal');
  assert.equal(processingAlertState('open','2026-10-16T00:00:00Z',{valid:false,minutes:80}),'normal');
});

test('female BAND closed and male SPACE open cards retain all fields and record-bound interactions', () => {
  const female = processingCard(dorm('closed',45));
  for (const text of ['proc-card gate-processing-card border-female border-band dorm-closed',
    'data-gate-time-alert="normal"', 'role="button"', 'tabindex="0"', 'gate-processing-card__name">3A2',
    'gate-processing-card__meta">321 TRS · 1 · 4', 'gate-processing-card__state--closed">CLOSED',
    'gate-processing-card__airman', 'AIRMAN', '47 / 47', 'data-processing-location-slot',
    'PHASE · AUDITORIUM', '45:40', 'gate-processing-card__identity--band', 'aria-label="Band dorm">BAND'])
    assert.ok(female.includes(text), 'Missing female reference-layout field: ' + text);
  const space = processingCard(dorm('open',45,{sex:'male',band:'false',space_force:'true',current_load:60,max_load:60}));
  for (const text of ['proc-card gate-processing-card border-space-force',
    'data-state="open" data-gate-time-alert="warning"', 'gate-processing-card__state--open">OPEN',
    'gate-processing-card__identity--space', 'aria-label="Space Force dorm">SPACE', 'timer-display timer-yellow'])
    assert.ok(space.includes(text), 'Missing Space Force reference-layout field: ' + text);
  assert.ok(!space.includes('border-female'));
  assert.ok(!space.includes('identity--band'));
  assert.ok(female.indexOf('gate-processing-card__footer') < female.indexOf('identity--band'));
  assert.ok(space.indexOf('gate-processing-card__load') < space.indexOf('data-processing-location-slot'));
});

test('Processing tick is presentation-only and retains existing card click and instructor context handling', () => {
  const tick = section(processing, '  function updateProcessingTimers() {', '  function setModalOpen(open) {');
  assert.match(tick, /processingAlertState\(card.dataset.state, timer.dataset.opened, elapsed\)/);
  assert.match(tick, /if \(card.dataset.gateTimeAlert !== alert\) card.dataset.gateTimeAlert = alert/);
  assert.match(tick, /timer.classList.toggle\('timer-flash', alert === 'overtime'\)/);
  assert.doesNotMatch(tick, /innerHTML|outerHTML|renderProcessingPage|updateDorm|dataSdk|triggerOvertime|createSoundEvent/);
  assert.match(processing, /document.addEventListener\('click', handleProcessingClick, true\)/);
  assert.match(processing, /document.addEventListener\('contextmenu', handleProcessingContext, true\)/);
  assert.match(processing, /event.key === 'Enter'/);
  assert.match(audio, /const OVERTIME_THRESHOLD_MS = 60 \* 60 \* 1000/);
});

test('female permanent exterior and BAND/SPACE semantic colors remain independent of inner band', () => {
  assert.match(css, /#page-processing #proc-dorm-grid \.proc-card.border-female \{[\s\S]*?border-width: 3px;[\s\S]*?border-color: var\(--gate-flag-female-red\);[\s\S]*?var\(--gate-female-halo\)/);
  assert.match(css, /#page-processing \.gate-processing-card__identity--band \{\s*color: var\(--gate-flag-band-green\)/);
  assert.match(css, /#page-processing \.gate-processing-card__identity--space \{\s*color: var\(--gate-flag-space-force-bluebird\)/);
  assert.match(css, /#page-processing \.gate-processing-card__state--open \{\s*background: var\(--mg-ok\)/);
  assert.match(css, /#page-processing \.gate-processing-card__state--closed \{\s*background: var\(--mg-red\)/);
  assert.match(css, /--gate-processing-alert-color: var\(--mg-yellow\)/);
  assert.match(css, /--gate-processing-alert-color: var\(--mg-red\)/);
  assert.match(css, /inset: 6px;[\s\S]*?pointer-events: none/);
  assert.match(css, /animation: gate-board-alert-orbit 4.5s linear infinite/);
  assert.doesNotMatch(css, /\.proc-card\.border-band > \.text-xl\.font-black\.font-tabular::before/);
});

test('auditorium augmentation targets Processing center without taking over persistence', () => {
  assert.match(adapter, /card\.querySelector\('\[data-processing-location-slot\]'\)/);
  assert.match(adapter, /if \(processingSlot\) processingSlot\.insertAdjacentHTML\('beforeend', html\)/);
  assert.match(adapter, /controller\.updateDorm\(payload, \{ source: 'processing-assignment-location-update' \}\)/);
});

test('all three revised asset references remain coordinated across middleware, budget and Squadron', async () => {
  const mw = await source('functions/_middleware.js');
  const squadron = await source('public/squadron/index.html');
  const budget = JSON.parse(await source('docs/build-2/ACTIVE_RUNTIME_BUDGET.json'));
  const assets = [
    '/css/military-glass-terminal.css?v=status-board-reference-20261016-v1',
    '/js/gate-processing-controller.js?v=processing-dorm-cards-20261016-v2',
    '/js/prc-dash-auditorium-location.js?v=status-board-reference-20261016-v1'
  ];
  for (const asset of assets) {
    assert.ok(mw.includes(asset), 'Middleware missing ' + asset);
    assert.ok([...budget.currentDirectStyles, ...budget.currentDirectScripts].includes(asset), 'Inventory missing ' + asset);
  }
  assert.ok(squadron.includes(assets[0]));
  assert.ok(mw.includes('/js/gate-status-board-controller.js?v=status-board-reference-20261016-v1'));
});
