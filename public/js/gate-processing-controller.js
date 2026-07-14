// GATE Phase 2 Processing Controller
// Canonical owner for Processing page cards, dorm modal, edit modal workflow, instructor context menu, Airman-safe close, final-time commit, and reopen access.
(function () {
  'use strict';

  const PHASES = ['OPEN', 'LOBBY', 'AUDITORIUM', 'STANDBY', 'INITIAL ISSUE', 'ITEM SETUP', 'LATRINE', 'FIT TEST', 'EATING', 'READY TO DEPART'];

  let installed = false;
  let renderQueued = false;
  let contextMenu = null;
  let editSubmitBound = false;

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
    try { return currentRole === 'instructor'; } catch (_) { return false; }
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
    if (index >= 0) list[index] = { ...list[index], ...record };
    else list.push(record);
  }

  function forceRefresh(source = 'processing-controller') {
    try { window.GateStatusBoardController?.scheduleRender?.({ force: true }); } catch (_) {}
    try { window.GateDormBoardController?.refresh?.(); } catch (_) {}
    try { window.runGateHooks?.('afterDataChanged', { source }); } catch (_) {}
    scheduleRender({ force: true });
  }

  function stateLabelHtml(dorm) {
    const state = String(dorm?.state || 'empty').toLowerCase();
    if (state === 'empty') return '<span class="text-xs font-bold uppercase px-2 py-1 rounded" style="background:var(--surface-alt);">EMPTY</span>';
    if (state === 'open') return '<span class="text-xs font-bold uppercase px-2 py-1 rounded text-white" style="background:var(--green);">OPEN</span>';
    return '<span class="text-xs font-bold uppercase px-2 py-1 rounded text-white" style="background:var(--red);">CLOSED</span>';
  }

  function timerHtml(dorm) {
    const state = String(dorm?.state || 'empty').toLowerCase();
    if (state === 'open' && dorm.opened_at && typeof getElapsedTimer === 'function') {
      const timer = getElapsedTimer(dorm.opened_at);
      return `<div class="text-2xl font-mono font-black font-tabular timer-display" data-opened="${esc(dorm.opened_at)}" data-dorm-id="${esc(dorm.__backendId)}">${esc(timer.text || '00:00')}</div>`;
    }
    if (state === 'closed' && dorm.closed_timer) return `<div class="text-2xl font-mono font-black font-tabular text-muted">${esc(dorm.closed_timer)}</div>`;
    return '';
  }

  function processingCard(dorm) {
    const female = String(dorm?.sex || '').toLowerCase() === 'female';
    const normalizedFlags = recordDisplay()?.normalizeDormFlags?.(dorm);
    const band = normalizedFlags ? normalizedFlags.band : (dorm?.band === true || dorm?.band === 'true');
    const spaceForce = normalizedFlags ? normalizedFlags.spaceForce : (dorm?.space_force === true || dorm?.space_force === 'true' || dorm?.is_space_force === true || dorm?.is_space_force === 'true');
    const borderClass = female ? 'border-female' : (spaceForce ? 'border-space-force' : (band ? 'border-band' : ''));
    const closedClass = dorm.state === 'closed' ? 'dorm-closed' : '';
    const assignedAirmanHtml = dorm.assigned_airman
      ? `<div class="text-[10px] font-black uppercase tracking-wider text-muted mt-1 text-right">${esc(dorm.assigned_airman)}</div>`
      : '';
    const phaseHtml = dorm.state === 'closed'
      ? '<div class="text-sm font-bold mt-1" style="color:var(--text-muted);">CLOSED</div>'
      : (dorm.phase ? `<div class="text-sm font-bold mt-1" style="color:var(--green);">${esc(dorm.phase)}</div>` : '');
    const info = [esc(dorm.sdq), esc(dorm.section), esc(dorm.inter_sec)].filter(Boolean).join(' · ');

    return `<div class="proc-card ${borderClass} ${closedClass}" data-component="processing-dorm-card" data-owner="gate-processing-controller" data-dorm-id="${esc(dorm.__backendId)}" data-state="${esc(dorm.state || 'empty')}" tabindex="0" role="button" aria-label="Open Processing controls for ${esc(dorm.dorm_name || 'dorm')}">
      <div class="flex justify-between items-start mb-2 gap-3">
        <div class="font-black text-3xl">${esc(dorm.dorm_name || '')}</div>
        <div class="flex flex-col items-end">
          ${stateLabelHtml(dorm)}
          ${assignedAirmanHtml}
        </div>
      </div>
      <div class="text-xs text-muted font-bold uppercase">${info}</div>
      <div class="text-xl font-black font-tabular mt-2">${n(dorm.current_load)} / ${n(dorm.max_load)}</div>
      ${phaseHtml}
      ${timerHtml(dorm)}
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
    page.querySelectorAll('.timer-display[data-opened]').forEach(timer => {
      if (!timer.dataset.opened || typeof getElapsedTimer !== 'function') return;
      const elapsed = getElapsedTimer(timer.dataset.opened);
      if (elapsed?.text) timer.textContent = elapsed.text;
      timer.classList.toggle('timer-yellow', elapsed?.minutes >= 45 && elapsed?.minutes < 60);
      timer.classList.toggle('timer-red', elapsed?.minutes >= 60);
      timer.classList.toggle('timer-flash', elapsed?.minutes >= 60);
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

  function instructorModalActions(id, state) {
    const editButton = `<button type="button" data-processing-action="edit-record" data-dorm-id="${esc(id)}" class="px-6 py-3 rounded-lg font-bold text-white text-lg" style="background:var(--surface-alt);border:1px solid var(--border);color:var(--text);">EDIT RECORD</button>`;
    if (state === 'empty') {
      return `<button type="button" data-processing-action="open-dorm" data-dorm-id="${esc(id)}" class="px-8 py-3 rounded-lg font-bold text-white text-lg" style="background:var(--green);">OPEN DORM</button>${editButton}`;
    }
    if (state === 'open') {
      return `<button type="button" data-processing-action="close-dorm" data-dorm-id="${esc(id)}" class="px-8 py-3 rounded-lg font-bold text-white text-lg" style="background:var(--red);">CLOSE DORM</button>${editButton}`;
    }
    return `<button type="button" data-processing-action="reopen-dorm" data-dorm-id="${esc(id)}" class="px-8 py-3 rounded-lg font-bold text-white text-lg" style="background:linear-gradient(135deg,#2563eb,#38bdf8);">REOPEN DORM</button>${editButton}`;
  }

  function openDormModalCanonical(id) {
    const dorm = dormById(id);
    if (!dorm) return;
    setActiveModalDorm(id);

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
    await updateDorm({ ...dorm, phase, updated_at: new Date().toISOString() }, { source: 'processing-phase-update' });
    closeDormModalCanonical();
  }

  function modLoadCanonical(delta) {
    const input = document.getElementById('modal-load-input');
    if (!input) return;
    input.value = String(Math.max(0, n(input.value) + Number(delta || 0)));
  }

  function setLoadFullCanonical() {
    const dorm = dormById(activeModalDormId());
    const input = document.getElementById('modal-load-input');
    if (dorm && input) input.value = String(n(dorm.max_load));
  }

  async function saveLoadCanonical() {
    const dorm = dormById(activeModalDormId());
    const input = document.getElementById('modal-load-input');
    if (!dorm || !input) return;
    await updateDorm({ ...dorm, current_load: Math.max(0, n(input.value)), updated_at: new Date().toISOString() }, { source: 'processing-load-update' });
  }

  async function saveAssignedAirmanCanonical() {
    const dorm = dormById(activeModalDormId());
    const input = document.getElementById('modal-airman-input');
    if (!dorm || !input) return;
    await updateDorm({ ...dorm, assigned_airman: normalizeUpper(input.value), updated_at: new Date().toISOString() }, { source: 'processing-airman-update' });
    closeDormModalCanonical();
  }

  async function openDormCanonical(id) {
    if (!isInstructor()) return;
    const dorm = dormById(id);
    if (!dorm) return;
    const now = new Date().toISOString();
    await updateDorm({
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
      soundType: 'dorm_open',
      soundPayload: { dorm_id: id, dorm_name: dorm.dorm_name || '', action: 'open_dorm' }
    });
    closeDormModalCanonical();
  }

  async function closeDormCanonical(id) {
    if (!isInstructor()) return;
    const dorm = dormById(id);
    if (!dorm) return;
    const finalTime = computeFinalTime(dorm);
    const now = new Date().toISOString();
    await updateDorm({
      ...dorm,
      state: 'closed',
      phase: 'Closed',
      closed_timer: finalTime,
      closed_at: now,
      updated_at: now
    }, {
      source: 'processing-close-dorm',
      soundType: 'dorm_closed',
      soundPayload: { dorm_id: id, dorm_name: dorm.dorm_name || '', final_time: finalTime, action: 'close_dorm' }
    });
    closeDormModalCanonical();
  }

  async function reopenDormCanonical(id, options = {}) {
    if (!isInstructor()) return;
    const dorm = dormById(id || activeEditDormId() || activeModalDormId());
    if (!dorm) return;
    if (String(dorm.state || '').toLowerCase() !== 'closed') {
      setEditMessage('Only closed dorms can be reopened.', true);
      return;
    }

    const finalTimeSource = options.finalTime || document.getElementById('edit-closed-timer')?.value || dorm.closed_timer || '00:00';
    const elapsedSeconds = parseTimerToSeconds(finalTimeSource);
    const reopenedOpenedAt = new Date(Date.now() - (elapsedSeconds * 1000)).toISOString();
    const now = new Date().toISOString();

    await updateDorm({
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
      soundType: 'dorm_open',
      soundPayload: { dorm_id: dorm.__backendId, dorm_name: dorm.dorm_name || '', action: 'reopen_dorm' }
    });

    closeDormModalCanonical();
    closeDormEditModalCanonical();
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

    const payload = readEditPayload(dorm);
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
      const result = await updateDorm(payload, { source: 'processing-edit-save' });
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