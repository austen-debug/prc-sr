// PRC GATE overtime sound control
// Keeps timer rendering visual-only and creates overtime sound events from persistent dorm data.
(function () {
  const OVERTIME_THRESHOLD_MS = 60 * 60 * 1000;
  let patchStarted = false;
  let auditInProgress = false;
  let localOvertimeInProgress = new Set();
  let auditInterval = null;

  function getActiveWeekGroupSafe() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function getRecordsSafe(type) {
    try { return typeof getRecords === 'function' ? getRecords(type) : []; } catch (_) { return []; }
  }

  function getDormRecordsSafe() {
    return getRecordsSafe('dorm');
  }

  function getSoundEventRecordsSafe() {
    return getRecordsSafe('sound_event');
  }

  function parseEventDetails(event) {
    try { return JSON.parse(event.details || '{}'); } catch (_) { return {}; }
  }

  function getOvertimeDormIdFromEvent(event) {
    if (!event || event.sound_key !== 'overtime') return '';
    const details = parseEventDetails(event);
    return String(details.dorm_id || '').trim();
  }

  function hasOvertimeSoundEvent(dormId) {
    const targetDormId = String(dormId || '').trim();
    if (!targetDormId) return false;

    const activeWeekGroup = getActiveWeekGroupSafe();
    return getSoundEventRecordsSafe().some(event => (
      event.week_group === activeWeekGroup &&
      event.sound_key === 'overtime' &&
      getOvertimeDormIdFromEvent(event) === targetDormId
    ));
  }

  function ensureTimerPillSpacingStyles() {
    if (document.getElementById('prc-gate-timer-pill-spacing')) return;

    const style = document.createElement('style');
    style.id = 'prc-gate-timer-pill-spacing';
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
        min-width: 6.2ch !important;
        max-width: 100% !important;
        padding: 0.12em 0.34em 0.14em !important;
        line-height: 0.96 !important;
        letter-spacing: -0.045em !important;
        white-space: nowrap !important;
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

  function getElapsedTimerSafe(openedAt) {
    if (typeof getElapsedTimer === 'function') return getElapsedTimer(openedAt);

    const openedMs = new Date(openedAt || '').getTime();
    if (!Number.isFinite(openedMs)) return { text: '00:00', minutes: 0 };

    const elapsed = Math.max(0, Math.floor((Date.now() - openedMs) / 1000));
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;

    return {
      text: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`,
      minutes: mins
    };
  }

  function updateTimersVisualOnly() {
    document.querySelectorAll('.timer-display').forEach(el => {
      const timer = getElapsedTimerSafe(el.dataset.opened);

      el.textContent = timer.text;
      el.classList.remove('timer-yellow', 'timer-red', 'timer-flash');

      if (timer.minutes >= 60) {
        el.classList.add('timer-flash');
      } else if (timer.minutes >= 50) {
        el.classList.add('timer-red');
      } else if (timer.minutes >= 40) {
        el.classList.add('timer-yellow');
      }
    });
  }

  async function markDormOvertimeSent(dorm) {
    if (!dorm || dorm.overtime_sound_sent === 'true') return null;
    if (!window.dataSdk || typeof window.dataSdk.update !== 'function') return null;

    return window.dataSdk.update({
      ...dorm,
      overtime_sound_sent: 'true',
      overtime_sound_at: dorm.overtime_sound_at || new Date().toISOString()
    });
  }

  async function triggerOvertimeSoundOnce(dormId) {
    if (!dormId || localOvertimeInProgress.has(dormId)) return;

    const dorm = getDormRecordsSafe().find(record => record.__backendId === dormId);
    if (!dorm || dorm.state !== 'open') return;

    localOvertimeInProgress.add(dormId);

    try {
      if (hasOvertimeSoundEvent(dormId)) {
        await markDormOvertimeSent(dorm);
        return;
      }

      const result = await markDormOvertimeSent(dorm);
      if (!result || !result.isOk) return;

      if (!hasOvertimeSoundEvent(dormId) && typeof createSoundEvent === 'function') {
        await createSoundEvent('overtime', {
          dorm_id: dormId,
          dorm_name: dorm.dorm_name || '',
          action: 'timer_overtime'
        });
      }
    } finally {
      localOvertimeInProgress.delete(dormId);
    }
  }

  async function auditOpenDormsForOvertime() {
    if (auditInProgress || !window.dataSdk || typeof window.dataSdk.update !== 'function') return;

    auditInProgress = true;

    try {
      const activeWeekGroup = getActiveWeekGroupSafe();
      if (!activeWeekGroup) return;

      const now = Date.now();
      const openDorms = getDormRecordsSafe().filter(dorm => {
        if (!dorm || dorm.week_group !== activeWeekGroup) return false;
        if (dorm.state !== 'open' || !dorm.opened_at) return false;

        const openedMs = new Date(dorm.opened_at).getTime();
        return Number.isFinite(openedMs) && now - openedMs >= OVERTIME_THRESHOLD_MS;
      });

      for (const dorm of openDorms) {
        if (dorm.overtime_sound_sent === 'true' && hasOvertimeSoundEvent(dorm.__backendId)) continue;
        await triggerOvertimeSoundOnce(dorm.__backendId);
      }
    } finally {
      auditInProgress = false;
    }
  }

  function processSoundEventsDeduped() {
    const activeWeekGroup = getActiveWeekGroupSafe();
    const overtimeDormsSeen = new Set();

    const events = getSoundEventRecordsSafe()
      .filter(event => event.week_group === activeWeekGroup)
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

    for (const event of events) {
      const id = event.__backendId;
      if (!id) continue;

      const overtimeDormId = getOvertimeDormIdFromEvent(event);
      const isDuplicateOvertime = overtimeDormId && overtimeDormsSeen.has(overtimeDormId);
      if (overtimeDormId) overtimeDormsSeen.add(overtimeDormId);

      if (playedSoundEventIds.has(id)) continue;

      const eventTime = new Date(event.created_at || '').getTime();
      if (!Number.isFinite(eventTime) || eventTime < soundEventBaseline || isDuplicateOvertime) {
        playedSoundEventIds.add(id);
        continue;
      }

      playOperationalSound(event.sound_key);
      playedSoundEventIds.add(id);
    }

    if (typeof savePlayedSoundEventIds === 'function') savePlayedSoundEventIds();
  }

  function patchTimerAndOvertimeFunctions() {
    try {
      ensureTimerPillSpacingStyles();

      window.updateTimers = updateTimersVisualOnly;
      try { updateTimers = updateTimersVisualOnly; } catch (_) {}

      window.triggerOvertimeSoundIfNeeded = triggerOvertimeSoundOnce;
      try { triggerOvertimeSoundIfNeeded = triggerOvertimeSoundOnce; } catch (_) {}

      window.processSoundEvents = processSoundEventsDeduped;
      try { processSoundEvents = processSoundEventsDeduped; } catch (_) {}

      try {
        if (typeof timerInterval !== 'undefined' && timerInterval) {
          clearInterval(timerInterval);
          timerInterval = setInterval(updateTimersVisualOnly, 1000);
        }
      } catch (_) {}

      updateTimersVisualOnly();
    } catch (error) {
      console.warn('PRC GATE overtime timer patch failed:', error);
    }
  }

  function startPatch() {
    if (patchStarted) return;
    patchStarted = true;

    patchTimerAndOvertimeFunctions();
    auditOpenDormsForOvertime();

    if (!auditInterval) {
      auditInterval = setInterval(() => {
        patchTimerAndOvertimeFunctions();
        auditOpenDormsForOvertime();
      }, 1000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPatch);
  } else {
    startPatch();
  }
})();
