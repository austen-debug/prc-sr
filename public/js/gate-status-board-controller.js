// GATE Phase 1C Status Board Controller
// Canonical owner for Status Board dorm columns, dorm cards, active bus panel, and board timer text refresh.
(function () {
  'use strict';

  let installed = false;
  let renderQueued = false;
  let lastDormSignature = '';
  let lastBusSignature = '';

  function components() {
    return window.GateComponents || null;
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
    return records()
      .filter(record => record?.type === 'dorm')
      .filter(record => !wg || record.week_group === wg)
      .sort((a, b) => String(a.dorm_name || '').localeCompare(String(b.dorm_name || ''), undefined, { numeric: true }));
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

  function renderColumns(dorms, options = {}) {
    const force = Boolean(options.force);
    const signature = dormSignature(dorms);
    if (!force && signature === lastDormSignature) return;
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

  function fallbackActiveBusCard(bus) {
    const label = bus.bus_type === 'local'
      ? `LOCAL – ${esc(bus.destination || bus.originating_destination || '')} – ${n(bus.otw_count)} OTW`
      : `BUS #${esc(bus.bus_id || '')} – ${n(bus.otw_count)} OTW`;
    return `
      <button type="button" class="bus-badge prc-bus-card gate-component-active-bus-card" data-component="active-bus-card" data-owner="gate-status-board-controller" data-bus-id="${esc(bus.__backendId || '')}" onclick="confirmBusArrival(this.dataset.busId)">
        ${label}
      </button>
    `;
  }

  function renderActiveBuses(options = {}) {
    const container = document.getElementById('active-buses');
    if (!container) return;

    const buses = getActiveBuses();
    const signature = busSignature(buses);
    const force = Boolean(options.force);
    if (!force && signature === lastBusSignature && container.dataset.owner === 'gate-status-board-controller') return;
    lastBusSignature = signature;

    container.dataset.component = 'active-bus-panel';
    container.dataset.owner = 'gate-status-board-controller';
    container.dataset.gateActiveBusSignature = signature;

    if (!buses.length) {
      container.innerHTML = '<span class="text-muted text-sm" data-owner="gate-status-board-controller" data-empty-state="true">None</span>';
      return;
    }

    container.innerHTML = buses
      .map(bus => components()?.activeBusCard ? components().activeBusCard(bus).replace('data-owner="gate-active-bus-controller"', 'data-owner="gate-status-board-controller"') : fallbackActiveBusCard(bus))
      .join('');
  }

  function updateBoardTimers() {
    const board = document.getElementById('page-board');
    if (!board) return;

    board.querySelectorAll('.timer-display[data-opened]').forEach(timer => {
      const openedAt = timer.dataset.opened;
      if (!openedAt || typeof getElapsedTimer !== 'function') return;

      const elapsed = getElapsedTimer(openedAt);
      if (elapsed?.text) timer.textContent = elapsed.text;

      timer.classList.toggle('timer-yellow', elapsed?.minutes >= 45 && elapsed?.minutes < 60);
      timer.classList.toggle('timer-red', elapsed?.minutes >= 60);
      timer.classList.toggle('timer-flash', elapsed?.minutes >= 60);

      if (elapsed?.minutes >= 60 && timer.dataset.dormId && typeof triggerOvertimeSoundIfNeeded === 'function') {
        triggerOvertimeSoundIfNeeded(timer.dataset.dormId);
      }
    });
  }

  function renderStatusBoard(options = {}) {
    renderQueued = false;
    const dorms = getDorms();
    renderColumns(dorms, options);
    renderActiveBuses(options);
    updateBoardTimers();
  }

  function scheduleRender(options = {}) {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => renderStatusBoard(options));
  }

  function patchLegacyBoardGlobals() {
    const boardDormCard = function gateStatusBoardDormCard(dorm) {
      return renderDormCard(dorm);
    };
    boardDormCard.__gateStatusBoardController = true;

    const boardDormColumns = function gateStatusBoardDormColumns(dorms) {
      renderColumns(Array.isArray(dorms) ? dorms : getDorms(), { force: true });
    };
    boardDormColumns.__gateStatusBoardController = true;

    window.buildBoardDormCard = boardDormCard;
    window.renderDormColumns = boardDormColumns;
    try { buildBoardDormCard = boardDormCard; } catch (_) {}
    try { renderDormColumns = boardDormColumns; } catch (_) {}
  }

  function exposeControllers() {
    window.GateStatusBoardController = Object.freeze({
      isCanonicalOwner: true,
      render: renderStatusBoard,
      scheduleRender,
      renderDormColumns: renderColumns,
      renderActiveBuses,
      updateBoardTimers,
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

  function start() {
    if (installed) return;
    installed = true;
    patchLegacyBoardGlobals();
    exposeControllers();
    window.registerGateHook?.('afterRenderAll', () => scheduleRender({ force: true }));
    window.registerGateHook?.('afterDataChanged', () => scheduleRender({ force: true }));
    window.registerGateHook?.('afterPageChange', () => scheduleRender());
    window.addEventListener('resize', () => scheduleRender(), true);
    window.setInterval(updateBoardTimers, 1000);
    scheduleRender({ force: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
