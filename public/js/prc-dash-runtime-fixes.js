// PRC DASH runtime fixes
// Keeps this patch small and isolated from the main app logic.
(function () {
  const QUIET_UNLOCK_SOUND_FILES = {
    dorm_open: '/assets/sr_open_sound.mp3',
    dorm_closed: '/assets/sr_closed_sound.mp3',
    bus_dispatch: '/assets/sr_bus_sound.mp3',
    overtime: '/assets/sr_overtime_sound.mp3'
  };

  const SOUND_ENABLED_KEY = 'prc_sr_sound_enabled_v1';
  let soundUnlockedThisPage = false;
  let soundUnlockInProgress = false;

  function safeUpdateSoundButton() {
    try {
      if (typeof updateSoundButton === 'function') {
        updateSoundButton();
      }
    } catch (error) {
      console.warn('PRC DASH sound button update failed:', error);
    }
  }

  async function enableOperationalSoundsQuietly() {
    if (soundUnlockInProgress) {
      return;
    }

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

      if (!soundPlayers || typeof soundPlayers !== 'object') {
        soundPlayers = {};
      }

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
      }
    } catch (error) {
      console.warn('PRC DASH sound button patch failed:', error);
    }
  }

  function escapeText(value) {
    return String(value ?? '').trim();
  }

  function formatBusBadge(bus) {
    const otw = Number(bus.otw_count || 0);
    const females = Number(bus.female_count || 0);
    const nats = Number(bus.nat_count || 0);

    const prefix = bus.bus_type === 'local'
      ? `LOCAL – ${escapeText(bus.destination || bus.originating_destination || 'LOCAL')}`
      : `BUS #${escapeText(bus.bus_id || '')}`;

    return `${prefix} – ${otw} OTW | ${females} F | ${nats} NAT`;
  }

  function updateActiveBusBadges() {
    try {
      const activeBusContainer = document.getElementById('active-buses');

      if (!activeBusContainer || typeof allData === 'undefined') {
        return;
      }

      activeBusContainer.querySelectorAll('.bus-badge').forEach(button => {
        const onclick = button.getAttribute('onclick') || '';
        const idMatch = onclick.match(/confirmBusArrival\('([^']+)'\)/);
        const id = idMatch ? idMatch[1] : '';

        if (!id) {
          return;
        }

        const bus = allData.find(record => record.__backendId === id);

        if (!bus) {
          return;
        }

        const label = formatBusBadge(bus);
        button.textContent = label;
        button.title = `Confirm arrival: ${label}`;
      });
    } catch (error) {
      console.warn('PRC DASH active bus badge update failed:', error);
    }
  }

  function startRuntimeFixes() {
    patchSoundButton();
    updateActiveBusBadges();

    setInterval(() => {
      patchSoundButton();
      updateActiveBusBadges();
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startRuntimeFixes);
  } else {
    startRuntimeFixes();
  }
})();
