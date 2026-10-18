import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext, Script } from 'node:vm';

const source = path => readFile(new URL('../../' + path, import.meta.url), 'utf8');

function portion(js, from, to) {
  const start = js.indexOf(from);
  const end = js.indexOf(to, start);
  assert.ok(start >= 0 && end > start, 'Required closeout function boundary not found');
  return js.slice(start, end);
}

async function harness(options = {}) {
  const js = await source('public/js/gate-archive-controller.js');
  const overlayFunctions = portion(js, '  function showCloseoutProgress(', '  function showArchiveMessage(');
  const closeoutFunction = portion(js, '  async function runSafeCloseout()', '  function initiateCloseoutCanonical(');
  const stages = [];
  const calls = [];
  const alerts = [];
  const dialogs = [];
  const button = { disabled: false, textContent: 'CLOSE OUT WEEK GROUP' };
  let dialog = null;
  let resolveCreate;
  const pendingCreate = new Promise(resolve => { resolveCreate = resolve; });
  let finishIndex;
  const archiveRefresh = new Promise(resolve => { finishIndex = resolve; });

  const document = {
    body: {
      appendChild(element) { dialog = element; dialogs.push(element); }
    },
    getElementById(id) {
      if (id === 'closeout-btn') return button;
      if (id === 'gate-closeout-progress') return dialog;
      if (id === 'gate-closeout-progress-stage') return dialog?.querySelector('#gate-closeout-progress-stage') || null;
      return null;
    },
    createElement(tag) {
      assert.equal(tag, 'dialog');
      const children = new Map();
      const node = {
        id: '', className: '', open: false, innerHTML: '',
        attributes: {}, listeners: {}, removed: false,
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(name, callback) { this.listeners[name] = callback; },
        querySelector(selector) {
          if (!children.has(selector)) {
            const item = { _text: '' };
            Object.defineProperty(item, 'textContent', {
              get() { return this._text; },
              set(value) { this._text = value; if (selector === '#gate-closeout-progress-stage') stages.push(value); }
            });
            children.set(selector, item);
          }
          return children.get(selector);
        },
        showModal() { this.open = true; calls.push('showModal'); },
        close() { this.open = false; calls.push('close'); },
        remove() { this.removed = true; if (dialog === this) dialog = null; }
      };
      return node;
    }
  };

  const weekGroup = 'WG26053';
  const dorms = [{ type: 'dorm', week_group: weekGroup }];
  const context = {
    document, console: { error(...args) { calls.push('error'); } },
    requestAnimationFrame(callback) { callback(); },
    window: {
      alert(message) { alerts.push(message); },
      setTimeout(callback, delay) {
        if (delay === 0) Promise.resolve().then(callback);
        else calls.push('scheduleMessageClear');
      },
      dataSdk: {
        create() { calls.push('createArchive'); return pendingCreate; }
      },
      runGateHooks(event) { calls.push('hook:' + event); }
    },
    isInstructor: () => true,
    activeWeekGroup: () => weekGroup,
    getRecordsOfType: type => type === 'dorm' ? dorms : [],
    showCloseoutMessage: message => calls.push('message:' + message),
    buildArchivePayload: () => ({ week_group: weekGroup }),
    syncLocalRecord: () => calls.push('sync'),
    verifyArchiveCreated: async () => options.verified !== false,
    deleteRecordsSafely: async () => { calls.push('deleteLiveRecords'); },
    clearConfig: async key => { calls.push('clearConfig:' + key); },
    resetInputAfterCloseout: () => calls.push('resetInput'),
    renderAll: () => calls.push('renderAll'),
    renderArchiveManagementView: () => calls.push('renderArchives')
  };
  const compiled = new Script(
    '(function () { let closeoutInProgress = false; let weekGroupProgressPhraseIndex = 0; let archiveIndexPromise = null;\n' +
    overlayFunctions + '\n' + closeoutFunction + '\n' +
    'return { runSafeCloseout, showCloseoutProgress, updateCloseoutProgress, hideCloseoutProgress, ' +
    'setIndexPromise(value) { archiveIndexPromise = value; } }; })()'
  );
  const subject = compiled.runInNewContext(context);

  return {
    subject, button, dialogs, stages, calls, alerts,
    resolveCreate,
    setPendingRefresh() { subject.setIndexPromise(archiveRefresh); },
    finishIndex,
    get currentDialog() { return dialog; }
  };
}

