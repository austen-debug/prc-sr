// Canonical GATE 3 application bootstrap: session, data, shell controls, and orchestration only.
(function () {
  'use strict';

  const store = window.GateApplicationStore;
  if (!store || !window.GateRouteLifecycle) throw new Error('GATE foundations must load before bootstrap.');

  const SOUND_ENABLED_KEY = 'prc_sr_sound_enabled_v1';
  const SOUND_FILES = Object.freeze({
    dorm_open: '/assets/sr_open_sound.mp3',
    dorm_closed: '/assets/sr_closed_sound.mp3',
    bus_dispatch: '/assets/sr_bus_sound.mp3',
    overtime: '/assets/sr_overtime_sound.mp3'
  });
  let soundEnabled = localStorage.getItem(SOUND_ENABLED_KEY) === 'true';
  let isDark = true;

  function refreshOwners() {
    const display = document.getElementById('week-group-display');
    if (display) display.textContent = store.activeWeekGroup() || 'No WG';
    window.GateStatusBoardController?.scheduleRender?.({ force: true });
    window.GateProcessingController?.refresh?.();
    window.GateBusWorkflowController?.refresh?.();
    window.GateInputPageController?.refresh?.();
    window.GateArchiveController?.refresh?.();
    window.GatePremiumMetricsController?.refresh?.();
    window.GateAppShell?.sync?.();
    window.runGateHooks?.('afterDataChanged', { records: store.records() });
  }

  async function loadSession() {
    const response = await fetch('/api/session', { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' });
    const result = await response.json();
    if (!result.isOk) { window.location.href = '/login/'; return false; }
    store.setSession({ role: result.role || 'airman', username: result.username || '' });
    return true;
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST', headers: { Accept: 'application/json' } });
    window.location.href = '/login/';
  }

  function toggleTheme() {
    isDark = !isDark;
    document.body.classList.toggle('theme-light', !isDark);
  }

  async function toggleFullscreenBoard() {
    const board = document.getElementById('page-board');
    if (!board) return;
    if (!document.fullscreenElement) {
      await board.requestFullscreen?.();
      document.body.classList.add('fullscreen-board');
    } else {
      await document.exitFullscreen?.();
      document.body.classList.remove('fullscreen-board');
    }
    window.GateFullscreenBoardLayout?.sync?.();
  }

  async function enableOperationalSounds() {
    soundEnabled = true;
    localStorage.setItem(SOUND_ENABLED_KEY, 'true');
    const button = document.getElementById('sound-toggle-btn');
    if (button) button.textContent = 'SOUND ON';
    await Promise.all(Object.values(SOUND_FILES).map(async src => {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.volume = 0.01;
      try { await audio.play(); audio.pause(); audio.currentTime = 0; } catch (_) {}
    }));
  }

  function handleStaticAction(event) {
    const target = event.target instanceof Element ? event.target.closest('[data-gate-action-click]') : null;
    if (!target) return;
    const id = target.dataset.gateActionClick;
    const actions = {
      'gate-action-001': logout,
      'gate-action-002': toggleFullscreenBoard,
      'gate-action-003': enableOperationalSounds,
      'gate-action-004': toggleTheme,
      'gate-action-006': () => window.GateInputPageController?.initializeWeekGroup?.(event),
      'gate-action-007': () => window.GateAppShell?.go?.('board'),
      'gate-action-009': () => window.GateArchiveController?.initiateCloseout?.(event),
      'gate-action-010': () => window.GateProcessingController?.closeDormModal?.(),
      'gate-action-019': () => window.GateProcessingController?.closeDormEditModal?.(),
      'gate-action-021': () => window.GateBusWorkflowController?.closeLocalBusModal?.(),
      'gate-action-022': () => window.GateBusWorkflowController?.closeBusModal?.(),
      'gate-action-023': () => window.GateArchiveController?.closeArchiveEditModal?.(),
      'gate-action-024': () => window.GateArchiveController?.printArchiveReport?.(event)
    };
    const action = actions[id];
    if (action) { event.preventDefault(); action(); }
  }

  function handleCanonicalActions(event) {
    const busArrival = event.target instanceof Element ? event.target.closest('[data-gate-bus-arrival][data-bus-id]') : null;
    if (busArrival) return window.GateBusWorkflowController?.confirmBusArrival?.(busArrival.dataset.busId);
    const dorm = event.target instanceof Element ? event.target.closest('[data-gate-open-dorm]') : null;
    if (dorm) return window.GateProcessingController?.openDormModal?.(dorm.dataset.gateOpenDorm);
    const archive = event.target instanceof Element ? event.target.closest('[data-archive-id]') : null;
    if (archive) return window.GateArchiveController?.openArchiveEditModal?.(event, archive.dataset.archiveId);
  }

  async function initializeData() {
    if (!window.dataSdk) throw new Error('Data SDK unavailable.');
    const result = await window.dataSdk.init({ onDataChanged(data) { store.replaceRecords(data, 'data-sdk'); refreshOwners(); } });
    if (!result?.isOk) console.warn('Data SDK initialized with a warning:', result);
  }

  async function init() {
    document.addEventListener('click', handleStaticAction, true);
    document.addEventListener('click', handleCanonicalActions, true);
    const sessionOk = await loadSession();
    if (!sessionOk) return;
    try { await initializeData(); } catch (error) { console.error('GATE failed to initialize data layer:', error); store.replaceRecords([], 'data-sdk-error'); }
    if (window.lucide) window.lucide.createIcons();
    const soundButton = document.getElementById('sound-toggle-btn');
    if (soundButton) soundButton.textContent = soundEnabled ? 'SOUND ON' : 'ENABLE SOUND';
    refreshOwners();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
