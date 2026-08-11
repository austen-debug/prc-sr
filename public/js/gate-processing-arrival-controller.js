// GATE Processing quick-add arrival controller
// Owns the Processing ADD menu, individual trainee arrival persistence, and compact trainee-arrival history.
(function () {
  'use strict';

  const ADD_MENU_ID = 'gate-processing-add-menu';
  const TRAINEE_MODAL_ID = 'gate-processing-trainee-modal';
  const HISTORY_ID = 'gate-processing-trainee-history';
  let installed = false;
  let hooksRegistered = false;
  let saving = false;

  function records() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function activeWeekGroup() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function syncLocalRecord(record) {
    if (!record || !record.__backendId) return;
    const list = records();
    const index = list.findIndex(item => item && item.__backendId === record.__backendId);
    if (index >= 0) list[index] = { ...list[index], ...record };
    else list.push(record);
  }

  function traineeArrivals() {
    const wg = activeWeekGroup();
    return records()
      .filter(record => record?.type === 'trainee_arrival')
      .filter(record => !wg || record.week_group === wg)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  function ensureUi() {
    const page = document.getElementById('page-processing');
    if (!page) return;

    const toolbar = page.querySelector('.px-4.py-3.flex-shrink-0');
    if (toolbar && !document.getElementById('gate-processing-add-btn')) {
      const existingLocal = toolbar.querySelector('button[onclick="openLocalBusModal()"]');
      if (existingLocal) existingLocal.remove();

      const addButton = document.createElement('button');
      addButton.id = 'gate-processing-add-btn';
      addButton.type = 'button';
      addButton.className = 'px-6 py-3 rounded-lg font-bold text-white text-lg';
      addButton.style.background = '#2563eb';
      addButton.textContent = '+ ADD';
      addButton.setAttribute('aria-haspopup', 'menu');
      addButton.setAttribute('aria-controls', ADD_MENU_ID);
      toolbar.prepend(addButton);
    }

    if (!document.getElementById(ADD_MENU_ID)) {
      const menu = document.createElement('div');
      menu.id = ADD_MENU_ID;
      menu.className = 'confirm-overlay hidden';
      menu.setAttribute('aria-hidden', 'true');
      menu.innerHTML = `
        <div class="modal-content" style="max-width:420px;">
          <div class="flex justify-between items-center mb-4">
            <div>
              <div class="text-xs uppercase tracking-wider font-bold text-muted">Processing</div>
              <h2 class="text-2xl font-black">Add Arrival</h2>
            </div>
            <button type="button" data-processing-add-close class="text-3xl leading-none text-muted">×</button>
          </div>
          <div class="grid grid-cols-1 gap-3">
            <button type="button" data-processing-add-action="local" class="w-full px-5 py-4 rounded-lg font-black text-left" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text);">
              <div class="text-base">LOCAL BUS</div>
              <div class="text-xs text-muted font-medium mt-1">Record a non-airport bus movement.</div>
            </button>
            <button type="button" data-processing-add-action="trainee" class="w-full px-5 py-4 rounded-lg font-black text-left text-white" style="background:#2563eb;">
              <div class="text-base">TRAINEE</div>
              <div class="text-xs font-medium mt-1" style="opacity:.8;">Quick-add one or more trainees arriving outside a bus movement.</div>
            </button>
          </div>
        </div>`;
      document.body.appendChild(menu);
    }

    if (!document.getElementById(TRAINEE_MODAL_ID)) {
      const modal = document.createElement('div');
      modal.id = TRAINEE_MODAL_ID;
      modal.className = 'confirm-overlay hidden';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = `
        <div class="modal-content" style="max-width:420px;">
          <div class="flex justify-between items-center mb-4">
            <div>
              <div class="text-xs uppercase tracking-wider font-bold text-muted">Individual Arrival</div>
              <h2 class="text-2xl font-black">Add Trainee</h2>
            </div>
            <button type="button" data-trainee-arrival-close class="text-3xl leading-none text-muted">×</button>
          </div>
          <div class="text-sm text-muted mb-5">Counts toward Arrived without creating a bus record.</div>
          <div class="flex items-center justify-center gap-5 mb-5">
            <button type="button" data-trainee-count="decrement" class="load-btn" aria-label="Decrease trainee count">−</button>
            <div id="gate-trainee-arrival-count" class="text-5xl font-black font-tabular" aria-live="polite">1</div>
            <button type="button" data-trainee-count="increment" class="load-btn" aria-label="Increase trainee count">+</button>
          </div>
          <button type="button" id="gate-trainee-arrival-confirm" class="w-full px-5 py-4 rounded-lg font-black text-white text-lg" style="background:var(--green);">ADD 1 TRAINEE</button>
          <div id="gate-trainee-arrival-msg" class="text-center text-sm mt-3 hidden"></div>
        </div>`;
      document.body.appendChild(modal);
    }

    if (!document.getElementById(HISTORY_ID)) {
      const grid = document.getElementById('proc-dorm-grid');
      if (grid) {
        const panel = document.createElement('section');
        panel.id = HISTORY_ID;
        panel.className = 'mx-4 mb-4 surface border rounded-lg overflow-hidden';
        panel.style.borderColor = 'var(--border)';
        panel.innerHTML = `
          <div class="px-4 py-3 border-b flex items-center justify-between gap-3" style="border-color:var(--border);">
            <div>
              <div class="font-black uppercase tracking-wider">Individual Arrivals</div>
              <div class="text-xs text-muted">Non-bus trainee additions for this Week Group.</div>
            </div>
            <div id="gate-trainee-arrival-total" class="text-2xl font-black font-tabular">0</div>
          </div>
          <div id="gate-trainee-arrival-list" class="divide-y" style="border-color:var(--border);"></div>`;
        grid.insertAdjacentElement('afterend', panel);
      }
    }
  }

  function setOverlay(id, open) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('hidden', !open);
    el.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.classList.toggle('gate-modal-open', open);
  }

  function openAddMenu() {
    ensureUi();
    setOverlay(ADD_MENU_ID, true);
  }

  function closeAddMenu() {
    setOverlay(ADD_MENU_ID, false);
  }

  function setCount(value) {
    const count = Math.min(99, Math.max(1, Math.round(n(value) || 1)));
    const el = document.getElementById('gate-trainee-arrival-count');
    const confirm = document.getElementById('gate-trainee-arrival-confirm');
    if (el) el.textContent = String(count);
    if (confirm) confirm.textContent = `ADD ${count} ${count === 1 ? 'TRAINEE' : 'TRAINEES'}`;
  }

  function currentCount() {
    return Math.max(1, n(document.getElementById('gate-trainee-arrival-count')?.textContent));
  }

  function openTraineeModal() {
    closeAddMenu();
    setCount(1);
    const msg = document.getElementById('gate-trainee-arrival-msg');
    if (msg) msg.classList.add('hidden');
    setOverlay(TRAINEE_MODAL_ID, true);
  }

  function closeTraineeModal() {
    if (saving) return;
    setOverlay(TRAINEE_MODAL_ID, false);
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
    const msg = document.getElementById('gate-trainee-arrival-msg');
    const button = document.getElementById('gate-trainee-arrival-confirm');

    if (!wg) {
      if (msg) {
        msg.textContent = 'Initialize a Week Group before adding a trainee.';
        msg.style.color = 'var(--red)';
        msg.classList.remove('hidden');
      }
      return;
    }

    if (!window.dataSdk || typeof window.dataSdk.create !== 'function') return;
    saving = true;
    if (button) {
      button.disabled = true;
      button.textContent = 'ADDING…';
    }

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
      if (!result?.isOk) throw new Error(result?.error || 'Failed to add trainee arrival.');
      syncLocalRecord(result.data || payload);
      refreshAll();
      closeTraineeModal();
    } catch (error) {
      if (msg) {
        msg.textContent = error?.message || 'Failed to add trainee arrival.';
        msg.style.color = 'var(--red)';
        msg.classList.remove('hidden');
      }
    } finally {
      saving = false;
      if (button) {
        button.disabled = false;
        setCount(count);
      }
    }
  }

  function renderHistory() {
    ensureUi();
    const list = document.getElementById('gate-trainee-arrival-list');
    const total = document.getElementById('gate-trainee-arrival-total');
    if (!list || !total) return;

    const arrivals = traineeArrivals();
    const count = arrivals.reduce((sum, record) => sum + Math.max(0, n(record.quantity)), 0);
    total.textContent = String(count);

    if (!arrivals.length) {
      list.innerHTML = '<div class="px-4 py-4 text-sm text-muted">No individual arrivals recorded.</div>';
      return;
    }

    list.innerHTML = arrivals.map(record => {
      const quantity = Math.max(0, n(record.quantity));
      const date = new Date(record.arrived_at || record.created_at || '');
      const time = Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `<div class="px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <div class="font-bold">${quantity === 1 ? 'Trainee' : 'Trainees'}</div>
          <div class="text-xs text-muted">${time}</div>
        </div>
        <div class="text-xl font-black font-tabular">+${quantity}</div>
      </div>`;
    }).join('');
  }

  function onClick(event) {
    if (event.target.closest?.('#gate-processing-add-btn')) return openAddMenu();
    if (event.target.closest?.('[data-processing-add-close]')) return closeAddMenu();
    if (event.target.closest?.('[data-processing-add-action="local"]')) {
      closeAddMenu();
      return window.openLocalBusModal?.();
    }
    if (event.target.closest?.('[data-processing-add-action="trainee"]')) return openTraineeModal();
    if (event.target.closest?.('[data-trainee-arrival-close]')) return closeTraineeModal();
    if (event.target.closest?.('[data-trainee-count="increment"]')) return setCount(currentCount() + 1);
    if (event.target.closest?.('[data-trainee-count="decrement"]')) return setCount(currentCount() - 1);
    if (event.target.closest?.('#gate-trainee-arrival-confirm')) return addTrainees();
  }

  function onKeyDown(event) {
    if (event.key !== 'Escape') return;
    closeAddMenu();
    closeTraineeModal();
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
      renderHistory,
      getArrivals: traineeArrivals
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  window.addEventListener('load', install, { once: true });
})();
