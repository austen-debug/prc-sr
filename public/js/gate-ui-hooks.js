(function () {
  'use strict';

  const HOOK_GROUPS = [
    'afterRenderAll',
    'afterPageChange',
    'afterDataChanged',
    'afterModalOpen',
    'afterCloseout'
  ];

  if (!window.GateHooks) {
    window.GateHooks = HOOK_GROUPS.reduce((hooks, name) => {
      hooks[name] = [];
      return hooks;
    }, {});
  } else {
    for (const name of HOOK_GROUPS) {
      if (!Array.isArray(window.GateHooks[name])) window.GateHooks[name] = [];
    }
  }

  function getActivePageId() {
    const activePage = document.querySelector('.page.active[id]');
    return activePage ? activePage.id.replace(/^page-/, '') : '';
  }

  function getWeekGroup() {
    try {
      return typeof window.getActiveWG === 'function' ? window.getActiveWG() : '';
    } catch (error) {
      return '';
    }
  }

  function buildPayload(extra) {
    return Object.assign({
      allData: Array.isArray(window.allData) ? window.allData : [],
      activePage: getActivePageId(),
      role: window.currentRole || '',
      weekGroup: getWeekGroup(),
      timestamp: Date.now()
    }, extra || {});
  }

  window.runGateHooks = function runGateHooks(name, payload) {
    const hooks = window.GateHooks?.[name];
    if (!Array.isArray(hooks) || hooks.length === 0) return;

    const hookPayload = buildPayload(payload);

    for (const hook of [...hooks]) {
      try {
        hook(hookPayload);
      } catch (error) {
        console.warn(`GATE hook failed: ${name}`, error);
      }
    }
  };

  window.registerGateHook = function registerGateHook(name, fn) {
    if (!Array.isArray(window.GateHooks?.[name]) || typeof fn !== 'function') return false;
    if (!window.GateHooks[name].includes(fn)) window.GateHooks[name].push(fn);
    return true;
  };

  window.unregisterGateHook = function unregisterGateHook(name, fn) {
    if (!Array.isArray(window.GateHooks?.[name]) || typeof fn !== 'function') return false;
    const before = window.GateHooks[name].length;
    window.GateHooks[name] = window.GateHooks[name].filter(hook => hook !== fn);
    return window.GateHooks[name].length !== before;
  };

  function wrapRenderAll() {
    const current = window.renderAll;
    if (typeof current !== 'function') return false;
    if (current.__gateHooksWrapped === true) return true;

    const wrapped = function gateHooksRenderAllWrapper(...args) {
      const result = current.apply(this, args);
      window.runGateHooks('afterRenderAll', { args });
      return result;
    };

    wrapped.__gateHooksWrapped = true;
    wrapped.__gateHooksOriginal = current;
    window.renderAll = wrapped;
    return true;
  }

  function wrapShowPage() {
    const current = window.showPage;
    if (typeof current !== 'function') return false;
    if (current.__gateHooksWrapped === true) return true;

    const wrapped = function gateHooksShowPageWrapper(page, ...args) {
      const result = current.call(this, page, ...args);
      window.runGateHooks('afterPageChange', { page, args });
      return result;
    };

    wrapped.__gateHooksWrapped = true;
    wrapped.__gateHooksOriginal = current;
    window.showPage = wrapped;
    return true;
  }

  function installWrappers() {
    wrapRenderAll();
    wrapShowPage();
  }

  function installActiveBusController() {
    if (window.GateActiveBusController) return;

    let lastSignature = '';
    let renderQueued = false;
    let rendering = false;
    let activeBusRenderAllWrapped = false;
    let observerReady = false;

    function numberValue(value) {
      const parsed = Number(value || 0);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function activeWeekGroup() {
      try {
        if (typeof window.getActiveWG === 'function') return window.getActiveWG();
      } catch (_) {}
      return '';
    }

    function activeBuses() {
      const records = Array.isArray(window.allData) ? window.allData : [];
      const weekGroup = activeWeekGroup();
      return records
        .filter(record => record && record.type === 'bus' && record.status === 'active')
        .filter(record => !weekGroup || record.week_group === weekGroup)
        .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    }

    function busSignature(bus) {
      return [
        bus.__backendId,
        bus.bus_type,
        bus.bus_id,
        bus.destination,
        bus.originating_destination,
        bus.status,
        numberValue(bus.otw_count),
        numberValue(bus.female_count),
        numberValue(bus.nat_count),
        numberValue(bus.space_force_count),
        bus.departed_at,
        bus.created_at,
        bus.week_group
      ].join('|');
    }

    function signatureFor(buses) {
      return buses.map(busSignature).join('~') || 'none';
    }

    function looksCanonical(container, buses, signature) {
      if (!container || container.dataset.gateActiveBusSignature !== signature) return false;

      if (buses.length === 0) {
        return Boolean(container.querySelector('[data-owner="gate-active-bus-controller"][data-empty-state="true"]'));
      }

      const cards = Array.from(container.querySelectorAll('[data-component="active-bus-card"]'));
      if (cards.length !== buses.length) return false;

      return cards.every(card => (
        card.dataset.owner === 'gate-active-bus-controller' &&
        card.querySelector('.prc-bus-card-title') &&
        card.querySelector('.prc-bus-card-line') &&
        card.querySelector('.prc-bus-card-dept')
      ));
    }

    function renderActiveBuses(options = {}) {
      const container = document.getElementById('active-buses');
      if (!container || rendering) return;

      const buses = activeBuses();
      const signature = signatureFor(buses);
      const force = Boolean(options.force);

      if (!force && signature === lastSignature && looksCanonical(container, buses, signature)) return;

      rendering = true;
      try {
        const components = window.GateComponents;
        container.dataset.component = 'active-bus-surface';
        container.dataset.owner = 'gate-active-bus-controller';
        container.dataset.gateActiveBusSignature = signature;

        if (buses.length === 0) {
          container.innerHTML = '<span class="text-muted text-sm" data-owner="gate-active-bus-controller" data-empty-state="true">None</span>';
        } else if (components?.activeBusCard) {
          container.innerHTML = buses.map(bus => components.activeBusCard(bus)).join('');
        }

        lastSignature = signature;
      } finally {
        rendering = false;
      }
    }

    function scheduleActiveBusRender(options = {}) {
      if (renderQueued) return;
      renderQueued = true;
      window.requestAnimationFrame(() => {
        renderQueued = false;
        renderActiveBuses(options);
      });
    }

    function wrapActiveBusRenderAll() {
      if (activeBusRenderAllWrapped || typeof window.renderAll !== 'function') return false;

      const originalRenderAll = window.renderAll;
      const wrappedRenderAll = function gateActiveBusRenderAllWrapper(...args) {
        const result = originalRenderAll.apply(this, args);
        renderActiveBuses({ force: true });
        return result;
      };

      wrappedRenderAll.__gateActiveBusWrapped = true;
      wrappedRenderAll.__gateActiveBusOriginal = originalRenderAll;
      window.renderAll = wrappedRenderAll;
      try { renderAll = wrappedRenderAll; } catch (_) {}
      activeBusRenderAllWrapped = true;
      return true;
    }

    function observeActiveBusSurface() {
      if (observerReady || typeof MutationObserver === 'undefined') return;
      const container = document.getElementById('active-buses');
      if (!container) return;

      const observer = new MutationObserver(() => {
        if (rendering) return;
        scheduleActiveBusRender();
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'title', 'aria-label', 'data-component', 'data-owner']
      });

      observerReady = true;
    }

    window.GateActiveBusController = Object.freeze({
      isCanonicalOwner: true,
      render: renderActiveBuses,
      scheduleRender: scheduleActiveBusRender,
      getActiveBuses: activeBuses
    });

    wrapActiveBusRenderAll();
    observeActiveBusSurface();
    renderActiveBuses({ force: true });

    window.registerGateHook('afterRenderAll', () => scheduleActiveBusRender({ force: true }));
    window.registerGateHook('afterDataChanged', () => scheduleActiveBusRender({ force: true }));
    window.registerGateHook('afterPageChange', () => scheduleActiveBusRender());
  }

  function installArchiveSchemaController() {
    if (!window.GateArchiveSchemaController) {
      const controller = buildArchiveSchemaController();
      window.GateArchiveSchemaController = Object.freeze(controller);
    }

    window.GateArchiveSchemaController.patchCloseoutWorkflow();
  }

  function buildArchiveSchemaController() {
    function n(value) {
      const parsed = Number(value || 0);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function closeoutStatusElement() {
      const closeoutBtn = document.getElementById('closeout-btn');
      if (!closeoutBtn) return null;

      let el = document.getElementById('closeout-safety-msg');
      if (!el) {
        el = document.createElement('div');
        el.id = 'closeout-safety-msg';
        el.className = 'text-xs font-bold text-muted';
        el.style.minHeight = '20px';
        closeoutBtn.insertAdjacentElement('afterend', el);
      }

      return el;
    }

    function showCloseoutMessage(message, isError = false) {
      const el = closeoutStatusElement();
      if (!el) {
        if (isError) alert(message);
        return;
      }
      el.textContent = message;
      el.style.color = isError ? 'var(--red)' : 'var(--green)';
    }

    function clearCloseoutMessageAfterDelay() {
      const el = closeoutStatusElement();
      if (!el) return;
      setTimeout(() => {
        el.textContent = '';
        el.style.color = 'var(--text-muted)';
      }, 6000);
    }

    function getRecordsOfType(type) {
      if (typeof window.getRecords === 'function') return window.getRecords(type);
      if (Array.isArray(window.allData)) return window.allData.filter(record => record.type === type);
      return [];
    }

    function buildArchivePayload(weekGroup, dorms, buses) {
      const arrivedBuses = buses.filter(bus => bus.status === 'arrived');
      const totalArrived = arrivedBuses.reduce((sum, bus) => sum + n(bus.otw_count), 0);
      const femaleTotal = buses.reduce((sum, bus) => sum + n(bus.female_count), 0);
      const natTotal = buses.reduce((sum, bus) => sum + n(bus.nat_count), 0);
      const spaceForceTotal = buses.reduce((sum, bus) => sum + n(bus.space_force_count), 0);
      const arrivedSpaceForceTotal = arrivedBuses.reduce((sum, bus) => sum + n(bus.space_force_count), 0);
      const loadedTotal = dorms.reduce((sum, dorm) => sum + n(dorm.current_load), 0);
      const expectedTotal = dorms.reduce((sum, dorm) => sum + n(dorm.max_load), 0);

      const dormHistory = dorms.map(dorm => ({
        name: dorm.dorm_name,
        dorm_name: dorm.dorm_name,
        sdq: dorm.sdq || '',
        section: dorm.section || '',
        inter_sec: dorm.inter_sec || '',
        sex: dorm.sex || '',
        band: dorm.band || 'false',
        space_force: dorm.space_force || dorm.is_space_force || false,
        is_space_force: dorm.is_space_force || dorm.space_force || false,
        auditorium_location: dorm.auditorium_location || '',
        current_load: n(dorm.current_load),
        max_load: n(dorm.max_load),
        state: dorm.state || '',
        phase: dorm.phase || '',
        notes: dorm.notes || '',
        assigned_airman: dorm.assigned_airman || '',
        opened_at: dorm.opened_at || '',
        closed_at: dorm.closed_at || '',
        closed_timer: dorm.closed_timer || '',
        open_time: dorm.opened_at ? new Date(dorm.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
        close_time: dorm.closed_at ? new Date(dorm.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
        elapsed: dorm.closed_timer || '—'
      }));

      const busHistory = buses.map(bus => ({
        bus_id: bus.bus_id || '',
        bus_type: bus.bus_type || 'airport',
        originating_destination: bus.originating_destination || bus.destination || '',
        destination: bus.destination || '',
        departed_at: bus.departed_at || bus.created_at || '',
        created_at: bus.created_at || '',
        arrived_at: bus.arrived_at || '',
        otw_count: n(bus.otw_count),
        female_count: n(bus.female_count),
        nat_count: n(bus.nat_count),
        space_force_count: n(bus.space_force_count),
        status: bus.status || ''
      }));

      return {
        type: 'archive',
        week_group: weekGroup,
        archived_at: new Date().toISOString(),
        dorm_count: dorms.length,
        bus_count: buses.length,
        total_arrived: totalArrived,
        total_loaded: loadedTotal,
        total_expected: expectedTotal,
        female_total: femaleTotal,
        nat_total: natTotal,
        space_force_total: spaceForceTotal,
        arrived_space_force_total: arrivedSpaceForceTotal,
        dorm_data: JSON.stringify(dormHistory),
        bus_data: JSON.stringify(busHistory),
        archive_schema_version: 'gate-archive-schema-v2-space-force',
        closeout_safety_version: 'archive-verified-before-clear-v2'
      };
    }

    async function fetchRecordsDirectly() {
      const response = await fetch('/api/records', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      const result = await response.json();
      if (!result.isOk) throw new Error(result.error || 'Unable to fetch records.');
      return result.records || [];
    }

    async function verifyArchiveCreated(archiveId, weekGroup) {
      if (!archiveId) return false;
      const records = await fetchRecordsDirectly();
      return records.some(record => (
        record.__backendId === archiveId &&
        record.type === 'archive' &&
        record.week_group === weekGroup &&
        record.archive_schema_version === 'gate-archive-schema-v2-space-force'
      ));
    }

    async function deleteCloseoutRecords(records) {
      const failures = [];
      for (const record of records) {
        const result = await window.dataSdk.delete(record);
        if (!result || !result.isOk) failures.push(record.dorm_name || record.bus_id || record.type || record.__backendId || 'record');
      }
      if (failures.length > 0) throw new Error(`Archive was created and verified, but ${failures.length} live record(s) could not be cleared.`);
    }

    async function updateCloseoutConfigRecord(record, value, label) {
      if (!record) return;
      const result = await window.dataSdk.update({ ...record, value });
      if (!result || !result.isOk) throw new Error(`Archive was created, but ${label} could not be cleared.`);
    }

    function resetCloseoutInputGrid() {
      try {
        const wgInput = document.getElementById('wg-batch-input');
        if (wgInput) wgInput.value = '';

        if (typeof batchRows !== 'undefined') {
          batchRows = Array.from({ length: 25 }, (_, i) => ({
            rowIndex: i,
            sdq: '',
            sec: '',
            inter_sec: '',
            dorm_name: '',
            sex: 'male',
            band: false,
            space_force: false,
            load: ''
          }));
        }

        if (typeof initBatchGrid === 'function') initBatchGrid();
        if (typeof updateTotalLoadCalc === 'function') updateTotalLoadCalc();
      } catch (error) {
        console.warn('GATE input grid reset failed after closeout:', error);
      }
    }

    async function runSafeCloseout() {
      if (typeof currentRole !== 'undefined' && currentRole !== 'instructor') {
        showCloseoutMessage('Instructor access required to close out week group.', true);
        return;
      }

      const weekGroup = typeof window.getActiveWG === 'function' ? window.getActiveWG() : '';
      if (!weekGroup) {
        showCloseoutMessage('No active week group to close out.', true);
        return;
      }

      const dorms = getRecordsOfType('dorm').filter(dorm => dorm.week_group === weekGroup);
      const buses = getRecordsOfType('bus').filter(bus => bus.week_group === weekGroup);
      const soundEvents = getRecordsOfType('sound_event').filter(event => event.week_group === weekGroup);

      if (dorms.length === 0 && buses.length === 0) {
        showCloseoutMessage('No dorm or bus records found for the active week group.', true);
        return;
      }

      const closeoutBtn = document.getElementById('closeout-btn');
      const originalText = closeoutBtn ? closeoutBtn.textContent : '';

      try {
        if (closeoutBtn) {
          closeoutBtn.disabled = true;
          closeoutBtn.textContent = 'ARCHIVING...';
        }

        showCloseoutMessage('Creating archive record...');
        const archivePayload = buildArchivePayload(weekGroup, dorms, buses);
        const archiveResult = await window.dataSdk.create(archivePayload);

        if (!archiveResult || !archiveResult.isOk || !archiveResult.data || !archiveResult.data.__backendId) {
          throw new Error(archiveResult?.error || 'Archive creation failed. Live records were not cleared.');
        }

        showCloseoutMessage('Verifying archive record...');
        const archiveVerified = await verifyArchiveCreated(archiveResult.data.__backendId, weekGroup);
        if (!archiveVerified) throw new Error('Archive verification failed. Live records were not cleared.');

        showCloseoutMessage('Archive verified. Clearing live records...');
        await deleteCloseoutRecords([...dorms, ...buses, ...soundEvents]);

        const latestRecords = await fetchRecordsDirectly();
        const lastAirport = latestRecords.find(record => record.type === 'config' && record.key === 'last_airport');
        const activeWgConfig = latestRecords.find(record => record.type === 'config' && record.key === 'week_group');

        await updateCloseoutConfigRecord(lastAirport, '', 'last airport arrival');
        await updateCloseoutConfigRecord(activeWgConfig, '', 'active week group');

        resetCloseoutInputGrid();
        if (typeof window.runGateHooks === 'function') window.runGateHooks('afterCloseout', { weekGroup, archiveId: archiveResult.data.__backendId });
        if (typeof renderAll === 'function') renderAll();

        showCloseoutMessage(`Week group ${weekGroup} archived and cleared.`);
        clearCloseoutMessageAfterDelay();
      } catch (error) {
        console.error('GATE safe closeout failed:', error);
        showCloseoutMessage(error.message || 'Closeout failed. Live records were not cleared.', true);
        alert(error.message || 'Closeout failed. Live records were not cleared.');
      } finally {
        if (closeoutBtn) {
          closeoutBtn.disabled = false;
          closeoutBtn.textContent = originalText || 'CLOSE OUT WEEK GROUP';
        }
      }
    }

    function safeInitiateCloseout() {
      if (typeof showConfirm !== 'function') {
        showCloseoutMessage('Confirmation dialog unavailable. Closeout cancelled.', true);
        return;
      }

      showConfirm('Close out this week group? GATE will create and verify the archive before clearing live records.', async () => {
        await runSafeCloseout();
      });
    }

    safeInitiateCloseout.__gateArchiveSchemaController = true;

    function patchCloseoutWorkflow() {
      const closeoutBtn = document.getElementById('closeout-btn');
      if (!closeoutBtn || typeof showConfirm !== 'function') return false;
      if (window.initiateCloseout?.__gateArchiveSchemaController === true && closeoutBtn.onclick === safeInitiateCloseout) return true;

      closeoutStatusElement();
      window.initiateCloseout = safeInitiateCloseout;
      try { initiateCloseout = safeInitiateCloseout; } catch (_) {}
      closeoutBtn.onclick = safeInitiateCloseout;
      closeoutBtn.dataset.owner = 'gate-archive-schema-controller';
      return true;
    }

    return {
      isCanonicalOwner: true,
      buildArchivePayload,
      patchCloseoutWorkflow,
      runSafeCloseout
    };
  }

  window.GateHooks.installWrappers = installWrappers;
  window.GateHooks.installActiveBusController = installActiveBusController;
  window.GateHooks.installArchiveSchemaController = installArchiveSchemaController;

  function installAllControllers() {
    installWrappers();
    installActiveBusController();
    installArchiveSchemaController();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installAllControllers, { once: true });
  } else {
    installAllControllers();
  }

  window.addEventListener('load', installAllControllers, { once: true });

  let attempts = 0;
  const retry = window.setInterval(() => {
    attempts += 1;
    installWrappers();
    installArchiveSchemaController();
    if (attempts >= 24) window.clearInterval(retry);
  }, 250);
})();
