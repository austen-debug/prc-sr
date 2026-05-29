// PRC DASH Space Force bus count support
// UI/runtime patch loaded after the main single-page app. Keeps existing D1/data SDK workflow intact.
(function () {
  let airportFormPatched = false;
  let airportEditFormPatched = false;
  let airportEditOpenPatched = false;
  let renderAirportBusLogPatched = false;
  let renderAllPatchedForSf = false;
  let busCardStylesPatched = false;

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

  function formatDepartedTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function findInputWrapper(inputId) {
    const input = document.getElementById(inputId);
    return input ? input.closest('div') : null;
  }

  function showFieldError(id, message) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('hidden', !message);
  }

  function resetErrors(ids) {
    ids.forEach(id => showFieldError(id, ''));
  }

  function validateCounts(prefix, otw, females, nats, spaceForce) {
    const errors = {
      otw: `${prefix}-otw-error`,
      female: `${prefix}-female-error`,
      nat: `${prefix}-nat-error`,
      sf: `${prefix}-sf-error`
    };

    resetErrors(Object.values(errors));

    if (!Number.isFinite(otw) || otw < 0 || otw > 44) {
      showFieldError(errors.otw, 'OTW must be between 0 and 44.');
      return false;
    }

    if (!Number.isFinite(females) || females < 0 || females > otw) {
      showFieldError(errors.female, 'Females cannot exceed OTW.');
      return false;
    }

    if (!Number.isFinite(nats) || nats < 0 || nats > otw) {
      showFieldError(errors.nat, 'Naturalizations cannot exceed OTW.');
      return false;
    }

    if (!Number.isFinite(spaceForce) || spaceForce < 0 || spaceForce > otw) {
      showFieldError(errors.sf, 'Space Force cannot exceed OTW.');
      return false;
    }

    return true;
  }

  function ensureBusCardStyles() {
    if (busCardStylesPatched || document.getElementById('prc-bus-card-styles')) return;

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
    busCardStylesPatched = true;
  }

  function addSpaceForceInputs() {
    const airportNatWrapper = findInputWrapper('bus-nat');
    if (airportNatWrapper && !document.getElementById('bus-sf')) {
      airportNatWrapper.insertAdjacentHTML('afterend', `
        <div>
          <label class="block text-sm font-medium mb-1" for="bus-sf">Space Force</label>
          <input id="bus-sf" type="number" inputmode="numeric" min="0" value="0" class="w-full border rounded px-3 py-2 bg-transparent" style="border-color:var(--border);color:var(--text);">
          <div id="bus-sf-error" class="text-red-500 text-xs mt-1 hidden"></div>
        </div>
      `);
    }

    const editNatWrapper = findInputWrapper('edit-bus-nat');
    if (editNatWrapper && !document.getElementById('edit-bus-sf')) {
      editNatWrapper.insertAdjacentHTML('afterend', `
        <div>
          <label class="block text-sm font-medium mb-1" for="edit-bus-sf">Space Force</label>
          <input id="edit-bus-sf" type="number" inputmode="numeric" min="0" class="w-full border rounded px-3 py-2 bg-transparent" style="border-color:var(--border);color:var(--text);">
          <div id="edit-bus-sf-error" class="text-red-500 text-xs mt-1 hidden"></div>
        </div>
      `);
    }

    const logHelp = document.querySelector('#page-airport .surface h3 + .text-xs.text-muted');
    if (logHelp && logHelp.textContent.includes('OTW, female, or naturalization')) {
      logHelp.textContent = 'Click a bus to edit OTW, female, naturalization, or Space Force counts.';
    }
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

  function updateAirportLogRowsWithSf() {
    ensureAirportLogSfColumn();

    const body = document.getElementById('airport-bus-log-body');
    if (!body || typeof allData === 'undefined') return;

    body.querySelectorAll('tr[onclick*="openAirportBusEditModal"]').forEach(row => {
      const onclick = row.getAttribute('onclick') || '';
      const match = onclick.match(/openAirportBusEditModal\('([^']+)'\)/);
      const id = match ? match[1] : '';
      const bus = id ? allData.find(record => record.__backendId === id) : null;
      if (!bus) return;

      let cell = row.querySelector('[data-sf-col="body"]');
      if (!cell) {
        cell = document.createElement('td');
        cell.className = 'px-3 py-2 font-tabular';
        cell.dataset.sfCol = 'body';
        row.appendChild(cell);
      }

      cell.textContent = String(n(bus.space_force_count));
    });

    const activeWg = getActiveWeekGroupSafe();
    const airportBuses = allData.filter(record => (
      record.type === 'bus' &&
      record.week_group === activeWg &&
      record.bus_type === 'airport'
    ));

    const total = airportBuses.reduce((sum, bus) => sum + n(bus.space_force_count), 0);
    const totalEl = document.getElementById('airport-log-total-sf');
    if (totalEl) totalEl.textContent = String(total);
  }

  function updateActiveBusSfBadges() {
    ensureBusCardStyles();

    const container = document.getElementById('active-buses');
    if (!container || typeof allData === 'undefined') return;

    container.querySelectorAll('.bus-badge').forEach(button => {
      const onclick = button.getAttribute('onclick') || '';
      const match = onclick.match(/confirmBusArrival\('([^']+)'\)/);
      const id = match ? match[1] : '';
      const bus = id ? allData.find(record => record.__backendId === id) : null;
      if (!bus) return;

      const otw = n(bus.otw_count);
      const females = n(bus.female_count);
      const nats = n(bus.nat_count);
      const sf = n(bus.space_force_count);
      const departed = formatDepartedTime(bus.created_at || bus.departed_at);
      const title = bus.bus_type === 'local'
        ? `LOCAL – ${bus.destination || bus.originating_destination || 'LOCAL'}`
        : `BUS #${bus.bus_id || ''}`;
      const plainLabel = `${title}: ${otw} OTW, ${females} FEMALE, ${nats} NAT, ${sf} SPACE FORCE, DEPT ${departed}`;

      button.innerHTML = `
        <span class="prc-bus-card-title">${safeEscape(title)}</span>
        <span class="prc-bus-card-line">${otw} OTW</span>
        <span class="prc-bus-card-line">${females} FEMALE</span>
        <span class="prc-bus-card-line">${nats} NAT</span>
        <span class="prc-bus-card-line">${sf} SPACE FORCE</span>
        <span class="prc-bus-card-dept">DEPT: ${safeEscape(departed)}</span>
      `;
      button.title = `Confirm arrival: ${plainLabel}`;
      button.setAttribute('aria-label', `Confirm arrival: ${plainLabel}`);
    });
  }

  function patchRenderAirportBusLog() {
    try {
      if (renderAirportBusLogPatched || typeof renderAirportBusLog !== 'function') return;

      const originalRenderAirportBusLog = renderAirportBusLog;
      const patchedRenderAirportBusLog = function patchedRenderAirportBusLog(...args) {
        const result = originalRenderAirportBusLog.apply(this, args);
        addSpaceForceInputs();
        updateAirportLogRowsWithSf();
        return result;
      };

      window.renderAirportBusLog = patchedRenderAirportBusLog;
      try { renderAirportBusLog = patchedRenderAirportBusLog; } catch (_) {}
      renderAirportBusLogPatched = true;
    } catch (error) {
      console.warn('PRC DASH Space Force airport log patch failed:', error);
    }
  }

  function patchRenderAllForSf() {
    try {
      if (renderAllPatchedForSf || typeof renderAll !== 'function') return;

      const originalRenderAll = renderAll;
      const patchedRenderAllForSf = function patchedRenderAllForSf(...args) {
        const result = originalRenderAll.apply(this, args);
        addSpaceForceInputs();
        updateAirportLogRowsWithSf();
        updateActiveBusSfBadges();
        return result;
      };

      window.renderAll = patchedRenderAllForSf;
      try { renderAll = patchedRenderAllForSf; } catch (_) {}
      renderAllPatchedForSf = true;
    } catch (error) {
      console.warn('PRC DASH Space Force render patch failed:', error);
    }
  }

  function patchAirportDispatchForm() {
    const form = document.getElementById('airport-form');
    if (!form || airportFormPatched) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      addSpaceForceInputs();

      const otw = n(document.getElementById('bus-otw')?.value);
      const females = n(document.getElementById('bus-female')?.value);
      const nats = n(document.getElementById('bus-nat')?.value);
      const spaceForce = n(document.getElementById('bus-sf')?.value);

      if (!validateCounts('bus', otw, females, nats, spaceForce)) return;

      if (typeof allData !== 'undefined' && allData.length >= 999) {
        if (typeof showMsg === 'function') showMsg('airport-msg', 'Record limit reached!', true);
        return;
      }

      const wg = getActiveWeekGroupSafe();
      if (!wg) {
        if (typeof showMsg === 'function') showMsg('airport-msg', 'Initialize a Week Group before dispatching buses.', true);
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      const originalText = submitButton ? submitButton.textContent : '';

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Dispatching...';
      }

      const newBusId = typeof getNextAirportBusId === 'function' ? getNextAirportBusId() : Date.now();
      const result = await window.dataSdk.create({
        type: 'bus',
        bus_id: String(newBusId),
        bus_type: 'airport',
        destination: '',
        otw_count: otw,
        female_count: females,
        nat_count: nats,
        space_force_count: spaceForce,
        status: 'active',
        created_at: new Date().toISOString(),
        week_group: wg
      });

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText || 'DISPATCH BUS';
      }

      if (result && result.isOk) {
        if (typeof createSoundEvent === 'function') {
          await createSoundEvent('bus_dispatch', {
            bus_id: String(newBusId),
            otw_count: otw,
            female_count: females,
            nat_count: nats,
            space_force_count: spaceForce,
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
      } else if (typeof showMsg === 'function') {
        showMsg('airport-msg', 'Failed', true);
      }
    }, true);

    airportFormPatched = true;
  }

  function patchAirportBusEditOpen() {
    try {
      if (airportEditOpenPatched || typeof openAirportBusEditModal !== 'function') return;

      const originalOpen = openAirportBusEditModal;
      const patchedOpen = function patchedOpenAirportBusEditModal(id) {
        originalOpen.call(this, id);
        addSpaceForceInputs();

        const bus = typeof allData !== 'undefined'
          ? allData.find(record => record.__backendId === id)
          : null;

        const sfInput = document.getElementById('edit-bus-sf');
        if (bus && sfInput) sfInput.value = n(bus.space_force_count);
        resetErrors(['edit-bus-otw-error', 'edit-bus-female-error', 'edit-bus-nat-error', 'edit-bus-sf-error']);
      };

      window.openAirportBusEditModal = patchedOpen;
      try { openAirportBusEditModal = patchedOpen; } catch (_) {}
      airportEditOpenPatched = true;
    } catch (error) {
      console.warn('PRC DASH Space Force edit-open patch failed:', error);
    }
  }

  function patchAirportBusEditForm() {
    const form = document.getElementById('airport-bus-edit-form');
    if (!form || airportEditFormPatched) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (typeof editBusId === 'undefined' || !editBusId || typeof allData === 'undefined') return;

      const bus = allData.find(record => record.__backendId === editBusId);
      if (!bus || bus.bus_type !== 'airport') return;

      const otw = n(document.getElementById('edit-bus-otw')?.value);
      const females = n(document.getElementById('edit-bus-female')?.value);
      const nats = n(document.getElementById('edit-bus-nat')?.value);
      const spaceForce = n(document.getElementById('edit-bus-sf')?.value);

      if (!validateCounts('edit-bus', otw, females, nats, spaceForce)) return;

      const result = await window.dataSdk.update({
        ...bus,
        otw_count: otw,
        female_count: females,
        nat_count: nats,
        space_force_count: spaceForce,
        updated_at: new Date().toISOString()
      });

      if (result && result.isOk) {
        if (typeof closeAirportBusEditModal === 'function') closeAirportBusEditModal();
      } else {
        const msg = document.getElementById('edit-bus-msg');
        if (msg) {
          msg.textContent = 'Failed to save bus update.';
          msg.style.color = 'var(--red)';
          msg.classList.remove('hidden');
        }
      }
    }, true);

    airportEditFormPatched = true;
  }

  function startSpaceForcePatch() {
    ensureBusCardStyles();
    addSpaceForceInputs();
    ensureAirportLogSfColumn();
    patchAirportDispatchForm();
    patchAirportBusEditOpen();
    patchAirportBusEditForm();
    patchRenderAirportBusLog();
    patchRenderAllForSf();
    updateAirportLogRowsWithSf();
    updateActiveBusSfBadges();

    setInterval(() => {
      ensureBusCardStyles();
      addSpaceForceInputs();
      ensureAirportLogSfColumn();
      patchAirportDispatchForm();
      patchAirportBusEditOpen();
      patchAirportBusEditForm();
      patchRenderAirportBusLog();
      patchRenderAllForSf();
      updateAirportLogRowsWithSf();
      updateActiveBusSfBadges();
    }, 750);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSpaceForcePatch);
  } else {
    startSpaceForcePatch();
  }
})();
