// GATE Phase 1C Status Board Controller
// Canonical owner for Status Board dorm columns, dorm cards, active bus panel, and board timer refresh.
(function () {
  'use strict';

  let installed = false;
  let renderQueued = false;
  let pendingForceRender = false;
  let lastDormSignature = '';
  let lastBusSignature = '';
  let boardObserver = null;
  let statusBoardRenderInProgress = false;
  let canonicalTimerInterval = null;

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
    return `
      <div class="dorm-card tactical-glass-card gate-dorm-card" data-component="dorm-card" data-owner="gate-status-board-controller" data-dorm-id="${esc(dorm?.__backendId || '')}" data-state="${esc(state)}">
        <div class="gate-dorm-name">${esc(dorm?.dorm_name || '')}</div>
        <div class="gate-dorm-status">${esc(dorm?.phase || state.toUpperCase())}</div>
      </div>
    `;
  }

  function renderDormCard(dorm) {
    const html = components()?.dormCard
      ? components().dormCard(dorm, { showAuditorium: true })
      : fallbackDormCard(dorm);
    return html.replace('data-component="dorm-card"', 'data-component="dorm-card" data-owner="gate-status-board-controller"');
  }

  function directDormCards(column) {
    return Array.from(column?.children || []).filter(child => child?.dataset?.component === 'dorm-card');
  }

  function hasCompleteDormMarkup(dorms) {
    return ['empty', 'open', 'closed'].every(state => {
      const column = document.getElementById(`col-${state}`);
      if (!column || column.dataset.owner !== 'gate-status-board-controller') return false;

      const expected = dorms.filter(dorm => String(dorm.state || 'empty').toLowerCase() === state);
      if (column.dataset.state !== state || Number(column.dataset.count || -1) !== expected.length) return false;

      if (!expected.length) {
        return Boolean(column.querySelector('[data-owner="gate-status-board-controller"][data-empty-state="true"]'));
      }

      const cards = directDormCards(column);
      if (cards.length !== expected.length) return false;

      const expectedIds = expected.map(dorm => String(dorm.__backendId || '')).filter(Boolean);
      const actualIds = cards.map(card => String(card.dataset.dormId || '')).filter(Boolean);
      return cards.every(card => card.dataset.owner === 'gate-status-board-controller') &&
        expectedIds.length === actualIds.length &&
        expectedIds.every((id, index) => actualIds[index] === id);
    });
  }

  function renderColumns(dorms, options = {}) {
    const force = Boolean(options.force);
    const signature = dormSignature(dorms);
    const complete = hasCompleteDormMarkup(dorms);
    if (!force && signature === lastDormSignature && complete) return;
    lastDormSignature = signature;

    const board = document.getElementById('page-board');
    if (board) {
      board.dataset.component = 'status-board';
      board.dataset.owner = 'gate-status-board-controller';
    }

    ['empty', 'open', 'closed'].forEach(state => {
      const column = document.getElementById(`col-${state}`);
      if (!column) return;

      const filtered = dorms.filter(dorm => String(dorm.state || 'empty').toLowerCase() === state);
      column.dataset.component = 'status-board-dorm-column';
      column.dataset.owner = 'gate-status-board-controller';
      column.dataset.state = state;
      column.dataset.count = String(filtered.length);

      column.innerHTML = filtered.length
        ? filtered.map(renderDormCard).join('')
        : '<div class="text-muted text-xs" data-owner="gate-status-board-controller" data-empty-state="true">None</div>';
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
    if (!buses.length) return Boolean(container.querySelector('[data-empty-state="true"]'));

    const cards = Array.from(container.querySelectorAll('[data-component="active-bus-card"]'));
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
      return;
    }

    container.innerHTML = buses
      .map(bus => components()?.activeBusCard
        ? components().activeBusCard(bus).replace('data-owner="gate-active-bus-controller"', 'data-owner="gate-status-board-controller"')
        : fallbackActiveBusCard(bus))
      .join('');
  }

  function applyTimerVisualState(timer, minutes) {
    const warning = minutes >= 40 && minutes < 50;
    const critical = minutes >= 50;

    timer.classList.toggle('timer-yellow', warning);
    timer.classList.toggle('timer-red', critical);
    if (timer.classList.contains('timer-flash')) timer.classList.remove('timer-flash');
    timer.dataset.timerVisualState = critical ? 'critical' : (warning ? 'warning' : 'normal');
  }

  function updateBoardTimers() {
    const board = document.getElementById('page-board');
    if (!board) return;

    board.querySelectorAll('.timer-display[data-opened]').forEach(timer => {
      const openedAt = timer.dataset.opened;
      if (!openedAt || typeof getElapsedTimer !== 'function') return;

      const elapsed = getElapsedTimer(openedAt);
      if (elapsed?.text && timer.textContent !== elapsed.text) timer.textContent = elapsed.text;

      const minutes = Number(elapsed?.minutes || 0);
      applyTimerVisualState(timer, minutes);

      if (minutes >= 60 && timer.dataset.dormId && typeof triggerOvertimeSoundIfNeeded === 'function') {
        triggerOvertimeSoundIfNeeded(timer.dataset.dormId);
      }
    });
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

  function renderStatusBoard(options = {}) {
    renderQueued = false;
    const force = Boolean(options.force || pendingForceRender);
    pendingForceRender = false;
    const dorms = getDorms();

    statusBoardRenderInProgress = true;
    try {
      renderColumns(dorms, { force });
      renderActiveBuses({ force });
      updateBoardTimers();
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
    if (statusBoardRenderInProgress) return;
    const dorms = getDorms();
    const buses = getActiveBuses();
    const activeBuses = document.getElementById('active-buses');

    if (!hasCompleteDormMarkup(dorms) || !hasCompleteActiveBusMarkup(activeBuses, buses)) {
      renderStatusBoard({ force: true });
    }
  }

  function observeStatusBoardSurfaces() {
    if (boardObserver || typeof MutationObserver === 'undefined') return;
    const board = document.getElementById('page-board');
    if (!board) return;

    boardObserver = new MutationObserver(repairStatusBoardSurfaces);
    boardObserver.observe(board, { childList: true, subtree: true });
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
    scheduleRender();
  }

  function start() {
    if (installed) return;
    installed = true;
    patchLegacyBoardGlobals();
    exposeControllers();
    observeStatusBoardSurfaces();
    ensureTimerOwner();
    window.registerGateHook?.('afterRenderAll', handleRenderLifecycle);
    window.registerGateHook?.('afterDataChanged', () => scheduleRender());
    window.registerGateHook?.('afterPageChange', () => scheduleRender());
    window.addEventListener('resize', () => scheduleRender({ force: true }), true);
    window.addEventListener('orientationchange', () => scheduleRender({ force: true }), true);
    scheduleRender({ force: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', () => {
    start();
    ensureTimerOwner();
    repairStatusBoardSurfaces();
  }, { once: true });
})();
