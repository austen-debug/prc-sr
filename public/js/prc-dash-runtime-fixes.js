// GATE runtime stability controller
// One-time runtime safeguards for sound unlock, modal load controls, escape handling, and batch-grid tab flow.
(function () {
  'use strict';

  const QUIET_UNLOCK_SOUND_FILES = {
    dorm_open: '/assets/sr_open_sound.mp3',
    dorm_closed: '/assets/sr_closed_sound.mp3',
    bus_dispatch: '/assets/sr_bus_sound.mp3',
    overtime: '/assets/sr_overtime_sound.mp3'
  };

  const SOUND_ENABLED_KEY = 'prc_sr_sound_enabled_v1';

  let soundUnlockedThisPage = false;
  let soundUnlockInProgress = false;
  let escapePatched = false;
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
      const btn = document.getElementById('sound-toggle-btn');
      if (btn) {
        btn.onclick = enableOperationalSoundsQuietly;
        btn.dataset.owner = 'gate-runtime-stability-controller';
      }
      safeUpdateSoundButton();
    } catch (error) {
      console.warn('GATE sound button patch failed:', error);
    }
  }

  function getModalDormRecord() {
    try {
      if (typeof modalDormId === 'undefined' || !modalDormId || !Array.isArray(allData)) return null;
      return allData.find(record => record.__backendId === modalDormId && record.type === 'dorm') || null;
    } catch (_) {
      return null;
    }
  }

  function getDormMaxLoad(dorm) {
    const maxLoad = Number(dorm?.max_load || 0);
    return Number.isFinite(maxLoad) ? Math.max(0, Math.floor(maxLoad)) : 0;
  }

  function clampDormLoad(value, dorm) {
    const maxLoad = getDormMaxLoad(dorm);
    const parsed = Number.parseInt(value, 10);
    const normalized = Number.isFinite(parsed) ? parsed : 0;
    return Math.min(maxLoad, Math.max(0, normalized));
  }

  function syncModalLoadInputLimit() {
    try {
      const input = document.getElementById('modal-load-input');
      const maxLabel = document.getElementById('modal-load-max');
      const dorm = getModalDormRecord();
      if (!input || !dorm) return;

      const maxLoad = getDormMaxLoad(dorm);
      input.min = '0';
      input.max = String(maxLoad);
      if (maxLabel) maxLabel.textContent = `/ ${maxLoad}`;

      if (input.value !== '' && Number(input.value) > maxLoad) input.value = String(maxLoad);
      if (input.value !== '' && Number(input.value) < 0) input.value = '0';
    } catch (error) {
      console.warn('GATE load input limit sync failed:', error);
    }
  }

  function modLoadCapped(delta) {
    const input = document.getElementById('modal-load-input');
    const dorm = getModalDormRecord();
    if (!input || !dorm) return;

    const current = Number.parseInt(input.value, 10) || 0;
    input.value = String(clampDormLoad(current + Number(delta || 0), dorm));
  }

  function setLoadFullCapped() {
    const input = document.getElementById('modal-load-input');
    const dorm = getModalDormRecord();
    if (!input || !dorm) return;
    input.value = String(getDormMaxLoad(dorm));
  }

  async function saveLoadCapped() {
    if (typeof modalDormId === 'undefined' || !modalDormId) return;

    const dorm = getModalDormRecord();
    const input = document.getElementById('modal-load-input');
    if (!dorm || !input) return;

    const cappedLoad = clampDormLoad(input.value, dorm);
    input.value = String(cappedLoad);

    const result = await window.dataSdk.update({
      ...dorm,
      current_load: cappedLoad
    });

    if (result && result.isOk) {
      if (typeof closeDormModal === 'function') closeDormModal();
    } else {
      console.warn('GATE save load failed:', result);
    }
  }

  function patchDormLoadControls() {
    try {
      window.modLoad = modLoadCapped;
      window.setLoadFull = setLoadFullCapped;
      window.saveLoad = saveLoadCapped;
      try { modLoad = modLoadCapped; } catch (_) {}
      try { setLoadFull = setLoadFullCapped; } catch (_) {}
      try { saveLoad = saveLoadCapped; } catch (_) {}

      const input = document.getElementById('modal-load-input');
      if (input && input.dataset.gateLoadCapPatched !== 'true') {
        input.dataset.gateLoadCapPatched = 'true';
        input.dataset.owner = 'gate-runtime-stability-controller';
        input.addEventListener('input', syncModalLoadInputLimit);
        input.addEventListener('blur', () => {
          const dorm = getModalDormRecord();
          if (dorm) input.value = String(clampDormLoad(input.value, dorm));
        });
        input.addEventListener('keydown', event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            saveLoadCapped();
          }
        });
      }

      syncModalLoadInputLimit();
    } catch (error) {
      console.warn('GATE dorm load control patch failed:', error);
    }
  }

  function setModalEscapeCloseBehavior() {
    try {
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
    } catch (error) {
      console.warn('GATE escape close patch failed:', error);
    }
  }

  function patchHorizontalBatchTabFlow() {
    try {
      const container = document.getElementById('batch-rows-container');
      if (!container) return;

      const fieldClasses = [
        'batch-sdq',
        'batch-sec',
        'batch-inter',
        'batch-dorm',
        'batch-sex',
        'batch-band',
        'batch-space-force',
        'batch-load'
      ];

      for (let row = 0; row < 25; row += 1) {
        fieldClasses.forEach((className, col) => {
          const field = container.querySelector(`.${className}[data-row="${row}"]`);
          if (field) field.tabIndex = (row * fieldClasses.length) + col + 1;
        });
      }

      container.querySelectorAll('button[onclick^="clearBatchRow"]').forEach(button => {
        button.tabIndex = -1;
      });

      if (container.dataset.gateTabFlowPatched === 'true') return;
      container.dataset.gateTabFlowPatched = 'true';
      container.dataset.owner = 'gate-runtime-stability-controller';

      container.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;

        const active = document.activeElement;
        if (!active || !active.dataset || typeof active.dataset.row === 'undefined') return;

        const ordered = [];
        for (let row = 0; row < 25; row += 1) {
          fieldClasses.forEach(className => {
            const field = container.querySelector(`.${className}[data-row="${row}"]`);
            if (field) ordered.push(field);
          });
        }

        const index = ordered.indexOf(active);
        if (index === -1) return;

        const next = ordered[event.shiftKey ? index - 1 : index + 1];
        if (next) {
          event.preventDefault();
          next.focus();
          if (typeof next.select === 'function' && next.tagName !== 'SELECT') next.select();
        }
      });
    } catch (error) {
      console.warn('GATE horizontal tab flow patch failed:', error);
    }
  }

  function runRuntimeStabilityPass() {
    patchSoundButton();
    patchDormLoadControls();
    patchHorizontalBatchTabFlow();
    setModalEscapeCloseBehavior();
  }

  function registerHooksOnce() {
    if (hooksRegistered || typeof window.registerGateHook !== 'function') return;
    window.registerGateHook('afterRenderAll', runRuntimeStabilityPass);
    window.registerGateHook('afterPageChange', runRuntimeStabilityPass);
    window.registerGateHook('afterDataChanged', runRuntimeStabilityPass);
    window.registerGateHook('afterModalOpen', runRuntimeStabilityPass);
    hooksRegistered = true;
  }

  function startRuntimeStabilityController() {
    runRuntimeStabilityPass();
    registerHooksOnce();

    window.GateRuntimeStabilityController = Object.freeze({
      isCanonicalOwner: true,
      refresh: runRuntimeStabilityPass,
      enableOperationalSounds: enableOperationalSoundsQuietly,
      syncModalLoadInputLimit
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startRuntimeStabilityController, { once: true });
  } else {
    startRuntimeStabilityController();
  }

  window.addEventListener('load', startRuntimeStabilityController, { once: true });
})();
