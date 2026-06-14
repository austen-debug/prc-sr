// PRC DASH instructor closed-dorm reopen fail-safe
// Safe runtime patch. Does not touch navigation or page routing.
(function () {
  var patchStarted = false;

  function isInstructor() {
    try {
      return typeof currentRole === 'undefined' || currentRole === 'instructor';
    } catch (error) {
      return false;
    }
  }

  function parseTimerToSeconds(value) {
    var raw = String(value || '').trim();
    var match = raw.match(/^(\d{1,5})(?::([0-5]\d))?$/);
    if (!match) return 0;

    var minutes = Number(match[1] || 0);
    var seconds = Number(match[2] || 0);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0;

    return Math.max(0, (minutes * 60) + seconds);
  }

  function getEditDormId() {
    try {
      return typeof editDormId === 'undefined' ? null : editDormId;
    } catch (error) {
      return null;
    }
  }

  function getEditDorm() {
    var id = getEditDormId();
    if (!id) return null;

    try {
      if (typeof allData === 'undefined' || !Array.isArray(allData)) return null;
      return allData.find(function (record) {
        return record && record.__backendId === id && record.type === 'dorm';
      }) || null;
    } catch (error) {
      return null;
    }
  }

  function showEditMessage(message, isError) {
    var msg = document.getElementById('dorm-edit-msg');
    if (!msg) return;

    msg.textContent = message;
    msg.style.color = isError ? 'var(--red)' : 'var(--green)';
    msg.classList.remove('hidden');
  }

  function getFinalTimeValue(dorm) {
    var input = document.getElementById('edit-closed-timer');
    return (input && input.value) || (dorm && dorm.closed_timer) || '00:00';
  }

  function ensureStyles() {
    if (document.getElementById('prc-dorm-reopen-styles')) return;

    var style = document.createElement('style');
    style.id = 'prc-dorm-reopen-styles';
    style.textContent = '' +
      '#dorm-edit-form .prc-dorm-edit-actions{display:flex!important;flex-wrap:wrap!important;gap:.5rem!important;justify-content:flex-end!important;align-items:center!important;}' +
      '#dorm-edit-form .prc-dorm-edit-actions>button{box-sizing:border-box!important;min-width:88px!important;width:88px!important;min-height:36px!important;padding:.5rem .65rem!important;border-radius:.65rem!important;font-size:.72rem!important;font-weight:900!important;letter-spacing:.065em!important;line-height:1!important;text-align:center!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;}' +
      '#reopen-dorm-btn{background:linear-gradient(135deg,rgba(37,99,235,.94),rgba(56,189,248,.84))!important;color:#fff!important;border:1px solid rgba(125,211,252,.52)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 8px 18px rgba(2,132,199,.16)!important;}' +
      '#reopen-dorm-btn:hover{border-color:rgba(186,230,253,.82)!important;}' +
      '#reopen-dorm-btn.hidden{display:none!important;}';

    document.head.appendChild(style);
  }

  function findFooter(form, saveButton) {
    var node = saveButton ? saveButton.parentElement : null;
    while (node && node !== form) {
      if (node.classList && node.classList.contains('flex')) return node;
      node = node.parentElement;
    }
    return saveButton ? saveButton.parentElement : null;
  }

  function ensureReopenButton() {
    try {
      ensureStyles();

      var form = document.getElementById('dorm-edit-form');
      if (!form) return;

      var saveButton = form.querySelector('button[type="submit"]');
      if (!saveButton) return;

      var footer = findFooter(form, saveButton);
      if (!footer) return;

      footer.classList.add('prc-dorm-edit-actions');

      var cancelButton = footer.querySelector('button[onclick*="closeDormEditModal"]');
      var deleteButton = footer.querySelector('button[onclick*="deleteDormitoryFromEditModal"]');
      var buttons = [cancelButton, deleteButton, saveButton];
      buttons.forEach(function (button) {
        if (button) {
          button.style.minWidth = '88px';
          button.style.width = '88px';
          button.style.minHeight = '36px';
        }
      });

      var reopenButton = document.getElementById('reopen-dorm-btn');
      if (!reopenButton) {
        reopenButton = document.createElement('button');
        reopenButton.id = 'reopen-dorm-btn';
        reopenButton.type = 'button';
        reopenButton.textContent = 'REOPEN';
        reopenButton.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          reopenDormFromEditModal();
        });

        if (deleteButton) footer.insertBefore(reopenButton, deleteButton);
        else footer.insertBefore(reopenButton, saveButton);
      }

      var dorm = getEditDorm();
      var isClosed = dorm && String(dorm.state || '').toLowerCase() === 'closed';
      reopenButton.classList.toggle('hidden', !isClosed);
      reopenButton.disabled = !isClosed;
    } catch (error) {
      console.warn('PRC DASH reopen button patch failed:', error);
    }
  }

  async function reopenDormFromEditModal() {
    try {
      if (!isInstructor()) return;

      var dorm = getEditDorm();
      if (!dorm) return;

      if (String(dorm.state || '').toLowerCase() !== 'closed') {
        showEditMessage('Only closed dorms can be reopened.', true);
        return;
      }

      var elapsedSeconds = parseTimerToSeconds(getFinalTimeValue(dorm));
      var reopenedOpenedAt = new Date(Date.now() - (elapsedSeconds * 1000)).toISOString();

      var result = await window.dataSdk.update(Object.assign({}, dorm, {
        state: 'open',
        phase: 'OPEN',
        opened_at: reopenedOpenedAt,
        closed_at: '',
        closed_timer: '',
        manual_reopen_override: 'true',
        updated_at: new Date().toISOString()
      }));

      if (result && result.isOk) {
        try {
          if (typeof allData !== 'undefined' && Array.isArray(allData)) {
            var index = allData.findIndex(function (record) { return record.__backendId === dorm.__backendId; });
            if (index >= 0) {
              allData[index] = Object.assign({}, allData[index], result.data || {}, {
                state: 'open',
                phase: 'OPEN',
                opened_at: reopenedOpenedAt,
                closed_at: '',
                closed_timer: '',
                manual_reopen_override: undefined
              });
            }
          }
        } catch (error) {
          console.warn('PRC DASH reopen local update failed:', error);
        }

        if (typeof createSoundEvent === 'function') {
          await createSoundEvent('dorm_open', {
            dorm_id: dorm.__backendId,
            dorm_name: dorm.dorm_name || '',
            action: 'reopen_dorm'
          });
        }

        if (typeof renderAll === 'function') renderAll();
        if (typeof closeDormEditModal === 'function') closeDormEditModal();
      } else {
        showEditMessage((result && result.error) || 'Failed to reopen dorm.', true);
      }
    } catch (error) {
      console.warn('PRC DASH reopen dorm failed:', error);
      showEditMessage('Failed to reopen dorm.', true);
    }
  }

  function startPatch() {
    if (patchStarted) return;
    patchStarted = true;

    window.reopenDormFromEditModal = reopenDormFromEditModal;
    ensureReopenButton();

    setInterval(ensureReopenButton, 750);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPatch);
  } else {
    startPatch();
  }
})();

