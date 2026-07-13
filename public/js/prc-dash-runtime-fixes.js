// GATE Phase 8E Runtime Safeguards
// Non-owning safeguards for sound unlock, modal Escape handling, and Processing load-input constraints.
(function () {
  'use strict';

  const QUIET_UNLOCK_SOUND_FILES = Object.freeze({
    dorm_open: '/assets/sr_open_sound.mp3',
    dorm_closed: '/assets/sr_closed_sound.mp3',
    bus_dispatch: '/assets/sr_bus_sound.mp3',
    overtime: '/assets/sr_overtime_sound.mp3'
  });
  const SOUND_ENABLED_KEY = 'prc_sr_sound_enabled_v1';

  let soundUnlockedThisPage = false;
  let soundUnlockInProgress = false;
  let escapePatched = false;
  let loadGuardPatched = false;
  let hooksRegistered = false;

  function safeUpdateSoundButton() {
    try {
      if (typeof updateSoundButton === 'function') updateSoundButton();
    } catch (error) {
      console.warn('GATE sound button update failed:', error);
    }
  }

  async function enableOperationalSoundsQuietly() {
    if (soundUnlockInProgress) return;
    if (soundUnlockedThisPage) {
      safeUpdateSoundButton();
      return;
    }

    soundUnlockInProgress = true;
    try {
      soundEnabled = true;
      soundEventBaseline = Date.now();
      localStorage.setItem(SOUND_ENABLED_KEY, 'true');
      safeUpdateSoundButton();

      if (!soundPlayers || typeof soundPlayers !== 'object') soundPlayers = {};
      for (const [soundKey, src] of Object.entries(QUIET_UNLOCK_SOUND_FILES)) {
        let audio = soundPlayers[soundKey];
        if (!audio) {
          audio = new Audio(src);
          audio.preload = 'auto';
          soundPlayers[soundKey] = audio;
        }
        try {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = true;
          audio.volume = 0;
          audio.load();
          await audio.play();
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
          audio.volume = 1;
        } catch (error) {
          audio.muted = false;
          audio.volume = 1;
          console.warn(`Quiet sound unlock failed for ${soundKey}:`, error);
        }
      }
      soundUnlockedThisPage = true;
    } finally {
      soundUnlockInProgress = false;
      safeUpdateSoundButton();
    }
  }

  function patchSoundButton() {
    try {
      window.enableOperationalSounds = enableOperationalSoundsQuietly;
      const button = document.getElementById('sound-toggle-btn');
      if (button) {
        button.onclick = enableOperationalSoundsQuietly;
        button.dataset.owner = 'gate-runtime-safeguards';
      }
      safeUpdateSoundButton();
    } catch (error) {
      console.warn('GATE sound button safeguard failed:', error);
    }
  }

  function modalDormRecord() {
    try {
      if (typeof modalDormId === 'undefined' || !modalDormId || !Array.isArray(allData)) return null;
      return allData.find(record => record?.type === 'dorm' && record.__backendId === modalDormId) || null;
    } catch (_) {
      return null;
    }
  }

  function maxDormLoad(dorm) {
    const parsed = Number(dorm?.max_load || 0);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
  }

  function constrainLoadInput() {
    const input = document.getElementById('modal-load-input');
    const dorm = modalDormRecord();
    if (!input || !dorm) return;

    const maximum = maxDormLoad(dorm);
    input.min = '0';
    input.max = String(maximum);
    const maxLabel = document.getElementById('modal-load-max');
    if (maxLabel) maxLabel.textContent = `/ ${maximum}`;

    if (input.value === '') return;
    const parsed = Number.parseInt(input.value, 10);
    const normalized = Number.isFinite(parsed) ? parsed : 0;
    input.value = String(Math.min(maximum, Math.max(0, normalized)));
  }

  function patchLoadConstraintGuard() {
    const input = document.getElementById('modal-load-input');
    if (input && input.dataset.gateLoadConstraintGuard !== 'true') {
      input.dataset.gateLoadConstraintGuard = 'true';
      input.dataset.constraintOwner = 'gate-runtime-safeguards';
      input.addEventListener('input', constrainLoadInput);
      input.addEventListener('blur', constrainLoadInput);
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') window.setTimeout(constrainLoadInput, 0);
      });
    }
    constrainLoadInput();
  }

  function installLoadButtonGuard() {
    if (loadGuardPatched) return;
    loadGuardPatched = true;
    document.addEventListener('click', event => {
      if (!event.target?.closest?.('#modal-load-section button, #dorm-modal [data-processing-action]')) return;
      window.setTimeout(constrainLoadInput, 0);
    }, true);
  }

  function setModalEscapeCloseBehavior() {
    if (escapePatched || document.body.dataset.gateEscapeClosePatched === 'true') return;
    escapePatched = true;
    document.body.dataset.gateEscapeClosePatched = 'true';

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const modalClosers = [
        ['dorm-modal', 'closeDormModal'],
        ['dorm-edit-modal', 'closeDormEditModal'],
        ['local-bus-modal', 'closeLocalBusModal'],
        ['airport-bus-edit-modal', 'closeAirportBusEditModal'],
        ['archive-edit-modal', 'closeArchiveEditModal']
      ];

      for (const [modalId, closerName] of modalClosers) {
        const modal = document.getElementById(modalId);
        if (modal && !modal.classList.contains('hidden') && typeof window[closerName] === 'function') {
          event.preventDefault();
          window[closerName]();
          return;
        }
      }

      const confirmDialog = document.getElementById('confirm-dialog');
      const confirmNo = document.getElementById('confirm-no');
      if (confirmDialog && !confirmDialog.classList.contains('hidden') && confirmNo) {
        event.preventDefault();
        confirmNo.click();
      }
    });
  }

  function runSafeguardPass() {
    patchSoundButton();
    patchLoadConstraintGuard();
    installLoadButtonGuard();
    setModalEscapeCloseBehavior();
  }

  function registerHooksOnce() {
    if (hooksRegistered || typeof window.registerGateHook !== 'function') return;
    window.registerGateHook('afterRenderAll', runSafeguardPass);
    window.registerGateHook('afterPageChange', runSafeguardPass);
    window.registerGateHook('afterDataChanged', runSafeguardPass);
    window.registerGateHook('afterModalOpen', runSafeguardPass);
    hooksRegistered = true;
  }

  function start() {
    runSafeguardPass();
    registerHooksOnce();
    window.GateRuntimeStabilityController = Object.freeze({
      isCanonicalOwner: false,
      isSafeguardOnly: true,
      ownsProcessingLoadFunctions: false,
      ownsInputTabFlow: false,
      refresh: runSafeguardPass,
      enableOperationalSounds: enableOperationalSoundsQuietly,
      constrainLoadInput
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
