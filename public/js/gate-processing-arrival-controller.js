// GATE Processing arrival controller
// Owns the Processing ADD menu, individual trainee arrival persistence, reconciliation summary, and correction history.
(function () {
  'use strict';

  const ADD_MENU_ID = 'gate-processing-add-menu';
  const TRAINEE_MODAL_ID = 'gate-processing-trainee-modal';
  const MANAGE_MODAL_ID = 'gate-processing-trainee-manage-modal';
  const HISTORY_ID = 'gate-processing-trainee-history';
  let installed = false;
  let hooksRegistered = false;
  let saving = false;
  let manageRecordId = '';

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
      addButton.setAttribute('aria-haspopup', 'dialog');
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
              <h2 class="text-2xl font-black">Add</h2>
            </div>
            <button type="button" data-processing-add-close class="text-3xl leading-none text-muted" aria-label="Close">×</button>
          </div>
          <div class="grid grid-cols-1 gap-3">
            <button type="button" data-processing-add-action="local" class="w-full px-5 py-4 rounded-lg font-black text-left" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text);">
              <div class="text-base">LOCAL BUS</div>
              <div class="text-xs text-muted font-medium mt-1">Record a local bus arrival.</div>
            </button>
            <button type="button" data-processing-add-action="trainee" class="w-full px-5 py-4 rounded-lg font-black text-left text-white" style="background:#2563eb;">
              <div class="text-base">TRAINEE</div>
              <div class="text-xs font-medium mt-1" style="opacity:.82;">Add trainee headcount that did not arrive on a recorded bus.</div>
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
              <div class="text-xs uppercase tracking-wider font-bold text-muted">Non-Bus Arrival</div>
              <h2 class="text-2xl font-black">Add Trainee</h2>
            </div>
            <button type="button" data-trainee-arrival-close class="text-3xl leading-none text-muted" aria-label="Close">×</button>
          </div>
          <div class="text-sm text-muted mb-5">Adds directly to the arrived headcount. No bus record is created.</div>
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

    if (!document.getElementById(MANAGE_MODAL_ID)) {
      const modal = document.createElement('div');
      modal.id = MANAGE_MODAL_ID;
      modal.className = 'confirm-overlay hidden';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML = `
        <div class="modal-content" style="max-width:420px;">
          <div class="flex justify-between items-center mb-4">
            <div>
              <div class="text-xs uppercase tracking-wider font-bold text-muted">Individual Arrival</div>
              <h2 class="text-2xl font-black">Correct Entry</h2>
            </div>
            <button type="button" data-trainee-manage-close class="text-3xl leading-none text-muted" aria-label="Close">×</button>
          </div>
          <div class="flex items-center justify-center gap-5 mb-5">
            <button type="button" data-trainee-manage-count="decrement" class="load-btn" aria-label="Decrease trainee count">−</button>
            <div id="gate-trainee-manage-count" class="text-5xl font-black font-tabular" aria-live="polite">1</div>
            <button type="button" data-trainee-manage-count="increment" class="load-btn" aria-label="Increase trainee count">+</button>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <button type="button" id="gate-trainee-manage-delete" class="px-5 py-3 rounded-lg font-black" style="border:1px solid var(--red);color:var(--red);">DELETE</button>
            <button type="button" id="gate-trainee-manage-save" class="px-5 py-3 rounded-lg font-black text-white" style="background:var(--green);">SAVE</button>
          </div>
          <div id="gate-trainee-manage-msg" class="text-center text-sm mt-3 hidden"></div>
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
          <div class="px-4 py-3 border-b" style="border-color:var(--border);">
            <div class="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div class="font-black uppercase tracking-wider">Accountability</div>
                <div class="text-xs text-muted">Bus and non-bus arrived headcount for the active Week Group.</div>
              </div>
              <div id="gate-processing-accountability-state" class="text-sm font-black uppercase"></div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
              <div><div class="text-[10px] uppercase font-bold text-muted">Expected</div><div id="gate-accountability-expected" class="text-xl font-black font-tabular">0</div></div>
              <div><div class="text-[10px] uppercase font-bold text-muted">Bus</div><div id="gate-accountability-bus" class="text-xl font-black font-tabular">0</div></div>
              <div><div class="text-[10px] uppercase font-bold text-muted">Individual</div><div id="gate-accountability-individual" class="text-xl font-black font-tabular">0</div></div>
              <div><div class="text-[10px] uppercase font-bold text-muted">Arrived</div><div id="gate-accountability-arrived" class="text-xl font-black font-tabular">0</div></div>
              <div><div class="text-[10px] uppercase font-bold text-muted">Variance</div><div id="gate-accountability-variance" class="text-xl font-black font-tabular">0</div></div>
            </div>
          </div>
          <div class="px-4 py-3 border-b flex items-center justify-between gap-3" style="border-color:var(--border);">
            <div>
              <div class="font-black uppercase tracking-wider">Individual Arrivals</div>
              <div class="text-xs text-muted">Non-bus trainee additions. Instructor entries can be corrected or deleted.</div>
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
    const anyOpen = [ADD_MENU_ID, TRAINEE_MODAL_ID, MANAGE_MODAL_ID]
      .some(overlayId => !document.getElementById(overlayId)?.classList.contains('hidden'));
    document.body.classList.toggle('gate-modal-open', anyOpen);
  }

  function openAddMenu() {
    ensureUi();
    setOverlay(ADD_MENU_ID, true);
  }

  function closeAddMenu() { setOverlay(ADD_MENU_ID, false); }

  function setCount(value) {
    const count = boundedCount(value);
    const el = document.getElementById('gate-trainee-arrival-count');
    const confirm = document.getElementById('gate-trainee-arrival-confirm');
    if (el) el.textContent = String(count);
    if (confirm) confirm.textContent = `ADD ${count} ${count === 1 ? 'TRAINEE' : 'TRAINEES'}`;
  }

  function currentCount() {
    return boundedCount(document.getElementById('gate-trainee-arrival-count')?.textContent);
  }

  function setManageCount(value) {
    const count = boundedCount(value);
    const el = document.getElementById('gate-trainee-manage-count');
    if (el) el.textContent = String(count);
  }

  function currentManageCount() {
    return boundedCount(document.getElementById('gate-trainee-manage-count')?.textContent);
  }

  function openTraineeModal() {
    closeAddMenu();
    setCount(1);
    const msg = document.getElementById('gate-trainee-arrival-msg');
    if (msg) msg.classList.add('hidden');
    setOverlay(TRAINEE_MODAL_ID, true);
  }

  function closeTraineeModal() {
    if (!saving) setOverlay(TRAINEE_MODAL_ID, false);
  }

  function openManageModal(id) {
    if (!isInstructor()) return;
    const record = traineeArrivalById(id);
    if (!record) return;
    manageRecordId = id;
    setManageCount(record.quantity);
    const msg = document.getElementById('gate-trainee-manage-msg');
    if (msg) msg.classList.add('hidden');
    setOverlay(MANAGE_MODAL_ID, true);
  }

  function closeManageModal() {
    if (saving) return;
    manageRecordId = '';
    setOverlay(MANAGE_MODAL_ID, false);
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
    if (button) { button.disabled = true; button.textContent = 'ADDING…'; }
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
      setOverlay(TRAINEE_MODAL_ID, false);
      refreshAll();
    } catch (error) {
      if (msg) {
        msg.textContent = error?.message || 'Failed to add trainee arrival.';
        msg.style.color = 'var(--red)';
        msg.classList.remove('hidden');
      }
    } finally {
      saving = false;
      if (button) { button.disabled = false; setCount(count); }
    }
  }

  async function saveManagedArrival() {
    if (saving || !isInstructor()) return;
    const record = traineeArrivalById(manageRecordId);
    if (!record || !window.dataSdk?.update) return;
    const msg = document.getElementById('gate-trainee-manage-msg');
    saving = true;
    try {
      const payload = { ...record, quantity: currentManageCount(), updated_at: new Date().toISOString() };
      const result = await window.dataSdk.update(payload);
      if (!result?.isOk) throw new Error(result?.error || 'Failed to update trainee arrival.');
      syncLocalRecord(result.data || payload);
      closeManageModalAfterSave();
      refreshAll();
    } catch (error) {
      if (msg) {
        msg.textContent = error?.message || 'Failed to update trainee arrival.';
        msg.style.color = 'var(--red)';
        msg.classList.remove('hidden');
      }
    } finally { saving = false; }
  }

  function closeManageModalAfterSave() {
    manageRecordId = '';
    setOverlay(MANAGE_MODAL_ID, false);
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
    confirmAction(`Delete this +${quantity} individual trainee arrival? This will remove it from Arrived.`, deleteManagedArrival);
  }

  async function deleteManagedArrival() {
    if (saving || !isInstructor()) return;
    const record = traineeArrivalById(manageRecordId);
    if (!record || !window.dataSdk?.delete) return;
    const msg = document.getElementById('gate-trainee-manage-msg');
    saving = true;
    try {
      const result = await window.dataSdk.delete(record);
      if (!result?.isOk) throw new Error(result?.error || 'Failed to delete trainee arrival.');
      removeLocalRecord(record.__backendId);
      closeManageModalAfterSave();
      refreshAll();
    } catch (error) {
      if (msg) {
        msg.textContent = error?.message || 'Failed to delete trainee arrival.';
        msg.style.color = 'var(--red)';
        msg.classList.remove('hidden');
      }
    } finally { saving = false; }
  }

  function renderAccountability() {
    const values = accountability();
    const expected = document.getElementById('gate-accountability-expected');
    const bus = document.getElementById('gate-accountability-bus');
    const individual = document.getElementById('gate-accountability-individual');
    const arrived = document.getElementById('gate-accountability-arrived');
    const variance = document.getElementById('gate-accountability-variance');
    const state = document.getElementById('gate-processing-accountability-state');
    if (expected) expected.textContent = String(values.expected);
    if (bus) bus.textContent = String(values.busArrived);
    if (individual) individual.textContent = String(values.individualArrived);
    if (arrived) arrived.textContent = String(values.arrived);
    if (variance) {
      variance.textContent = values.variance > 0 ? `+${values.variance}` : String(values.variance);
      variance.style.color = values.variance === 0 ? 'var(--green)' : 'var(--yellow)';
    }
    if (state) {
      state.textContent = values.variance === 0 ? 'BALANCED' : 'RECONCILE';
      state.style.color = values.variance === 0 ? 'var(--green)' : 'var(--yellow)';
    }
  }

  function renderHistory() {
    ensureUi();
    renderAccountability();
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

    const instructor = isInstructor();
    list.innerHTML = arrivals.map(record => {
      const quantity = Math.max(0, n(record.quantity));
      const date = new Date(record.arrived_at || record.created_at || '');
      const time = Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const action = instructor
        ? `<button type="button" data-trainee-arrival-manage="${record.__backendId || ''}" class="px-3 py-2 rounded font-black text-xs" style="border:1px solid var(--border);color:var(--text);">CORRECT</button>`
        : '';
      return `<div class="px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <div class="font-bold">${quantity === 1 ? 'Trainee' : 'Trainees'}</div>
          <div class="text-xs text-muted">${time}</div>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-xl font-black font-tabular">+${quantity}</div>
          ${action}
        </div>
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

    const manage = event.target.closest?.('[data-trainee-arrival-manage]');
    if (manage) return openManageModal(manage.dataset.traineeArrivalManage);
    if (event.target.closest?.('[data-trainee-manage-close]')) return closeManageModal();
    if (event.target.closest?.('[data-trainee-manage-count="increment"]')) return setManageCount(currentManageCount() + 1);
    if (event.target.closest?.('[data-trainee-manage-count="decrement"]')) return setManageCount(currentManageCount() - 1);
    if (event.target.closest?.('#gate-trainee-manage-save')) return saveManagedArrival();
    if (event.target.closest?.('#gate-trainee-manage-delete')) return requestDeleteManagedArrival();
  }

  function onKeyDown(event) {
    if (event.key !== 'Escape') return;
    closeAddMenu();
    closeTraineeModal();
    closeManageModal();
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