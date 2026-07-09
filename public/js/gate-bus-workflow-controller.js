// GATE Phase 3 bus workflow controller
// Canonical owner for airport dispatch, local arrivals, bus arrival confirmation, combined bus log, shared bus edit modal, and Space Force counts.
(function () {
  'use strict';

  let installed = false;
  let hooksRegistered = false;
  let refreshQueued = false;

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function esc(value) {
    if (typeof window.GateComponents?.esc === 'function') return window.GateComponents.esc(value);
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function wg() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function data() {
    if (Array.isArray(window.allData)) return window.allData;
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function isBusRecord(record) {
    return record && record.type === 'bus' && (record.bus_type === 'airport' || record.bus_type === 'local');
  }

  function isActiveBus(bus) {
    return bus && (bus.status === 'active' || bus.status === 'otw');
  }

  function buses(source) {
    const activeWg = wg();
    const list = Array.isArray(source)
      ? source
      : (typeof getRecords === 'function' ? getRecords('bus') : data().filter(record => record.type === 'bus'));

    return list
      .filter(isBusRecord)
      .filter(bus => !activeWg || bus.week_group === activeWg)
      .sort((a, b) => {
        const statusA = isActiveBus(a) ? 0 : 1;
        const statusB = isActiveBus(b) ? 0 : 1;
        if (statusA !== statusB) return statusA - statusB;
        if (a.bus_type !== b.bus_type) return a.bus_type === 'airport' ? -1 : 1;
        if (a.bus_type === 'airport') return n(a.bus_id) - n(b.bus_id);
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      });
  }

  function busById(id) {
    return data().find(record => record && record.__backendId === id && isBusRecord(record)) || null;
  }

  function time(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function label(bus) {
    return bus.bus_type === 'local'
      ? `LOCAL – ${bus.destination || bus.originating_destination || 'LOCAL'}`
      : `AIRPORT – BUS #${bus.bus_id || ''}`;
  }

  function updateCache(record) {
    const list = data();
    const id = record?.__backendId;
    if (!id || !Array.isArray(list)) return;
    const index = list.findIndex(item => item.__backendId === id);
    if (index >= 0) list[index] = { ...list[index], ...record };
    else list.push(record);
  }

  function showMessage(id, message, isError = false) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || '';
    el.style.color = isError ? 'var(--red)' : 'var(--green)';
    el.classList.toggle('hidden', !message);
  }

  function showError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('hidden', !message);
  }

  function clearErrors(prefix) {
    [`${prefix}-otw-error`, `${prefix}-female-error`, `${prefix}-nat-error`, `${prefix}-sf-error`, `${prefix}-total-error`, `${prefix}-dest-error`].forEach(id => showError(id, ''));
  }

  function validateCounts(prefix, total, females, naturals, spaceForce) {
    const totalError = prefix === 'local' ? 'local-total-error' : `${prefix}-otw-error`;
    const totalLabel = prefix === 'local' ? 'Total arrived' : 'OTW';

    if (!Number.isFinite(total) || total <= 0 || total > 44) {
      showError(totalError, `${totalLabel} must be between 1 and 44.`);
      return false;
    }
    if (!Number.isFinite(females) || females < 0 || females > total) {
      showError(`${prefix}-female-error`, 'Females cannot exceed total.');
      return false;
    }
    if (!Number.isFinite(naturals) || naturals < 0 || naturals > total) {
      showError(`${prefix}-nat-error`, 'Naturalizations cannot exceed total.');
      return false;
    }
    if (!Number.isFinite(spaceForce) || spaceForce < 0 || spaceForce > total) {
      showError(`${prefix}-sf-error`, 'Space Force cannot exceed total.');
      return false;
    }
    return true;
  }

  function insertAfter(inputId, id, markup) {
    const input = document.getElementById(inputId);
    const wrapper = input ? input.closest('div') : null;
    if (!wrapper || document.getElementById(id)) return;
    wrapper.insertAdjacentHTML('afterend', markup);
  }

  function ensureFieldError(inputId, errorId) {
    const input = document.getElementById(inputId);
    const wrapper = input ? input.closest('div') : null;
    if (!wrapper || document.getElementById(errorId)) return;
    wrapper.insertAdjacentHTML('beforeend', `<div id="${errorId}" class="text-red-500 text-xs mt-1 hidden"></div>`);
  }

  function refreshAllSurfaces(source = 'gate-bus-workflow-controller') {
    try { if (typeof renderAll === 'function') renderAll(); } catch (error) { console.warn('GATE bus renderAll refresh failed:', error); }
    runPass();
    try { window.GateStatusBoardController?.scheduleRender?.({ force: true }); } catch (_) {}
    try { window.GateActiveBusController?.render?.({ force: true }); } catch (_) {}
    try { window.GatePremiumMetricsController?.refresh?.(); } catch (_) {}
    try { window.runGateHooks?.('afterDataChanged', { source }); } catch (_) {}
  }

  function ensureFields() {
    insertAfter('bus-nat', 'bus-sf', `
      <div data-owner="gate-bus-workflow-controller">
        <label class="block text-sm font-medium mb-1" for="bus-sf">Space Force</label>
        <input id="bus-sf" type="number" inputmode="numeric" min="0" value="0" class="w-full border rounded px-3 py-2 bg-transparent" style="border-color:var(--border);color:var(--text);">
        <div id="bus-sf-error" class="text-red-500 text-xs mt-1 hidden"></div>
      </div>
    `);

    ensureFieldError('local-dest', 'local-dest-error');
    ensureFieldError('local-total', 'local-total-error');
    ensureFieldError('local-female', 'local-female-error');
    ensureFieldError('local-nat', 'local-nat-error');

    insertAfter('local-nat', 'local-sf', `
      <div data-owner="gate-bus-workflow-controller">
        <label class="block text-sm font-medium mb-1" for="local-sf">Space Force</label>
        <input id="local-sf" type="number" inputmode="numeric" min="0" value="0" class="w-full border rounded px-3 py-2 bg-transparent" style="border-color:var(--border);color:var(--text);">
        <div id="local-sf-error" class="text-red-500 text-xs mt-1 hidden"></div>
      </div>
    `);

    const editOtw = document.getElementById('edit-bus-otw');
    const editWrapper = editOtw ? editOtw.closest('div') : null;
    if (editWrapper && !document.getElementById('edit-bus-identity')) {
      editWrapper.insertAdjacentHTML('beforebegin', `
        <div data-owner="gate-bus-workflow-controller">
          <label id="edit-bus-identity-label" class="block text-sm font-medium mb-1" for="edit-bus-identity">Bus Number</label>
          <input id="edit-bus-identity" type="text" class="w-full border rounded px-3 py-2 bg-transparent" style="border-color:var(--border);color:var(--text);" maxlength="40">
          <div id="edit-bus-identity-error" class="text-red-500 text-xs mt-1 hidden"></div>
        </div>
      `);
    }

    insertAfter('edit-bus-nat', 'edit-bus-sf', `
      <div data-owner="gate-bus-workflow-controller">
        <label class="block text-sm font-medium mb-1" for="edit-bus-sf">Space Force</label>
        <input id="edit-bus-sf" type="number" inputmode="numeric" min="0" class="w-full border rounded px-3 py-2 bg-transparent" style="border-color:var(--border);color:var(--text);">
        <div id="edit-bus-sf-error" class="text-red-500 text-xs mt-1 hidden"></div>
      </div>
    `);
  }

  function ensureSfColumn() {
    const body = document.getElementById('airport-bus-log-body');
    const table = body ? body.closest('table') : null;
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

  function renderBusLog(source) {
    const body = document.getElementById('airport-bus-log-body');
    if (!body) return;

    ensureSfColumn();
    const rows = buses(source);

    const help = document.querySelector('#page-airport .surface h3 + .text-xs.text-muted');
    if (help) help.textContent = 'Click any airport or local bus to edit bus number/name, OTW, female, naturalization, or Space Force counts.';

    if (rows.length === 0) {
      body.innerHTML = '<tr><td class="px-3 py-4 text-center text-muted" colspan="8">No airport or local buses generated for this week group.</td></tr>';
    } else {
      body.innerHTML = rows.map(bus => {
        const status = bus.status === 'arrived'
          ? '<span class="text-xs font-bold uppercase px-2 py-1 rounded text-white" style="background:var(--green);">ARRIVED</span>'
          : '<span class="text-xs font-bold uppercase px-2 py-1 rounded text-white" style="background:var(--blue);">EN ROUTE</span>';
        return `
          <tr class="border-b hover:opacity-80" style="border-color:var(--border);cursor:pointer;" data-component="editable-bus-row" data-owner="gate-bus-workflow-controller" data-bus-id="${esc(bus.__backendId)}">
            <td class="px-3 py-2 font-bold">${esc(label(bus))}</td>
            <td class="px-3 py-2 font-tabular text-muted">${time(bus.departed_at || bus.created_at)}</td>
            <td class="px-3 py-2 font-tabular">${time(bus.arrived_at)}</td>
            <td class="px-3 py-2">${status}</td>
            <td class="px-3 py-2 font-tabular">${n(bus.otw_count)}</td>
            <td class="px-3 py-2 font-tabular">${n(bus.female_count)}</td>
            <td class="px-3 py-2 font-tabular">${n(bus.nat_count)}</td>
            <td class="px-3 py-2 font-tabular" data-sf-col="body">${n(bus.space_force_count)}</td>
          </tr>
        `;
      }).join('');
    }

    const totals = rows.reduce((sum, bus) => ({
      otw: sum.otw + n(bus.otw_count),
      female: sum.female + n(bus.female_count),
      nat: sum.nat + n(bus.nat_count),
      sf: sum.sf + n(bus.space_force_count)
    }), { otw: 0, female: 0, nat: 0, sf: 0 });

    const footerLabel = body.closest('table')?.querySelector('tfoot td:first-child');
    if (footerLabel) footerLabel.textContent = 'BUS TOTAL';
    const otwTotal = document.getElementById('airport-log-total-otw');
    const femaleTotal = document.getElementById('airport-log-total-f');
    const natTotal = document.getElementById('airport-log-total-nat');
    const sfTotal = document.getElementById('airport-log-total-sf');
    if (otwTotal) otwTotal.textContent = String(totals.otw);
    if (femaleTotal) femaleTotal.textContent = String(totals.female);
    if (natTotal) natTotal.textContent = String(totals.nat);
    if (sfTotal) sfTotal.textContent = String(totals.sf);
  }

  function refresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    window.requestAnimationFrame(() => {
      refreshQueued = false;
      runPass();
      if (typeof window.GateActiveBusController?.render === 'function') window.GateActiveBusController.render({ force: true });
    });
  }

  async function createAirport(form) {
    clearErrors('bus');
    const total = n(document.getElementById('bus-otw')?.value);
    const females = n(document.getElementById('bus-female')?.value);
    const naturals = n(document.getElementById('bus-nat')?.value);
    const spaceForce = n(document.getElementById('bus-sf')?.value);
    const activeWg = wg();

    if (!validateCounts('bus', total, females, naturals, spaceForce)) return;
    if (!activeWg) return showMessage('airport-msg', 'Initialize a Week Group before dispatching buses.', true);
    if (data().length >= 999) return showMessage('airport-msg', 'Record limit reached!', true);

    const submit = form.querySelector('button[type="submit"]');
    const original = submit ? submit.textContent : '';
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Dispatching...';
    }

    const busId = typeof getNextAirportBusId === 'function' ? getNextAirportBusId() : Date.now();
    const now = new Date().toISOString();
    const payload = {
      type: 'bus',
      bus_id: String(busId),
      bus_type: 'airport',
      destination: '',
      otw_count: total,
      female_count: females,
      nat_count: naturals,
      space_force_count: spaceForce,
      status: 'active',
      created_at: now,
      departed_at: now,
      week_group: activeWg
    };

    const result = await window.dataSdk.create(payload);

    if (submit) {
      submit.disabled = false;
      submit.textContent = original || 'DISPATCH BUS';
    }

    if (!result?.isOk) return showMessage('airport-msg', result?.error || 'Failed to dispatch bus.', true);

    updateCache(result.data || payload);
    await createSoundEvent?.('bus_dispatch', { bus_id: String(busId), otw_count: total, female_count: females, nat_count: naturals, space_force_count: spaceForce, action: 'dispatch_bus' });
    form.reset();
    ['bus-female', 'bus-nat', 'bus-sf'].forEach(id => { const input = document.getElementById(id); if (input) input.value = '0'; });
    showMessage('airport-msg', `Bus #${busId} Dispatched`, false);
    refreshAllSurfaces('airport-dispatch');
  }

  async function createLocal(form) {
    clearErrors('local');
    const destination = String(document.getElementById('local-dest')?.value || '').trim();
    const total = n(document.getElementById('local-total')?.value);
    const females = n(document.getElementById('local-female')?.value);
    const naturals = n(document.getElementById('local-nat')?.value);
    const spaceForce = n(document.getElementById('local-sf')?.value);
    const activeWg = wg();

    if (!destination) {
      showError('local-dest-error', 'Originating destination is required.');
      showMessage('local-bus-msg', 'Destination and total arrived are required.', true);
      return;
    }
    if (!validateCounts('local', total, females, naturals, spaceForce)) return;
    if (!activeWg) return showMessage('local-bus-msg', 'Initialize a Week Group before adding a local arrival.', true);
    if (data().length >= 999) return showMessage('local-bus-msg', 'Record limit reached!', true);

    const submit = form.querySelector('button[type="submit"]');
    const original = submit ? submit.textContent : '';
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'SAVING...';
    }

    const now = new Date().toISOString();
    const payload = {
      type: 'bus',
      bus_id: '',
      bus_type: 'local',
      destination,
      originating_destination: destination,
      otw_count: total,
      female_count: females,
      nat_count: naturals,
      space_force_count: spaceForce,
      status: 'arrived',
      created_at: now,
      departed_at: now,
      arrived_at: now,
      week_group: activeWg
    };

    const result = await window.dataSdk.create(payload);

    if (submit) {
      submit.disabled = false;
      submit.textContent = original || 'ADD LOCAL ARRIVAL';
    }

    if (!result?.isOk) return showMessage('local-bus-msg', result?.error || 'Failed to add local arrival.', true);

    updateCache(result.data || payload);
    form.reset();
    ['local-female', 'local-nat', 'local-sf'].forEach(id => { const input = document.getElementById(id); if (input) input.value = '0'; });
    refreshAllSurfaces('local-arrival-create');
    showMessage('local-bus-msg', `${destination} added to arrived total.`, false);
    window.setTimeout(closeLocalBusModalCanonical, 250);
  }

  function openLocalBusModalCanonical() {
    ensureFields();
    const modal = document.getElementById('local-bus-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gate-modal-open');
    window.runGateHooks?.('afterModalOpen', { modal: 'local-bus-modal', source: 'gate-bus-workflow-controller' });
  }

  function closeLocalBusModalCanonical() {
    const modal = document.getElementById('local-bus-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gate-modal-open');
  }

  function openModal(id) {
    const bus = busById(id);
    if (!bus) return;

    ensureFields();
    try { editBusId = id; } catch (_) { window.editBusId = id; }

    const title = document.getElementById('airport-bus-edit-title');
    const identityLabel = document.getElementById('edit-bus-identity-label');
    const identityInput = document.getElementById('edit-bus-identity');
    if (title) title.textContent = bus.bus_type === 'local' ? `Edit Local Bus – ${bus.destination || bus.originating_destination || 'LOCAL'}` : `Edit Bus #${bus.bus_id || ''}`;
    if (identityLabel) identityLabel.textContent = bus.bus_type === 'local' ? 'Local Bus Name' : 'Bus Number';
    if (identityInput) identityInput.value = bus.bus_type === 'local' ? String(bus.destination || bus.originating_destination || '').trim() : String(bus.bus_id || '').trim();

    const values = {
      'edit-bus-otw': n(bus.otw_count),
      'edit-bus-female': n(bus.female_count),
      'edit-bus-nat': n(bus.nat_count),
      'edit-bus-sf': n(bus.space_force_count)
    };
    Object.entries(values).forEach(([field, value]) => { const input = document.getElementById(field); if (input) input.value = value; });

    ['edit-bus-identity-error', 'edit-bus-otw-error', 'edit-bus-female-error', 'edit-bus-nat-error', 'edit-bus-sf-error'].forEach(id => showError(id, ''));
    const msg = document.getElementById('edit-bus-msg');
    if (msg) msg.classList.add('hidden');

    const modal = document.getElementById('airport-bus-edit-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('gate-modal-open');
    window.runGateHooks?.('afterModalOpen', { modal: 'airport-bus-edit-modal', busId: id, source: 'gate-bus-workflow-controller' });
  }

  function closeAirportBusEditModalCanonical() {
    const modal = document.getElementById('airport-bus-edit-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
    }
    try { editBusId = null; } catch (_) { window.editBusId = null; }
    document.body.classList.remove('gate-modal-open');
  }

  async function updateBus(form) {
    if (typeof editBusId === 'undefined' || !editBusId) return;
    const bus = busById(editBusId);
    if (!bus) return;

    ['edit-bus-identity-error', 'edit-bus-otw-error', 'edit-bus-female-error', 'edit-bus-nat-error', 'edit-bus-sf-error'].forEach(id => showError(id, ''));

    const identity = String(document.getElementById('edit-bus-identity')?.value || '').trim();
    const total = n(document.getElementById('edit-bus-otw')?.value);
    const females = n(document.getElementById('edit-bus-female')?.value);
    const naturals = n(document.getElementById('edit-bus-nat')?.value);
    const spaceForce = n(document.getElementById('edit-bus-sf')?.value);

    if (!identity) {
      showError('edit-bus-identity-error', bus.bus_type === 'local' ? 'Local bus name is required.' : 'Bus number is required.');
      return;
    }
    if (!validateCounts('edit-bus', total, females, naturals, spaceForce)) return;

    const payload = {
      ...bus,
      ...(bus.bus_type === 'local' ? { destination: identity, originating_destination: identity } : { bus_id: identity }),
      otw_count: total,
      female_count: females,
      nat_count: naturals,
      space_force_count: spaceForce,
      updated_at: new Date().toISOString()
    };

    const submit = form.querySelector('button[type="submit"]');
    const original = submit ? submit.textContent : '';
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'SAVING...';
    }

    const result = await window.dataSdk.update(payload);

    if (submit) {
      submit.disabled = false;
      submit.textContent = original || 'SAVE';
    }

    if (!result?.isOk) {
      const msg = document.getElementById('edit-bus-msg');
      if (msg) {
        msg.textContent = result?.error || 'Failed to save bus update.';
        msg.style.color = 'var(--red)';
        msg.classList.remove('hidden');
      }
      return;
    }

    updateCache(result.data || payload);
    closeAirportBusEditModalCanonical();
    refreshAllSurfaces('bus-edit-save');
  }

  function confirmAction(message, callback) {
    if (typeof showConfirm === 'function') {
      showConfirm(message, callback);
      return;
    }
    if (window.confirm(message)) callback();
  }

  function confirmBusArrivalCanonical(id) {
    const bus = busById(id);
    if (!bus || !isActiveBus(bus)) return;
    const busLabel = bus.bus_type === 'local'
      ? `LOCAL – ${bus.destination || bus.originating_destination || 'Originating Destination'}`
      : `Bus #${bus.bus_id || ''}`;

    confirmAction(`Confirm ${busLabel} has arrived at PRC?`, async () => {
      const payload = {
        ...bus,
        status: 'arrived',
        arrived_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const result = await window.dataSdk.update(payload);
      if (result?.isOk) {
        updateCache(result.data || payload);
        refreshAllSurfaces('bus-arrival-confirm');
      } else {
        showMessage('airport-msg', result?.error || 'Failed to confirm bus arrival.', true);
      }
    });
  }

  function onSubmit(event) {
    const form = event.target;
    if (!form || !['airport-form', 'local-bus-form', 'airport-bus-edit-form'].includes(form.id)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (form.id === 'airport-form') return createAirport(form);
    if (form.id === 'local-bus-form') return createLocal(form);
    return updateBus(form);
  }

  function onClick(event) {
    const row = event.target.closest?.('[data-component="editable-bus-row"][data-bus-id]');
    if (row) openModal(row.dataset.busId);
  }

  function patchGlobals() {
    window.renderAirportBusLog = renderBusLog;
    window.openAirportBusEditModal = openModal;
    window.closeAirportBusEditModal = closeAirportBusEditModalCanonical;
    window.openLocalBusModal = openLocalBusModalCanonical;
    window.closeLocalBusModal = closeLocalBusModalCanonical;
    window.confirmBusArrival = confirmBusArrivalCanonical;

    try { renderAirportBusLog = renderBusLog; } catch (_) {}
    try { openAirportBusEditModal = openModal; } catch (_) {}
    try { closeAirportBusEditModal = closeAirportBusEditModalCanonical; } catch (_) {}
    try { openLocalBusModal = openLocalBusModalCanonical; } catch (_) {}
    try { closeLocalBusModal = closeLocalBusModalCanonical; } catch (_) {}
    try { confirmBusArrival = confirmBusArrivalCanonical; } catch (_) {}
  }

  function runPass() {
    ensureFields();
    ensureSfColumn();
    patchGlobals();
    renderBusLog();
  }

  function registerHooks() {
    if (hooksRegistered || typeof window.registerGateHook !== 'function') return;
    window.registerGateHook('afterRenderAll', renderBusLog);
    window.registerGateHook('afterDataChanged', refresh);
    window.registerGateHook('afterPageChange', runPass);
    window.registerGateHook('afterModalOpen', runPass);
    hooksRegistered = true;
  }

  function install() {
    if (!installed) {
      document.addEventListener('submit', onSubmit, true);
      document.addEventListener('click', onClick, true);
      installed = true;
    }

    runPass();
    registerHooks();
    window.GateBusWorkflowController = Object.freeze({
      isCanonicalOwner: true,
      renderBusLog,
      openBusModal: openModal,
      closeBusModal: closeAirportBusEditModalCanonical,
      openLocalBusModal: openLocalBusModalCanonical,
      closeLocalBusModal: closeLocalBusModalCanonical,
      confirmBusArrival: confirmBusArrivalCanonical,
      refresh,
      getEditableBuses: buses
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();

  window.addEventListener('load', install, { once: true });
})();
