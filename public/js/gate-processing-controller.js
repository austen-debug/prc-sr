// GATE Phase 2 Processing Controller
// Canonical owner for Processing page cards, dorm modal, edit modal workflow, instructor context menu, Airman-safe close, final-time commit, and reopen access.
(function () {
  'use strict';

  const PHASES = ['OPEN', 'LOBBY', 'AUDITORIUM', 'STANDBY', 'INITIAL ISSUE', 'ITEM SETUP', 'LATRINE', 'FIT TEST', 'EATING', 'READY TO DEPART'];

  let installed = false;
  let renderQueued = false;
  let contextMenu = null;
  let editSubmitBound = false;
  let loadSaveInFlight = false;
  let reopenInFlight = false;
  let editDormBaseline = null;

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function esc(value) {
    const helper = window.GateComponents?.esc;
    if (helper) return helper(value);
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function recordDisplay() {
    return window.GateRecordDisplay || null;
  }

  function records() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function activeWeekGroup() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function isInstructor() {
    try { return ['instructor','admin'].includes(currentRole); } catch (_) { return false; }
  }

  function dormById(id) {
    return records().find(record => record && record.type === 'dorm' && record.__backendId === id) || null;
  }

  function processingDorms() {
    const wg = activeWeekGroup();
    const dorms = records()
      .filter(record => record?.type === 'dorm')
      .filter(record => !wg || record.week_group === wg);
    return recordDisplay()?.sortDorms ? recordDisplay().sortDorms(dorms) : dorms;
  }

  function assignmentSummary() {
    const wg = activeWeekGroup();
    const accounting = window.GateOperationalCounts?.calculateAssignmentSummary?.(records(), wg);
    if (accounting) return accounting;

    const weekRecords = records().filter(record => !wg || String(record?.week_group || '') === wg);
    const arrived = weekRecords
      .filter(record => record?.type === 'bus' && String(record.status || '').trim().toLowerCase() === 'arrived')
      .reduce((sum, bus) => sum + Math.max(0, Math.trunc(n(bus.otw_count))), 0);
    const loaded = weekRecords
      .filter(record => record?.type === 'dorm')
      .reduce((sum, dorm) => sum + Math.max(0, Math.trunc(n(dorm.current_load))), 0);
    return { arrived, loaded, awaitingAssignment: Math.max(arrived - loaded, 0), overAssigned: Math.max(loaded - arrived, 0) };
  }

  function normalizeUpper(value) {
    return String(value ?? '').trim().toUpperCase();
  }

  function normalizeFinalTime(value, fallback = '00:00') {
    const raw = String(value || '').trim();
    if (!raw) return fallback || '00:00';
    const match = raw.match(/^(\d{1,5})(?::([0-5]\d))?$/);
    if (!match) return raw;
    return `${String(Number(match[1] || 0)).padStart(2, '0')}:${match[2] || '00'}`;
  }

  function parseTimerToSeconds(value) {
    const normalized = normalizeFinalTime(value, '00:00');
    const match = String(normalized || '').match(/^(\d{1,5}):([0-5]\d)$/);
    if (!match) return 0;
    const minutes = Number(match[1] || 0);
    const seconds = Number(match[2] || 0);
    return Math.max(0, (minutes * 60) + seconds);
  }

  function computeFinalTime(dorm) {
    if (!dorm) return '00:00';
    try {
      if (window.GateDormBoardController?.computeDormElapsedTimer) {
        const computed = window.GateDormBoardController.computeDormElapsedTimer(dorm);
        if (computed) return normalizeFinalTime(computed, '00:00');
      }
    } catch (_) {}
    try {
      if (typeof getElapsedTimer === 'function' && dorm.opened_at) {
        const timer = getElapsedTimer(dorm.opened_at);
        if (timer?.text) return normalizeFinalTime(timer.text, '00:00');
      }
    } catch (_) {}
    return normalizeFinalTime(dorm.closed_timer, '00:00');
  }

  function syncLocalRecord(record) {
    if (!record || !record.__backendId) return;
    const list = records();
    const index = list.findIndex(item => item && item.__backendId === record.__backendId);
    if (index >= 0 && Number(list[index].record_version || 0) > Number(record.record_version || 0)) return;
    if (index >= 0) list[index] = { ...list[index], ...record };
    else list.push(record);
  }

  function forceRefresh(source = 'processing-controller') {
    try { window.GateStatusBoardController?.scheduleRender?.({ force: true }); } catch (_) {}
    try { window.GateDormBoardController?.refresh?.(); } catch (_) {}
    try { window.runGateHooks?.('afterDataChanged', { source }); } catch (_) {}
    scheduleRender({ force: true });
  }

  // Presentation only. No overtime persistence or sound ownership is transferred
  // to Processing; the existing audio auditor retains that responsibility.
  function processingAlertState(dormState, openedAt, elapsed) {
    if (String(dormState || '').toLowerCase() !== 'open' ||
        !openedAt || !Number.isFinite(new Date(openedAt).getTime()) ||
        elapsed?.valid === false || !Number.isFinite(Number(elapsed?.minutes))) return 'normal';
    const minutes = Number(elapsed.minutes);
    if (minutes >= 60) return 'overtime';
    if (minutes >= 50) return 'critical';
    if (minutes >= 40) return 'warning';
    return 'normal';
  }

  function stateLabelHtml(dorm) {
    const state = String(dorm?.state || 'empty').toLowerCase();
    const label = state === 'open' ? 'OPEN' : (state === 'closed' ? 'CLOSED' : 'EMPTY');
    return '<span class="gate-processing-card__state gate-processing-card__state--' +
      label.toLowerCase() + '">' + label + '</span>';
  }

  function timerHtml(dorm) {
    const state = String(dorm?.state || 'empty').toLowerCase();
    if (state === 'open' && dorm.opened_at && typeof getElapsedTimer === 'function') {
      const timer = getElapsedTimer(dorm.opened_at);
      const alert = processingAlertState(state, dorm.opened_at, timer);
      const classes = [
        'gate-processing-card__timer', 'text-2xl', 'font-mono',
        'font-black', 'font-tabular', 'timer-display',
        alert === 'warning' ? 'timer-yellow' : '',
        alert === 'critical' || alert === 'overtime' ? 'timer-red' : '',
        alert === 'overtime' ? 'timer-flash' : ''
      ].filter(Boolean).join(' ');
      return `<div class="${classes}" data-opened="${esc(dorm.opened_at)}" data-dorm-id="${esc(dorm.__backendId)}" aria-live="off">${esc(timer?.text || '00:00')}</div>`;
    }
    if (state === 'closed' && dorm.closed_timer) {
      return `<div class="gate-processing-card__timer gate-processing-card__timer--final text-2xl font-mono font-black font-tabular text-muted">${esc(dorm.closed_timer)}</div>`;
    }
    return '<div class="gate-processing-card__timer gate-processing-card__timer--empty" aria-hidden="true"></div>';
  }

  function processingCard(dorm) {
    const state = String(dorm?.state || 'empty').toLowerCase();
    const sex = String(dorm?.sex || '').trim().toLowerCase();
    const female = sex === 'female' || sex === 'f';
    const normalizedFlags = recordDisplay()?.normalizeDormFlags?.(dorm);
    const band = normalizedFlags ? normalizedFlags.band : (dorm?.band === true || dorm?.band === 'true');
    const spaceForce = normalizedFlags ? normalizedFlags.spaceForce : (dorm?.space_force === true || dorm?.space_force === 'true' || dorm?.is_space_force === true || dorm?.is_space_force === 'true');
    const borderClasses = [
      female ? 'border-female' : '',
      spaceForce ? 'border-space-force' : '',
      !spaceForce && band ? 'border-band' : ''
    ].filter(Boolean).join(' ');
    const currentTimer = state === 'open' && dorm.opened_at && typeof getElapsedTimer === 'function'
      ? getElapsedTimer(dorm.opened_at)
      : null;
    const alertState = processingAlertState(state, dorm.opened_at, currentTimer);
    const closedClass = state === 'closed' ? 'dorm-closed' : '';
    const assignment = String(dorm.assigned_airman || '').trim();
    const assignedAirmanHtml = assignment
      ? `<div class="gate-processing-card__airman" title="${esc(assignment)}">${esc(assignment)}</div>`
      : '';
    const phase = String(dorm.phase || (state === 'closed' ? 'CLOSED' : '')).trim();
    const phaseHtml = phase
      ? `<div class="gate-processing-card__phase" title="Processing phase: ${esc(phase)}">PHASE · ${esc(phase)}</div>`
      : '';
    const identityHtml = spaceForce
      ? '<span class="gate-processing-card__identity gate-processing-card__identity--space" aria-label="Space Force dorm">SPACE</span>'
      : (band
        ? '<span class="gate-processing-card__identity gate-processing-card__identity--band" aria-label="Band dorm">BAND</span>'
        : '');
    const info = [esc(dorm.sdq), esc(dorm.section), esc(dorm.inter_sec)].filter(Boolean).join(' · ');
    return `<div class="proc-card gate-processing-card ${borderClasses} ${closedClass}" data-component="processing-dorm-card" data-owner="gate-processing-controller" data-dorm-id="${esc(dorm.__backendId)}" data-state="${esc(state)}" data-gate-time-alert="${alertState}" tabindex="0" role="button" aria-label="Open Processing controls for ${esc(dorm.dorm_name || 'dorm')}">
      <div class="gate-processing-card__header">
        <div class="gate-processing-card__identification">
          <div class="gate-processing-card__name">${esc(dorm.dorm_name || '')}</div>
          <div class="gate-processing-card__meta">${info}</div>
        </div>
        <div class="gate-processing-card__status-group">
          ${stateLabelHtml(dorm)}
          ${assignedAirmanHtml}
        </div>
      </div>
      <div class="gate-processing-card__center">
        <div class="gate-processing-card__load text-xl font-black font-tabular">${n(dorm.current_load)} / ${n(dorm.max_load)}</div>
        <div class="gate-processing-card__location-slot" data-processing-location-slot></div>
        ${phaseHtml}
      </div>
      <div class="gate-processing-card__footer">
        ${timerHtml(dorm)}
        ${identityHtml}
      </div>
    </div>`;
  }

  function renderProcessingPageCanonical(dorms) {
    const grid = document.getElementById('proc-dorm-grid');
    if (!grid) return;
    const source = Array.isArray(dorms) ? dorms : processingDorms();
    const list = recordDisplay()?.sortDorms ? recordDisplay().sortDorms(source) : source;
    grid.dataset.component = 'processing-dorm-grid';
    grid.dataset.owner = 'gate-processing-controller';
    grid.innerHTML = list.length
      ? list.map(processingCard).join('')
      : '<div class="text-muted text-center text-lg py-8">No dormitories loaded. Initialize a Week Group from the Input page.</div>';
  }

  function scheduleRender(options = {}) {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderProcessingPageCanonical(options.dorms);
      updateProcessingTimers();
    });
  }

  function updateProcessingTimers() {
    const page = document.getElementById('page-processing');
    if (!page) return;
    page.querySelectorAll('#proc-dorm-grid .proc-card[data-state="open"] .timer-display[data-opened]').forEach(timer => {
      const card = timer.closest('.proc-card[data-dorm-id]');
      if (!card || !timer.dataset.opened || typeof getElapsedTimer !== 'function') return;
      const elapsed = getElapsedTimer(timer.dataset.opened);
      const alert = processingAlertState(card.dataset.state, timer.dataset.opened, elapsed);
      if (elapsed?.text && timer.textContent !== elapsed.text) timer.textContent = elapsed.text;
      timer.classList.toggle('timer-yellow', alert === 'warning');
      timer.classList.toggle('timer-red', alert === 'critical' || alert === 'overtime');
      timer.classList.toggle('timer-flash', alert === 'overtime');
      // Only update on a transition; do not rerender the card or restart its orbit.
      if (card.dataset.gateTimeAlert !== alert) card.dataset.gateTimeAlert = alert;
    });
  }

  function setModalOpen(open) {
    const modal = document.getElementById('dorm-modal');
    if (!modal) return;
    modal.classList.toggle('hidden', !open);
    modal.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.classList.toggle('gate-modal-open', open);
  }

  function activeModalDormId() {
    try { return modalDormId || ''; } catch (_) { return ''; }
  }

  function setActiveModalDorm(id) {
    try { modalDormId = id || null; } catch (_) {}
  }

  function setModalFeedback(fieldId, message, state = 'error') {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.textContent = message || '';
    field.hidden = !message;
    if (message) field.dataset.state = state;
    else delete field.dataset.state;
  }

  function setModalCommandBusy(button, busy, pendingLabel) {
    if (!button) return;
    const label = button.querySelector('.gate-processing-command__label');
    if (busy) {
      if (label) {
        button.dataset.processingOriginalLabel = label.textContent || '';
        label.textContent = pendingLabel;
      }
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    } else {
      if (label && button.dataset.processingOriginalLabel) {
        label.textContent = button.dataset.processingOriginalLabel;
      }
      delete button.dataset.processingOriginalLabel;
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  function instructorModalActions(id, state) {
    const editButton = `<button type="button" data-processing-action="edit-record" data-dorm-id="${esc(id)}" class="gate-processing-command gate-processing-command--secondary"><span class="gate-processing-command__label">EDIT RECORD</span></button>`;
    if (state === 'empty') {
      return `<button type="button" data-processing-action="open-dorm" data-dorm-id="${esc(id)}" class="px-8 py-3 rounded-lg font-bold text-white text-lg" style="background:var(--blue);">OPEN DORM</button>${editButton}`;
    }
    if (state === 'open') {
      return `<button type="button" data-processing-action="close-dorm" data-dorm-id="${esc(id)}" class="px-8 py-3 rounded-lg font-bold text-white text-lg" style="background:var(--red);">CLOSE DORM</button>${editButton}`;
    }
    return `<button type="button" data-processing-action="reopen-dorm" data-dorm-id="${esc(id)}" class="gate-processing-command gate-processing-command--reopen"><span class="gate-processing-command__label">REOPEN DORM</span></button>${editButton}`;
  }

  function openDormModalCanonical(id) {
    const dorm = dormById(id);
    if (!dorm) return;
    setActiveModalDorm(id);
    setModalFeedback('modal-assignment-feedback', '');
    setModalFeedback('modal-load-feedback', '');
    setModalFeedback('modal-action-feedback', '');

    const name = document.getElementById('modal-dorm-name');
    const info = document.getElementById('modal-dorm-info');
    const airman = document.getElementById('modal-airman-input');
    const loadInput = document.getElementById('modal-load-input');
    const loadMax = document.getElementById('modal-load-max');
    const phaseSection = document.getElementById('modal-phase-section');
    const phaseButtons = document.getElementById('modal-phase-buttons');
    const actionSection = document.getElementById('modal-action-section');

    if (name) name.textContent = dorm.dorm_name || '';
    if (info) {
      const sexLabel = String(dorm.sex || '').toLowerCase() === 'female' ? '♀ Female' : '♂ Male';
      const normalizedFlags = recordDisplay()?.normalizeDormFlags?.(dorm);
      const band = normalizedFlags ? normalizedFlags.band : (dorm.band === true || dorm.band === 'true');
      const spaceForce = normalizedFlags ? normalizedFlags.spaceForce : (dorm.space_force === true || dorm.space_force === 'true' || dorm.is_space_force === true || dorm.is_space_force === 'true');
      const flags = [band ? '🎵 Band' : '', spaceForce ? 'Space Force' : ''].filter(Boolean).join(' | ');
      info.innerHTML = `${[esc(dorm.sdq), esc(dorm.section), esc(dorm.inter_sec)].filter(Boolean).join(' · ')} | ${sexLabel}${flags ? ` | ${esc(flags)}` : ''} | Max: ${n(dorm.max_load)}`;
    }
    if (airman) airman.value = dorm.assigned_airman || '';
    if (loadInput) loadInput.value = n(dorm.current_load);
    if (loadMax) loadMax.textContent = `/ ${n(dorm.max_load)}`;

    if (phaseSection && phaseButtons) {
      const open = String(dorm.state || '').toLowerCase() === 'open';
      phaseSection.style.display = open ? '' : 'none';
      phaseButtons.innerHTML = open
        ? PHASES.map(phase => `<button type="button" class="phase-btn ${dorm.phase === phase ? 'selected' : ''}" data-processing-phase="${esc(phase)}">${esc(phase)}</button>`).join('')
        : '';
    }

    if (actionSection) {
      const state = String(dorm.state || 'empty').toLowerCase();
      if (!isInstructor()) {
        actionSection.innerHTML = state === 'closed'
          ? '<div class="text-muted font-bold">DORM CLOSED</div>'
          : '<div class="text-muted font-bold text-center">Instructor access required to open or close dorms.</div>';
      } else {
        actionSection.innerHTML = instructorModalActions(id, state);
      }
    }

    setModalOpen(true);
    window.runGateHooks?.('afterModalOpen', { modal: 'processing-dorm', dormId: id, source: 'gate-processing-controller' });
  }

  function closeDormModalCanonical(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    setActiveModalDorm('');
    setModalOpen(false);
    if (window.GateAppShell?.currentPage?.() !== 'processing' && document.getElementById('page-processing')?.classList.contains('active')) {
      window.GateAppShell?.sync?.();
    }
    return false;
  }

  async function updateDorm(payload, options = {}) {
    if (!payload || payload.type !== 'dorm' || !payload.__backendId) return { isOk: false, error: 'Missing dorm record.' };
    const base = options.baseline || dormById(payload.__backendId);
    if (options.fields && !base) return {isOk:false,error:'Authoritative dorm baseline is unavailable.'};
    if (options.fields) {
      const changes=Object.fromEntries(options.fields.filter(key=>JSON.stringify(payload[key] ?? null)!==JSON.stringify(base[key] ?? null))
        .map(key=>[key,payload[key] ?? null]));
      if (Object.hasOwn(changes,'closed_timer') && String(base.state).toLowerCase()==='closed')
        changes.manual_closed_timer_override='true';
      if (!Object.keys(changes).length) return {isOk:true,data:base};
      payload={__backendId:base.__backendId,type:'dorm',record_version:base.record_version,
        __changes:changes,__base_values:Object.fromEntries(Object.keys(changes).map(key=>[key,base[key] ?? null]))};
    }
    const result = await window.dataSdk.update(payload);
    if (result?.isOk) {
      syncLocalRecord(result.data || payload);
      if (options.soundType && typeof createSoundEvent === 'function') {
        try { await createSoundEvent(options.soundType, options.soundPayload || {}); } catch (error) { console.warn('GATE Processing sound event failed:', error); }
      }
      forceRefresh(options.source || 'processing-update');
    }
    return result;
  }

  async function setPhaseCanonical(phase) {
    const id = activeModalDormId();
    const dorm = id ? dormById(id) : null;
    if (!dorm) return;
    const result = await updateDorm({ ...dorm, phase }, { source: 'processing-phase-update', fields:['phase'] });
    if (result?.isOk) closeDormModalCanonical();
    else setModalFeedback('modal-action-feedback', result?.error || 'Dorm changed. Review its latest status before retrying.');
  }

  function modLoadCanonical(delta) {
    const input = document.getElementById('modal-load-input');
    if (!input) return;
    input.setCustomValidity('');
    setModalFeedback('modal-load-feedback', '');
    input.value = String(Math.max(0, n(input.value) + Number(delta || 0)));
  }

  function setLoadFullCanonical() {
    const dorm = dormById(activeModalDormId());
    const input = document.getElementById('modal-load-input');
    if (dorm && input) {
      input.setCustomValidity('');
      setModalFeedback('modal-load-feedback', '');
      input.value = String(n(dorm.max_load));
    }
  }

  async function saveLoadCanonical() {
    if (loadSaveInFlight) return;
    const dormId = activeModalDormId();
    const dorm = dormById(dormId);
    const input = document.getElementById('modal-load-input');
    if (!dorm || !input) return;
    setModalFeedback('modal-load-feedback', '');
    input.setCustomValidity('');

    const requested = Math.max(0, Math.trunc(n(input.value)));
    const capacity = Math.max(0, Math.trunc(n(dorm.max_load)));
    if (requested > capacity) {
      input.setCustomValidity(`Dorm load cannot exceed the configured capacity of ${capacity}.`);
      input.reportValidity();
      return;
    }

    const accounting = assignmentSummary();
    const existingLoad = Math.max(0, Math.trunc(n(dorm.current_load)));
    const loadedOutsideDorm = Math.max(0, accounting.loaded - existingLoad);
    const availableForDorm = Math.max(0, accounting.arrived - loadedOutsideDorm);
    const proposedLoaded = loadedOutsideDorm + requested;
    const proposedOverAssigned = Math.max(proposedLoaded - accounting.arrived, 0);
    if (proposedOverAssigned > accounting.overAssigned) {
      input.setCustomValidity(`Only ${availableForDorm} physically arrived trainee${availableForDorm === 1 ? '' : 's'} are available for this dorm assignment.`);
      input.reportValidity();
      return;
    }

    input.value = String(requested);
    const button = document.querySelector('#dorm-modal button[onclick="saveLoad()"]');
    loadSaveInFlight = true;
    setModalCommandBusy(button, true, 'SAVING...');
    try {
      const result = await updateDorm({ ...dorm, current_load: requested, updated_at: new Date().toISOString() }, { source: 'processing-load-update', fields:['current_load'] });
      if (!result?.isOk && activeModalDormId() === dormId) {
        setModalFeedback('modal-load-feedback', 'Unable to save the dorm load. Check the record and try again.');
      }
      return result;
    } catch (error) {
      console.warn('GATE Processing load save failed:', error);
      if (activeModalDormId() === dormId) setModalFeedback('modal-load-feedback', 'Unable to save the dorm load. Try again.');
      return { isOk: false, error: 'Dorm load save failed.' };
    } finally {
      setModalCommandBusy(button, false);
      loadSaveInFlight = false;
    }
  }

  async function saveAssignedAirmanCanonical() {
    const dorm = dormById(activeModalDormId());
    const input = document.getElementById('modal-airman-input');
    if (!dorm || !input) return;
    const result = await updateDorm({ ...dorm, assigned_airman: normalizeUpper(input.value) }, { source: 'processing-airman-update', fields:['assigned_airman'] });
    if (result?.isOk) closeDormModalCanonical();
    else setModalFeedback('modal-action-feedback', result?.error || 'Dorm changed. Review its latest status before retrying.');
  }

  async function openDormCanonical(id) {
    if (!isInstructor()) return;
    const dorm = dormById(id);
    if (!dorm) return;
    const now = new Date().toISOString();
    const result = await updateDorm({
      ...dorm,
      state: 'open',
      phase: 'OPEN',
      opened_at: now,
      closed_at: '',
      closed_timer: '',
      overtime_sound_sent: 'false',
      overtime_sound_at: '',
      updated_at: now
    }, {
      source: 'processing-open-dorm',
      fields:['state','phase','opened_at','closed_at','closed_timer','overtime_sound_sent','overtime_sound_at'],
      soundType: 'dorm_open',
      soundPayload: { dorm_id: id, dorm_name: dorm.dorm_name || '', action: 'open_dorm' }
    });
    if (result?.isOk) closeDormModalCanonical();
    else setModalFeedback('modal-action-feedback', result?.error || 'Dorm changed. Review its latest status before retrying.');
  }

  async function closeDormCanonical(id) {
    if (!isInstructor()) return;
    const dorm = dormById(id);
    if (!dorm) return;
    const finalTime = computeFinalTime(dorm);
    const now = new Date().toISOString();
    const result = await updateDorm({
      ...dorm,
      state: 'closed',
      phase: 'Closed',
      closed_timer: finalTime,
      closed_at: now,
      updated_at: now
    }, {
      source: 'processing-close-dorm',
      fields:['state','phase','closed_timer','closed_at'],
      soundType: 'dorm_closed',
      soundPayload: { dorm_id: id, dorm_name: dorm.dorm_name || '', final_time: finalTime, action: 'close_dorm' }
    });
    if (result?.isOk) closeDormModalCanonical();
    else setModalFeedback('modal-action-feedback', result?.error || 'Dorm changed. Review its latest status before retrying.');
  }

  // The API and middleware return structured reasons for refused writes. Never
  // replace an actionable authorization/lifecycle rejection with a generic retry.
  // All displayed messages are fixed text; raw SQL/exception content is excluded.
  function dormReopenFailureMessage(result) {
    const code = String(result?.code || '').trim();
    const detail = String(result?.error || '');
    if (code === 'admin_writes_disabled') {
      return 'Privileged Admin changes remain disabled. Ordinary dorm operations require a validated Admin actor audit schema; contact the GATE administrator rather than changing security settings.';
    }
    if (code === 'admin_schema_required') {
      return 'Admin writes cannot be correctly attributed until the verified Admin actor provenance schema (migration 0007) is installed. No records were changed.';
    }
    if (code === 'lifecycle_required') {
      if (detail === 'Only records in the active Week Group can be modified.') {
        return 'This dorm does not belong to the active Week Group. Select the correct operational group before reopening it.';
      }
      return 'Reopen blocked: an active Week Group and matching configuration are required. Check the current Week Group in Input.';
    }
    if (code === 'integrity_error') {
      return 'Reopen blocked: Week Group configuration and lifecycle records do not agree. Contact the GATE administrator; do not edit the database manually.';
    }
    if (code === 'unauthorized') return 'Your login session has expired. Sign in again before reopening this dorm.';
    if (code === 'forbidden') return 'Your account does not have permission to reopen dorms. Sign in with an authorized Instructor account.';
    if (code === 'not_found') return 'This dorm is no longer available. Refresh Processing before attempting another change.';
    if (['version_conflict', 'record_version_conflict', 'conflict'].includes(code)) {
      return 'The dorm changed after you opened it. Refresh Processing to review its latest state before retrying.';
    }
    return 'Dorm reopen was not confirmed. Check its current state before retrying. If it remains closed, contact the GATE administrator.';
  }

  function showDormReopenFailure(message, dormId) {
    setEditMessage(message, true);
    if (activeModalDormId() === dormId) setModalFeedback('modal-action-feedback', message);
    // Context-menu and other nonmodal actions must not hide the rejection inside
    // a closed modal. Keep an accessible message on the Processing page.
    const page = document.getElementById('page-processing');
    if (!page) return;
    let status = document.getElementById('gate-processing-reopen-feedback');
    if (!status) {
      status = document.createElement('p');
      status.id = 'gate-processing-reopen-feedback';
      status.setAttribute('role', 'alert');
      status.className = 'text-red-500';
      page.prepend(status);
    }
    status.textContent = message;
    status.classList.remove('hidden');
  }

  async function reopenDormCanonical(id, options = {}) {
    if (!isInstructor() || reopenInFlight) return;
    const dorm = dormById(id || activeEditDormId() || activeModalDormId());
    if (!dorm) return;
    if (String(dorm.state || '').toLowerCase() !== 'closed') {
      setEditMessage('Only closed dorms can be reopened.', true);
      setModalFeedback('modal-action-feedback', 'Only closed dorms can be reopened.');
      return;
    }

    // The Processing popup must use the selected dorm's persisted final time.
    // Edit-form values are permitted only through an explicit edit-modal option.
    const finalTimeSource = options.finalTime || dorm.closed_timer || '00:00';
    const elapsedSeconds = parseTimerToSeconds(finalTimeSource);
    const reopenedOpenedAt = new Date(Date.now() - (elapsedSeconds * 1000)).toISOString();
    const now = new Date().toISOString();
    const button = document.querySelector('#dorm-modal [data-processing-action="reopen-dorm"]');
    setModalFeedback('modal-action-feedback', '');
    const previousFailure = document.getElementById('gate-processing-reopen-feedback');
    if (previousFailure) { previousFailure.textContent = ''; previousFailure.classList.add('hidden'); }
    reopenInFlight = true;
    setModalCommandBusy(button, true, 'REOPENING...');
    try {
      const result = await updateDorm({
        ...dorm,
        state: 'open',
        phase: 'OPEN',
        opened_at: reopenedOpenedAt,
        closed_at: '',
        closed_timer: '',
        manual_reopen_override: 'true',
        updated_at: now
      }, {
        source: 'processing-reopen-dorm',
        fields:['state','phase','opened_at','closed_at','closed_timer','manual_reopen_override'],
        soundType: 'dorm_open',
        soundPayload: { dorm_id: dorm.__backendId, dorm_name: dorm.dorm_name || '', action: 'reopen_dorm' }
      });

      if (result?.isOk) {
        closeDormModalCanonical();
        closeDormEditModalCanonical();
      } else {
        const message = dormReopenFailureMessage(result);
        showDormReopenFailure(message, dorm.__backendId);
      }
      return result;
    } catch (error) {
      console.warn('GATE Processing dorm reopen request or refresh failed:', error);
      const message = 'Dorm reopen status could not be confirmed. Refresh Processing and check the dorm state before retrying.';
      showDormReopenFailure(message, dorm.__backendId);
      return { isOk: false, code: 'result_unconfirmed', error: message };
    } finally {
      setModalCommandBusy(button, false);
      reopenInFlight = false;
    }
  }

  function reopenDormFromEditModalCanonical(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    return reopenDormCanonical(activeEditDormId(), { finalTime: document.getElementById('edit-closed-timer')?.value });
  }

  function ensureEditExtensionFields() {
    const notes = document.getElementById('edit-notes');
    if (!notes || document.getElementById('edit-assigned-airman')) return;
    const wrapper = notes.closest('div');
    if (!wrapper) return;
    wrapper.insertAdjacentHTML('beforebegin', `
      <div id="gate-edit-assignment-fields" class="gate-edit-record-grid">
        <div>
          <label class="block text-sm font-medium mb-1" for="edit-assigned-airman">Assigned Airman</label>
          <input id="edit-assigned-airman" type="text" class="w-full border rounded px-3 py-2 bg-transparent" style="border-color:var(--border);color:var(--text);">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1" for="edit-auditorium-location">Auditorium Location</label>
          <input id="edit-auditorium-location" type="text" class="w-full border rounded px-3 py-2 bg-transparent" style="border-color:var(--border);color:var(--text);">
        </div>
      </div>
    `);
  }

  function setEditMessage(message, isError = false) {
    const msg = document.getElementById('dorm-edit-msg');
    if (!msg) return;
    msg.textContent = message;
    msg.style.color = isError ? 'var(--red)' : 'var(--green)';
    msg.classList.toggle('hidden', !message);
  }

  function activeEditDormId() {
    try { return editDormId || ''; } catch (_) { return ''; }
  }

  function setActiveEditDorm(id) {
    try { editDormId = id || null; } catch (_) {}
  }

  function openDormEditModalCanonical(event, id) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
    if (!isInstructor()) return;
    const dorm = dormById(id);
    if (!dorm) return;
    ensureEditExtensionFields();
    setActiveEditDorm(id);
    editDormBaseline = { ...dorm };

    const setValue = (fieldId, value) => { const el = document.getElementById(fieldId); if (el) el.value = value ?? ''; };
    const setChecked = (fieldId, value) => { const el = document.getElementById(fieldId); if (el) el.checked = Boolean(value); };

    setValue('edit-dorm-name', dorm.dorm_name || '');
    setValue('edit-sdq', dorm.sdq || '');
    setValue('edit-section', dorm.section || '');
    setValue('edit-inter-sec', dorm.inter_sec || '');
    setValue('edit-sex', dorm.sex || 'male');
    setChecked('edit-band', dorm.band === true || dorm.band === 'true');
    setValue('edit-max-load', n(dorm.max_load));
    setValue('edit-current-load', n(dorm.current_load));
    setValue('edit-closed-timer', dorm.closed_timer || '');
    setValue('edit-notes', dorm.notes || '');
    setValue('edit-assigned-airman', dorm.assigned_airman || '');
    setValue('edit-auditorium-location', dorm.auditorium_location || '');

    setEditMessage('', false);
    const modal = document.getElementById('dorm-edit-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
    }

    window.GateDormReopenController?.refresh?.();
    window.runGateHooks?.('afterModalOpen', { modal: 'dorm-edit', dormId: id, source: 'gate-processing-controller' });
  }

  function closeDormEditModalCanonical() {
    const modal = document.getElementById('dorm-edit-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
    }
    setActiveEditDorm('');
    editDormBaseline = null;
  }

  function readEditPayload(dorm) {
    const value = id => document.getElementById(id)?.value;
    const checked = id => Boolean(document.getElementById(id)?.checked);
    const maxLoad = Math.max(0, Number(value('edit-max-load') || dorm.max_load || 0));
    const currentLoad = Math.min(Math.max(0, Number(value('edit-current-load') || dorm.current_load || 0)), maxLoad);
    const isClosed = String(dorm.state || '').toLowerCase() === 'closed';
    const rawFinalTime = value('edit-closed-timer');
    const finalTime = isClosed ? normalizeFinalTime(rawFinalTime, dorm.closed_timer || '00:00') : dorm.closed_timer;
    const existingFlags = recordDisplay()?.normalizeDormFlags?.(dorm);
    const isSpaceForce = existingFlags ? existingFlags.spaceForce : (dorm.space_force === true || dorm.space_force === 'true' || dorm.is_space_force === true || dorm.is_space_force === 'true');

    return {
      ...dorm,
      dorm_name: String(value('edit-dorm-name') || dorm.dorm_name || '').trim() || dorm.dorm_name,
      sdq: String(value('edit-sdq') || '').trim(),
      section: String(value('edit-section') || '').trim(),
      inter_sec: String(value('edit-inter-sec') || '').trim(),
      sex: value('edit-sex') || dorm.sex || 'male',
      band: !isSpaceForce && checked('edit-band') ? 'true' : 'false',
      max_load: maxLoad,
      current_load: currentLoad,
      notes: String(value('edit-notes') || '').trim(),
      assigned_airman: normalizeUpper(value('edit-assigned-airman')),
      auditorium_location: normalizeUpper(value('edit-auditorium-location')),
      phase: isClosed ? 'Closed' : dorm.phase,
      closed_timer: finalTime,
      updated_at: new Date().toISOString()
    };
  }

  async function handleEditSubmit(event) {
    if (event.target?.id !== 'dorm-edit-form') return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    if (!isInstructor()) return;
    const dorm = dormById(activeEditDormId());
    if (!dorm) return;

    const payload = readEditPayload(editDormBaseline || dorm);
    if (String(payload.state || '').toLowerCase() === 'closed' && !/^\d{1,5}:\d{2}$/.test(String(payload.closed_timer || ''))) {
      setEditMessage('Final Time must use MM:SS format, such as 60:00.', true);
      return;
    }

    const submit = event.target.querySelector('button[type="submit"]');
    const originalText = submit?.textContent || '';
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'SAVING...';
    }

    try {
      const result = await updateDorm(payload, { source: 'processing-edit-save', baseline:editDormBaseline || dorm,
        fields:['dorm_name','sdq','section','inter_sec','sex','band','max_load','current_load','notes','assigned_airman','auditorium_location','closed_timer'] });
      if (!result?.isOk) {
        setEditMessage(result?.error || 'Failed to save changes.', true);
        return;
      }
      setEditMessage('Changes saved.', false);
      window.setTimeout(closeDormEditModalCanonical, 180);
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = originalText || 'SAVE CHANGES';
      }
    }
  }

  async function deleteDormitoryCanonical() {
    if (!isInstructor()) return;
    const dorm = dormById(activeEditDormId());
    if (!dorm) return;
    const confirmed = confirm(`Delete dormitory ${dorm.dorm_name || 'this dorm'} from the current week group? This cannot be undone.`);
    if (!confirmed) return;
    const result = await window.dataSdk.delete(dorm);
    if (result?.isOk) {
      closeDormEditModalCanonical();
      forceRefresh('processing-delete-dorm');
    } else {
      setEditMessage(result?.error || 'Failed to delete dormitory.', true);
    }
  }

  function ensureContextMenu() {
    if (contextMenu) return contextMenu;
    contextMenu = document.createElement('div');
    contextMenu.id = 'gate-processing-context-menu';
    contextMenu.className = 'gate-processing-context-menu hidden';
    contextMenu.setAttribute('role', 'menu');
    contextMenu.setAttribute('aria-label', 'Processing dorm actions');
    contextMenu.dataset.owner = 'gate-processing-controller';
    document.body.appendChild(contextMenu);
    return contextMenu;
  }

  function hideContextMenu() {
    contextMenu?.classList.add('hidden');
  }

  function showContextMenu(event, dorm) {
    const menu = ensureContextMenu();
    const state = String(dorm.state || 'empty').toLowerCase();
    const stateAction = state === 'empty'
      ? '<button type="button" class="gate-processing-context-action" data-processing-context-action="open" role="menuitem">Open Record <span>▶</span></button>'
      : (state === 'open'
        ? '<button type="button" class="gate-processing-context-action danger" data-processing-context-action="close" role="menuitem">Close Record <span>■</span></button>'
        : '<button type="button" class="gate-processing-context-action" data-processing-context-action="reopen" role="menuitem">Reopen Record <span>↻</span></button>');

    menu.innerHTML = `
      <div class="gate-processing-context-title">
        ${esc(dorm.dorm_name || 'Dorm Record')}
        <span class="gate-processing-context-subtitle">${esc([dorm.sdq, dorm.section, dorm.inter_sec].filter(Boolean).join(' · ') || state.toUpperCase())} · ${esc(state.toUpperCase())}</span>
      </div>
      <button type="button" class="gate-processing-context-action" data-processing-context-action="edit" role="menuitem">Edit Record <span>↵</span></button>
      ${stateAction}
      <button type="button" class="gate-processing-context-action" data-processing-context-action="processing" role="menuitem">Open Processing Controls <span>⌘</span></button>
      <button type="button" class="gate-processing-context-action danger" data-processing-context-action="delete" role="menuitem">Delete Record <span>!</span></button>
    `;

    menu.dataset.dormId = dorm.__backendId || '';
    menu.classList.remove('hidden');
    const rect = menu.getBoundingClientRect();
    const pad = 10;
    const x = Math.min(event.clientX || pad, window.innerWidth - rect.width - pad);
    const y = Math.min(event.clientY || pad, window.innerHeight - rect.height - pad);
    menu.style.left = `${Math.max(pad, x)}px`;
    menu.style.top = `${Math.max(pad, y)}px`;
    menu.querySelector('.gate-processing-context-action')?.focus({ preventScroll: true });
  }

  function handleProcessingClick(event) {
    const phaseButton = event.target?.closest?.('[data-processing-phase]');
    if (phaseButton) {
      event.preventDefault();
      setPhaseCanonical(phaseButton.dataset.processingPhase);
      return;
    }

    const action = event.target?.closest?.('[data-processing-action]');
    if (action) {
      event.preventDefault();
      const id = action.dataset.dormId || activeModalDormId();
      if (action.dataset.processingAction === 'open-dorm') openDormCanonical(id);
      if (action.dataset.processingAction === 'close-dorm') closeDormCanonical(id);
      if (action.dataset.processingAction === 'reopen-dorm') reopenDormCanonical(id);
      if (action.dataset.processingAction === 'edit-record') openDormEditModalCanonical(event, id);
      return;
    }

    const contextAction = event.target?.closest?.('[data-processing-context-action]');
    if (contextAction) {
      event.preventDefault();
      const dorm = dormById(contextMenu?.dataset.dormId || '');
      hideContextMenu();
      if (!dorm) return;
      const actionName = contextAction.dataset.processingContextAction;
      if (actionName === 'edit') openDormEditModalCanonical(event, dorm.__backendId);
      if (actionName === 'open') openDormCanonical(dorm.__backendId);
      if (actionName === 'close') closeDormCanonical(dorm.__backendId);
      if (actionName === 'reopen') reopenDormCanonical(dorm.__backendId);
      if (actionName === 'processing') openDormModalCanonical(dorm.__backendId);
      if (actionName === 'delete') {
        openDormEditModalCanonical(event, dorm.__backendId);
        window.setTimeout(deleteDormitoryCanonical, 60);
      }
      return;
    }

    const card = event.target?.closest?.('#page-processing .proc-card[data-dorm-id]');
    if (card) {
      event.preventDefault();
      openDormModalCanonical(card.dataset.dormId);
      return;
    }

    if (!event.target?.closest?.('#gate-processing-context-menu')) hideContextMenu();
  }

  function handleProcessingContext(event) {
    const card = event.target?.closest?.('#page-processing .proc-card[data-dorm-id]');
    if (!card) return;
    if (!isInstructor()) {
      hideContextMenu();
      return;
    }
    const dorm = dormById(card.dataset.dormId);
    if (!dorm) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    showContextMenu(event, dorm);
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      hideContextMenu();
      const dormModal = document.getElementById('dorm-modal');
      if (dormModal && !dormModal.classList.contains('hidden')) closeDormModalCanonical(event);
      return;
    }
    if (event.key === 'Enter') {
      if (event.target?.id === 'modal-airman-input') {
        event.preventDefault();
        saveAssignedAirmanCanonical();
        return;
      }
      if (event.target?.matches?.('#page-processing .proc-card[data-dorm-id]')) {
        event.preventDefault();
        openDormModalCanonical(event.target.dataset.dormId);
      }
    }
  }

  function patchGlobals() {
    window.renderProcessingPage = renderProcessingPageCanonical;
    window.buildProcCard = processingCard;
    window.openDormModal = openDormModalCanonical;
    window.closeDormModal = closeDormModalCanonical;
    window.setPhase = setPhaseCanonical;
    window.modLoad = modLoadCanonical;
    window.setLoadFull = setLoadFullCanonical;
    window.saveLoad = saveLoadCanonical;
    window.saveAssignedAirman = saveAssignedAirmanCanonical;
    window.openDorm = openDormCanonical;
    window.closeDorm = closeDormCanonical;
    window.openDormEditModal = openDormEditModalCanonical;
    window.closeDormEditModal = closeDormEditModalCanonical;
    window.deleteDormitoryFromEditModal = deleteDormitoryCanonical;
    window.reopenDormFromEditModal = reopenDormFromEditModalCanonical;

    try { renderProcessingPage = renderProcessingPageCanonical; } catch (_) {}
    try { buildProcCard = processingCard; } catch (_) {}
    try { openDormModal = openDormModalCanonical; } catch (_) {}
    try { closeDormModal = closeDormModalCanonical; } catch (_) {}
    try { setPhase = setPhaseCanonical; } catch (_) {}
    try { modLoad = modLoadCanonical; } catch (_) {}
    try { setLoadFull = setLoadFullCanonical; } catch (_) {}
    try { saveLoad = saveLoadCanonical; } catch (_) {}
    try { saveAssignedAirman = saveAssignedAirmanCanonical; } catch (_) {}
    try { openDorm = openDormCanonical; } catch (_) {}
    try { closeDorm = closeDormCanonical; } catch (_) {}
    try { openDormEditModal = openDormEditModalCanonical; } catch (_) {}
    try { closeDormEditModal = closeDormEditModalCanonical; } catch (_) {}
    try { deleteDormitoryFromEditModal = deleteDormitoryCanonical; } catch (_) {}
    try { reopenDormFromEditModal = reopenDormFromEditModalCanonical; } catch (_) {}
  }

  function bindEditSubmit() {
    if (editSubmitBound) return;
    document.addEventListener('submit', handleEditSubmit, true);
    document.addEventListener('blur', event => {
      if (event.target?.id === 'edit-closed-timer') {
        const dorm = dormById(activeEditDormId());
        event.target.value = normalizeFinalTime(event.target.value, dorm?.closed_timer || '00:00');
      }
    }, true);
    editSubmitBound = true;
  }

  function start() {
    if (installed) return;
    installed = true;
    ensureContextMenu();
    ensureEditExtensionFields();
    patchGlobals();
    bindEditSubmit();
    document.addEventListener('click', handleProcessingClick, true);
    document.addEventListener('contextmenu', handleProcessingContext, true);
    document.addEventListener('auxclick', handleProcessingContext, true);
    document.addEventListener('keydown', handleKeydown, true);
    window.addEventListener('resize', hideContextMenu, true);
    window.registerGateHook?.('afterRenderAll', () => scheduleRender({ force: true }));
    window.registerGateHook?.('afterDataChanged', () => scheduleRender({ force: true }));
    window.registerGateHook?.('afterPageChange', () => scheduleRender());
    window.setInterval(updateProcessingTimers, 1000);

    window.GateProcessingController = Object.freeze({
      isCanonicalOwner: true,
      render: renderProcessingPageCanonical,
      scheduleRender,
      openDormModal: openDormModalCanonical,
      closeDormModal: closeDormModalCanonical,
      openDorm: openDormCanonical,
      closeDorm: closeDormCanonical,
      reopenDorm: reopenDormCanonical,
      openDormEditModal: openDormEditModalCanonical,
      closeDormEditModal: closeDormEditModalCanonical,
      saveLoad: saveLoadCanonical,
      saveAssignedAirman: saveAssignedAirmanCanonical,
      updateDorm,
      refresh: () => forceRefresh('processing-refresh')
    });

    scheduleRender({ force: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();