test('Closeout displays a blocking modal with an accessible spinner through archiving and refresh', async () => {
  const h = await harness();
  const running = h.subject.runSafeCloseout();
  assert.equal(h.dialogs.length, 1);
  const dialog = h.dialogs[0];
  assert.equal(dialog.open, true, 'progress must appear before the first server request');
  assert.equal(h.button.disabled, true);
  assert.equal(h.button.textContent, 'CLOSE OUT WEEK GROUP', 'button label does not flash during closeout');
  assert.equal(dialog.attributes['aria-modal'], 'true');
  assert.match(dialog.innerHTML, /ARCHIVING WEEK GROUP/);
  assert.match(dialog.innerHTML, /gate-closeout-progress-spinner/);
  assert.match(dialog.innerHTML, /aria-live="polite"/);
  assert.equal(dialog.querySelector('#gate-closeout-progress-week').textContent, 'Week Group: WG26053');
  assert.equal(dialog.querySelector('#gate-closeout-progress-phrase').textContent, '60 SECONDS… HYDRATE');
  assert.match(dialog.attributes['aria-describedby'], /gate-closeout-progress-phrase/);

  // A second invocation while the first transaction is in flight must not issue another write.
  await h.subject.runSafeCloseout();
  assert.equal(h.calls.filter(item => item === 'createArchive').length, 1);

  h.setPendingRefresh();
  h.resolveCreate({ isOk: true, data: { __backendId: 'arch-123' } });
  // The archive index read can stall; it is not part of the archive-before-clear transaction.
  await running;
  assert.equal(dialog.open, false, 'presentation refresh must not keep the spinner open after closeout');
  assert.equal(dialog.removed, true);
  assert.equal(h.currentDialog, null);
  assert.ok(h.stages.includes('Verifying archive record…'));
  assert.ok(h.stages.includes('Archive verified. Clearing live records…'));
  assert.ok(h.stages.includes('Finalizing Week Group…'));
  assert.equal(h.calls.includes('deleteLiveRecords'), true);
  assert.ok(h.calls.indexOf('sync') < h.calls.indexOf('deleteLiveRecords'));

  h.finishIndex();
  assert.equal(h.button.disabled, false);
  assert.deepEqual(h.alerts, []);
  assert.ok(h.calls.includes('hook:afterCloseout'));
  assert.ok(h.calls.includes('hook:afterDataChanged'));
});

test('Failure removes progress overlay and retains archive-before-clear safety', async () => {
  const h = await harness({ verified: false });
  const running = h.subject.runSafeCloseout();
  h.resolveCreate({ isOk: true, data: { __backendId: 'arch-123' } });
  await running;
  assert.equal(h.dialogs.length, 1);
  assert.equal(h.dialogs[0].removed, true);
  assert.equal(h.button.disabled, false);
  assert.equal(h.calls.includes('deleteLiveRecords'), false, 'failed verification must not clear operational records');
  assert.equal(h.alerts.length, 1);
  assert.match(h.alerts[0], /Archive verification failed/);
  assert.ok(h.calls.indexOf('close') < h.calls.indexOf('error') + 5 || h.dialogs[0].removed);
});