// PRC GATE operational sound system
// Normalizes all app sound calls onto the current GATE audio assets.
(function () {
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
    try {
      if (typeof soundEnabled !== 'undefined') return soundEnabled === true;
    } catch (_) {}
    return localStorage.getItem(SOUND_ENABLED_KEY) === 'true';
  }

  function syncSoundEnabled(value) {
    try { soundEnabled = value; } catch (_) {}
    localStorage.setItem(SOUND_ENABLED_KEY, value ? 'true' : 'false');
  }

  function preloadGateSounds() {
    try {
      if (typeof soundPlayers === 'undefined' || !soundPlayers || typeof soundPlayers !== 'object') soundPlayers = {};
      Object.entries(GATE_SOUND_FILES).forEach(function ([key, src]) {
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
        result.catch(function (error) {
          console.warn(`GATE sound playback blocked or failed for ${normalized}:`, error);
        });
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

    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.target && mutation.target.nodeType === 1) signalErrorFromElement(mutation.target);
        mutation.addedNodes.forEach(function (node) {
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

    window.addEventListener('error', function () { playGateErrorSound(); });
    window.addEventListener('unhandledrejection', function () { playGateErrorSound(); });
  }

  function startGateSoundSystem() {
    patchSoundFunctions();
    patchMessageFunctions();
    patchGlobalErrorSounds();
    startErrorObserver();
    preloadGateSounds();

    setInterval(function () {
      patchSoundFunctions();
      patchMessageFunctions();
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startGateSoundSystem);
  } else {
    startGateSoundSystem();
  }
})();