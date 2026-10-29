import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = path => readFile(resolve(root, path), 'utf8');
const controller = await source('public/js/gate-processing-controller.js');
const adapter = await source('public/js/prc-dash-auditorium-location.js');
const html = await source('public/index.html');
const css = await source('public/css/military-glass-terminal.css');

function part(text, first, last) {
  const a = text.indexOf(first), b = text.indexOf(last, a);
  assert.ok(a >= 0 && b > a, 'Missing canonical function segment');
  return text.slice(a, b).trim();
}
function button(name) {
  const label = { textContent: name }, attrs = new Map();
  return {
    label,
    node: {
      dataset: {}, disabled: false,
      querySelector: s => s === '.gate-processing-command__label' ? label : null,
      setAttribute: (a, b) => attrs.set(a, b),
      removeAttribute: a => attrs.delete(a),
      getAttribute: a => attrs.get(a)
    }
  };
}
function harness(record, accounting, write, role = 'instructor') {
  const load = { value: String(record.current_load || 0), setCustomValidity(s) { this.validity = s; }, reportValidity() { this.reported = true; } };
  const save = button('SAVE LOAD'), reopen = button('REOPEN DORM');
  const nodes = new Map([
    ['modal-load-input', load],
    ['modal-load-feedback', { hidden: true, textContent: '', dataset: {} }],
    ['modal-action-feedback', { hidden: true, textContent: '', dataset: {} }],
    ['edit-closed-timer', { value: '99:00' }]
  ]);
  const document = {
    getElementById: id => nodes.get(id) || null,
    querySelector(s) {
      if (s === '#dorm-modal button[onclick="saveLoad()"]') return save.node;
      if (s === '#dorm-modal [data-processing-action="reopen-dorm"]') return reopen.node;
      return null;
    }
  };
  const feedback = new Function('document', part(controller, '  function setModalFeedback(', '  function setModalCommandBusy(') + '\nreturn setModalFeedback;')(document);
  const busy = new Function(part(controller, '  function setModalCommandBusy(', '  function instructorModalActions(') + '\nreturn setModalCommandBusy;')();
  let closed = 0;
  const mock = {
    activeModalDormId: () => record.__backendId,
    activeEditDormId: () => '',
    dormById: id => id === record.__backendId ? record : null,
    n: val => Number(val) || 0,
    assignmentSummary: () => accounting,
    document, updateDorm: write, setModalFeedback: feedback, setModalCommandBusy: busy,
    isInstructor: () => role === 'instructor',
    setEditMessage: () => {},
    parseTimerToSeconds: value => {
      const [min, sec] = String(value).split(':').map(Number);
      return 60 * min + sec;
    },
    closeDormModalCanonical: () => { closed++; },
    closeDormEditModalCanonical: () => { closed++; },
    console: { warn() {} }
  };
  // Load the actual canonical error-classification and visible-feedback helpers
  // into the isolated command harness; failures must remain visible to users.
  mock.dormReopenFailureMessage = new Function(
    part(controller, '  function dormReopenFailureMessage(', '  function showDormReopenFailure(')
    + '\nreturn dormReopenFailureMessage;'
  )();
  mock.showDormReopenFailure = new Function(
    'setEditMessage', 'activeModalDormId', 'setModalFeedback', 'document',
    part(controller, '  function showDormReopenFailure(', '  async function reopenDormCanonical(')
    + '\nreturn showDormReopenFailure;'
  )(mock.setEditMessage, mock.activeModalDormId, mock.setModalFeedback, document);
  function compile(first, last, names, fn) {
    return new Function(...names, 'let loadSaveInFlight = false; let reopenInFlight = false;\n' +
      part(controller, first, last) + '\nreturn ' + fn + ';')(...names.map(n => mock[n]));
  }
  return {
    document, load, save, reopen, get closed() { return closed; },
    full: compile('  function setLoadFullCanonical(', '  async function saveLoadCanonical(', ['dormById', 'activeModalDormId', 'document', 'n', 'setModalFeedback'], 'setLoadFullCanonical'),
    persistLoad: compile('  async function saveLoadCanonical(', '  async function saveAssignedAirmanCanonical(', ['activeModalDormId', 'dormById', 'document', 'n', 'assignmentSummary', 'updateDorm', 'setModalFeedback', 'setModalCommandBusy', 'console'], 'saveLoadCanonical'),
    reopenDorm: compile('  async function reopenDormCanonical(', '  function reopenDormFromEditModalCanonical(', ['isInstructor', 'dormById', 'activeEditDormId', 'activeModalDormId', 'setEditMessage', 'setModalFeedback', 'parseTimerToSeconds', 'document', 'updateDorm', 'setModalCommandBusy', 'closeDormModalCanonical', 'closeDormEditModalCanonical', 'console', 'dormReopenFailureMessage', 'showDormReopenFailure'], 'reopenDormCanonical')
  };
}

