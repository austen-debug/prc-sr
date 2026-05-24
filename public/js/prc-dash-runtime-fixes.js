// PRC DASH runtime fixes
// Small, isolated patches loaded after the main single-page app.
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
  let renderAllPatched = false;
  let localBusFormPatched = false;

  function safeUpdateSoundButton() {
    try {
      if (typeof updateSoundButton === 'function') updateSoundButton();
    } catch (error) {
      console.warn('PRC DASH sound button update failed:', error);
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
      if (btn) btn.onclick = enableOperationalSoundsQuietly;
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
      if (!activeBusContainer || typeof allData === 'undefined') return;

      activeBusContainer.querySelectorAll('.bus-badge').forEach(button => {
        const onclick = button.getAttribute('onclick') || '';
        const idMatch = onclick.match(/confirmBusArrival\('([^']+)'\)/);
        const id = idMatch ? idMatch[1] : '';
        if (!id) return;

        const bus = allData.find(record => record.__backendId === id);
        if (!bus) return;

        const label = formatBusBadge(bus);
        button.textContent = label;
        button.title = `Confirm arrival: ${label}`;
        button.setAttribute('aria-label', `Confirm arrival: ${label}`);
      });
    } catch (error) {
      console.warn('PRC DASH active bus badge render update failed:', error);
    }
  }

  function patchRenderAllBusBadges() {
    try {
      if (renderAllPatched || typeof renderAll !== 'function') return;

      const originalRenderAll = renderAll;
      const patchedRenderAll = function patchedRenderAll(...args) {
        const result = originalRenderAll.apply(this, args);
        updateActiveBusBadges();
        return result;
      };

      window.renderAll = patchedRenderAll;
      try { renderAll = patchedRenderAll; } catch (_) {}

      renderAllPatched = true;
      updateActiveBusBadges();
    } catch (error) {
      console.warn('PRC DASH renderAll bus badge patch failed:', error);
    }
  }

  function getModalDormRecord() {
    if (typeof modalDormId === 'undefined' || !modalDormId || typeof allData === 'undefined') return null;
    return allData.find(record => record.__backendId === modalDormId && record.type === 'dorm') || null;
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
      console.warn('PRC DASH load input limit sync failed:', error);
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
      console.warn('PRC DASH save load failed:', result);
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

      if (input && input.dataset.prcLoadCapPatched !== 'true') {
        input.dataset.prcLoadCapPatched = 'true';
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
      console.warn('PRC DASH dorm load control patch failed:', error);
    }
  }

  function setModalEscapeCloseBehavior() {
    try {
      if (document.body.dataset.prcEscapeClosePatched === 'true') return;
      document.body.dataset.prcEscapeClosePatched = 'true';

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
      console.warn('PRC DASH escape close patch failed:', error);
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

      if (container.dataset.prcTabFlowPatched !== 'true') {
        container.dataset.prcTabFlowPatched = 'true';
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

          const nextIndex = event.shiftKey ? index - 1 : index + 1;
          const next = ordered[nextIndex];

          if (next) {
            event.preventDefault();
            next.focus();
            if (typeof next.select === 'function' && next.tagName !== 'SELECT') next.select();
          }
        });
      }
    } catch (error) {
      console.warn('PRC DASH horizontal tab flow patch failed:', error);
    }
  }

  function patchLocalBusSubmitClose() {
    try {
      const form = document.getElementById('local-bus-form');
      if (!form || localBusFormPatched) return;

      form.addEventListener('submit', async event => {
        event.preventDefault();
        event.stopImmediatePropagation();

        const dest = document.getElementById('local-dest').value.trim();
        const total = Number(document.getElementById('local-total').value);
        const females = Number(document.getElementById('local-female').value || 0);
        const nats = Number(document.getElementById('local-nat').value || 0);
        const wg = typeof getActiveWG === 'function' ? getActiveWG() : '';

        if (!dest || !total) {
          showMsg('local-bus-msg', 'Destination and total arrived are required.', true);
          return;
        }

        if (!wg) {
          showMsg('local-bus-msg', 'Initialize a Week Group before adding a local arrival.', true);
          return;
        }

        if (females > total) {
          showMsg('local-bus-msg', 'Females cannot exceed total arrived.', true);
          return;
        }

        if (nats > total) {
          showMsg('local-bus-msg', 'Naturalizations cannot exceed total arrived.', true);
          return;
        }

        if (allData.length >= 999) {
          showMsg('local-bus-msg', 'Record limit reached!', true);
          return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton ? submitButton.textContent : '';

        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'SAVING...';
        }

        const result = await window.dataSdk.create({
          type: 'bus',
          bus_id: '',
          bus_type: 'local',
          destination: dest,
          otw_count: total,
          female_count: females,
          nat_count: nats,
          status: 'arrived',
          created_at: new Date().toISOString(),
          arrived_at: new Date().toISOString(),
          week_group: wg
        });

        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText || 'SAVE';
        }

        if (result && result.isOk) {
          form.reset();
          document.getElementById('local-female').value = '0';
          document.getElementById('local-nat').value = '0';
          if (typeof closeLocalBusModal === 'function') closeLocalBusModal();
        } else {
          showMsg('local-bus-msg', 'Failed', true);
        }
      }, true);

      localBusFormPatched = true;
    } catch (error) {
      console.warn('PRC DASH local bus submit close patch failed:', error);
    }
  }

  function ensureCloseoutStatusElement() {
    const closeoutBtn = document.getElementById('closeout-btn');
    if (!closeoutBtn) return null;

    let el = document.getElementById('closeout-safety-msg');
    if (!el) {
      el = document.createElement('div');
      el.id = 'closeout-safety-msg';
      el.className = 'text-xs font-bold text-muted';
      el.style.minHeight = '20px';
      closeoutBtn.insertAdjacentElement('afterend', el);
    }

    return el;
  }

  function showCloseoutMessage(message, isError = false) {
    const el = ensureCloseoutStatusElement();
    if (!el) {
      if (isError) alert(message);
      return;
    }

    el.textContent = message;
    el.style.color = isError ? 'var(--red)' : 'var(--green)';
  }

  function clearCloseoutMessageAfterDelay() {
    const el = ensureCloseoutStatusElement();
    if (!el) return;

    setTimeout(() => {
      el.textContent = '';
      el.style.color = 'var(--text-muted)';
    }, 6000);
  }

  function buildArchivePayload(weekGroup, dorms, buses) {
    const arrivedBuses = buses.filter(b => b.status === 'arrived');
    const totalArrived = arrivedBuses.reduce((s, b) => s + Number(b.otw_count || 0), 0);
    const femaleTotal = buses.reduce((s, b) => s + Number(b.female_count || 0), 0);
    const natTotal = buses.reduce((s, b) => s + Number(b.nat_count || 0), 0);
    const loadedTotal = dorms.reduce((s, d) => s + Number(d.current_load || 0), 0);
    const expectedTotal = dorms.reduce((s, d) => s + Number(d.max_load || 0), 0);

    const dormHistory = dorms.map(d => ({
      name: d.dorm_name,
      dorm_name: d.dorm_name,
      sdq: d.sdq || '',
      section: d.section || '',
      inter_sec: d.inter_sec || '',
      sex: d.sex || '',
      band: d.band || 'false',
      current_load: Number(d.current_load || 0),
      max_load: Number(d.max_load || 0),
      state: d.state || '',
      phase: d.phase || '',
      notes: d.notes || '',
      assigned_airman: d.assigned_airman || '',
      opened_at: d.opened_at || '',
      closed_at: d.closed_at || '',
      open_time: d.opened_at ? new Date(d.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
      close_time: d.closed_at ? new Date(d.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
      elapsed: d.closed_timer || '—'
    }));

    const busHistory = buses.map(b => ({
      bus_id: b.bus_id || '',
      bus_type: b.bus_type || 'airport',
      originating_destination: b.originating_destination || b.destination || '',
      destination: b.destination || '',
      departed_at: b.created_at || '',
      arrived_at: b.arrived_at || '',
      otw_count: Number(b.otw_count || 0),
      female_count: Number(b.female_count || 0),
      nat_count: Number(b.nat_count || 0),
      status: b.status || ''
    }));

    return {
      type: 'archive',
      week_group: weekGroup,
      archived_at: new Date().toISOString(),
      dorm_count: dorms.length,
      bus_count: buses.length,
      total_arrived: totalArrived,
      total_loaded: loadedTotal,
      total_expected: expectedTotal,
      female_total: femaleTotal,
      nat_total: natTotal,
      dorm_data: JSON.stringify(dormHistory),
      bus_data: JSON.stringify(busHistory),
      closeout_safety_version: 'archive-verified-before-clear-v1'
    };
  }

  async function fetchRecordsDirectly() {
    const response = await fetch('/api/records', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });

    const result = await response.json();
    if (!result.isOk) throw new Error(result.error || 'Unable to fetch records.');
    return result.records || [];
  }

  async function verifyArchiveCreated(archiveId, weekGroup) {
    if (!archiveId) return false;
    const records = await fetchRecordsDirectly();
    return records.some(record => (
      record.__backendId === archiveId &&
      record.type === 'archive' &&
      record.week_group === weekGroup
    ));
  }

  async function deleteCloseoutRecords(records) {
    const failures = [];

    for (const record of records) {
      const result = await window.dataSdk.delete(record);
      if (!result || !result.isOk) {
        failures.push(record.dorm_name || record.bus_id || record.type || record.__backendId || 'record');
      }
    }

    if (failures.length > 0) {
      throw new Error(`Archive was created and verified, but ${failures.length} live record(s) could not be cleared.`);
    }
  }

  async function updateCloseoutConfigRecord(record, value, label) {
    if (!record) return;

    const result = await window.dataSdk.update({ ...record, value });
    if (!result || !result.isOk) {
      throw new Error(`Archive was created, but ${label} could not be cleared.`);
    }
  }

  function resetCloseoutInputGrid() {
    try {
      const wgInput = document.getElementById('wg-batch-input');
      if (wgInput) wgInput.value = '';

      batchRows = Array.from({ length: 25 }, (_, i) => ({
        rowIndex: i,
        sdq: '',
        sec: '',
        inter_sec: '',
        dorm_name: '',
        sex: 'male',
        band: false,
        load: ''
      }));

      if (typeof initBatchGrid === 'function') initBatchGrid();
      if (typeof updateTotalLoadCalc === 'function') updateTotalLoadCalc();
    } catch (error) {
      console.warn('PRC DASH input grid reset failed after closeout:', error);
    }
  }

  async function runSafeCloseout() {
    if (typeof currentRole !== 'undefined' && currentRole !== 'instructor') {
      showCloseoutMessage('Instructor access required to close out week group.', true);
      return;
    }

    const weekGroup = getActiveWG();
    if (!weekGroup) {
      showCloseoutMessage('No active week group to close out.', true);
      return;
    }

    const dorms = getRecords('dorm').filter(d => d.week_group === weekGroup);
    const buses = getRecords('bus').filter(b => b.week_group === weekGroup);
    const soundEvents = getRecords('sound_event').filter(e => e.week_group === weekGroup);

    if (dorms.length === 0 && buses.length === 0) {
      showCloseoutMessage('No dorm or bus records found for the active week group.', true);
      return;
    }

    const closeoutBtn = document.getElementById('closeout-btn');
    const originalText = closeoutBtn ? closeoutBtn.textContent : '';

    try {
      if (closeoutBtn) {
        closeoutBtn.disabled = true;
        closeoutBtn.textContent = 'ARCHIVING...';
      }

      showCloseoutMessage('Creating archive record...');

      const archivePayload = buildArchivePayload(weekGroup, dorms, buses);
      const archiveResult = await window.dataSdk.create(archivePayload);

      if (!archiveResult || !archiveResult.isOk || !archiveResult.data || !archiveResult.data.__backendId) {
        throw new Error(archiveResult?.error || 'Archive creation failed. Live records were not cleared.');
      }

      showCloseoutMessage('Verifying archive record...');

      const archiveVerified = await verifyArchiveCreated(archiveResult.data.__backendId, weekGroup);
      if (!archiveVerified) {
        throw new Error('Archive verification failed. Live records were not cleared.');
      }

      showCloseoutMessage('Archive verified. Clearing live records...');

      await deleteCloseoutRecords([...dorms, ...buses, ...soundEvents]);

      const latestRecords = await fetchRecordsDirectly();
      const lastAirport = latestRecords.find(d => d.type === 'config' && d.key === 'last_airport');
      const activeWgConfig = latestRecords.find(d => d.type === 'config' && d.key === 'week_group');

      await updateCloseoutConfigRecord(lastAirport, '', 'last airport arrival');
      await updateCloseoutConfigRecord(activeWgConfig, '', 'active week group');

      resetCloseoutInputGrid();

      if (typeof renderAll === 'function') renderAll();

      showCloseoutMessage(`Week group ${weekGroup} archived and cleared.`);
      clearCloseoutMessageAfterDelay();
    } catch (error) {
      console.error('PRC DASH safe closeout failed:', error);
      showCloseoutMessage(error.message || 'Closeout failed. Live records were not cleared.', true);
      alert(error.message || 'Closeout failed. Live records were not cleared.');
    } finally {
      if (closeoutBtn) {
        closeoutBtn.disabled = false;
        closeoutBtn.textContent = originalText || 'CLOSE OUT WEEK GROUP';
      }
    }
  }

  function safeInitiateCloseout() {
    if (typeof showConfirm !== 'function') {
      showCloseoutMessage('Confirmation dialog unavailable. Closeout cancelled.', true);
      return;
    }

    showConfirm('Close out this week group? PRC DASH will create and verify the archive before clearing live records.', async () => {
      await runSafeCloseout();
    });
  }

  function patchCloseoutWorkflow() {
    try {
      const closeoutBtn = document.getElementById('closeout-btn');
      if (!closeoutBtn || typeof showConfirm !== 'function') return;

      ensureCloseoutStatusElement();
      window.initiateCloseout = safeInitiateCloseout;
      closeoutBtn.onclick = safeInitiateCloseout;
    } catch (error) {
      console.warn('PRC DASH closeout workflow patch failed:', error);
    }
  }

  function startRuntimeFixes() {
    patchSoundButton();
    patchDormLoadControls();
    patchHorizontalBatchTabFlow();
    patchLocalBusSubmitClose();
    setModalEscapeCloseBehavior();
    patchCloseoutWorkflow();
    patchRenderAllBusBadges();

    setInterval(() => {
      patchSoundButton();
      patchDormLoadControls();
      patchHorizontalBatchTabFlow();
      patchLocalBusSubmitClose();
      setModalEscapeCloseBehavior();
      patchCloseoutWorkflow();
      patchRenderAllBusBadges();
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startRuntimeFixes);
  } else {
    startRuntimeFixes();
  }
})();
