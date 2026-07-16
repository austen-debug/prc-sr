// GATE Build 2 Phase 3A — hidden, read-only Status Board shadow bridge.
// Observes Build 1 output and runs canonical parity calculations without rendering or persistence authority.
(function () {
  'use strict';

  let installed = false;
  let scheduled = false;
  let running = false;
  let latest = null;
  let latestError = null;
  let evidence = null;
  let shadowModulePromise = null;

  function moduleApi() {
    if (!shadowModulePromise) {
      shadowModulePromise = import('/app/status-board-shadow/index.mjs?v=phase-3a-status-board-shadow-20260715');
    }
    return shadowModulePromise;
  }

  function records() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function activeWeekGroup() {
    try { return typeof getActiveWG === 'function' ? String(getActiveWG() || '') : ''; } catch (_) { return ''; }
  }

  function numberFromText(id) {
    const value = document.getElementById(id)?.textContent || '0';
    const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function dormRecords() {
    try {
      const value = window.GateStatusBoardController?.getDorms?.();
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function activeBusRecords() {
    try {
      const value = window.GateStatusBoardController?.getActiveBuses?.();
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function timerTone(element, state) {
    if (state !== 'open') return 'settled';
    if (element?.classList.contains('timer-red')) return 'critical';
    if (element?.classList.contains('timer-yellow')) return 'warning';
    return 'normal';
  }

  function captureTimers(dorms) {
    return dorms.map(dorm => {
      const id = String(dorm?.__backendId || dorm?.id || '');
      const state = String(dorm?.state || 'empty').toLowerCase();
      const card = id ? document.querySelector(`#page-board .gate-dorm-card[data-dorm-id="${CSS.escape(id)}"]`) : null;
      const timer = card?.querySelector('.gate-dorm-timer');
      const display = String(timer?.textContent || dorm?.closed_timer || '00:00').trim() || '00:00';
      const parts = /^(\d+):([0-5]\d)$/.exec(display);
      const elapsedSeconds = parts ? Number(parts[1]) * 60 + Number(parts[2]) : 0;
      return {
        dormId: id,
        display,
        tone: timerTone(timer, state),
        overtime: state === 'open' && elapsedSeconds >= 60 * 60
      };
    }).filter(timer => Boolean(timer.dormId));
  }

  async function runShadow() {
    scheduled = false;
    if (running || !document.getElementById('page-board')) return latest;
    running = true;
    try {
      const module = await moduleApi();
      const dorms = dormRecords();
      const buses = activeBusRecords();
      const capturedAt = new Date().toISOString();
      const weekGroup = activeWeekGroup();
      const legacySnapshot = module.buildLegacyStatusBoardSnapshot({
        weekGroup,
        capturedAt,
        arrived: numberFromText('stat-arrived'),
        expected: numberFromText('stat-expected'),
        lastArrival: document.getElementById('stat-last')?.textContent || '—',
        activeBusIds: buses.map(bus => bus?.__backendId || bus?.id || ''),
        dorms: dorms.map(dorm => ({ id: dorm?.__backendId || dorm?.id || '', state: dorm?.state || 'empty' })),
        timers: captureTimers(dorms)
      });
      latest = module.runStatusBoardShadow({
        legacySnapshot,
        records: records(),
        weekGroup,
        capturedAt,
        timeZone: 'America/Chicago'
      });
      evidence = module.appendShadowEvidence(evidence || module.createShadowEvidenceLedger(), latest.comparison);
      latestError = null;
      return latest;
    } catch (error) {
      latestError = String(error?.message || 'Status Board shadow evaluation failed.');
      return null;
    } finally {
      running = false;
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => requestAnimationFrame(runShadow));
  }

  function expose() {
    window.GateStatusBoardShadow = Object.freeze({
      contractVersion: '3A.1.0',
      mode: 'shadow',
      readOnly: true,
      productionRouteActivated: false,
      runNow: runShadow,
      schedule,
      getLatest: () => latest,
      getLatestError: () => latestError,
      getEvidence: () => evidence,
      getEvidenceSummary: async () => {
        const module = await moduleApi();
        return module.summarizeShadowEvidence(evidence || module.createShadowEvidenceLedger());
      }
    });
  }

  function start() {
    if (installed) return;
    installed = true;
    expose();
    window.registerGateHook?.('afterRenderAll', schedule);
    window.registerGateHook?.('afterDataChanged', schedule);
    window.registerGateHook?.('afterPageChange', schedule);
    window.setInterval(schedule, 30000);
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
