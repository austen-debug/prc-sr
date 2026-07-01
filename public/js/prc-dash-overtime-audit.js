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

  function getDormRecordsSafe() {
    try { return typeof getRecords === 'function' ? getRecords('dorm') : []; } catch (_) { return []; }
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

  async function triggerOvertimeSoundOnce(dormId) {
    if (!dormId || localOvertimeInProgress.has(dormId)) return;

    const dorm = getDormRecordsSafe().find(record => record.__backendId === dormId);
    if (!dorm || dorm.state !== 'open' || dorm.overtime_sound_sent === 'true') return;

    localOvertimeInProgress.add(dormId);

    try {
      const result = await window.dataSdk.update({
        ...dorm,
        overtime_sound_sent: 'true',
        overtime_sound_at: new Date().toISOString()
      });

      if (result && result.isOk && result.overtime_sound_transitioned === true) {
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
    if (typeof createSoundEvent !== 'function') return;

    auditInProgress = true;

    try {
      const activeWeekGroup = getActiveWeekGroupSafe();
      if (!activeWeekGroup) return;

      const now = Date.now();
      const openDorms = getDormRecordsSafe().filter(dorm => {
        if (!dorm || dorm.week_group !== activeWeekGroup) return false;
        if (dorm.state !== 'open' || dorm.overtime_sound_sent === 'true' || !dorm.opened_at) return false;

        const openedMs = new Date(dorm.opened_at).getTime();
        return Number.isFinite(openedMs) && now - openedMs >= OVERTIME_THRESHOLD_MS;
      });

      for (const dorm of openDorms) {
        await triggerOvertimeSoundOnce(dorm.__backendId);
      }
    } finally {
      auditInProgress = false;
    }
  }

  function patchTimerAndOvertimeFunctions() {
    try {
      window.updateTimers = updateTimersVisualOnly;
      try { updateTimers = updateTimersVisualOnly; } catch (_) {}

      window.triggerOvertimeSoundIfNeeded = triggerOvertimeSoundOnce;
      try { triggerOvertimeSoundIfNeeded = triggerOvertimeSoundOnce; } catch (_) {}

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
