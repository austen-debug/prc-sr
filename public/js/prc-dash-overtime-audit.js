// GATE Timer and Sound Controller
// Canonical owner for timer display updates, sound event playback, and one-time overtime sound eligibility.
(function () {
  'use strict';

  const OVERTIME_THRESHOLD_MS = 60 * 60 * 1000;
  const TIMER_TICK_MS = 1000;
  const INSTALL_RETRY_MS = 250;
  const INSTALL_RETRY_LIMIT = 24;

  let installed = false;
  let installAttempts = 0;
  let installRetryInterval = null;
  let controllerInterval = null;
  let auditInProgress = false;
  let localOvertimeInProgress = new Set();

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function activeWeekGroup() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function recordsOfType(type) {
    try {
      if (typeof getRecords === 'function') return getRecords(type);
      if (Array.isArray(window.allData)) return window.allData.filter(record => record.type === type);
    } catch (_) {}
    return [];
  }

  function dormRecords() {
    return recordsOfType('dorm');
  }

  function soundEventRecords() {
    return recordsOfType('sound_event');
  }

  function parseEventDetails(event) {
    try { return JSON.parse(event.details || '{}'); } catch (_) { return {}; }
  }

  function eventDormId(event) {
    if (!event || event.sound_key !== 'overtime') return '';
    return String(parseEventDetails(event).dorm_id || '').trim();
  }

  function activeWeekSoundEvents() {
    const wg = activeWeekGroup();
    return soundEventRecords()
      .filter(event => !wg || event.week_group === wg)
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  }

  function hasOvertimeSoundEvent(dormId) {
    const targetDormId = String(dormId || '').trim();
    if (!targetDormId) return false;
    const wg = activeWeekGroup();
    return soundEventRecords().some(event => (
      (!wg || event.week_group === wg) &&
      event.sound_key === 'overtime' &&
      eventDormId(event) === targetDormId
    ));
  }

  function ensureTimerStyles() {
    if (document.getElementById('gate-timer-sound-controller-styles')) return;

    const style = document.createElement('style');
    style.id = 'gate-timer-sound-controller-styles';
    style.textContent = `
      #page-board .timer-display.timer-yellow,
      #page-board .timer-display.timer-red,
      #page-board .timer-display.timer-flash,
      #page-squadron .timer-display.timer-yellow,
      #page-squadron .timer-display.timer-red,
      #page-squadron .timer-display.timer-flash {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        box-sizing: border-box !important;
        width: auto !important;
        min-width: 6.35ch !important;
        max-width: 100% !important;
        min-height: 1.28em !important;
        padding: 0.18em 0.36em 0.16em !important;
        line-height: 1 !important;
        letter-spacing: -0.045em !important;
        white-space: nowrap !important;
        font-variant-numeric: tabular-nums !important;
        vertical-align: middle !important;
      }

      #page-board .timer-display.timer-yellow::before,
      #page-board .timer-display.timer-red::before,
      #page-board .timer-display.timer-flash::before,
      #page-squadron .timer-display.timer-yellow::before,
      #page-squadron .timer-display.timer-red::before,
      #page-squadron .timer-display.timer-flash::before {
        content: '' !important;
        width: 0 !important;
        min-width: 0 !important;
      }

      #page-board .timer-display.timer-red,
      #page-board .timer-display.timer-flash,
      #page-squadron .timer-display.timer-red,
      #page-squadron .timer-display.timer-flash {
        border-radius: var(--radius-pill) !important;
      }
    `;

    document.head.appendChild(style);
  }

  function elapsedTimer(openedAt) {
    if (typeof getElapsedTimer === 'function') {
      try {
        const timer = getElapsedTimer(openedAt);
        if (timer && typeof timer.text === 'string') return timer;
      } catch (_) {}
    }

    const openedMs = new Date(openedAt || '').getTime();
    if (!Number.isFinite(openedMs)) return { text: '00:00', minutes: 0, elapsedMs: 0 };

    const elapsedMs = Math.max(0, Date.now() - openedMs);
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;

    return {
      text: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      minutes,
      elapsedMs
    };
  }

  function elapsedMsForDorm(dorm) {
    const openedMs = new Date(dorm?.opened_at || '').getTime();
    if (!Number.isFinite(openedMs)) return 0;
    return Math.max(0, Date.now() - openedMs);
  }

  function applyTimerState(el, timer) {
    el.textContent = timer.text;
    el.classList.remove('timer-yellow', 'timer-red', 'timer-flash');

    if (timer.minutes >= 60) {
      el.classList.add('timer-flash');
    } else if (timer.minutes >= 50) {
      el.classList.add('timer-red');
    } else if (timer.minutes >= 40) {
      el.classList.add('timer-yellow');
    }
  }

  function updateTimerDisplays() {
    ensureTimerStyles();
    document.querySelectorAll('.timer-display[data-opened]').forEach(el => {
      applyTimerState(el, elapsedTimer(el.dataset.opened));
    });
  }

  async function markDormOvertimeSent(dorm) {
    if (!dorm || dorm.overtime_sound_sent === 'true') return { isOk: true, data: dorm };
    if (!window.dataSdk || typeof window.dataSdk.update !== 'function') return { isOk: false };

    const overtimeAt = dorm.overtime_sound_at || new Date().toISOString();
    const result = await window.dataSdk.update({
      ...dorm,
      overtime_sound_sent: 'true',
      overtime_sound_at: overtimeAt
    });

    if (result && result.isOk && Array.isArray(window.allData)) {
      const index = window.allData.findIndex(record => record.__backendId === dorm.__backendId);
      if (index >= 0) window.allData[index] = { ...window.allData[index], overtime_sound_sent: 'true', overtime_sound_at: overtimeAt };
    }

    return result;
  }

  async function createOvertimeSoundEvent(dorm) {
    if (!dorm || hasOvertimeSoundEvent(dorm.__backendId)) return;
    if (typeof createSoundEvent !== 'function') return;

    await createSoundEvent('overtime', {
      dorm_id: dorm.__backendId,
      dorm_name: dorm.dorm_name || '',
      action: 'timer_overtime',
      threshold_minutes: 60
    });
  }

  async function triggerOvertimeSoundOnce(dormId) {
    const targetDormId = String(dormId || '').trim();
    if (!targetDormId || localOvertimeInProgress.has(targetDormId)) return;

    const dorm = dormRecords().find(record => record.__backendId === targetDormId);
    if (!dorm || dorm.type !== 'dorm' || dorm.state !== 'open' || !dorm.opened_at) return;
    if (elapsedMsForDorm(dorm) < OVERTIME_THRESHOLD_MS) return;

    localOvertimeInProgress.add(targetDormId);

    try {
      if (hasOvertimeSoundEvent(targetDormId)) {
        await markDormOvertimeSent(dorm);
        return;
      }

      const markResult = await markDormOvertimeSent(dorm);
      if (!markResult || !markResult.isOk) return;

      await createOvertimeSoundEvent(dorm);
    } finally {
      localOvertimeInProgress.delete(targetDormId);
    }
  }

  async function auditOpenDormsForOvertime() {
    if (auditInProgress || !window.dataSdk || typeof window.dataSdk.update !== 'function') return;

    const wg = activeWeekGroup();
    if (!wg) return;

    const candidates = dormRecords().filter(dorm => (
      dorm &&
      dorm.type === 'dorm' &&
      dorm.week_group === wg &&
      dorm.state === 'open' &&
      dorm.opened_at &&
      elapsedMsForDorm(dorm) >= OVERTIME_THRESHOLD_MS &&
      !(dorm.overtime_sound_sent === 'true' && hasOvertimeSoundEvent(dorm.__backendId))
    ));

    if (candidates.length === 0) return;

    auditInProgress = true;
    try {
      for (const dorm of candidates) await triggerOvertimeSoundOnce(dorm.__backendId);
    } finally {
      auditInProgress = false;
    }
  }

  function processSoundEventsDeduped() {
    if (typeof playedSoundEventIds === 'undefined') return;

    const overtimeDormsSeen = new Set();

    for (const event of activeWeekSoundEvents()) {
      const id = event.__backendId;
      if (!id) continue;

      const overtimeDormId = eventDormId(event);
      const duplicateOvertime = overtimeDormId && overtimeDormsSeen.has(overtimeDormId);
      if (overtimeDormId) overtimeDormsSeen.add(overtimeDormId);

      if (playedSoundEventIds.has(id)) continue;

      const eventTime = new Date(event.created_at || '').getTime();
      const baseline = typeof soundEventBaseline === 'number' ? soundEventBaseline : 0;
      if (!Number.isFinite(eventTime) || eventTime < baseline || duplicateOvertime) {
        playedSoundEventIds.add(id);
        continue;
      }

      if (typeof playOperationalSound === 'function') playOperationalSound(event.sound_key);
      playedSoundEventIds.add(id);
    }

    if (typeof savePlayedSoundEventIds === 'function') savePlayedSoundEventIds();
  }

  function patchGlobalFunctions() {
    ensureTimerStyles();

    window.updateTimers = updateTimerDisplays;
    try { updateTimers = updateTimerDisplays; } catch (_) {}

    window.triggerOvertimeSoundIfNeeded = triggerOvertimeSoundOnce;
    try { triggerOvertimeSoundIfNeeded = triggerOvertimeSoundOnce; } catch (_) {}

    window.processSoundEvents = processSoundEventsDeduped;
    try { processSoundEvents = processSoundEventsDeduped; } catch (_) {}
  }

  function stopLegacyTimerInterval() {
    try {
      if (typeof timerInterval !== 'undefined' && timerInterval && timerInterval !== controllerInterval) {
        clearInterval(timerInterval);
        timerInterval = controllerInterval;
      }
    } catch (_) {}
  }

  function tick() {
    updateTimerDisplays();
    processSoundEventsDeduped();
    auditOpenDormsForOvertime();
  }

  function startControllerInterval() {
    if (controllerInterval) return;
    controllerInterval = setInterval(tick, TIMER_TICK_MS);
    try { timerInterval = controllerInterval; } catch (_) {}
  }

  function installController() {
    patchGlobalFunctions();
    stopLegacyTimerInterval();
    startControllerInterval();
    tick();

    if (!window.GateTimerSoundController) {
      window.GateTimerSoundController = Object.freeze({
        isCanonicalOwner: true,
        updateTimers: updateTimerDisplays,
        processSoundEvents: processSoundEventsDeduped,
        auditOvertime: auditOpenDormsForOvertime,
        triggerOvertimeSoundOnce,
        getElapsedTimer: elapsedTimer
      });
    }

    if (typeof window.registerGateHook === 'function') {
      window.registerGateHook('afterRenderAll', updateTimerDisplays);
      window.registerGateHook('afterDataChanged', () => {
        updateTimerDisplays();
        processSoundEventsDeduped();
        auditOpenDormsForOvertime();
      });
      window.registerGateHook('afterPageChange', updateTimerDisplays);
    }

    installed = true;
  }

  function attemptInstall() {
    installAttempts += 1;
    installController();

    if (installAttempts >= INSTALL_RETRY_LIMIT || installed) {
      if (installRetryInterval) clearInterval(installRetryInterval);
      installRetryInterval = null;
    }
  }

  function start() {
    attemptInstall();
    if (!installRetryInterval) installRetryInterval = setInterval(attemptInstall, INSTALL_RETRY_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.addEventListener('load', start, { once: true });
})();
