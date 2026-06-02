// PRC DASH local bus edit support
// Shows local bus records in the Airport editable bus log and allows their counts and identity to be edited.
(function () {
  let renderPatched = false;
  let submitPatched = false;

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function safeEscape(value) {
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
    if (bus.bus_type === 'local') {
      return `LOCAL – ${bus.destination || bus.originating_destination || 'LOCAL'}`;
    }

    return `AIRPORT – BUS #${bus.bus_id || ''}`;
  }

  function busEditTitle(bus) {
    if (bus.bus_type === 'local') {
      return `Edit Local Bus – ${bus.destination || bus.originating_destination || 'LOCAL'}`;
    }

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
    const records = Array.isArray(sourceBuses)
      ? sourceBuses
      : (typeof getRecords === 'function' ? getRecords('bus') : []);

    return records
      .filter(bus => isEditableBus(bus) && bus.week_group === wg)
      .sort((a, b) => {
        const statusA = a.status === 'active' ? 0 : 1;
        const statusB = b.status === 'active' ? 0 : 1;
        if (statusA !== statusB) return statusA - statusB;

        if (a.bus_type !== b.bus_type) return a.bus_type === 'airport' ? -1 : 1;

        if (a.bus_type === 'airport') {
          return Number(a.bus_id || 0) - Number(b.bus_id || 0);
        }

        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      });
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
      tbody.innerHTML = `
        <tr>
          <td class="px-3 py-4 text-center text-muted" colspan="8">No airport or local buses generated for this week group.</td>
        </tr>
      `;

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
          onclick="openAirportBusEditModal('${bus.__backendId}')"
          title="${title}"
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
        <div>
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

    if (natWrapper && !document.getElementById('edit-bus-sf')) {
      natWrapper.insertAdjacentHTML('afterend', `
        <div>
          <label class="block text-sm font-medium mb-1" for="edit-bus-sf">Space Force</label>
          <input id="edit-bus-sf" type="number" inputmode="numeric" min="0" class="w-full border rounded px-3 py-2 bg-transparent" style="border-color:var(--border);color:var(--text);">
          <div id="edit-bus-sf-error" class="text-red-500 text-xs mt-1 hidden"></div>
        </div>
      `);
    }
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

  function showEditError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
  }

  function validateEditCounts(otw, females, nats, sf) {
    if (!Number.isFinite(otw) || otw < 0 || otw > 44) {
      showEditError('edit-bus-otw-error', 'OTW must be between 0 and 44.');
      return false;
    }

    if (!Number.isFinite(females) || females < 0 || females > otw) {
      showEditError('edit-bus-female-error', 'Females cannot exceed OTW.');
      return false;
    }

    if (!Number.isFinite(nats) || nats < 0 || nats > otw) {
      showEditError('edit-bus-nat-error', 'Naturalizations cannot exceed OTW.');
      return false;
    }

    if (!Number.isFinite(sf) || sf < 0 || sf > otw) {
      showEditError('edit-bus-sf-error', 'Space Force cannot exceed OTW.');
      return false;
    }

    return true;
  }

  function validateBusIdentity(bus, identity) {
    if (bus.bus_type === 'local' && !identity) {
      showEditError('edit-bus-identity-error', 'Local bus name is required.');
      return false;
    }

    if (bus.bus_type === 'airport' && !identity) {
      showEditError('edit-bus-identity-error', 'Bus number is required.');
      return false;
    }

    return true;
  }

  function openEditableBusModal(id) {
    const bus = typeof allData !== 'undefined'
      ? allData.find(record => record.__backendId === id)
      : null;

    if (!isEditableBus(bus)) return;

    editBusId = id;
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

  async function handleEditableBusSubmit(event) {
    const form = event.target;
    if (!form || form.id !== 'airport-bus-edit-form') return;

    if (typeof editBusId === 'undefined' || !editBusId || typeof allData === 'undefined') return;

    const bus = allData.find(record => record.__backendId === editBusId);
    if (!isEditableBus(bus)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    clearEditErrors();

    const identity = String(document.getElementById('edit-bus-identity')?.value || '').trim();
    const otw = n(document.getElementById('edit-bus-otw')?.value);
    const females = n(document.getElementById('edit-bus-female')?.value);
    const nats = n(document.getElementById('edit-bus-nat')?.value);
    const sf = n(document.getElementById('edit-bus-sf')?.value);

    if (!validateBusIdentity(bus, identity)) return;
    if (!validateEditCounts(otw, females, nats, sf)) return;

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

    const result = await window.dataSdk.update(updatedBus);

    if (result && result.isOk) {
      const index = allData.findIndex(record => record.__backendId === editBusId);
      if (index >= 0) {
        allData[index] = {
          ...allData[index],
          ...(result.data || updatedBus)
        };
      }

      if (typeof closeAirportBusEditModal === 'function') closeAirportBusEditModal();
      if (typeof renderAll === 'function') renderAll();
      renderEditableBusLog();
    } else {
      const msg = document.getElementById('edit-bus-msg');
      if (msg) {
        msg.textContent = result?.error || 'Failed to save bus update.';
        msg.style.color = 'var(--red)';
        msg.classList.remove('hidden');
      }
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

      if (typeof openAirportBusEditModal === 'function' && openAirportBusEditModal.name !== 'patchedOpenEditableBusModal') {
        const patchedOpenEditableBusModal = function patchedOpenEditableBusModal(id) {
          openEditableBusModal(id);
        };

        window.openAirportBusEditModal = patchedOpenEditableBusModal;
        try { openAirportBusEditModal = patchedOpenEditableBusModal; } catch (_) {}
      }
    } catch (error) {
      console.warn('PRC DASH local bus edit patch failed:', error);
    }
  }

  function patchRenderAll() {
    try {
      if (window.__prcLocalBusRenderAllPatched || typeof renderAll !== 'function') return;

      const originalRenderAll = renderAll;
      const patchedRenderAll = function patchedRenderAll(...args) {
        const result = originalRenderAll.apply(this, args);
        renderEditableBusLog();
        return result;
      };

      window.renderAll = patchedRenderAll;
      try { renderAll = patchedRenderAll; } catch (_) {}
      window.__prcLocalBusRenderAllPatched = true;
    } catch (error) {
      console.warn('PRC DASH local bus renderAll patch failed:', error);
    }
  }

  function patchSubmitCapture() {
    if (submitPatched) return;

    document.addEventListener('submit', handleEditableBusSubmit, true);
    submitPatched = true;
  }

  function startLocalBusEditPatch() {
    patchBusLogRenderers();
    patchRenderAll();
    patchSubmitCapture();
    addBusIdentityEditInput(null);
    addSpaceForceEditInput();
    renderEditableBusLog();

    setInterval(() => {
      patchBusLogRenderers();
      patchRenderAll();
      addBusIdentityEditInput(null);
      addSpaceForceEditInput();
      renderEditableBusLog();
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startLocalBusEditPatch);
  } else {
    startLocalBusEditPatch();
  }
})();
