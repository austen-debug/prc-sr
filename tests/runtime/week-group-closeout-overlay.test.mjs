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
      setTimeout() { calls.push('scheduleMessageClear'); },
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
    '(function () { let closeoutInProgress = false; let archiveIndexPromise = null;\n' +
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

  // A second invocation while the first transaction is in flight must not issue another write.
  await h.subject.runSafeCloseout();
  assert.equal(h.calls.filter(item => item === 'createArchive').length, 1);

  h.setPendingRefresh();
  h.resolveCreate({ isOk: true, data: { __backendId: 'arch-123' } });
  // Wait for sequential awaits to finish and reach the intentionally pending archive-list refresh.
  for (let i = 0; i < 12; i++) await Promise.resolve();
  assert.equal(dialog.open, true, 'the overlay must remain through the last archive refresh');
  assert.ok(h.stages.includes('Verifying archive record…'));
  assert.ok(h.stages.includes('Archive verified. Clearing live records…'));
  assert.ok(h.stages.includes('Finalizing Week Group…'));
  assert.equal(h.calls.includes('deleteLiveRecords'), true);
  assert.ok(h.calls.indexOf('sync') < h.calls.indexOf('deleteLiveRecords'));

  h.finishIndex();
  await running;
  assert.equal(dialog.open, false);
  assert.equal(dialog.removed, true);
  assert.equal(h.currentDialog, null);
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
  assert.match(section, /@keyframes gate-closeout-spinner/);
  assert.match(section, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(section, /!important/);
});
