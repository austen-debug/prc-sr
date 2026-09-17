// GATE Phase 6 lifecycle hook bus
// Narrow owner for shared lifecycle hooks only. Workflow controllers own rendering and records.
(function () {
  'use strict';

  const HOOK_GROUPS = [
    'afterRenderAll',
    'afterPageChange',
    'afterDataChanged',
    'afterModalOpen',
    'afterCloseout'
  ];

  function ensureHookRegistry() {
    if (!window.GateHooks) window.GateHooks = {};
    for (const name of HOOK_GROUPS) {
      if (!Array.isArray(window.GateHooks[name])) window.GateHooks[name] = [];
    }
  }

  function activePageId() {
    const activePage = document.querySelector('.page.active[id]');
    return activePage ? activePage.id.replace(/^page-/, '') : '';
  }

  function activeWeekGroup() {
    try { return typeof window.getActiveWG === 'function' ? window.getActiveWG() : ''; } catch (_) { return ''; }
  }

  function hookPayload(extra) {
    return Object.assign({
      allData: Array.isArray(window.allData) ? window.allData : [],
      activePage: activePageId(),
      role: window.currentRole || '',
      weekGroup: activeWeekGroup(),
      timestamp: Date.now()
    }, extra || {});
  }

  function runGateHooks(name, payload) {
    ensureHookRegistry();
    const hooks = window.GateHooks[name];
    if (!Array.isArray(hooks) || hooks.length === 0) return;

    const data = hookPayload(payload);
    [...hooks].forEach(hook => {
      try { hook(data); }
      catch (error) { console.warn(`GATE hook failed: ${name}`, error); }
    });
  }

  function registerGateHook(name, fn) {
    ensureHookRegistry();
    if (!Array.isArray(window.GateHooks[name]) || typeof fn !== 'function') return false;
    if (!window.GateHooks[name].includes(fn)) window.GateHooks[name].push(fn);
    return true;
  }

  function unregisterGateHook(name, fn) {
    ensureHookRegistry();
    if (!Array.isArray(window.GateHooks[name]) || typeof fn !== 'function') return false;
    const before = window.GateHooks[name].length;
    window.GateHooks[name] = window.GateHooks[name].filter(hook => hook !== fn);
    return window.GateHooks[name].length !== before;
  }

  function exposeHookApi() {
    window.runGateHooks = runGateHooks;
    window.registerGateHook = registerGateHook;
    window.unregisterGateHook = unregisterGateHook;
  }

  function wrapRenderAll() {
    const current = window.renderAll;
    if (typeof current !== 'function') return false;
    if (current.__gateHooksWrapped === true) return true;

    const wrapped = function gateHooksRenderAllWrapper(...args) {
      const result = current.apply(this, args);
      runGateHooks('afterRenderAll', { args, source: 'renderAll' });
      return result;
    };
    wrapped.__gateHooksWrapped = true;
    wrapped.__gateHooksOriginal = current;
    window.renderAll = wrapped;
    try { renderAll = wrapped; } catch (_) {}
    return true;
  }

  function wrapShowPage() {
    const current = window.showPage;
    if (typeof current !== 'function') return false;
    if (current.__gateHooksWrapped === true) return true;

    const wrapped = function gateHooksShowPageWrapper(page, ...args) {
      const result = current.call(this, page, ...args);
      runGateHooks('afterPageChange', { page, args, source: 'showPage' });
      return result;
    };
    wrapped.__gateHooksWrapped = true;
    wrapped.__gateHooksOriginal = current;
    window.showPage = wrapped;
    try { showPage = wrapped; } catch (_) {}
    return true;
  }

  function installWrappers() {
    wrapRenderAll();
    wrapShowPage();
  }

  function installCompatibilityStubs() {
    window.GateHooks.installWrappers = installWrappers;

    window.GateHooks.installActiveBusController = function gateHooksActiveBusHandoff() {
      if (window.GateStatusBoardController?.scheduleRender) {
        window.GateStatusBoardController.scheduleRender({ force: true });
        return true;
      }
      return false;
    };

    window.GateHooks.installArchiveSchemaController = function gateHooksArchiveHandoff() {
      if (window.GateArchiveController?.refresh) {
        window.GateArchiveController.refresh();
        return true;
      }
      return false;
    };
  }

  function install() {
    ensureHookRegistry();
    exposeHookApi();
    installCompatibilityStubs();
    installWrappers();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  window.addEventListener('load', install, { once: true });

  let attempts = 0;
  const retry = window.setInterval(() => {
    attempts += 1;
    installWrappers();
    if (attempts >= 24 || (window.renderAll?.__gateHooksWrapped && window.showPage?.__gateHooksWrapped)) window.clearInterval(retry);
  }, 250);
})();

// PORT CLEAR owns its event, instructor action, individual acknowledgements, and board cue.
// It uses the existing shared record refresh and lifecycle bus; no second polling loop or asset.
(function () {
  'use strict';

  const OWNER = 'gate-port-clear';
  const EVENT_TYPE = 'port_clear';
  const ACK_PREFIX = 'gate_port_clear_ack_';
  const TIME_ZONE = 'America/Chicago';
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  let installed = false;
  let hooksRegistered = false;
  let sending = false;
  let expirationTimer = null;
  let scheduledExpiration = 0;
  let previousFocus = null;
  const acknowledged = new Set();

  function records() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function weekGroup() {
    try { return typeof getActiveWG === 'function' ? String(getActiveWG() || '') : ''; } catch (_) { return ''; }
  }

  function isInstructor() {
    try { return currentRole === 'instructor'; } catch (_) { return false; }
  }

  function offsetAt(instant) {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    const wallTime = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    return wallTime - instant;
  }

  // datetime-local values are entered in the receiving center's Central timezone,
  // independent of the viewing device's timezone and daylight-saving offset.
  function toEpoch(value) {
    const text = String(value || '').trim();
    if (!text) return NaN;
    if (/[zZ]$|[+-]\d\d:?\d\d$/.test(text)) return Date.parse(text);
    const match = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::\d\d)?$/.exec(text);
    if (!match) return NaN;
    const target = Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]);
    let instant = target - offsetAt(target);
    instant = target - offsetAt(instant);
    return instant;
  }

  function dayTwoValue(group = weekGroup()) {
    if (!group) return '';
    const scoped = records().find(record => record?.type === 'config' && record.key === `receiving_day_two_start:${group}`);
    if (scoped) return String(scoped.value || '');
    const dorm = records().find(record => record?.type === 'dorm' && record.week_group === group && record.receiving_day_two_start);
    return String(dorm?.receiving_day_two_start || '');
  }

  function latestEvent(group = weekGroup()) {
    return records()
      .filter(record => record?.type === 'audit_event' && record.event_type === EVENT_TYPE &&
        record.week_group === group && record.entity_id === group &&
        record.created_by_role === 'instructor' && record.actor_role === 'instructor' && record.__backendId)
      .sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''))[0] || null;
  }

  function activeEvent() {
    const event = latestEvent();
    if (!event) return null;
    const cutoff = toEpoch(dayTwoValue() || event.metadata?.receiving_day_two_start);
    const sent = Date.parse(event.created_at || '');
    if (!Number.isFinite(cutoff) || !Number.isFinite(sent) || sent >= cutoff || Date.now() >= cutoff) return null;
    return { event, cutoff };
  }

  function ackKey(id) { return `${ACK_PREFIX}${id}`; }

  function isAcknowledged(id) {
    if (acknowledged.has(id)) return true;
    try { return sessionStorage.getItem(ackKey(id)) === '1'; } catch (_) { return false; }
  }

  function acknowledge(id) {
    if (!id) return;
    acknowledged.add(id);
    try { sessionStorage.setItem(ackKey(id), '1'); } catch (_) {}
    hideDialog();
  }

  function message(text, error = false) {
    const target = document.getElementById('gate-port-clear-message');
    if (!target) return;
    target.textContent = text;
    target.style.color = error ? 'var(--red)' : 'var(--green)';
  }

  function ensureAirportControl() {
    const page = document.getElementById('page-airport');
    const content = page?.querySelector('.max-w-3xl');
    if (!content) return;
    let section = document.getElementById('gate-port-clear-action');
    if (!section) {
      section = document.createElement('section');
      section.id = 'gate-port-clear-action';
      section.className = 'surface border rounded-lg p-4 mt-4 mb-4';
      section.style.borderColor = 'var(--border)';
      section.dataset.owner = OWNER;
      section.innerHTML = '<button id="gate-port-clear-send" type="button" class="w-full px-6 py-3 rounded-lg font-black text-white text-lg" style="background:var(--green)">PORT CLEAR</button><div id="gate-port-clear-message" class="text-xs mt-2" role="status" aria-live="polite"></div>';
      content.appendChild(section);
      section.querySelector('button').addEventListener('click', requestSend);
    }
    section.hidden = !isInstructor();
    const button = document.getElementById('gate-port-clear-send');
    if (!button) return;
    const active = activeEvent();
    button.disabled = sending || Boolean(active);
    button.textContent = sending ? 'SENDING PORT CLEAR…' : (active ? 'PORT CLEAR SENT' : 'PORT CLEAR');
    button.style.opacity = button.disabled ? '0.65' : '1';
    button.setAttribute('aria-disabled', String(button.disabled));
  }

  function dialog() {
    let root = document.getElementById('gate-port-clear-dialog');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'gate-port-clear-dialog';
    root.className = 'confirm-overlay';
    root.style.cssText = 'position:fixed;inset:0;z-index:20000;display:none;align-items:center;justify-content:center;padding:16px;';
    root.dataset.owner = OWNER;
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = '<div class="surface border rounded-lg p-6 text-center w-full max-w-sm" style="border-color:var(--border);background:var(--surface);color:var(--text)"><h2 id="gate-port-clear-title" class="text-2xl font-black tracking-wider mb-3">PORT CLEAR</h2><p id="gate-port-clear-dialog-text" class="text-sm mb-6"></p><div id="gate-port-clear-dialog-actions" class="flex gap-3 justify-center flex-wrap"></div></div>';
    document.body.appendChild(root);
    root.addEventListener('click', event => {
      const action = event.target.closest?.('[data-port-clear-action]')?.dataset.portClearAction;
      if (action === 'cancel') hideDialog();
      if (action === 'send') void sendPortClear();
      if (action === 'ack') acknowledge(root.dataset.eventId);
    });
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape' && root.dataset.mode === 'confirm') {
        event.preventDefault();
        hideDialog();
      }
      if (event.key === 'Tab') {
        const buttons = [...root.querySelectorAll('button:not([disabled])')];
        if (!buttons.length) return;
        if (event.shiftKey && document.activeElement === buttons[0]) {
          event.preventDefault(); buttons[buttons.length - 1].focus();
        } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
          event.preventDefault(); buttons[0].focus();
        }
      }
    });
    return root;
  }

  function hideDialog() {
    const root = document.getElementById('gate-port-clear-dialog');
    if (!root) return;
    root.style.display = 'none';
    root.dataset.mode = '';
    root.dataset.eventId = '';
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }

  function showDialog(mode, eventId = '') {
    const root = dialog();
    if (root.style.display !== 'none' && root.dataset.mode === mode && root.dataset.eventId === eventId) return;
    if (root.style.display === 'none') previousFocus = document.activeElement;
    root.dataset.mode = mode;
    root.dataset.eventId = eventId;
    root.setAttribute('role', mode === 'alert' ? 'alertdialog' : 'dialog');
    root.querySelector('#gate-port-clear-dialog-text').textContent = mode === 'alert'
      ? 'PORT CLEAR' : 'Send PORT CLEAR to every user with GATE open?';
    root.querySelector('#gate-port-clear-dialog-actions').innerHTML = mode === 'alert'
      ? '<button type="button" data-port-clear-action="ack" class="px-6 py-3 rounded-lg font-bold text-white" style="background:var(--green)">ACKNOWLEDGE</button>'
      : '<button type="button" data-port-clear-action="send" class="px-4 py-3 rounded-lg font-bold text-white" style="background:var(--green)">SEND PORT CLEAR</button><button type="button" data-port-clear-action="cancel" class="px-4 py-3 rounded-lg font-bold surface border" style="border-color:var(--border)">CANCEL</button>';
    root.style.display = 'flex';
    root.querySelector('button')?.focus({ preventScroll: true });
  }

  function renderBoard(active) {
    const buses = document.getElementById('active-buses');
    const parent = buses?.closest('.gate-active-buses-block') || buses?.parentElement;
    if (!buses || !parent) return;
    let cue = document.getElementById('gate-port-clear-board-cue');
    if (!cue) {
      cue = document.createElement('div');
      cue.id = 'gate-port-clear-board-cue';
      cue.className = 'w-full rounded-lg px-4 py-4 text-center text-xl font-black tracking-widest';
      cue.style.cssText = 'background:var(--green);color:white;letter-spacing:.12em;';
      cue.dataset.owner = OWNER;
      cue.textContent = 'PORT CLEAR';
      cue.setAttribute('role', 'status');
      parent.appendChild(cue);
    }
    cue.hidden = !active;
    cue.style.display = active ? 'block' : 'none';
    buses.style.display = active ? 'none' : '';
    parent.dataset.portClear = String(active);
  }

  function scheduleExpiry(cutoff = 0) {
    if (scheduledExpiration === cutoff) return;
    if (expirationTimer) window.clearTimeout(expirationTimer);
    expirationTimer = null;
    scheduledExpiration = cutoff;
    if (cutoff > Date.now()) {
      expirationTimer = window.setTimeout(sync, Math.min(cutoff - Date.now() + 20, 2147483647));
    }
  }

  function sync() {
    ensureAirportControl();
    const active = activeEvent();
    renderBoard(Boolean(active));
    scheduleExpiry(active?.cutoff || 0);
    if (active && !isAcknowledged(active.event.__backendId)) {
      showDialog('alert', active.event.__backendId);
    }
    if (!active && document.getElementById('gate-port-clear-dialog')?.dataset.mode === 'confirm' &&
        (!Number.isFinite(toEpoch(dayTwoValue())) || Date.now() >= toEpoch(dayTwoValue()))) hideDialog();
  }

  function requestSend() {
    if (!isInstructor() || sending) return;
    const value = dayTwoValue();
    const cutoff = toEpoch(value);
    if (!weekGroup()) { message('Initialize a Week Group before sending PORT CLEAR.', true); return; }
    if (!Number.isFinite(cutoff)) { message('Set Receiving Day Two Start on the Input page before sending PORT CLEAR.', true); return; }
    if (Date.now() >= cutoff) { message('Receiving Day Two has already started; PORT CLEAR was not sent.', true); return; }
    if (activeEvent()) { message('PORT CLEAR is already active.', false); return; }
    showDialog('confirm');
  }

  async function sendPortClear() {
    if (!isInstructor() || sending) return;
    hideDialog();
    const group = weekGroup();
    const value = dayTwoValue(group);
    const cutoff = toEpoch(value);
    if (!group || !Number.isFinite(cutoff) || Date.now() >= cutoff || activeEvent()) {
      message('PORT CLEAR was not sent. Check the active Week Group and Receiving Day Two Start.', true);
      return;
    }
    sending = true;
    ensureAirportControl();
    try {
      const result = await window.dataSdk.create({
        type: 'audit_event', event_type: EVENT_TYPE, entity_type: 'week_group', entity_id: group,
        week_group: group, prior_version: 0, resulting_version: 0,
        metadata: { receiving_day_two_start: value }
      });
      if (!result?.isOk || result.data?.created_by_role !== 'instructor') {
        throw new Error(result?.error || 'PORT CLEAR could not be sent.');
      }
      message('PORT CLEAR sent to all open GATE sessions.', false);
    } catch (error) {
      message(error?.message || 'PORT CLEAR could not be sent.', true);
    } finally {
      sending = false;
      sync();
    }
  }

  async function updateSharedDayTwo(event) {
    if (event.target?.id !== 'receiving_day_two_start' || !isInstructor()) return;
    const group = String(document.getElementById('wg-batch-input')?.value || '').trim().toUpperCase();
    if (!group || group !== weekGroup()) return;
    const key = `receiving_day_two_start:${group}`;
    const value = String(event.target.value || '');
    const existing = records().find(record => record?.type === 'config' && record.key === key);
    try {
      const result = existing
        ? await window.dataSdk.update({ ...existing, value })
        : await window.dataSdk.create({ type: 'config', key, value, week_group: group });
      if (!result?.isOk) throw new Error(result?.error || 'Unable to save Receiving Day Two time.');
      sync();
    } catch (error) {
      const status = document.getElementById('init-status-msg');
      if (status) {
        status.textContent = error?.message || 'Unable to share Receiving Day Two time.';
        status.className = 'text-sm text-red-500';
      }
    }
  }

  function install() {
    if (installed) return;
    installed = true;
    document.addEventListener('change', event => { void updateSharedDayTwo(event); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
    window.addEventListener('focus', sync);
    window.addEventListener('pageshow', sync);
    if (!hooksRegistered && typeof window.registerGateHook === 'function') {
      window.registerGateHook('afterRenderAll', sync);
      window.registerGateHook('afterDataChanged', sync);
      window.registerGateHook('afterPageChange', sync);
      window.registerGateHook('afterCloseout', sync);
      hooksRegistered = true;
    }
    sync();
    window.GatePortClear = Object.freeze({ refresh: sync, activeEvent, dayTwoValue, toEpoch });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  window.addEventListener('load', install, { once: true });
})();
