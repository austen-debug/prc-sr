// GATE Phase 1C Status Board Controller
// Canonical owner for Status Board dorm columns, dorm cards, active bus panel, and board timer refresh.
(function () {
  'use strict';

  const DORM_STATES = Object.freeze(['empty', 'open', 'closed']);
  const SURFACE_IDS = Object.freeze(['col-empty', 'col-open', 'col-closed', 'active-buses']);

  let installed = false;
  let renderQueued = false;
  let pendingForceRender = false;
  let lastBusSignature = '';
  let surfaceObserver = null;
  let observerConnected = false;
  let statusBoardRenderInProgress = false;
  let canonicalTimerInterval = null;

  const lastDormSignatures = new Map(DORM_STATES.map(state => [state, '']));
  const renderStats = {
    renderPasses: 0,
    columnWrites: 0,
    busWrites: 0,
    surfaceRepairs: 0,
    timerTicks: 0
  };

  function components() {
    return window.GateComponents || null;
  }

  function recordDisplay() {
    return window.GateRecordDisplay || null;
  }

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function esc(value) {
    const helper = components()?.esc;
    if (helper) return helper(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function activeWeekGroup() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function records() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function getDorms() {
    const wg = activeWeekGroup();
    const dorms = records()
      .filter(record => record?.type === 'dorm')
      .filter(record => !wg || record.week_group === wg);
    return recordDisplay()?.sortDorms ? recordDisplay().sortDorms(dorms) : dorms;
  }

  function getActiveBuses() {
    const wg = activeWeekGroup();
    return records()
      .filter(record => record?.type === 'bus')
      .filter(record => !wg || record.week_group === wg)
      .filter(record => record.status === 'active' || record.status === 'otw')
      .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  }

  function dormSignature(dorms) {
    return dorms.map(dorm => [
      dorm.__backendId,
      dorm.display_order,
      dorm.input_order,
      dorm.source_row_index,
      dorm.row_index,
      dorm.created_at,
      dorm.dorm_name,
      dorm.assigned_airman,
      dorm.auditorium_location,
      dorm.sdq,
      dorm.section,
      dorm.inter_sec,
      dorm.sex,
      dorm.band,
      dorm.space_force,
      dorm.is_space_force,
      dorm.state,
      dorm.phase,
      dorm.current_load,
      dorm.max_load,
      dorm.opened_at,
      dorm.closed_at,
      dorm.closed_timer,
      dorm.notes
    ].join('|')).join('~') || 'none';
  }

  function busSignature(buses) {
    return buses.map(bus => [
      bus.__backendId,
      bus.bus_type,
      bus.bus_id,
      bus.destination,
      bus.originating_destination,
      bus.status,
      n(bus.otw_count),
      n(bus.female_count),
      n(bus.nat_count),
      n(bus.space_force_count),
      bus.departed_at,
      bus.created_at,
      bus.week_group
    ].join('|')).join('~') || 'none';
  }

  function fallbackDormCard(dorm) {
    const state = String(dorm?.state || 'empty').toLowerCase();
    const timer = state === 'closed' ? String(dorm?.closed_timer || '00:00') : '00:00';
    return `
      <div class="dorm-card tactical-glass-card gate-dorm-card" data-component="dorm-card" data-owner="gate-status-board-controller" data-dorm-id="${esc(dorm?.__backendId || '')}" data-state="${esc(state)}">
        <div class="gate-dorm-name">${esc(dorm?.dorm_name || '')}</div>
        <div class="gate-dorm-status">${esc(dorm?.phase || state.toUpperCase())}</div>
        <div class="gate-dorm-timer" data-gate-live-value="true" aria-live="off">${esc(timer)}</div>
      </div>
    `;
  }

  function renderDormCard(dorm) {
    const html = components()?.dormCard
      ? components().dormCard(dorm, { showAuditorium: true })
      : fallbackDormCard(dorm);
    return html
      .replace('data-component="dorm-card"', 'data-component="dorm-card" data-owner="gate-status-board-controller"')
      .replace('class="gate-dorm-timer', 'data-gate-live-value="true" aria-live="off" class="gate-dorm-timer');
  }

  function directDormCards(column) {
    return Array.from(column?.children || []).filter(child => child?.dataset?.component === 'dorm-card');
  }

  function expectedDorms(dorms, state) {
    return dorms.filter(dorm => String(dorm.state || 'empty').toLowerCase() === state);
  }

  function hasCompleteDormColumnMarkup(column, expected, state) {
    if (!column || column.dataset.owner !== 'gate-status-board-controller') return false;
    if (column.dataset.state !== state || Number(column.dataset.count || -1) !== expected.length) return false;

    if (!expected.length) {
      return Boolean(column.querySelector(':scope > [data-owner="gate-status-board-controller"][data-empty-state="true"]'));
    }

    const cards = directDormCards(column);
    if (cards.length !== expected.length) return false;

    const expectedIds = expected.map(dorm => String(dorm.__backendId || '')).filter(Boolean);
    const actualIds = cards.map(card => String(card.dataset.dormId || '')).filter(Boolean);
    return cards.every(card => card.dataset.owner === 'gate-status-board-controller') &&
      expectedIds.length === actualIds.length &&
      expectedIds.every((id, index) => actualIds[index] === id);
  }

  function hasCompleteDormMarkup(dorms) {
    return DORM_STATES.every(state => {
      const column = document.getElementById(`col-${state}`);
      return hasCompleteDormColumnMarkup(column, expectedDorms(dorms, state), state);
    });
  }

  function setBoardOwnership() {
    const board = document.getElementById('page-board');
    if (!board) return;
    board.dataset.component = 'status-board';
    board.dataset.owner = 'gate-status-board-controller';
  }

  function renderColumns(dorms, options = {}) {
    const source = Array.isArray(dorms) ? dorms : getDorms();
    const force = Boolean(options.force);
    setBoardOwnership();

    DORM_STATES.forEach(state => {
      const column = document.getElementById(`col-${state}`);
      if (!column) return;

      const filtered = expectedDorms(source, state);
      const signature = dormSignature(filtered);
      const complete = hasCompleteDormColumnMarkup(column, filtered, state);
      if (!force && signature === lastDormSignatures.get(state) && complete) return;

      lastDormSignatures.set(state, signature);
      column.dataset.component = 'status-board-dorm-column';
      column.dataset.owner = 'gate-status-board-controller';
      column.dataset.state = state;
      column.dataset.count = String(filtered.length);
      column.innerHTML = filtered.length
        ? filtered.map(renderDormCard).join('')
        : '<div class="text-muted text-xs" data-owner="gate-status-board-controller" data-empty-state="true">None</div>';
      renderStats.columnWrites += 1;
    });
  }

  function formatBusDepartedTime(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function fallbackActiveBusCard(bus) {
    const title = bus.bus_type === 'local'
      ? `LOCAL – ${esc(bus.destination || bus.originating_destination || 'LOCAL')}`
      : `BUS #${esc(bus.bus_id || '')}`;
    const otw = n(bus.otw_count);
    const females = n(bus.female_count);
    const nat = n(bus.nat_count);
    const sf = n(bus.space_force_count);
    const departed = formatBusDepartedTime(bus.departed_at || bus.created_at);
    const plainLabel = `${title} – ${otw} OTW | ${females} FEMALE | ${nat} NAT | ${sf} SPACE FORCE | DEPT ${departed}`;

    return `
      <button
        type="button"
        class="bus-badge prc-bus-card gate-component-active-bus-card"
        data-component="active-bus-card"
        data-owner="gate-status-board-controller"
        data-bus-id="${esc(bus.__backendId || '')}"
        title="Confirm arrival: ${esc(plainLabel)}"
        aria-label="Confirm arrival: ${esc(plainLabel)}"
        onclick="confirmBusArrival(this.dataset.busId)"
      >
        <span class="prc-bus-card-title">${title}</span>
        <span class="prc-bus-card-line">${otw} OTW</span>
        <span class="prc-bus-card-line">${females} FEMALE</span>
        <span class="prc-bus-card-line">${nat} NAT</span>
        <span class="prc-bus-card-line">${sf} SPACE FORCE</span>
        <span class="prc-bus-card-dept">DEPT: ${esc(departed)}</span>
      </button>
    `;
  }

  function hasCompleteActiveBusMarkup(container, buses) {
    if (!container || container.dataset.owner !== 'gate-status-board-controller') return false;
    if (!buses.length) return Boolean(container.querySelector(':scope > [data-empty-state="true"]'));

    const cards = Array.from(container.querySelectorAll(':scope > [data-component="active-bus-card"]'));
    if (cards.length !== buses.length) return false;

    return cards.every(card => {
      const detailLines = Array.from(card.querySelectorAll('.prc-bus-card-line'));
      const text = detailLines.map(line => line.textContent || '').join(' | ').toUpperCase();
      return Boolean(
        card.dataset.owner === 'gate-status-board-controller' &&
        card.querySelector('.prc-bus-card-title') &&
        card.querySelector('.prc-bus-card-dept') &&
        detailLines.length >= 4 &&
        text.includes('OTW') &&
        text.includes('FEMALE') &&
        text.includes('NAT') &&
        text.includes('SPACE FORCE')
      );
    });
  }

  function renderActiveBuses(options = {}) {
    const container = document.getElementById('active-buses');
    if (!container) return;

    const buses = getActiveBuses();
    const signature = busSignature(buses);
    const force = Boolean(options.force);
    const complete = hasCompleteActiveBusMarkup(container, buses);
    if (!force && signature === lastBusSignature && complete) return;
    lastBusSignature = signature;

    container.dataset.component = 'active-bus-panel';
    container.dataset.owner = 'gate-status-board-controller';
    container.dataset.gateActiveBusSignature = signature;
    container.dataset.detailContract = 'otw-female-nat-space-force-departure';

    if (!buses.length) {
      container.innerHTML = '<span class="text-muted text-sm" data-owner="gate-status-board-controller" data-empty-state="true">None</span>';
      renderStats.busWrites += 1;
      return;
    }

    container.innerHTML = buses
      .map(bus => components()?.activeBusCard
        ? components().activeBusCard(bus).replace('data-owner="gate-active-bus-controller"', 'data-owner="gate-status-board-controller"')
        : fallbackActiveBusCard(bus))
      .join('');
    renderStats.busWrites += 1;
  }

  function applyTimerVisualState(timer, minutes) {
    const warning = minutes >= 40 && minutes < 50;
    const critical = minutes >= 50;
    const visualState = critical ? 'critical' : (warning ? 'warning' : 'normal');

    timer.classList.toggle('timer-yellow', warning);
    timer.classList.toggle('timer-red', critical);
    if (timer.classList.contains('timer-flash')) timer.classList.remove('timer-flash');
    if (timer.dataset.timerVisualState !== visualState) timer.dataset.timerVisualState = visualState;
  }

  function updateBoardTimers() {
    const board = document.getElementById('page-board');
    if (!board) return;

    board.querySelectorAll('.gate-dorm-timer.timer-display[data-opened]').forEach(timer => {
      const openedAt = timer.dataset.opened;
      if (!openedAt || typeof getElapsedTimer !== 'function') return;

      timer.dataset.gateLiveValue = 'true';
      timer.setAttribute('aria-live', 'off');
      const elapsed = getElapsedTimer(openedAt);
      if (elapsed?.text && timer.textContent !== elapsed.text) timer.textContent = elapsed.text;

      const minutes = Number(elapsed?.minutes || 0);
      applyTimerVisualState(timer, minutes);

      if (minutes >= 60 && timer.dataset.dormId && typeof triggerOvertimeSoundIfNeeded === 'function') {
        triggerOvertimeSoundIfNeeded(timer.dataset.dormId);
      }
    });
    renderStats.timerTicks += 1;
  }

  function canonicalTimerTick() {
    updateBoardTimers();
  }

  function ensureTimerOwner() {
    window.updateTimers = canonicalTimerTick;
    try { updateTimers = canonicalTimerTick; } catch (_) {}

    let legacyInterval = null;
    try { legacyInterval = typeof timerInterval !== 'undefined' ? timerInterval : null; } catch (_) {}
    if (legacyInterval && legacyInterval !== canonicalTimerInterval) window.clearInterval(legacyInterval);

    if (!canonicalTimerInterval) canonicalTimerInterval = window.setInterval(canonicalTimerTick, 1000);
    try { timerInterval = canonicalTimerInterval; } catch (_) {}

    canonicalTimerTick();
    return canonicalTimerInterval;
  }

  function disconnectSurfaceObserver() {
    if (!surfaceObserver) return;
    surfaceObserver.disconnect();
    observerConnected = false;
  }

  function connectSurfaceObserver() {
    if (!surfaceObserver || typeof MutationObserver === 'undefined') return;
    surfaceObserver.disconnect();
    let connected = false;
    SURFACE_IDS.forEach(id => {
      const surface = document.getElementById(id);
      if (!surface) return;
      surfaceObserver.observe(surface, { childList: true });
      connected = true;
    });
    observerConnected = connected;
  }

  function withSurfaceObserverPaused(callback) {
    const reconnect = Boolean(surfaceObserver && observerConnected);
    if (reconnect) disconnectSurfaceObserver();
    try {
      return callback();
    } finally {
      if (reconnect) connectSurfaceObserver();
    }
  }

  function renderStatusBoard(options = {}) {
    renderQueued = false;
    const force = Boolean(options.force || pendingForceRender);
    pendingForceRender = false;
    const dorms = getDorms();

    statusBoardRenderInProgress = true;
    try {
      withSurfaceObserverPaused(() => {
        renderColumns(dorms, { force });
        renderActiveBuses({ force });
      });
      updateBoardTimers();
      renderStats.renderPasses += 1;
    } finally {
      statusBoardRenderInProgress = false;
    }
  }

  function scheduleRender(options = {}) {
    if (options.force) pendingForceRender = true;
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => renderStatusBoard({ force: pendingForceRender }));
  }

  function repairStatusBoardSurfaces() {
    if (statusBoardRenderInProgress) return false;
    const dorms = getDorms();
    const buses = getActiveBuses();
    const activeBuses = document.getElementById('active-buses');
    const dormRepairNeeded = !hasCompleteDormMarkup(dorms);
    const busRepairNeeded = !hasCompleteActiveBusMarkup(activeBuses, buses);
    if (!dormRepairNeeded && !busRepairNeeded) return false;

    statusBoardRenderInProgress = true;
    try {
      withSurfaceObserverPaused(() => {
        if (dormRepairNeeded) renderColumns(dorms, { force: true });
        if (busRepairNeeded) renderActiveBuses({ force: true });
      });
      updateBoardTimers();
      renderStats.surfaceRepairs += 1;
    } finally {
      statusBoardRenderInProgress = false;
    }
    return true;
  }

  function observeStatusBoardSurfaces() {
    if (surfaceObserver || typeof MutationObserver === 'undefined') return;
    surfaceObserver = new MutationObserver(() => repairStatusBoardSurfaces());
    connectSurfaceObserver();
  }

  function patchLegacyBoardGlobals() {
    const boardDormCard = function gateStatusBoardDormCard(dorm) {
      return renderDormCard(dorm);
    };
    boardDormCard.__gateStatusBoardController = true;

    const boardDormColumns = function gateStatusBoardDormColumns(dorms) {
      const orderedDorms = recordDisplay()?.sortDorms ? recordDisplay().sortDorms(dorms) : dorms;
      renderColumns(Array.isArray(orderedDorms) ? orderedDorms : getDorms());
    };
    boardDormColumns.__gateStatusBoardController = true;

    window.buildBoardDormCard = boardDormCard;
    window.renderDormColumns = boardDormColumns;
    window.updateTimers = canonicalTimerTick;
    try { buildBoardDormCard = boardDormCard; } catch (_) {}
    try { renderDormColumns = boardDormColumns; } catch (_) {}
    try { updateTimers = canonicalTimerTick; } catch (_) {}
  }

  function diagnostics() {
    return Object.freeze({
      ...renderStats,
      observerConnected,
      observedSurfaceCount: SURFACE_IDS.filter(id => document.getElementById(id)).length,
      timerOwnerActive: Boolean(canonicalTimerInterval),
      pendingRender: renderQueued || pendingForceRender
    });
  }

  function exposeControllers() {
    window.GateStatusBoardController = Object.freeze({
      isCanonicalOwner: true,
      render: renderStatusBoard,
      scheduleRender,
      renderDormColumns: renderColumns,
      renderActiveBuses,
      updateBoardTimers,
      ensureTimerOwner,
      repairSurfaces: repairStatusBoardSurfaces,
      diagnostics,
      getDorms,
      getActiveBuses
    });

    window.GateActiveBusController = Object.freeze({
      isCanonicalOwner: false,
      handoffOwner: 'gate-status-board-controller',
      render: renderActiveBuses,
      scheduleRender,
      getActiveBuses
    });
  }

  function handleRenderLifecycle() {
    ensureTimerOwner();
    repairStatusBoardSurfaces();
  }

  function start() {
    if (installed) return;
    installed = true;
    patchLegacyBoardGlobals();
    exposeControllers();
    ensureTimerOwner();
    renderStatusBoard({ force: true });
    observeStatusBoardSurfaces();
    window.registerGateHook?.('afterRenderAll', handleRenderLifecycle);
    window.registerGateHook?.('afterDataChanged', () => scheduleRender());
    window.registerGateHook?.('afterPageChange', () => scheduleRender());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', () => {
    start();
    ensureTimerOwner();
    repairStatusBoardSurfaces();
  }, { once: true });
})();
