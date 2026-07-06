// GATE bus workflow controller
// Canonical owner for airport/local bus submit, editable bus log, bus edit modal, and Space Force counts.
(function () {
  'use strict';

  let renderPatched = false;
  let submitCapturePatched = false;
  let renderAllPatched = false;
  let refreshQueued = false;
  let busWorkflowInterval = null;

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function safeEscape(value) {
    if (typeof window.GateComponents?.esc === 'function') return window.GateComponents.esc(value);
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getActiveWeekGroupSafe() {
    try {
      return typeof getActiveWG === 'function' ? getActiveWG() : '';
    } catch (_) {
      return '';
    }
  }

  function records() {
    if (Array.isArray(window.allData)) return window.allData;
    try {
      return Array.isArray(allData) ? allData : [];
    } catch (_) {
      return [];
    }
  }

  function formatTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function isEditableBus(bus) {
    return bus && bus.type === 'bus' && (bus.bus_type === 'airport' || bus.bus_type === 'local');
  }

  function busDisplayName(bus) {
    if (bus.bus_type === 'local') return `LOCAL – ${bus.destination || bus.originating_destination || 'LOCAL'}`;
    return `AIRPORT – BUS #${bus.bus_id || ''}`;
  }

  function busEditTitle(bus) {
    if (bus.bus_type === 'local') return `Edit Local Bus – ${bus.destination || bus.originating_destination || 'LOCAL'}`;
    return `Edit Bus #${bus.bus_id || ''}`;
  }

  function getBusIdentityLabel(bus) {
    return bus?.bus_type === 'local' ? 'Local Bus Name' : 'Bus Number';
  }

  function getBusIdentityValue(bus) {
    if (!bus) return '';
    return bus.bus_type === 'local'
      ? String(bus.destination || bus.originating_destination || '').trim()
      : String(bus.bus_id || '').trim();
  }

  function getEditableBuses(sourceBuses) {
    const wg = getActiveWeekGroupSafe();
    const source = Array.isArray(sourceBuses)
      ? sourceBuses
      : (typeof getRecords === 'function' ? getRecords('bus') : records().filter(record => record.type === 'bus'));

    return source
      .filter(bus => isEditableBus(bus) && (!wg || bus.week_group === wg))
      .sort((a, b) => {
        const statusA = a.status === 'active' ? 0 : 1;
        const statusB = b.status === 'active' ? 0 : 1;
        if (statusA !== statusB) return statusA - statusB;
        if (a.bus_type !== b.bus_type) return a.bus_type === 'airport' ? -1 : 1;
        if (a.bus_type === 'airport') return Number(a.bus_id || 0) - Number(b.bus_id || 0);
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      });
  }

  function ensureAirportSpaceForceInput() {
    const natInput = document.getElementById('bus-nat');
    const natWrapper = natInput ? natInput.closest('div') : null;
    if (!natWrapper || document.getElementById('bus-sf')) return;

    natWrapper.insertAdjacentHTML('afterend', `
      <div data-owner="gate-bus-workflow-controller">
        <label class="block text-sm font-medium mb-1" for="bus-sf">Space Force</label>
        <input id="bus-sf" type="number" inputmode="numeric" min="0" value="0" class="w-full border rounded px-3 py-2 bg-transparent" style="border-color:var(--border);color:var(--text);">
        <div id="bus-sf-error" class="text-red-500 text-xs mt-1 hidden"></div>
      </div>
    `);
  }

  function ensureLocalSpaceForceInput() {
    const natInput = document.getElementById('local-nat');
    const natWrapper = natInput ? natInput.closest('div') : null;
    if (!natWrapper || document.getElementById('local-sf')) return;

    natWrapper.insertAdjacentHTML('afterend', `
      <div data-owner="gate-bus-workflow-controller">
        <label class="block text-sm font-medium mb-1" for="local-sf">Space Force</label>
        <input id="local-sf" type="number" inputmode="numeric" min="0" value="0" class="w-full border rounded px-3 py-2 bg-transparent" style="border-color:var(--border);color:var(--text);">
        <div id="local-sf-error" class="text-red-500 text-xs mt-1 hidden"></div>
      </div>
    `);
  }

  function ensureSpaceForceColumn() {
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

  function updateHelpText() {
    const help = document.querySelector('#page-airport .surface h3 + .text-xs.text-muted');
    if (help) {
      help.textContent = 'Click any airport or local bus to edit bus number/name, OTW, female, naturalization, or Space Force counts.';
    }
  }

  function renderEditableBusLog(sourceBuses) {
    const tbody = document.getElementById('airport-bus-log-body');
    if (!tbody) return;

    ensureSpaceForceColumn();
    updateHelpText();

    const buses = getEditableBuses(sourceBuses);
    const sfTotalEl = document.getElementById('airport-log-total-sf');
    const otwTotalEl = document.getElementById('airport-log-total-otw');
    const femaleTotalEl = document.getElementById('airport-log-total-f');
    const natTotalEl = document.getElementById('airport-log-total-nat');
    const footerLabel = tbody.closest('table')?.querySelector('tfoot td:first-child');
    if (footerLabel) footerLabel.textContent = 'BUS TOTAL';

    if (buses.length === 0) {
      tbody.innerHTML = '<tr><td class="px-3 py-4 text-center text-muted" colspan="8">No airport or local buses generated for this week group.</td></tr>';
      if (otwTotalEl) otwTotalEl.textContent = '0';
      if (femaleTotalEl) femaleTotalEl.textContent = '0';
      if (natTotalEl) natTotalEl.textContent = '0';
      if (sfTotalEl) sfTotalEl.textContent = '0';
      return;
    }

    tbody.innerHTML = buses.map(bus => {
      const departed = formatTime(bus.departed_at || bus.created_at);
      const arrived = formatTime(bus.arrived_at);
      const isArrived = bus.status === 'arrived';
      const statusLabel = isArrived
        ? '<span class="text-xs font-bold uppercase px-2 py-1 rounded text-white" style="background:var(--green);">ARRIVED</span>'
        : '<span class="text-xs font-bold uppercase px-2 py-1 rounded text-white" style="background:var(--blue);">EN ROUTE</span>';
      const title = bus.bus_type === 'local'
        ? `Click to edit local bus: ${safeEscape(bus.destination || bus.originating_destination || 'LOCAL')}`
        : `Click to edit airport Bus #${safeEscape(bus.bus_id || '')}`;

      return `
        <tr
          class="border-b hover:opacity-80"
          style="border-color:var(--border); cursor:pointer;"
          onclick="openAirportBusEditModal('${safeEscape(bus.__backendId)}')"
          title="${title}"
          data-component="editable-bus-row"
          data-owner="gate-bus-workflow-controller"
          data-bus-id="${safeEscape(bus.__backendId)}"
        >
          <td class="px-3 py-2 font-bold">${safeEscape(busDisplayName(bus))}</td>
          <td class="px-3 py-2 font-tabular text-muted">${departed}</td>
          <td class="px-3 py-2 font-tabular">${arrived}</td>
          <td class="px-3 py-2">${statusLabel}</td>
          <td class="px-3 py-2 font-tabular">${safeEscape(bus.otw_count || 0)}</td>
          <td class="px-3 py-2 font-tabular">${safeEscape(bus.female_count || 0)}</td>
          <td class="px-3 py-2 font-tabular">${safeEscape(bus.nat_count || 0)}</td>
          <td class="px-3 py-2 font-tabular" data-sf-col="body">${safeEscape(bus.space_force_count || 0)}</td>
        </tr>
      `;
    }).join('');

    if (otwTotalEl) otwTotalEl.textContent = String(buses.reduce((sum, bus) => sum + n(bus.otw_count), 0));
    if (femaleTotalEl) femaleTotalEl.textContent = String(buses.reduce((sum, bus) => sum + n(bus.female_count), 0));
    if (natTotalEl) natTotalEl.textContent = String(buses.reduce((sum, bus) => sum + n(bus.nat_count), 0));
    if (sfTotalEl) sfTotalEl.textContent = String(buses.reduce((sum, bus) => sum + n(bus.space_force_count), 0));
  }

  function addBusIdentityEditInput(bus) {
    const otwInput = document.getElementById('edit-bus-otw');
    const otwWrapper = otwInput ? otwInput.closest('div') : null;
    if (!otwWrapper) return;

    if (!document.getElementById('edit-bus-identity')) {
      otwWrapper.insertAdjacentHTML('beforebegin', `
        <div data-owner="gate-bus-workflow-controller">
          <label id="edit-bus-identity-label" class="block text-sm font-medium mb-1" for="edit-bus-identity">Bus Number</label>
          <input id="edit-bus-identity" type="text" class="w-full border rounded px-3 py-2 bg-transparent" style="border-color:var(--border);color:var(--text);" maxlength="40">
          <div id="edit-bus-identity-error" class="text-red-500 text-xs mt-1 hidden"></div>
        </div>
      `);
    }

    const label = document.getElementById('edit-bus-identity-label');
    const input = document.getElementById('edit-bus-identity');
    if (label) label.textContent = getBusIdentityLabel(bus);
    if (input && bus) input.value = getBusIdentityValue(bus);
  }

  function addSpaceForceEditInput() {
    const natInput = document.getElementById('edit-bus-nat');
    const natWrapper = natInput ? natInput.closest('div') : null;
    if (!natWrapper || document.getElementById('edit-bus-sf')) return;

    natWrapper.insertAdjacentHTML('afterend', `
      <div data-owner="gate-bus-workflow-controller">
        <label class="block text-sm font-medium mb-1" for="edit-bus-sf">Space Force</label>
        <input id="edit-bus-sf" type="number" inputmode="numeric" min="0" class="w-full border rounded px-3 py-2 bg-transparent" style="border-color:var(--border);color:var(--text);">
        <div id="edit-bus-sf-error" class="text-red-500 text-xs mt-1 hidden"></div>
      </div>
    `);
  }

  function clearFieldErrors(prefix) {
    [`${prefix}-otw-error`, `${prefix}-female-error`, `${prefix}-nat-error`, `${prefix}-sf-error`, `${prefix}-total-error`, `${prefix}-dest-error`].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = '';
      el.classList.add('hidden');
    });
  }

  function clearEditErrors() {
    ['edit-bus-identity-error', 'edit-bus-otw-error', 'edit-bus-female-error', 'edit-bus-nat-error', 'edit-bus-sf-error'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = '';
      el.classList.add('hidden');
    });

    const msg = document.getElementById('edit-bus-msg');
    if (msg) {
      msg.textContent = '';
      msg.classList.add('hidden');
    }
  }

  function showError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function validateCounts(prefix, total, females, nats, sf) {
    const totalLabel = prefix === 'local' ? 'Total arrived' : 'OTW';
    const totalError = prefix === 'local' ? 'local-total-error' : `${prefix}-otw-error`;

    if (!Number.isFinite(total) || total <= 0 || total > 44) {
      showError(totalError, `${totalLabel} must be between 1 and 44.`);
      return false;
    }

    if (!Number.isFinite(females) || females < 0 || females > total) {
      showError(`${prefix}-female-error`, 'Females cannot exceed total.');
      return false;
    }

    if (!Number.isFinite(nats) || nats < 0 || nats > total) {
      showError(`${prefix}-nat-error`, 'Naturalizations cannot exceed total.');
      return false;
    }

    if (!Number.isFinite(sf) || sf < 0 || sf > total) {
      showError(`${prefix}-sf-error`, 'Space Force cannot exceed total.');
      return false;
    }

    return true;
  }

  function validateBusIdentity(bus, identity) {
    if (bus.bus_type === 'local' && !identity) {
      showError('edit-bus-identity-error', 'Local bus name is required.');
      return false;
    }

    if (bus.bus_type === 'airport' && !identity) {
      showError('edit-bus-identity-error', 'Bus number is required.');
      return false;
    }

    return true;
  }

  function updateLocalCache(record) {
    const data = records();
    const id = record?.__backendId;
    if (!id || !Array.isArray(data)) return;
    const index = data.findIndex(item => item.__backendId === id);
    if (index >= 0) data[index] = { ...data[index], ...record };
    else data.push(record);
  }

  function scheduleRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    window.requestAnimationFrame(() => {
      refreshQueued = false;
      renderEditableBusLog();
      if (typeof window.GateActiveBusController?.render === 'function') window.GateActiveBusController.render({ force: true });
      else if (typeof renderAll === 'function') renderAll();
    });
  }

  async function createAirportBus(form) {
    ensureAirportSpaceForceInput();
    clearFieldErrors('bus');

    const otw = n(document.getElementById('bus-otw')?.value);
    const females = n(document.getElementById('bus-female')?.value);
    const nats = n(document.getElementById('bus-nat')?.value);
    const sf = n(document.getElementById('bus-sf')?.value);
    const wg = getActiveWeekGroupSafe();

    if (!validateCounts('bus', otw, females, nats, sf)) return;
    if (!wg) {
      if (typeof showMsg === 'function') showMsg('airport-msg', 'Initialize a Week Group before dispatching buses.', true);
      return;
    }

    if (records().length >= 999) {
      if (typeof showMsg === 'function') showMsg('airport-msg', 'Record limit reached!', true);
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton ? submitButton.textContent : '';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Dispatching...';
    }

    const newBusId = typeof getNextAirportBusId === 'function' ? getNextAirportBusId() : Date.now();
    const payload = {
      type: 'bus',
      bus_id: String(newBusId),
      bus_type: 'airport',
      destination: '',
      otw_count: otw,
      female_count: females,
      nat_count: nats,
      space_force_count: sf,
      status: 'active',
      created_at: new Date().toISOString(),
      week_group: wg
    };

    const result = await window.dataSdk.create(payload);

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText || 'DISPATCH BUS';
    }

    if (result && result.isOk) {
      updateLocalCache(result.data || payload);
      if (typeof createSoundEvent === 'function') {
        await createSoundEvent('bus_dispatch', {
          bus_id: String(newBusId),
          otw_count: otw,
          female_count: females,
          nat_count: nats,
          space_force_count: sf,
          action: 'dispatch_bus'
        });
      }
      form.reset();
      const femaleInput = document.getElementById('bus-female');
      const natInput = document.getElementById('bus-nat');
      const sfInput = document.getElementById('bus-sf');
      if (femaleInput) femaleInput.value = '0';
      if (natInput) natInput.value = '0';
      if (sfInput) sfInput.value = '0';
      if (typeof showMsg === 'function') showMsg('airport-msg', `Bus #${newBusId} Dispatched`, false);
      scheduleRefresh();
    } else if (typeof showMsg === 'function') {
      showMsg('airport-msg', result?.error || 'Failed', true);
    }
  }

  async function createLocalBus(form) {
    ensureLocalSpaceForceInput();
    clearFieldErrors('local');

    const dest = String(document.getElementById('local-dest')?.value || '').trim();
    const total = n(document.getElementById('local-total')?.value);
    const females = n(document.getElementById('local-female')?.value);
    const nats = n(document.getElementById('local-nat')?.value);
    const sf = n(document.getElementById('local-sf')?.value);
    const wg = getActiveWeekGroupSafe();

    if (!dest) {
      if (typeof showMsg === 'function') showMsg('local-bus-msg', 'Destination and total arrived are required.', true);
      return;
    }

    if (!validateCounts('local', total, females, nats, sf)) return;

    if (!wg) {
      if (typeof showMsg === 'function') showMsg('local-bus-msg', 'Initialize a Week Group before adding a local arrival.', true);
      return;
    }

    if (records().length >= 999) {
      if (typeof showMsg === 'function') showMsg('local-bus-msg', 'Record limit reached!', true);
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton ? submitButton.textContent : '';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'SAVING...';
    }

    const payload = {
      type: 'bus',
      bus_id: '',
      bus_type: 'local',
      destination: dest,
      originating_destination: dest,
      otw_count: total,
      female_count: females,
      nat_count: nats,
      space_force_count: sf,
      status: 'arrived',
      created_at: new Date().toISOString(),
      arrived_at: new Date().toISOString(),
      week_group: wg
    };

    const result = await window.dataSdk.create(payload);

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText || 'SAVE';
    }

    if (result && result.isOk) {
      updateLocalCache(result.data || payload);
      form.reset();
      const femaleInput = document.getElementById('local-female');
      const natInput = document.getElementById('local-nat');
      const sfInput = document.getElementById('local-sf');
      if (femaleInput) femaleInput.value = '0';
      if (natInput) natInput.value = '0';
      if (sfInput) sfInput.value = '0';
      if (typeof closeLocalBusModal === 'function') closeLocalBusModal();
      scheduleRefresh();
    } else if (typeof showMsg === 'function') {
      showMsg('local-bus-msg', result?.error || 'Failed', true);
    }
  }

  function openEditableBusModal(id) {
    const bus = records().find(record => record.__backendId === id);
    if (!isEditableBus(bus)) return;

    try { editBusId = id; } catch (_) { window.editBusId = id; }
    addBusIdentityEditInput(bus);
    addSpaceForceEditInput();

    const title = document.getElementById('airport-bus-edit-title');
    if (title) title.textContent = busEditTitle(bus);

    const identityInput = document.getElementById('edit-bus-identity');
    const otwInput = document.getElementById('edit-bus-otw');
    const femaleInput = document.getElementById('edit-bus-female');
    const natInput = document.getElementById('edit-bus-nat');
    const sfInput = document.getElementById('edit-bus-sf');

    if (identityInput) identityInput.value = getBusIdentityValue(bus);
    if (otwInput) otwInput.value = n(bus.otw_count);
    if (femaleInput) femaleInput.value = n(bus.female_count);
    if (natInput) natInput.value = n(bus.nat_count);
    if (sfInput) sfInput.value = n(bus.space_force_count);

    clearEditErrors();
    const modal = document.getElementById('airport-bus-edit-modal');
    if (modal) modal.classList.remove('hidden');
  }

  async function updateEditableBus(form) {
    if (typeof editBusId === 'undefined' || !editBusId) return;
    const bus = records().find(record => record.__backendId === editBusId);
    if (!isEditableBus(bus)) return;

    clearEditErrors();

    const identity = String(document.getElementById('edit-bus-identity')?.value || '').trim();
    const otw = n(document.getElementById('edit-bus-otw')?.value);
    const females = n(document.getElementById('edit-bus-female')?.value);
    const nats = n(document.getElementById('edit-bus-nat')?.value);
    const sf = n(document.getElementById('edit-bus-sf')?.value);

    if (!validateBusIdentity(bus, identity)) return;
    if (!validateCounts('edit-bus', otw, females, nats, sf)) return;

    const identityPatch = bus.bus_type === 'local'
      ? { destination: identity, originating_destination: identity }
      : { bus_id: identity };

    const updatedBus = {
      ...bus,
      ...identityPatch,
      otw_count: otw,
      female_count: females,
      nat_count: nats,
      space_force_count: sf,
      updated_at: new Date().toISOString()
    };

    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton ? submitButton.textContent : '';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'SAVING...';
    }

    const result = await window.dataSdk.update(updatedBus);

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalText || 'SAVE';
    }

    if (result && result.isOk) {
      updateLocalCache(result.data || updatedBus);
      if (typeof closeAirportBusEditModal === 'function') closeAirportBusEditModal();
      scheduleRefresh();
    } else {
      const msg = document.getElementById('edit-bus-msg');
      if (msg) {
        msg.textContent = result?.error || 'Failed to save bus update.';
        msg.style.color = 'var(--red)';
        msg.classList.remove('hidden');
      }
    }
  }

  function handleWorkflowSubmit(event) {
    const form = event.target;
    if (!form || !['airport-form', 'local-bus-form', 'airport-bus-edit-form'].includes(form.id)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (form.id === 'airport-form') {
      createAirportBus(form);
      return;
    }

    if (form.id === 'local-bus-form') {
      createLocalBus(form);
      return;
    }

    if (form.id === 'airport-bus-edit-form') {
      updateEditableBus(form);
    }
  }

  function patchBusLogRenderers() {
    try {
      if (!renderPatched && typeof renderAirportBusLog === 'function') {
        const patchedRenderAirportBusLog = function patchedRenderAirportBusLog(buses) {
          renderEditableBusLog(buses);
        };

        window.renderAirportBusLog = patchedRenderAirportBusLog;
        try { renderAirportBusLog = patchedRenderAirportBusLog; } catch (_) {}
        renderPatched = true;
      }

      if (typeof openAirportBusEditModal === 'function' && openAirportBusEditModal.name !== 'gateOpenEditableBusModal') {
        const gateOpenEditableBusModal = function gateOpenEditableBusModal(id) {
          openEditableBusModal(id);
        };

        window.openAirportBusEditModal = gateOpenEditableBusModal;
        try { openAirportBusEditModal = gateOpenEditableBusModal; } catch (_) {}
      }
    } catch (error) {
      console.warn('GATE bus workflow renderer patch failed:', error);
    }
  }

  function patchRenderAll() {
    try {
      if (renderAllPatched || typeof renderAll !== 'function') return;

      const originalRenderAll = renderAll;
      const patchedRenderAll = function gateBusWorkflowRenderAll(...args) {
        const result = originalRenderAll.apply(this, args);
        renderEditableBusLog();
        return result;
      };

      window.renderAll = patchedRenderAll;
      try { renderAll = patchedRenderAll; } catch (_) {}
      renderAllPatched = true;
    } catch (error) {
      console.warn('GATE bus workflow renderAll patch failed:', error);
    }
  }

  function patchSubmitCapture() {
    if (submitCapturePatched) return;
    document.addEventListener('submit', handleWorkflowSubmit, true);
    submitCapturePatched = true;
  }

  function startBusWorkflowController() {
    ensureAirportSpaceForceInput();
    ensureLocalSpaceForceInput();
    addBusIdentityEditInput(null);
    addSpaceForceEditInput();
    patchBusLogRenderers();
    patchRenderAll();
    patchSubmitCapture();
    renderEditableBusLog();

    window.GateBusWorkflowController = Object.freeze({
      isCanonicalOwner: true,
      renderBusLog: renderEditableBusLog,
      openBusModal: openEditableBusModal,
      refresh: scheduleRefresh,
      getEditableBuses
    });

    if (typeof window.registerGateHook === 'function') {
      window.registerGateHook('afterRenderAll', () => renderEditableBusLog());
      window.registerGateHook('afterDataChanged', () => scheduleRefresh());
      window.registerGateHook('afterPageChange', () => renderEditableBusLog());
    }

    if (!busWorkflowInterval) {
      busWorkflowInterval = setInterval(() => {
        patchBusLogRenderers();
        ensureAirportSpaceForceInput();
        ensureLocalSpaceForceInput();
        addBusIdentityEditInput(null);
        addSpaceForceEditInput();
        renderEditableBusLog();
      }, 2500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startBusWorkflowController);
  } else {
    startBusWorkflowController();
  }
})();