test('Progress overlay style is scoped, modal, translucent and respects reduced motion', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const section = css.slice(css.indexOf('/* GATE Week Group closeout progress dialog */'));
  assert.ok(section.startsWith('/* GATE Week Group closeout progress dialog */'));
  assert.match(section, /#gate-closeout-progress::backdrop/);
  assert.match(section, /rgba\(7, 12, 20, \.66\)/);
  assert.match(section, /#gate-closeout-progress-phrase/);
  assert.match(section, /@keyframes gate-closeout-spinner/);
  assert.match(section, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(section, /!important/);
});


test('Both Week Group actions show exactly one rotating MTI phrase per operation', async () => {
  const h = await harness();
  const phrases = [
    '60 SECONDS… HYDRATE',
    'I PROMISE IT’S DOING SOMETHING…',
    'DO TEN PUSH-UPS WHILE YOU WAIT',
    'DFAC ASSISTANTS GO!',
    'SHORT CHOPPY STEPPING OUR WAY THROUGH PROCESSING…',
    'HYDRATE OR DIE',
    'I… AM AN AMERICAN AIRMAN…',
    'GUIDON IS CURRENTLY ENTERING THE STAIRWELL…'
  ];
  for (let i = 0; i < phrases.length + 1; i += 1) {
    const action = i % 2 ? 'closeout' : 'initialize';
    h.subject.showCloseoutProgress('WG26053', action);
    const dialog = h.currentDialog;
    assert.ok(dialog.open);
    assert.equal(dialog.querySelector('#gate-closeout-progress-title').textContent,
      action === 'initialize' ? 'INITIALIZING WEEK GROUP' : 'ARCHIVING WEEK GROUP');
    assert.equal(dialog.querySelector('#gate-closeout-progress-phrase').textContent, phrases[i % phrases.length]);
    h.subject.updateCloseoutProgress('Server processing…');
    assert.equal(dialog.querySelector('#gate-closeout-progress-phrase').textContent,
      phrases[i % phrases.length], 'stage changes must not cycle phrases');
    h.subject.hideCloseoutProgress();
    assert.equal(h.currentDialog, null);
  }
});

async function inputHarness() {
  const input = await source('public/js/gate-input-page-controller.js');
  const initializeFunction = portion(input, '  async function initializeWeekGroupCanonical(', '  function returnToBoardCanonical(');
  const calls = [];
  const button = { disabled: false, textContent: 'INITIALIZE WEEK GROUP' };
  const overlay = { classList: { remove(name) { calls.push('success:' + name); } } };
  let resolveConfig;
  const configWrite = new Promise(resolve => { resolveConfig = resolve; });
  const context = {
    document: {
      getElementById(id) {
        return id === 'init-wg-btn' ? button : id === 'init-success-overlay' ? overlay : null;
      }
    },
    window: {
      GateWeekGroupProgress: {
        show(weekGroup, action) { calls.push('show:' + action + ':' + weekGroup); },
        update(stage) { calls.push('stage:' + stage); },
        hide() { calls.push('hide'); }
      },
      dataSdk: {
        create(payload) {
          calls.push('create:' + payload.type);
          if (payload.type === 'config') return configWrite;
          return Promise.resolve({ isOk: true, data: { __backendId: 'dorm-123' } });
        }
      },
      GateStatusBoardController: { scheduleRender() { calls.push('renderStatus'); } },
      GateProcessingController: { scheduleRender() { calls.push('renderProcessing'); } },
      runGateHooks(name) { calls.push('hook:' + name); }
    },
    ensureInputPageShell() {},
    syncAllBatchRowsFromDom() {},
    saveWindowInputs() {},
    preflightInitialization: () => ({ ok: true }),
    getWeekGroupInputValue: () => 'WG26053',
    filledRows: () => [{ dorm_name: '331' }],
    readWindowInputs: () => ({}),
    allDataSafe: () => [],
    buildDormPayload: () => ({ type: 'dorm', week_group: 'WG26053' }),
    syncLocalRecord: () => calls.push('sync'),
    showInputMessage: message => calls.push('message:' + message)
  };
  const subject = new Script(
    '(function () { let initializationInProgress = false;\n' + initializeFunction +
    '\nreturn { initializeWeekGroupCanonical }; })()'
  ).runInNewContext(context);
  return { subject, calls, button, resolveConfig };
}

test('Initialize uses shared spinner, blocks duplicate submits, and dismisses on success', async () => {
  const h = await inputHarness();
  const running = h.subject.initializeWeekGroupCanonical();
  assert.equal(h.button.disabled, true);
  assert.equal(h.calls[0], 'show:initialize:WG26053');
  await h.subject.initializeWeekGroupCanonical();
  assert.deepEqual(h.calls.filter(call => call === 'create:config'), ['create:config']);

  h.resolveConfig({ isOk: true, data: { __backendId: 'config-123' } });
  await running;
  assert.ok(h.calls.includes('stage:Creating dorm 1 of 1…'));
  assert.ok(h.calls.includes('success:hidden'));
  assert.ok(h.calls.includes('hide'));
  assert.ok(h.calls.indexOf('hide') > h.calls.indexOf('create:dorm'));
  assert.equal(h.button.disabled, false);
  assert.equal(h.button.textContent, 'INITIALIZE WEEK GROUP');
});

test('Initialize dismisses spinner and reports a failed server write', async () => {
  const h = await inputHarness();
  const running = h.subject.initializeWeekGroupCanonical();
  h.resolveConfig({ isOk: false, error: 'Server validation rejected Week Group.' });
  await running;
  assert.ok(h.calls.includes('hide'));
  assert.ok(h.calls.includes('message:Server validation rejected Week Group.'));
  assert.equal(h.calls.includes('create:dorm'), false);
  assert.equal(h.calls.includes('success:hidden'), false);
  assert.equal(h.button.disabled, false);
});