test('Processing controllers retain their coordinated release and the shared CSS receives a fresh Status Board revision', async () => {
  const middleware = await source('functions/_middleware.js');
  assert.ok(middleware.includes('/js/gate-processing-controller.js?v=processing-dorm-cards-20261016-v2'),
    'Processing mutation owner should remain unchanged');
  assert.ok(middleware.includes('/js/prc-dash-auditorium-location.js?v=status-board-spacing-20261017-v1'),
    'Shared display adapter must load at the revised Status Board version');
  const inventory = JSON.parse(await source('docs/build-2/ACTIVE_RUNTIME_BUDGET.json'));
  const cssUrl = inventory.currentDirectStyles.find(url => url.startsWith('/css/military-glass-terminal.css?v='));
  assert.ok(cssUrl && middleware.includes(cssUrl), 'Canonical stylesheet URL must match active runtime manifest');
  assert.ok(middleware.includes('/js/gate-status-board-controller.js?v=status-board-spacing-20261017-v1'));
  assert.doesNotMatch(middleware, /military-glass-terminal-20260929-tablet-menu/);
});

test('five requested buttons retain action binding and semantic theme styles', () => {
  assert.match(html, /onclick="saveAssignedAirman\(\)"[\s\S]*?gate-processing-command--commit/);
  assert.match(html, /onclick="setLoadFull\(\)" class="gate-processing-command gate-processing-command--shortcut"/);
  assert.match(html, /onclick="saveLoad\(\)" class="gate-processing-command gate-processing-command--commit"/);
  assert.match(controller, /data-processing-action="reopen-dorm"[\s\S]*?gate-processing-command--reopen/);
  assert.match(controller, /data-processing-action="edit-record"[\s\S]*?gate-processing-command--secondary/);
  for (const kind of ['commit', 'shortcut', 'reopen', 'secondary'])
    assert.ok(css.includes('#dorm-modal .gate-processing-command--' + kind));
  assert.match(css, /#dorm-modal \.gate-processing-command,\s*#page-processing #processing-add-local-bus \{[\s\S]*?background: var\(--gate-command-bg\)/);
  assert.match(controller, /if \(action\.dataset\.processingAction === 'edit-record'\) openDormEditModalCanonical\(event, id\)/);
});

test('FULL changes draft, while SAVE LOAD issues exactly one write and restores the button', async () => {
  const dorm = { type: 'dorm', __backendId: '3A2', max_load: 60, current_load: 20 };
  let finish, writes = 0;
  const ui = harness(dorm, { loaded: 20, arrived: 60, overAssigned: 0 }, async payload => {
    writes++; assert.equal(payload.current_load, 60);
    return new Promise(resolve => { finish = resolve; });
  });
  ui.full();
  assert.equal(ui.load.value, '60');
  assert.equal(writes, 0);
  const pending = ui.persistLoad();
  await Promise.resolve();
  assert.equal(ui.save.node.disabled, true);
  assert.equal(ui.save.label.textContent, 'SAVING...');
  assert.equal(ui.save.node.getAttribute('aria-busy'), 'true');
  await ui.persistLoad();
  assert.equal(writes, 1);
  finish({ isOk: true });
  await pending;
  assert.equal(ui.save.node.disabled, false);
  assert.equal(ui.save.label.textContent, 'SAVE LOAD');
  assert.equal(ui.save.node.getAttribute('aria-busy'), undefined);
});

test('SAVE LOAD failure stays visible and retryable instead of silently closing', async () => {
  const dorm = { type: 'dorm', __backendId: '3A2', max_load: 60, current_load: 12 };
  const ui = harness(dorm, { loaded: 12, arrived: 60, overAssigned: 0 }, async () => ({ isOk: false }));
  ui.load.value = '13';
  assert.equal((await ui.persistLoad()).isOk, false);
  assert.equal(ui.save.node.disabled, false);
  assert.match(ui.document.getElementById('modal-load-feedback').textContent, /Unable to save/);
});

test('REOPEN uses selected dorm saved timer, rejects failures, and respects role', async () => {
  const dorm = { type: 'dorm', __backendId: '3A2', state: 'closed', closed_timer: '04:30' };
  let payload;
  const ui = harness(dorm, { loaded: 0, arrived: 0, overAssigned: 0 }, async p => { payload = p; return { isOk: false }; });
  const at = Date.now();
  assert.equal((await ui.reopenDorm('3A2')).isOk, false);
  assert.equal(ui.closed, 0);
  assert.equal(ui.reopen.node.disabled, false);
  assert.equal(ui.reopen.label.textContent, 'REOPEN DORM');
  const millis = at - new Date(payload.opened_at).getTime();
  assert.ok(millis >= 269_000 && millis <= 271_000, 'Must use 04:30 from selected record, not 99:00 from stale edit form');
  assert.equal(ui.document.getElementById('modal-action-feedback').hidden, false);
  let writes = 0;
  const airman = harness(dorm, { loaded: 0, arrived: 0, overAssigned: 0 }, async () => { writes++; return { isOk: true }; }, 'airman');
  await airman.reopenDorm('3A2');
  assert.equal(writes, 0);
});

test('Successful REOPEN closes its modal only after persistence', async () => {
  const dorm = { type: 'dorm', __backendId: '3A2', state: 'closed', closed_timer: '00:30' };
  const ui = harness(dorm, { loaded: 0, arrived: 0, overAssigned: 0 }, async () => ({ isOk: true }));
  assert.equal((await ui.reopenDorm('3A2')).isOk, true);
  assert.equal(ui.closed, 2);
});

test('Airman SAVE remains bound to the active dorm and displays failures in a live region', () => {
  assert.match(adapter, /activeId !== modalId \|\| activeId !== inputId/);
  assert.match(adapter, /setAssignmentSaveLabel\(button, 'SAVING\.\.\.'\)/);
  assert.match(adapter, /setAssignmentFeedback\('Unable to save the Airman and auditorium location\. Try again\.'\)/);
  assert.match(adapter, /controller\.updateDorm\(payload, \{ source: 'processing-assignment-location-update'/);
  assert.match(adapter, /baseline:assignmentBaseline/);
  assert.match(adapter, /fields:\['assigned_airman','auditorium_location'\]/);
  for (const id of ['modal-assignment-feedback', 'modal-load-feedback', 'modal-action-feedback'])
    assert.ok(html.includes('id="' + id + '"'));
});

test('EDIT RECORD button dispatches to the existing instructor-gated editor with the exact dorm ID', () => {
  const calls = [];
  const handlerSource = part(controller, '  function handleProcessingClick(', '  function handleProcessingContext(');
  const handler = new Function(
    'setPhaseCanonical', 'openDormCanonical', 'closeDormCanonical',
    'reopenDormCanonical', 'openDormEditModalCanonical', 'activeModalDormId',
    handlerSource + '\nreturn handleProcessingClick;'
  )(
    () => {}, () => {}, () => {}, () => {},
    (event, id) => calls.push({ event, id }),
    () => 'wrong-dorm'
  );
  const action = { dataset: { processingAction: 'edit-record', dormId: '3A2' } };
  let prevented = false;
  const event = {
    preventDefault() { prevented = true; },
    target: { closest(selector) { return selector === '[data-processing-action]' ? action : null; } }
  };
  handler(event);
  assert.equal(prevented, true);
  assert.deepEqual(calls, [{ event, id: '3A2' }]);
  assert.match(controller, /function openDormEditModalCanonical\(event, id\) \{[\s\S]*?if \(!isInstructor\(\)\) return;/);
});
