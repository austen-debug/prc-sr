// GATE Airport Bus Log delete controller
// Instructor-only right-click workflow: Airport page -> Bus Log -> Delete Bus -> explicit confirmation.
(function () {
  'use strict';

  const MENU_ID = 'gate-airport-bus-context-menu';

  let installed = false;
  let hooksRegistered = false;
  let selectedBusId = '';
  let deleting = false;

  function records() {
    try { if (Array.isArray(allData)) return allData; } catch (_) {}
    if (Array.isArray(window.allData)) return window.allData;
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function isInstructor() {
    try {
      if (typeof window.GatePermissionGuard?.isInstructor === 'function') {
        return window.GatePermissionGuard.isInstructor();
      }
      return currentRole === 'instructor';
    } catch (_) {
      return false;
    }
  }

  function busById(id) {
    return records().find(record => (
      record &&
      record.type === 'bus' &&
      record.__backendId === id &&
      (record.bus_type === 'airport' || record.bus_type === 'local')
    )) || null;
  }

  function busLabel(bus) {
    if (!bus) return 'this bus';
    if (bus.bus_type === 'local') {
      return `LOCAL – ${bus.destination || bus.originating_destination || 'LOCAL'}`;
    }
    return `AIRPORT – BUS #${bus.bus_id || ''}`;
  }

  function ensureStyles() {
    const canonical = document.querySelector('link[href^="/css/military-glass-terminal.css"]');
    if (canonical) canonical.dataset.gateAirportBusContextMenu = 'true';
  }

  function ensureMenu() {
    ensureStyles();

    let menu = document.getElementById(MENU_ID);
    if (menu) return menu;

    menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'gate-processing-context-menu hidden';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Airport Bus Log actions');
    menu.setAttribute('aria-hidden', 'true');
    menu.dataset.owner = 'gate-airport-bus-delete-controller';
    menu.innerHTML = `
      <div class="gate-processing-context-title gate-airport-bus-context-label" data-airport-bus-context-label>Bus</div>
      <button type="button" class="gate-processing-context-action danger" role="menuitem" data-airport-bus-action="delete">Delete Bus</button>
    `;
    document.body.appendChild(menu);
    return menu;
  }

  function hideMenu(options = {}) {
    const menu = document.getElementById(MENU_ID);
    if (menu) {
      menu.setAttribute('aria-hidden', 'true');
      menu.classList.add('hidden');
    }
    if (!options.preserveSelection) selectedBusId = '';
  }

  function positionMenu(menu, clientX, clientY) {
    const margin = 12;
    menu.style.left = `${Math.max(margin, clientX)}px`;
    menu.style.top = `${Math.max(margin, clientY)}px`;
    menu.setAttribute('aria-hidden', 'false');
    menu.classList.remove('hidden');

    const rect = menu.getBoundingClientRect();
    const left = Math.min(Math.max(margin, clientX), Math.max(margin, window.innerWidth - rect.width - margin));
    const top = Math.min(Math.max(margin, clientY), Math.max(margin, window.innerHeight - rect.height - margin));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function showMessage(message, isError = false) {
    const target = document.getElementById('airport-msg');
    if (target) {
      target.textContent = message || '';
      target.style.color = isError ? 'var(--red)' : 'var(--green)';
      target.classList.toggle('hidden', !message);
      return;
    }

    if (isError) window.alert(message);
  }

  function removeFromLocalCache(id) {
    const list = records();
    const index = list.findIndex(record => record && record.__backendId === id);
    if (index >= 0) list.splice(index, 1);
  }

  function refreshSurfaces() {
    try { window.GateBusWorkflowController?.renderBusLog?.(); } catch (_) {}
    try { window.GateBusWorkflowController?.refresh?.(); } catch (_) {}
    try { window.GateStatusBoardController?.scheduleRender?.({ force: true }); } catch (_) {}
    try { window.GatePremiumMetricsController?.refresh?.(); } catch (_) {}
    try { if (typeof renderAll === 'function') renderAll(); } catch (_) {}
    try { window.runGateHooks?.('afterDataChanged', { source: 'airport-bus-delete' }); } catch (_) {}
  }

  function confirmAction(message, callback) {
    if (typeof showConfirm === 'function') {
      showConfirm(message, callback);
      return;
    }

    if (window.confirm(message)) callback();
  }

  async function deleteBus(id) {
    if (deleting || !isInstructor()) return;

    const bus = busById(id);
    if (!bus) {
      showMessage('Bus record could not be found.', true);
      return;
    }

    if (!window.dataSdk || typeof window.dataSdk.delete !== 'function') {
      showMessage('Bus deletion is unavailable.', true);
      return;
    }

    deleting = true;
    const menuButton = document.querySelector(`#${MENU_ID} [data-airport-bus-action='delete']`);
    if (menuButton) {
      menuButton.disabled = true;
      menuButton.textContent = 'Deleting…';
    }

    try {
      const result = await window.dataSdk.delete(bus);
      if (!result?.isOk) {
        showMessage(result?.error || `Failed to delete ${busLabel(bus)}.`, true);
        return;
      }

      removeFromLocalCache(id);
      refreshSurfaces();
      showMessage(`${busLabel(bus)} deleted.`, false);
    } catch (error) {
      console.error('GATE Airport Bus deletion failed:', error);
      showMessage(`Failed to delete ${busLabel(bus)}.`, true);
    } finally {
      deleting = false;
      if (menuButton) {
        menuButton.disabled = false;
        menuButton.textContent = 'Delete Bus';
      }
      hideMenu();
    }
  }

  function requestDelete(id) {
    if (!isInstructor()) return;

    const bus = busById(id);
    if (!bus) {
      showMessage('Bus record could not be found.', true);
      return;
    }

    hideMenu({ preserveSelection: true });
    confirmAction(
      `Delete ${busLabel(bus)}? Click CONFIRM to permanently delete this bus. This cannot be undone.`,
      () => deleteBus(id)
    );
  }

  function openMenu(event, row) {
    if (!isInstructor()) return;

    const id = String(row?.dataset?.busId || '').trim();
    const bus = busById(id);
    if (!id || !bus) return;

    event.preventDefault();
    event.stopPropagation();

    selectedBusId = id;
    const menu = ensureMenu();
    const label = menu.querySelector('[data-airport-bus-context-label]');
    if (label) label.textContent = busLabel(bus);
    positionMenu(menu, event.clientX, event.clientY);

    window.requestAnimationFrame(() => {
      menu.querySelector('[data-airport-bus-action="delete"]')?.focus({ preventScroll: true });
    });
  }

  function updateInstructorHints() {
    const instructor = isInstructor();
    const body = document.getElementById('airport-bus-log-body');
    if (!body) return;

    body.querySelectorAll('[data-component="editable-bus-row"][data-bus-id]').forEach(row => {
      row.dataset.airportBusDelete = instructor ? 'enabled' : 'disabled';
      row.title = instructor
        ? 'Click to edit. Right-click for bus actions.'
        : 'Airport Bus Log entry';
    });

    const help = document.querySelector('#page-airport .surface h3 + .text-xs.text-muted');
    if (help && instructor) {
      help.textContent = 'Click a bus to edit. Right-click a bus and select Delete Bus to permanently remove it.';
    }

    if (!instructor) hideMenu();
  }

  function onContextMenu(event) {
    const row = event.target.closest?.('#airport-bus-log-body [data-component="editable-bus-row"][data-bus-id]');
    if (!row) return;
    openMenu(event, row);
  }

  function onClick(event) {
    const deleteButton = event.target.closest?.(`#${MENU_ID} [data-airport-bus-action='delete']`);
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      const id = selectedBusId;
      if (id) requestDelete(id);
      return;
    }

    if (!event.target.closest?.(`#${MENU_ID}`)) hideMenu();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') hideMenu();
  }

  function registerHooks() {
    if (hooksRegistered || typeof window.registerGateHook !== 'function') return;
    window.registerGateHook('afterRenderAll', updateInstructorHints);
    window.registerGateHook('afterDataChanged', updateInstructorHints);
    window.registerGateHook('afterPageChange', updateInstructorHints);
    hooksRegistered = true;
  }

  function install() {
    ensureMenu();

    if (!installed) {
      document.addEventListener('contextmenu', onContextMenu, true);
      document.addEventListener('click', onClick, true);
      document.addEventListener('keydown', onKeyDown, true);
      window.addEventListener('resize', hideMenu, true);
      window.addEventListener('scroll', hideMenu, true);
      installed = true;
    }

    registerHooks();
    updateInstructorHints();

    window.GateAirportBusDeleteController = Object.freeze({
      isCanonicalOwner: true,
      openMenu,
      hideMenu,
      requestDelete,
      deleteBus,
      refresh: updateInstructorHints
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  window.addEventListener('load', install, { once: true });
})();