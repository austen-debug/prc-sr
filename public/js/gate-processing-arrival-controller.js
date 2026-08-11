// GATE Processing arrival controller
// Owns the Processing ADD menu, non-bus trainee arrival persistence,
// accountability reconciliation, correction history, and its responsive UI.
(function () {
  'use strict';

  const ADD_MENU_ID = 'gate-processing-add-menu';
  const TRAINEE_MODAL_ID = 'gate-processing-trainee-modal';
  const MANAGE_MODAL_ID = 'gate-processing-trainee-manage-modal';
  const PANEL_ID = 'gate-processing-arrival-panel';
  const STYLE_ID = 'gate-processing-arrival-style';
  const OVERLAY_IDS = [ADD_MENU_ID, TRAINEE_MODAL_ID, MANAGE_MODAL_ID];

  let installed = false;
  let hooksRegistered = false;
  let saving = false;
  let manageRecordId = '';
  let lastInvoker = null;

  function records() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function activeWeekGroup() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function isInstructor() {
    try {
      if (typeof window.GatePermissionGuard?.isInstructor === 'function') return window.GatePermissionGuard.isInstructor();
      return currentRole === 'instructor';
    } catch (_) { return false; }
  }

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function boundedCount(value) {
    return Math.min(99, Math.max(1, Math.round(n(value) || 1)));
  }

  function esc(value) {
    const helper = window.GateComponents?.esc;
    if (helper) return helper(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function syncLocalRecord(record) {
    if (!record || !record.__backendId) return;
    const list = records();
    const index = list.findIndex(item => item && item.__backendId === record.__backendId);
    if (index >= 0) list[index] = { ...list[index], ...record };
    else list.push(record);
  }

  function removeLocalRecord(id) {
    const list = records();
    const index = list.findIndex(item => item && item.__backendId === id);
    if (index >= 0) list.splice(index, 1);
  }

  function traineeArrivals() {
    const wg = activeWeekGroup();
    return records()
      .filter(record => record?.type === 'trainee_arrival')
      .filter(record => !wg || record.week_group === wg)
      .filter(record => record.status !== 'deleted')
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  function traineeArrivalById(id) {
    return traineeArrivals().find(record => record.__backendId === id) || null;
  }

  function accountability() {
    const wg = activeWeekGroup();
    const scoped = records().filter(record => !wg || record.week_group === wg);
    const expected = scoped
      .filter(record => record?.type === 'dorm')
      .reduce((sum, dorm) => sum + Math.max(0, n(dorm.max_load)), 0);
    const busArrived = scoped
      .filter(record => record?.type === 'bus' && record.status === 'arrived')
      .reduce((sum, bus) => sum + Math.max(0, n(bus.otw_count)), 0);
    const individualArrived = scoped
      .filter(record => record?.type === 'trainee_arrival' && record.status === 'arrived')
      .reduce((sum, record) => sum + Math.max(0, n(record.quantity)), 0);
    const arrived = busArrived + individualArrived;
    return { expected, busArrived, individualArrived, arrived, variance: arrived - expected };
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #page-processing .gate-processing-commandbar {
        position: sticky;
        top: 108px;
        z-index: 90;
        display: flex;
        align-items: center;
        gap: .65rem;
        flex-wrap: wrap;
        padding: .75rem 1rem;
        background: color-mix(in srgb, var(--bg) 88%, transparent);
        border-bottom: 1px solid var(--border);
        -webkit-backdrop-filter: blur(16px) saturate(1.12);
        backdrop-filter: blur(16px) saturate(1.12);
      }
      #gate-processing-add-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: .72rem 1.1rem;
        border: 1px solid rgba(56,189,248,.45);
        border-radius: .8rem;
        background: linear-gradient(145deg, rgba(37,99,235,.92), rgba(14,116,144,.82));
        color: #fff;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.16), 0 8px 22px rgba(0,0,0,.2);
        font-size: .85rem;
        font-weight: 950;
        letter-spacing: .07em;
        text-transform: uppercase;
      }
      #gate-processing-add-btn:focus-visible,
      .gate-arrival-choice:focus-visible,
      .gate-arrival-close:focus-visible,
      .gate-arrival-stepper button:focus-visible,
      .gate-arrival-primary:focus-visible,
      .gate-arrival-secondary:focus-visible,
      .gate-arrival-danger:focus-visible,
      .gate-arrival-row-action:focus-visible {
        outline: 2px solid var(--blue, #38bdf8);
        outline-offset: 3px;
      }
      #${PANEL_ID} {
        margin: .25rem 1rem .8rem;
        border: 1px solid var(--border);
        border-radius: 1rem;
        overflow: hidden;
        background: color-mix(in srgb, var(--surface) 94%, transparent);
        box-shadow: 0 10px 28px rgba(0,0,0,.16);
      }
      .gate-arrival-summary {
        display: grid;
        grid-template-columns: minmax(180px,1.3fr) repeat(5,minmax(84px,.6fr));
        align-items: stretch;
        min-width: 0;
      }
      .gate-arrival-summary-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: .75rem;
        padding: .8rem .9rem;
        border-right: 1px solid var(--border);
      }
      .gate-arrival-eyebrow {
        color: var(--text-muted);
        font-size: .63rem;
        font-weight: 900;
        letter-spacing: .09em;
        text-transform: uppercase;
      }
      .gate-arrival-summary-title {
        margin-top: .15rem;
        font-size: .92rem;
        font-weight: 950;
        letter-spacing: .035em;
        text-transform: uppercase;
      }
      .gate-arrival-state {
        flex: 0 0 auto;
        padding: .34rem .55rem;
        border: 1px solid currentColor;
        border-radius: 999px;
        font-size: .64rem;
        font-weight: 950;
        letter-spacing: .075em;
        text-transform: uppercase;
      }
      .gate-arrival-state[data-state='balanced'] { color: #4ade80; background: rgba(34,197,94,.09); }
      .gate-arrival-state[data-state='reconcile'] { color: #facc15; background: rgba(250,204,21,.09); }
      .gate-arrival-metric {
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-width: 0;
        padding: .7rem .75rem;
        border-right: 1px solid var(--border);
      }
      .gate-arrival-metric:last-child { border-right: 0; }
      .gate-arrival-metric-label {
        color: var(--text-muted);
        font-size: .58rem;
        font-weight: 900;
        letter-spacing: .07em;
        text-transform: uppercase;
      }
      .gate-arrival-metric-value {
        margin-top: .08rem;
        font-size: 1.28rem;
        font-weight: 950;
        font-variant-numeric: tabular-nums;
      }
      #gate-accountability-variance[data-state='balanced'] { color: #4ade80; }
      #gate-accountability-variance[data-state='reconcile'] { color: #facc15; }
      .gate-arrival-history {
        border-top: 1px solid var(--border);
      }
      .gate-arrival-history summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        min-height: 44px;
        padding: .62rem .9rem;
        cursor: pointer;
        list-style: none;
      }
      .gate-arrival-history summary::-webkit-details-marker { display: none; }
      .gate-arrival-history-count {
        display: inline-flex;
        align-items: center;
        gap: .45rem;
        font-size: .75rem;
        font-weight: 900;
      }
      .gate-arrival-history-count strong {
        min-width: 2rem;
        text-align: right;
        font-size: 1rem;
        font-variant-numeric: tabular-nums;
      }
      .gate-arrival-list { border-top: 1px solid var(--border); }
      .gate-arrival-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: .8rem;
        padding: .7rem .9rem;
        border-bottom: 1px solid var(--border);
      }
      .gate-arrival-row:last-child { border-bottom: 0; }
      .gate-arrival-row-main { min-width: 0; }
      .gate-arrival-row-title { font-size: .8rem; font-weight: 900; }
      .gate-arrival-row-time { margin-top: .12rem; color: var(--text-muted); font-size: .68rem; }
      .gate-arrival-row-end { display: flex; align-items: center; gap: .65rem; flex: 0 0 auto; }
      .gate-arrival-row-count { font-size: 1rem; font-weight: 950; font-variant-numeric: tabular-nums; }
      .gate-arrival-row-action {
        min-height: 36px;
        padding: .45rem .65rem;
        border: 1px solid var(--border);
        border-radius: .65rem;
        background: var(--surface-alt);
        color: var(--text);
        font-size: .66rem;
        font-weight: 900;
        letter-spacing: .04em;
        text-transform: uppercase;
      }
      .gate-arrival-empty { padding: .9rem; color: var(--text-muted); font-size: .78rem; text-align: center; }

      .gate-arrival-overlay {
        position: fixed;
        inset: 0;
        z-index: 7000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: rgba(0,0,0,.68);
        overscroll-behavior: contain;
      }
      .gate-arrival-overlay.hidden { display: none !important; }
      .gate-arrival-dialog {
        display: flex;
        flex-direction: column;
        width: min(94vw, 440px);
        max-height: min(88dvh, 680px);
        overflow: hidden;
        border: 1px solid rgba(148,163,184,.28);
        border-radius: 1.1rem;
        background: var(--surface);
        color: var(--text);
        box-shadow: 0 28px 70px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08);
      }
      .gate-arrival-dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex: 0 0 auto;
        padding: .9rem 1rem;
        border-bottom: 1px solid var(--border);
        background: color-mix(in srgb, var(--surface-alt) 70%, var(--surface));
      }
      .gate-arrival-dialog-title { margin: .08rem 0 0; font-size: 1.25rem; font-weight: 950; letter-spacing: -.02em; }
      .gate-arrival-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        min-height: 40px;
        border: 1px solid transparent;
        border-radius: 999px;
        background: transparent;
        color: var(--text-muted);
        font-size: 1.65rem;
        line-height: 1;
      }
      .gate-arrival-dialog-body {
        min-height: 0;
        overflow-y: auto;
        padding: 1rem;
      }
      .gate-arrival-help { margin: 0 0 .9rem; color: var(--text-muted); font-size: .78rem; line-height: 1.4; }
      .gate-arrival-choice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
      .gate-arrival-choice {
        display: flex;
        min-height: 112px;
        flex-direction: column;
        justify-content: space-between;
        padding: .9rem;
        border: 1px solid var(--border);
        border-radius: .9rem;
        background: var(--surface-alt);
        color: var(--text);
        text-align: left;
      }
      .gate-arrival-choice[data-primary='true'] {
        border-color: rgba(56,189,248,.42);
        background: linear-gradient(145deg, rgba(37,99,235,.32), rgba(14,116,144,.22));
      }
      .gate-arrival-choice-title { font-size: .9rem; font-weight: 950; letter-spacing: .04em; text-transform: uppercase; }
      .gate-arrival-choice-copy { margin-top: .45rem; color: var(--text-muted); font-size: .7rem; line-height: 1.35; }
      .gate-arrival-choice[data-primary='true'] .gate-arrival-choice-copy { color: rgba(255,255,255,.72); }
      .gate-arrival-stepper {
        display: grid;
        grid-template-columns: 52px minmax(90px,1fr) 52px;
        align-items: center;
        gap: .8rem;
        width: min(100%, 280px);
        margin: .55rem auto 1rem;
      }
      .gate-arrival-stepper button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 52px;
        height: 52px;
        min-height: 52px;
        border: 1px solid var(--border);
        border-radius: .85rem;
        background: var(--surface-alt);
        color: var(--text);
        font-size: 1.45rem;
        font-weight: 900;
      }
      .gate-arrival-stepper-value {
        text-align: center;
        font-size: 3rem;
        font-weight: 950;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }
      .gate-arrival-dialog-footer {
        display: flex;
        gap: .7rem;
        flex: 0 0 auto;
        padding: .8rem 1rem calc(.8rem + env(safe-area-inset-bottom));
        border-top: 1px solid var(--border);
        background: color-mix(in srgb, var(--surface) 94%, transparent);
      }
      .gate-arrival-primary,
      .gate-arrival-secondary,
      .gate-arrival-danger {
        flex: 1 1 0;
        min-height: 46px;
        padding: .7rem .9rem;
        border-radius: .8rem;
        font-size: .76rem;
        font-weight: 950;
        letter-spacing: .05em;
        text-transform: uppercase;
      }
      .gate-arrival-primary { border: 1px solid rgba(74,222,128,.35); background: #15803d; color: #fff; }
      .gate-arrival-secondary { border: 1px solid var(--border); background: var(--surface-alt); color: var(--text); }
      .gate-arrival-danger { border: 1px solid rgba(248,113,113,.52); background: rgba(127,29,29,.14); color: #f87171; }
      .gate-arrival-primary:disabled,
      .gate-arrival-secondary:disabled,
      .gate-arrival-danger:disabled { opacity: .55; cursor: progress; }
      .gate-arrival-message { min-height: 1.1rem; margin-top: .7rem; font-size: .72rem; text-align: center; }
      .gate-arrival-message.hidden { visibility: hidden; display: block !important; }

      @media (max-width: 900px) {
        .gate-arrival-summary { grid-template-columns: repeat(5,minmax(0,1fr)); }
        .gate-arrival-summary-heading { grid-column: 1 / -1; border-right: 0; border-bottom: 1px solid var(--border); }
        .gate-arrival-metric { border-bottom: 0; }
      }
      @media (max-width: 640px) {
        #page-processing .gate-processing-commandbar { top: 76px; padding: .6rem .75rem; gap: .5rem; }
        #gate-processing-add-btn { min-height: 42px; padding: .62rem .9rem; font-size: .76rem; }
        #${PANEL_ID} { margin: .2rem .75rem .7rem; border-radius: .85rem; }
        .gate-arrival-summary { grid-template-columns: repeat(2,minmax(0,1fr)); }
        .gate-arrival-summary-heading { grid-column: 1 / -1; padding: .7rem .75rem; }
        .gate-arrival-metric { padding: .58rem .65rem; border-bottom: 1px solid var(--border); }
        .gate-arrival-metric:nth-child(3), .gate-arrival-metric:nth-child(5) { border-right: 0; }
        .gate-arrival-metric:last-child { grid-column: 1 / -1; border-right: 0; border-bottom: 0; }
        .gate-arrival-metric-value { font-size: 1.12rem; }
        .gate-arrival-overlay { align-items: flex-end; padding: 0; }
        .gate-arrival-dialog {
          width: 100%;
          max-width: none;
          max-height: 100dvh;
          border-left: 0;
          border-right: 0;
          border-bottom: 0;
          border-radius: 1.1rem 1.1rem 0 0;
        }
        .gate-arrival-choice-grid { grid-template-columns: 1fr; }
        .gate-arrival-choice { min-height: 92px; }
        .gate-arrival-dialog-body { padding: .9rem; }
        .gate-arrival-dialog-footer { padding-left: .9rem; padding-right: .9rem; }
      }
      @media (max-height: 520px) and (orientation: landscape) {
        .gate-arrival-overlay { align-items: stretch; padding: 0; }
        .gate-arrival-dialog { width: min(100vw, 620px); max-height: 100dvh; border-radius: 0; }
        .gate-arrival-dialog-body { padding: .7rem 1rem; }
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeCommandbar(page) {
    const toolbar = page.querySelector(':scope > div:first-child');
    if (!toolbar) return null;
    toolbar.classList.add('gate-processing-commandbar');
    return toolbar;
  }

  function dialogShell(id, labelledBy, header, body, footer = '') {
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.className = 'gate-arrival-overlay hidden';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `<section class="gate-arrival-dialog" role="dialog" aria-modal="true" aria-labelledby="${labelledBy}" tabindex="-1">
      ${header}
      <div class="gate-arrival-dialog-body">${body}</div>
      ${footer ? `<div class="gate-arrival-dialog-footer">${footer}</div>` : ''}
    </section>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function ensureUi() {
    installStyles();
    const page = document.getElementById('page-processing');
    if (!page) return;

    const toolbar = normalizeCommandbar(page);
    if (toolbar && !document.getElementById('gate-processing-add-btn')) {
      const existingLocal = toolbar.querySelector('button[onclick="openLocalBusModal()"]');
      if (existingLocal) existingLocal.remove();

      const addButton = document.createElement('button');
      addButton.id = 'gate-processing-add-btn';
      addButton.type = 'button';
      addButton.textContent = '+ ADD';
      addButton.setAttribute('aria-haspopup', 'dialog');
      addButton.setAttribute('aria-controls', ADD_MENU_ID);
      toolbar.prepend(addButton);
    }

    if (!document.getElementById(ADD_MENU_ID)) {
      dialogShell(
        ADD_MENU_ID,
        'gate-processing-add-title',
        `<header class="gate-arrival-dialog-header">
          <div><div class="gate-arrival-eyebrow">Processing</div><h2 id="gate-processing-add-title" class="gate-arrival-dialog-title">Add arrival</h2></div>
          <button type="button" class="gate-arrival-close" data-processing-add-close aria-label="Close add arrival">×</button>
        </header>`,
        `<div class="gate-arrival-choice-grid">
          <button type="button" class="gate-arrival-choice" data-processing-add-action="local">
            <span class="gate-arrival-choice-title">Local Bus</span>
            <span class="gate-arrival-choice-copy">Record a local bus arrival using the established bus workflow.</span>
          </button>
          <button type="button" class="gate-arrival-choice" data-primary="true" data-processing-add-action="trainee">
            <span class="gate-arrival-choice-title">Trainee</span>
            <span class="gate-arrival-choice-copy">Add headcount that arrived outside a recorded bus movement.</span>
          </button>
        </div>`
      );
    }

    if (!document.getElementById(TRAINEE_MODAL_ID)) {
      dialogShell(
        TRAINEE_MODAL_ID,
        'gate-processing-trainee-title',
        `<header class="gate-arrival-dialog-header">
          <div><div class="gate-arrival-eyebrow">Non-Bus Arrival</div><h2 id="gate-processing-trainee-title" class="gate-arrival-dialog-title">Add trainee</h2></div>
          <button type="button" class="gate-arrival-close" data-trainee-arrival-close aria-label="Close add trainee">×</button>
        </header>`,
        `<p class="gate-arrival-help">Adds directly to Arrived without creating a bus record.</p>
         <div class="gate-arrival-stepper" aria-label="Trainee quantity">
           <button type="button" data-trainee-count="decrement" aria-label="Decrease trainee count">−</button>
           <div id="gate-trainee-arrival-count" class="gate-arrival-stepper-value" aria-live="polite">1</div>
           <button type="button" data-trainee-count="increment" aria-label="Increase trainee count">+</button>
         </div>
         <div id="gate-trainee-arrival-msg" class="gate-arrival-message hidden" role="status" aria-live="polite"></div>`,
        `<button type="button" class="gate-arrival-secondary" data-trainee-arrival-close>Cancel</button>
         <button type="button" id="gate-trainee-arrival-confirm" class="gate-arrival-primary">Add 1 Trainee</button>`
      );
    }

    if (!document.getElementById(MANAGE_MODAL_ID)) {
      dialogShell(
        MANAGE_MODAL_ID,
        'gate-processing-manage-title',
        `<header class="gate-arrival-dialog-header">
          <div><div class="gate-arrival-eyebrow">Individual Arrival</div><h2 id="gate-processing-manage-title" class="gate-arrival-dialog-title">Correct entry</h2></div>
          <button type="button" class="gate-arrival-close" data-trainee-manage-close aria-label="Close correction">×</button>
        </header>`,
        `<p class="gate-arrival-help">Correct the recorded quantity. Changes immediately affect Arrived and Variance.</p>
         <div class="gate-arrival-stepper" aria-label="Corrected trainee quantity">
           <button type="button" data-trainee-manage-count="decrement" aria-label="Decrease corrected trainee count">−</button>
           <div id="gate-trainee-manage-count" class="gate-arrival-stepper-value" aria-live="polite">1</div>
           <button type="button" data-trainee-manage-count="increment" aria-label="Increase corrected trainee count">+</button>
         </div>
         <div id="gate-trainee-manage-msg" class="gate-arrival-message hidden" role="status" aria-live="polite"></div>`,
        `<button type="button" id="gate-trainee-manage-delete" class="gate-arrival-danger">Delete Entry</button>
         <button type="button" id="gate-trainee-manage-save" class="gate-arrival-primary">Save Change</button>`
      );
    }

    if (!document.getElementById(PANEL_ID)) {
      const grid = document.getElementById('proc-dorm-grid');
      if (grid) {
        const panel = document.createElement('section');
        panel.id = PANEL_ID;
        panel.setAttribute('aria-label', 'Arrival accountability');
        panel.innerHTML = `
          <div class="gate-arrival-summary">
            <div class="gate-arrival-summary-heading">
              <div><div class="gate-arrival-eyebrow">Arrival Accountability</div><div class="gate-arrival-summary-title">Reconciliation</div></div>
              <div id="gate-processing-accountability-state" class="gate-arrival-state" data-state="balanced">Balanced</div>
            </div>
            <div class="gate-arrival-metric"><span class="gate-arrival-metric-label">Expected</span><strong id="gate-accountability-expected" class="gate-arrival-metric-value">0</strong></div>
            <div class="gate-arrival-metric"><span class="gate-arrival-metric-label">Bus</span><strong id="gate-accountability-bus" class="gate-arrival-metric-value">0</strong></div>
            <div class="gate-arrival-metric"><span class="gate-arrival-metric-label">Individual</span><strong id="gate-accountability-individual" class="gate-arrival-metric-value">0</strong></div>
            <div class="gate-arrival-metric"><span class="gate-arrival-metric-label">Arrived</span><strong id="gate-accountability-arrived" class="gate-arrival-metric-value">0</strong></div>
            <div class="gate-arrival-metric"><span class="gate-arrival-metric-label">Variance</span><strong id="gate-accountability-variance" class="gate-arrival-metric-value" data-state="balanced">0</strong></div>
          </div>
          <details class="gate-arrival-history">
            <summary>
              <span><span class="gate-arrival-eyebrow">Non-Bus Entries</span><span class="gate-arrival-summary-title" style="display:block">Individual arrivals</span></span>
              <span class="gate-arrival-history-count">Total <strong id="gate-trainee-arrival-total">0</strong></span>
            </summary>
            <div id="gate-trainee-arrival-list" class="gate-arrival-list"></div>
          </details>`;
        grid.insertAdjacentElement('beforebegin', panel);
      }
    }
  }

  function anyOverlayOpen() {
    return OVERLAY_IDS.some(id => !document.getElementById(id)?.classList.contains('hidden'));
  }

  function focusables(root) {
    return [...root.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.hasAttribute('hidden') && el.getClientRects().length > 0);
  }

  function setOverlay(id, open, invoker = null) {
    const el = document.getElementById(id);
    if (!el) return;
    if (open) {
      lastInvoker = invoker || document.activeElement;
      el.classList.remove('hidden');
      el.setAttribute('aria-hidden', 'false');
      document.body.classList.add('gate-modal-open');
      requestAnimationFrame(() => {
        const targets = focusables(el);
        (targets[0] || el.querySelector('.gate-arrival-dialog'))?.focus?.();
      });
    } else {
      el.classList.add('hidden');
      el.setAttribute('aria-hidden', 'true');
      if (!anyOverlayOpen()) {
        document.body.classList.remove('gate-modal-open');
        const restore = lastInvoker;
        lastInvoker = null;
        if (restore?.isConnected) requestAnimationFrame(() => restore.focus?.());
      }
    }
  }

  function openAddMenu(invoker) {
    ensureUi();
    setOverlay(ADD_MENU_ID, true, invoker);
  }
  function closeAddMenu() { setOverlay(ADD_MENU_ID, false); }

  function setCount(value) {
    const count = boundedCount(value);
    const el = document.getElementById('gate-trainee-arrival-count');
    const confirm = document.getElementById('gate-trainee-arrival-confirm');
    if (el) el.textContent = String(count);
    if (confirm) confirm.textContent = `Add ${count} ${count === 1 ? 'Trainee' : 'Trainees'}`;
  }
  function currentCount() { return boundedCount(document.getElementById('gate-trainee-arrival-count')?.textContent); }

  function setManageCount(value) {
    const count = boundedCount(value);
    const el = document.getElementById('gate-trainee-manage-count');
    if (el) el.textContent = String(count);
  }
  function currentManageCount() { return boundedCount(document.getElementById('gate-trainee-manage-count')?.textContent); }

  function openTraineeModal(invoker) {
    closeAddMenu();
    setCount(1);
    setMessage('gate-trainee-arrival-msg', '');
    setOverlay(TRAINEE_MODAL_ID, true, invoker);
  }
  function closeTraineeModal() { if (!saving) setOverlay(TRAINEE_MODAL_ID, false); }

  function openManageModal(id, invoker) {
    if (!isInstructor()) return;
    const record = traineeArrivalById(id);
    if (!record) return;
    manageRecordId = id;
    setManageCount(record.quantity);
    setMessage('gate-trainee-manage-msg', '');
    setOverlay(MANAGE_MODAL_ID, true, invoker);
  }
  function closeManageModal() {
    if (saving) return;
    manageRecordId = '';
    setOverlay(MANAGE_MODAL_ID, false);
  }
  function closeManageModalAfterSave() {
    manageRecordId = '';
    setOverlay(MANAGE_MODAL_ID, false);
  }

  function setMessage(id, message, tone = 'error') {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('hidden', !message);
    el.style.color = tone === 'success' ? 'var(--green)' : tone === 'warning' ? 'var(--yellow)' : 'var(--red)';
  }

  function refreshAll() {
    renderHistory();
    try { window.GatePremiumMetricsController?.sync?.(); } catch (_) {}
    try { window.GateStatusBoardController?.scheduleRender?.({ force: true }); } catch (_) {}
    try { if (typeof renderAll === 'function') renderAll(); } catch (_) {}
    try { window.runGateHooks?.('afterDataChanged', { source: 'processing-trainee-arrival' }); } catch (_) {}
  }

  async function addTrainees() {
    if (saving) return;
    const wg = activeWeekGroup();
    const count = currentCount();
    const button = document.getElementById('gate-trainee-arrival-confirm');

    if (!wg) return setMessage('gate-trainee-arrival-msg', 'Initialize a Week Group before adding a trainee.');
    if (!window.dataSdk || typeof window.dataSdk.create !== 'function') return setMessage('gate-trainee-arrival-msg', 'Arrival service is unavailable. Refresh and retry.');

    saving = true;
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = 'Adding…'; }
    const now = new Date().toISOString();
    const payload = {
      type: 'trainee_arrival',
      quantity: count,
      status: 'arrived',
      arrival_method: 'individual',
      created_at: now,
      arrived_at: now,
      week_group: wg
    };

    try {
      const result = await window.dataSdk.create(payload);
      if (!result?.isOk) throw new Error(result?.error || 'Trainee arrival was not added. Retry is required.');
      syncLocalRecord(result.data || payload);
      setOverlay(TRAINEE_MODAL_ID, false);
      refreshAll();
    } catch (error) {
      setMessage('gate-trainee-arrival-msg', error?.message || 'Trainee arrival was not added. Retry is required.');
    } finally {
      saving = false;
      if (button) { button.disabled = false; button.removeAttribute('aria-busy'); setCount(count); }
    }
  }

  async function saveManagedArrival() {
    if (saving || !isInstructor()) return;
    const record = traineeArrivalById(manageRecordId);
    if (!record || !window.dataSdk?.update) return setMessage('gate-trainee-manage-msg', 'Arrival service is unavailable. Refresh and retry.');
    const save = document.getElementById('gate-trainee-manage-save');
    const remove = document.getElementById('gate-trainee-manage-delete');
    saving = true;
    if (save) { save.disabled = true; save.setAttribute('aria-busy', 'true'); save.textContent = 'Saving…'; }
    if (remove) remove.disabled = true;
    try {
      const payload = { ...record, quantity: currentManageCount(), updated_at: new Date().toISOString() };
      const result = await window.dataSdk.update(payload);
      if (!result?.isOk) throw new Error(result?.error || 'Arrival correction was not saved. Retry is required.');
      syncLocalRecord(result.data || payload);
      closeManageModalAfterSave();
      refreshAll();
    } catch (error) {
      setMessage('gate-trainee-manage-msg', error?.message || 'Arrival correction was not saved. Retry is required.');
    } finally {
      saving = false;
      if (save) { save.disabled = false; save.removeAttribute('aria-busy'); save.textContent = 'Save Change'; }
      if (remove) remove.disabled = false;
    }
  }

  function confirmAction(message, callback) {
    if (typeof showConfirm === 'function') return showConfirm(message, callback);
    if (window.confirm(message)) callback();
  }

  function requestDeleteManagedArrival() {
    if (saving || !isInstructor()) return;
    const record = traineeArrivalById(manageRecordId);
    if (!record) return;
    const quantity = Math.max(0, n(record.quantity));
    confirmAction(`Delete this +${quantity} individual trainee arrival? This removes ${quantity} from Arrived.`, deleteManagedArrival);
  }

  async function deleteManagedArrival() {
    if (saving || !isInstructor()) return;
    const record = traineeArrivalById(manageRecordId);
    if (!record || !window.dataSdk?.delete) return setMessage('gate-trainee-manage-msg', 'Arrival service is unavailable. Refresh and retry.');
    const save = document.getElementById('gate-trainee-manage-save');
    const remove = document.getElementById('gate-trainee-manage-delete');
    saving = true;
    if (save) save.disabled = true;
    if (remove) { remove.disabled = true; remove.setAttribute('aria-busy', 'true'); remove.textContent = 'Deleting…'; }
    try {
      const result = await window.dataSdk.delete(record);
      if (!result?.isOk) throw new Error(result?.error || 'Arrival entry was not deleted. Retry is required.');
      removeLocalRecord(record.__backendId);
      closeManageModalAfterSave();
      refreshAll();
    } catch (error) {
      setMessage('gate-trainee-manage-msg', error?.message || 'Arrival entry was not deleted. Retry is required.');
    } finally {
      saving = false;
      if (save) save.disabled = false;
      if (remove) { remove.disabled = false; remove.removeAttribute('aria-busy'); remove.textContent = 'Delete Entry'; }
    }
  }

  function renderAccountability() {
    const values = accountability();
    const mapping = {
      'gate-accountability-expected': values.expected,
      'gate-accountability-bus': values.busArrived,
      'gate-accountability-individual': values.individualArrived,
      'gate-accountability-arrived': values.arrived
    };
    for (const [id, value] of Object.entries(mapping)) {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value);
    }
    const variance = document.getElementById('gate-accountability-variance');
    const state = document.getElementById('gate-processing-accountability-state');
    const balanced = values.variance === 0;
    if (variance) {
      variance.textContent = values.variance > 0 ? `+${values.variance}` : String(values.variance);
      variance.dataset.state = balanced ? 'balanced' : 'reconcile';
    }
    if (state) {
      state.textContent = balanced ? 'Balanced' : 'Reconcile';
      state.dataset.state = balanced ? 'balanced' : 'reconcile';
      state.setAttribute('aria-label', balanced ? 'Accountability balanced' : `Accountability variance ${values.variance > 0 ? 'plus ' : ''}${values.variance}`);
    }
  }

  function renderHistory() {
    ensureUi();
    renderAccountability();
    const list = document.getElementById('gate-trainee-arrival-list');
    const total = document.getElementById('gate-trainee-arrival-total');
    if (!list || !total) return;

    const arrivals = traineeArrivals();
    total.textContent = String(arrivals.reduce((sum, record) => sum + Math.max(0, n(record.quantity)), 0));
    if (!arrivals.length) {
      list.innerHTML = '<div class="gate-arrival-empty">No individual arrivals recorded.</div>';
      return;
    }

    const instructor = isInstructor();
    list.innerHTML = arrivals.map(record => {
      const quantity = Math.max(0, n(record.quantity));
      const date = new Date(record.arrived_at || record.created_at || '');
      const time = Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const id = esc(record.__backendId || '');
      const action = instructor ? `<button type="button" class="gate-arrival-row-action" data-trainee-arrival-manage="${id}" aria-label="Correct individual arrival of ${quantity} trainees at ${esc(time)}">Correct</button>` : '';
      return `<div class="gate-arrival-row">
        <div class="gate-arrival-row-main"><div class="gate-arrival-row-title">${quantity === 1 ? 'Trainee' : 'Trainees'}</div><div class="gate-arrival-row-time">${esc(time)}</div></div>
        <div class="gate-arrival-row-end"><div class="gate-arrival-row-count">+${quantity}</div>${action}</div>
      </div>`;
    }).join('');
  }

  function closeOverlayFromBackdrop(event) {
    const overlay = event.target.closest?.('.gate-arrival-overlay');
    if (!overlay || event.target !== overlay || saving) return false;
    if (overlay.id === ADD_MENU_ID) closeAddMenu();
    if (overlay.id === TRAINEE_MODAL_ID) closeTraineeModal();
    if (overlay.id === MANAGE_MODAL_ID) closeManageModal();
    return true;
  }

  function onClick(event) {
    if (closeOverlayFromBackdrop(event)) return;
    const add = event.target.closest?.('#gate-processing-add-btn');
    if (add) return openAddMenu(add);
    if (event.target.closest?.('[data-processing-add-close]')) return closeAddMenu();
    const local = event.target.closest?.('[data-processing-add-action="local"]');
    if (local) { closeAddMenu(); return window.openLocalBusModal?.(); }
    const trainee = event.target.closest?.('[data-processing-add-action="trainee"]');
    if (trainee) return openTraineeModal(trainee);
    if (event.target.closest?.('[data-trainee-arrival-close]')) return closeTraineeModal();
    if (event.target.closest?.('[data-trainee-count="increment"]')) return setCount(currentCount() + 1);
    if (event.target.closest?.('[data-trainee-count="decrement"]')) return setCount(currentCount() - 1);
    if (event.target.closest?.('#gate-trainee-arrival-confirm')) return addTrainees();

    const manage = event.target.closest?.('[data-trainee-arrival-manage]');
    if (manage) return openManageModal(manage.dataset.traineeArrivalManage, manage);
    if (event.target.closest?.('[data-trainee-manage-close]')) return closeManageModal();
    if (event.target.closest?.('[data-trainee-manage-count="increment"]')) return setManageCount(currentManageCount() + 1);
    if (event.target.closest?.('[data-trainee-manage-count="decrement"]')) return setManageCount(currentManageCount() - 1);
    if (event.target.closest?.('#gate-trainee-manage-save')) return saveManagedArrival();
    if (event.target.closest?.('#gate-trainee-manage-delete')) return requestDeleteManagedArrival();
  }

  function onKeyDown(event) {
    const openOverlay = OVERLAY_IDS.map(id => document.getElementById(id)).find(el => el && !el.classList.contains('hidden'));
    if (!openOverlay) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (saving) return;
      if (openOverlay.id === ADD_MENU_ID) closeAddMenu();
      if (openOverlay.id === TRAINEE_MODAL_ID) closeTraineeModal();
      if (openOverlay.id === MANAGE_MODAL_ID) closeManageModal();
      return;
    }
    if (event.key !== 'Tab') return;
    const targets = focusables(openOverlay);
    if (!targets.length) return;
    const first = targets[0];
    const last = targets[targets.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function registerHooks() {
    if (hooksRegistered || typeof window.registerGateHook !== 'function') return;
    window.registerGateHook('afterRenderAll', renderHistory);
    window.registerGateHook('afterDataChanged', renderHistory);
    window.registerGateHook('afterPageChange', renderHistory);
    hooksRegistered = true;
  }

  function install() {
    ensureUi();
    renderHistory();
    registerHooks();
    if (!installed) {
      document.addEventListener('click', onClick, true);
      document.addEventListener('keydown', onKeyDown, true);
      installed = true;
    }
    window.GateProcessingArrivalController = Object.freeze({
      isCanonicalOwner: true,
      openAddMenu,
      openTraineeModal,
      addTrainees,
      saveManagedArrival,
      deleteManagedArrival,
      renderHistory,
      calculateAccountability: accountability,
      getArrivals: traineeArrivals
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  window.addEventListener('load', install, { once: true });
})();
