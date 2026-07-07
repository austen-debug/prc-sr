// GATE Space Force compatibility layer
// Passive support only: Space Force field presence and closed-dorm final-time edit normalization.
(function () {
  'use strict';

  let hooksRegistered = false;
  let dormEditFormPatched = false;

  function findInputWrapper(inputId) {
    const input = document.getElementById(inputId);
    return input ? input.closest('div') : null;
  }

  function ensureBusCardStyles() {
    if (document.getElementById('prc-bus-card-styles')) return;

    const style = document.createElement('style');
    style.id = 'prc-bus-card-styles';
    style.textContent = `
      #page-board #active-buses .bus-badge {
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-start !important;
        justify-content: center !important;
        min-width: 124px !important;
        min-height: 142px !important;
        padding: 0.72rem 0.86rem !important;
        gap: 0.17rem !important;
        text-align: left !important;
        white-space: normal !important;
        line-height: 1.12 !important;
        font-size: 0.92rem !important;
      }

      #page-board #active-buses .prc-bus-card-title {
        display: block !important;
        font-size: 1.16rem !important;
        font-weight: 950 !important;
        letter-spacing: 0.035em !important;
        line-height: 1 !important;
        margin-bottom: 0.16rem !important;
      }

      #page-board #active-buses .prc-bus-card-line {
        display: block !important;
        font-size: 0.92rem !important;
        font-weight: 850 !important;
        letter-spacing: 0.035em !important;
        line-height: 1.1 !important;
      }

      #page-board #active-buses .prc-bus-card-dept {
        display: block !important;
        width: 100% !important;
        margin-top: 0.34rem !important;
        padding-top: 0.3rem !important;
        border-top: 1px solid rgba(255,255,255,0.16);
        font-size: 0.74rem !important;
        font-weight: 900 !important;
        letter-spacing: 0.075em !important;
        opacity: 0.9;
      }

      .theme-light #page-board #active-buses .prc-bus-card-dept {
        border-top-color: rgba(100,116,139,0.24);
      }

      @media (max-width: 1024px) {
        #page-board #active-buses .bus-badge {
          min-width: 112px !important;
          min-height: 132px !important;
          padding: 0.64rem 0.72rem !important;
        }

        #page-board #active-buses .prc-bus-card-title {
          font-size: 1.06rem !important;
        }

        #page-board #active-buses .prc-bus-card-line {
          font-size: 0.84rem !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensureAirportSpaceForceInput() {
    const natWrapper = findInputWrapper('bus-nat');
    if (!natWrapper || document.getElementById('bus-sf')) return;

    natWrapper.insertAdjacentHTML('afterend', `
      <div data-owner="gate-space-force-compatibility-layer">
        <label class="block text-sm font-medium mb-1" for="bus-sf">Space Force</label>
        <input id="bus-sf" type="number" inputmode="numeric" min="0" value="0" class="w-full border rounded px-3 py-2 bg-transparent" style="border-color:var(--border);color:var(--text);">
        <div id="bus-sf-error" class="text-red-500 text-xs mt-1 hidden"></div>
      </div>
    `);
  }

  function ensureLocalSpaceForceInput() {
    const natWrapper = findInputWrapper('local-nat');
    if (!natWrapper || document.getElementById('local-sf')) return;

    natWrapper.insertAdjacentHTML('afterend', `
      <div data-owner="gate-space-force-compatibility-layer">
        <label class="block text-sm font-medium mb-1" for="local-sf">Space Force</label>
        <input id="local-sf" type="number" inputmode="numeric" min="0" value="0" class="w-full border rounded px-3 py-2 bg-transparent" style="border-color:var(--border);color:var(--text);">
        <div id="local-sf-error" class="text-red-500 text-xs mt-1 hidden"></div>
      </div>
    `);
  }

  function ensureEditSpaceForceInput() {
    const natWrapper = findInputWrapper('edit-bus-nat');
    if (!natWrapper || document.getElementById('edit-bus-sf')) return;

    natWrapper.insertAdjacentHTML('afterend', `
      <div data-owner="gate-space-force-compatibility-layer">
        <label class="block text-sm font-medium mb-1" for="edit-bus-sf">Space Force</label>
        <input id="edit-bus-sf" type="number" inputmode="numeric" min="0" class="w-full border rounded px-3 py-2 bg-transparent" style="border-color:var(--border);color:var(--text);">
        <div id="edit-bus-sf-error" class="text-red-500 text-xs mt-1 hidden"></div>
      </div>
    `);
  }

  function ensureAirportLogSfColumn() {
    const body = document.getElementById('airport-bus-log-body');
    if (!body) return;

    const table = body.closest('table');
    if (!table) return;

    const headerRow = table.querySelector('thead tr');
    if (headerRow && !headerRow.querySelector('[data-sf-col="header"]')) {
      const th = document.createElement('th');
      th.className = 'px-3 py-2 text-left';
      th.dataset.sfCol = 'header';
      th.textContent = 'SF';
      headerRow.appendChild(th);
    }

    const footerRow = table.querySelector('tfoot tr');
    if (footerRow && !document.getElementById('airport-log-total-sf')) {
      const td = document.createElement('td');
      td.id = 'airport-log-total-sf';
      td.className = 'px-3 py-2 font-tabular';
      td.textContent = '0';
      footerRow.appendChild(td);
    }
  }

  function normalizeFinalTime(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const match = raw.match(/^(\d{1,4})(?::([0-5]\d))?$/);
    if (!match) return raw;

    const minutes = String(Number(match[1])).padStart(2, '0');
    const seconds = match[2] || '00';
    return `${minutes}:${seconds}`;
  }

  function showEditMessage(message, isError = false) {
    const msg = document.getElementById('dorm-edit-msg');
    if (!msg) return;

    msg.textContent = message;
    msg.style.color = isError ? 'var(--red)' : 'var(--green)';
    msg.classList.remove('hidden');
  }

  function patchDormEditFinalTimeInput() {
    const finalTimeInput = document.getElementById('edit-closed-timer');
    if (!finalTimeInput || finalTimeInput.dataset.gateFinalTimePatched === 'true') return;

    finalTimeInput.dataset.gateFinalTimePatched = 'true';
    finalTimeInput.dataset.owner = 'gate-space-force-compatibility-layer';
    finalTimeInput.addEventListener('blur', () => {
      finalTimeInput.value = normalizeFinalTime(finalTimeInput.value);
    });
    finalTimeInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const form = document.getElementById('dorm-edit-form');
        if (form) form.requestSubmit();
      }
    });
  }

  function patchDormEditFormValidation() {
    const form = document.getElementById('dorm-edit-form');
    if (!form || dormEditFormPatched) return;

    form.addEventListener('submit', event => {
      try {
        if (typeof editDormId === 'undefined' || !editDormId || !Array.isArray(allData)) return;
        const dorm = allData.find(record => record.__backendId === editDormId && record.type === 'dorm');
        if (!dorm || String(dorm.state || '').toLowerCase() !== 'closed') return;

        const input = document.getElementById('edit-closed-timer');
        if (!input) return;

        const finalTime = normalizeFinalTime(input.value || dorm.closed_timer || '');
        if (finalTime && !/^\d{1,4}:\d{2}$/.test(finalTime)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          showEditMessage('Final Time must use MM:SS format, such as 60:00.', true);
          return;
        }

        input.value = finalTime || dorm.closed_timer || '00:00';
      } catch (error) {
        console.warn('GATE final time validation failed:', error);
      }
    }, true);

    dormEditFormPatched = true;
  }

  function runSpaceForceCompatibilityPass() {
    ensureBusCardStyles();
    ensureAirportSpaceForceInput();
    ensureLocalSpaceForceInput();
    ensureEditSpaceForceInput();
    ensureAirportLogSfColumn();
    patchDormEditFinalTimeInput();
    patchDormEditFormValidation();
  }

  function registerHooksOnce() {
    if (hooksRegistered || typeof window.registerGateHook !== 'function') return;
    window.registerGateHook('afterRenderAll', runSpaceForceCompatibilityPass);
    window.registerGateHook('afterPageChange', runSpaceForceCompatibilityPass);
    window.registerGateHook('afterDataChanged', runSpaceForceCompatibilityPass);
    window.registerGateHook('afterModalOpen', runSpaceForceCompatibilityPass);
    hooksRegistered = true;
  }

  function startSpaceForceCompatibilityLayer() {
    runSpaceForceCompatibilityPass();
    registerHooksOnce();

    window.GateSpaceForceCompatibilityLayer = Object.freeze({
      isPassiveCompatibilityLayer: true,
      refresh: runSpaceForceCompatibilityPass,
      normalizeFinalTime
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSpaceForceCompatibilityLayer, { once: true });
  } else {
    startSpaceForceCompatibilityLayer();
  }

  window.addEventListener('load', startSpaceForceCompatibilityLayer, { once: true });
})();
