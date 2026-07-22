// GATE premium metrics sync guard
// Phase 1B: Status Board metric source is served directly by middleware/source refactor.
// This file does not create cards. It removes stale duplicate surfaces and performs change-only metric synchronization.
(function () {
  'use strict';

  let installed = false;
  let scheduled = false;
  let clockTimeout = null;

  function setText(id, value) {
    const element = document.getElementById(id);
    if (!element) return false;
    const next = String(value ?? '—');
    if (element.textContent === next) return false;
    element.textContent = next;
    return true;
  }

  function getRecordsSafe() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function getActiveWeekGroupSafe() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function getLocalTimeSafe() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
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
    if (!boardHeader.dataset.owner) boardHeader.dataset.owner = 'gate-status-metrics-source';

    document.getElementById('gate-metric-compat-sinks')?.remove();
    boardHeader.querySelectorAll('#gate-premium-metrics, .gate-premium-metrics, .prc-metric-grid-v3, .prc-metric-card-v3, .prc-header-legacy-v3').forEach(element => element.remove());

    boardHeader.querySelectorAll('.metric-block').forEach(block => {
      if (block.querySelector('#metric-arrived, #metric-airport')) block.remove();
      else if (block.textContent && /Arrived\s*\/\s*Expected|Last Airport Arrival/i.test(block.textContent)) block.remove();
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

  function syncLocalClock() {
    if (!document.querySelector('#page-board .gate-metrics-container')) return false;
    return setText('stat-local', getLocalTimeSafe());
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

  function scheduleLiveClock() {
    if (clockTimeout) window.clearTimeout(clockTimeout);
    const delay = Math.max(50, 1000 - (Date.now() % 1000) + 20);
    clockTimeout = window.setTimeout(() => {
      syncLocalClock();
      scheduleLiveClock();
    }, delay);
  }

  function restartLiveClock() {
    syncLocalClock();
    scheduleLiveClock();
  }

  function start() {
    if (installed) return;
    installed = true;
    window.registerGateHook?.('afterRenderAll', schedule);
    window.registerGateHook?.('afterDataChanged', schedule);
    window.registerGateHook?.('afterPageChange', schedule);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        schedule();
        restartLiveClock();
      }
    });
    document.addEventListener('fullscreenchange', restartLiveClock);
    window.addEventListener('focus', restartLiveClock);
    window.addEventListener('pageshow', restartLiveClock);
    restartLiveClock();
    schedule();

    window.GatePremiumMetricsController = Object.freeze({
      isCanonicalMetricSyncOwner: true,
      isCanonicalLocalClockOwner: true,
      sync: schedule,
      syncLocalClock,
      restartLiveClock,
      clockPrecision: 'second',
      clockFormat: 'HH:MM:SS'
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
