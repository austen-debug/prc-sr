// GATE premium metrics sync guard
// Phase 1B: Status Board metric source is served directly by middleware/source refactor.
// This file no longer creates cards or compatibility sinks; it only cleans stale duplicate surfaces and syncs stat-* IDs.
(function () {
  'use strict';

  let installed = false;
  let scheduled = false;

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value ?? '—');
  }

  function getRecordsSafe() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function getActiveWeekGroupSafe() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function getLocalTimeSafe() {
    try { return typeof getLocalTime24 === 'function' ? getLocalTime24() : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); } catch (_) {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
  }

  function calculateMetrics() {
    const records = getRecordsSafe();
    const wg = getActiveWeekGroupSafe();
    const dorms = records.filter(record => record?.type === 'dorm' && record.week_group === wg);
    const buses = records.filter(record => record?.type === 'bus' && record.week_group === wg);
    const arrivedBuses = buses.filter(bus => bus.status === 'arrived');
    const totalExpected = dorms.reduce((sum, dorm) => sum + (Number(dorm.max_load) || 0), 0);
    const totalArrived = arrivedBuses.reduce((sum, bus) => sum + (Number(bus.otw_count) || 0), 0);
    const lastAirport = records.find(record => record?.type === 'config' && record.key === 'last_airport')?.value || '—';

    return {
      arrived: totalArrived,
      expected: totalExpected,
      last: lastAirport,
      local: getLocalTimeSafe()
    };
  }

  function removeStaleDuplicateSurfaces() {
    const boardHeader = document.querySelector('#page-board .board-header');
    if (!boardHeader) return;

    const hasCanonicalMetrics = Boolean(boardHeader.querySelector('.gate-metrics-container'));
    if (!hasCanonicalMetrics) return;

    boardHeader.classList.add('gate-premium-metrics-enabled');
    boardHeader.dataset.owner = boardHeader.dataset.owner || 'gate-status-metrics-source';

    document.getElementById('gate-metric-compat-sinks')?.remove();
    boardHeader.querySelectorAll('#gate-premium-metrics, .gate-premium-metrics, .prc-metric-grid-v3, .prc-metric-card-v3, .prc-header-legacy-v3').forEach(element => element.remove());

    boardHeader.querySelectorAll('.metric-block').forEach(block => {
      if (block.querySelector('#metric-arrived, #metric-airport')) block.remove();
      if (block.textContent && /Arrived\s*\/\s*Expected|Last Airport Arrival/i.test(block.textContent)) block.remove();
    });

    document.getElementById('active-buses')?.closest('.metric-block')?.classList.add('gate-active-buses-block');
  }

  function syncMetricValues() {
    if (!document.querySelector('#page-board .gate-metrics-container')) return;
    const metrics = calculateMetrics();
    setText('stat-arrived', metrics.arrived);
    setText('stat-expected', metrics.expected);
    setText('stat-last', metrics.last);
    setText('stat-local', metrics.local);
  }

  function run() {
    scheduled = false;
    removeStaleDuplicateSurfaces();
    syncMetricValues();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  }

  function start() {
    if (installed) return;
    installed = true;
    window.registerGateHook?.('afterRenderAll', schedule);
    window.registerGateHook?.('afterDataChanged', schedule);
    window.registerGateHook?.('afterPageChange', schedule);
    window.setInterval(schedule, 1000);
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
