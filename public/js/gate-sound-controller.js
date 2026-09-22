// GATE operational sound controller
// Canonical owner for operational sound assets, sound enablement, error cues, and sound-event creation.
(function () {
  'use strict';

  const GATE_SOUND_FILES = {
    dorm_open: '/assets/gate_open_sound.mp3',
    open: '/assets/gate_open_sound.mp3',
    dorm_closed: '/assets/gate_closed_sound.mp3',
    closed: '/assets/gate_closed_sound.mp3',
    bus_dispatch: '/assets/gate_bus_sound.mp3',
    bus: '/assets/gate_bus_sound.mp3',
    overtime: '/assets/gate_overtime_sound.mp3',
    error: '/assets/gate_error_sound.mp3',
    enable: '/assets/gate_enable_sound.mp3'
  };

  const SOUND_ENABLED_KEY = 'prc_sr_sound_enabled_v1';
  const ERROR_TEXT_PATTERN = /(failed|failure|error|required|cannot|must|invalid|unable|unavailable|record limit|limit reached|no active|initialize|select a time|closeout cancelled)/i;
  const recentErrorSignals = new Map();
  let observerStarted = false;
  let clickPatchReady = false;
  let hooksRegistered = false;

  function normalizeSoundKey(soundKey) {
    const key = String(soundKey || '').trim().toLowerCase();
    if (key === 'dorm_close' || key === 'close_dorm') return 'dorm_closed';
    if (key === 'dorm_opened' || key === 'open_dorm' || key === 'reopen_dorm') return 'dorm_open';
    if (key === 'bus_arrival' || key === 'bus_arrived' || key === 'dispatch_bus') return 'bus_dispatch';
    if (key === 'gate_error') return 'error';
    if (key === 'gate_enable') return 'enable';
    return key;
  }

  function soundIsEnabled() {
    try { if (typeof soundEnabled !== 'undefined') return soundEnabled === true; } catch (_) {}
    return localStorage.getItem(SOUND_ENABLED_KEY) === 'true';
  }

  function syncSoundEnabled(value) {
    try { soundEnabled = value; } catch (_) {}
    localStorage.setItem(SOUND_ENABLED_KEY, value ? 'true' : 'false');
  }

  function preloadGateSounds() {
    try {
      if (typeof soundPlayers === 'undefined' || !soundPlayers || typeof soundPlayers !== 'object') soundPlayers = {};
      Object.entries(GATE_SOUND_FILES).forEach(([key, src]) => {
        if (!soundPlayers[key]) {
          const audio = new Audio(src);
          audio.preload = 'auto';
          audio.volume = 1;
          audio.load();
          soundPlayers[key] = audio;
        }
      });
    } catch (error) {
      console.warn('GATE sound preload failed:', error);
    }
  }

  function playGateSound(soundKey, options) {
    const normalized = normalizeSoundKey(soundKey);
    const src = GATE_SOUND_FILES[normalized];
    const force = Boolean(options && options.force);
    if (!src || (!force && !soundIsEnabled())) return;

    try {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.volume = 1;
      audio.loop = false;
      audio.currentTime = 0;
      const result = audio.play();
      if (result && typeof result.catch === 'function') {
        result.catch(error => console.warn(`GATE sound playback blocked or failed for ${normalized}:`, error));
      }
    } catch (error) {
      console.warn(`GATE sound playback failed for ${normalized}:`, error);
    }
  }

  function playGateErrorSound() {
    playGateSound('error');
  }

  async function enableGateOperationalSounds(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }

    syncSoundEnabled(true);
    try { soundEventBaseline = Date.now(); } catch (_) {}
    preloadGateSounds();

    if (typeof updateSoundButton === 'function') {
      try { updateSoundButton(); } catch (error) { console.warn('GATE sound button update failed:', error); }
    }

    playGateSound('enable', { force: true });
  }

  async function createGateSoundEvent(soundKey, details) {
    const normalized = normalizeSoundKey(soundKey);
    if (!GATE_SOUND_FILES[normalized]) return;

    try {
      if (typeof allData !== 'undefined' && Array.isArray(allData) && allData.length >= 990) {
        console.warn('GATE sound event skipped because record count is near the app limit.');
        return;
      }

      if (!window.dataSdk || typeof window.dataSdk.create !== 'function') return;
      await window.dataSdk.create({
        type: 'sound_event',
        sound_key: normalized,
        week_group: typeof getActiveWG === 'function' ? getActiveWG() : '',
        created_at: new Date().toISOString(),
        details: JSON.stringify(details || {})
      });
    } catch (error) {
      console.warn(`GATE sound event create failed for ${normalized}:`, error);
    }
  }

  function patchSoundFunctions() {
    try {
      window.playOperationalSound = playGateSound;
      window.enableOperationalSounds = enableGateOperationalSounds;
      window.createSoundEvent = createGateSoundEvent;
      window.playGateErrorSound = playGateErrorSound;
      window.playGateSound = playGateSound;

      try { playOperationalSound = playGateSound; } catch (_) {}
      try { enableOperationalSounds = enableGateOperationalSounds; } catch (_) {}
      try { createSoundEvent = createGateSoundEvent; } catch (_) {}

      const button = document.getElementById('sound-toggle-btn');
      if (button) {
        button.onclick = enableGateOperationalSounds;
        button.dataset.owner = 'gate-sound-system';
        if (!clickPatchReady) {
          button.addEventListener('click', enableGateOperationalSounds, true);
          clickPatchReady = true;
        }
      }
    } catch (error) {
      console.warn('GATE sound function patch failed:', error);
    }
  }

  function patchMessageFunctions() {
    try {
      if (typeof showMsg === 'function' && showMsg.__gateSoundPatched !== true) {
        const originalShowMsg = showMsg;
        const patchedShowMsg = function patchedShowMsg(elId, msg, isErr) {
          if (isErr) playGateErrorSound();
          return originalShowMsg.apply(this, arguments);
        };
        patchedShowMsg.__gateSoundPatched = true;
        window.showMsg = patchedShowMsg;
        try { showMsg = patchedShowMsg; } catch (_) {}
      }

      if (typeof showBatchMsg === 'function' && showBatchMsg.__gateSoundPatched !== true) {
        const originalShowBatchMsg = showBatchMsg;
        const patchedShowBatchMsg = function patchedShowBatchMsg(msg, isErr) {
          if (isErr) playGateErrorSound();
          return originalShowBatchMsg.apply(this, arguments);
        };
        patchedShowBatchMsg.__gateSoundPatched = true;
        window.showBatchMsg = patchedShowBatchMsg;
        try { showBatchMsg = patchedShowBatchMsg; } catch (_) {}
      }
    } catch (error) {
      console.warn('GATE error message sound patch failed:', error);
    }
  }

  function elementIsVisible(el) {
    if (!el || el.classList.contains('hidden')) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function elementLooksLikeError(el) {
    if (!el || !elementIsVisible(el)) return false;
    const text = String(el.textContent || '').trim();
    if (!text || !ERROR_TEXT_PATTERN.test(text)) return false;

    const id = String(el.id || '').toLowerCase();
    const className = String(el.className || '').toLowerCase();
    const styleColor = String(el.style && el.style.color || '').toLowerCase();

    return id.includes('error') || id.includes('msg') || id.includes('status') ||
      className.includes('text-red') || styleColor.includes('red') || styleColor.includes('var(--red)');
  }

  function signalErrorFromElement(el) {
    if (!elementLooksLikeError(el)) return;

    const text = String(el.textContent || '').trim();
    const key = `${el.id || el.className || el.tagName}:${text}`;
    const now = Date.now();
    const last = recentErrorSignals.get(key) || 0;
    if (now - last < 1800) return;

    recentErrorSignals.set(key, now);
    playGateErrorSound();
  }

  function scanVisibleErrors(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('.text-red-500, [id$="-error"], [id$="-msg"], #init-status-msg, #closeout-safety-msg').forEach(signalErrorFromElement);
  }

  function startErrorObserver() {
    if (observerStarted || !document.body || typeof MutationObserver === 'undefined') return;
    observerStarted = true;

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.target && mutation.target.nodeType === 1) signalErrorFromElement(mutation.target);
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          signalErrorFromElement(node);
          scanVisibleErrors(node);
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
      characterData: true
    });

    scanVisibleErrors(document);
  }

  function patchGlobalErrorSounds() {
    if (window.__gateGlobalErrorSoundPatched === true) return;
    window.__gateGlobalErrorSoundPatched = true;
    window.addEventListener('error', () => playGateErrorSound());
    window.addEventListener('unhandledrejection', () => playGateErrorSound());
  }

  function registerHooksOnce() {
    if (hooksRegistered || typeof window.registerGateHook !== 'function') return;
    window.registerGateHook('afterRenderAll', patchSoundFunctions);
    window.registerGateHook('afterPageChange', patchSoundFunctions);
    window.registerGateHook('afterDataChanged', patchSoundFunctions);
    window.registerGateHook('afterModalOpen', patchSoundFunctions);
    hooksRegistered = true;
  }

  function startGateSoundSystem() {
    patchSoundFunctions();
    patchMessageFunctions();
    patchGlobalErrorSounds();
    startErrorObserver();
    preloadGateSounds();
    registerHooksOnce();

    window.GateSoundSystem = Object.freeze({
      isCanonicalSoundAssetLayer: true,
      play: playGateSound,
      enable: enableGateOperationalSounds,
      createSoundEvent: createGateSoundEvent,
      refresh: patchSoundFunctions
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGateSoundSystem, { once: true });
  } else {
    startGateSoundSystem();
  }

  window.addEventListener('load', startGateSoundSystem, { once: true });
})();
