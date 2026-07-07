// PRC GATE Processing page instructor context menu
// Behavior layer for instructor record actions, edit-record field preservation, and record refresh.
(function () {
  let started = false;
  let menuEl = null;
  let sdkPatched = false;
  let editOpenPatched = false;
  let closeDormPatched = false;
  let passScheduled = false;

  function esc(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getAllDataSafe() {
    if (Array.isArray(window.allData)) return window.allData;
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function isInstructor() {
    try { return currentRole === 'instructor'; } catch (_) { return false; }
  }

  function getDormById(id) {
    return getAllDataSafe().find(record => record && record.type === 'dorm' && record.__backendId === id) || null;
  }

  function getEditDormIdSafe() {
    try { return editDormId || ''; } catch (_) { return ''; }
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

  function ensureMenu() {
    if (menuEl) return menuEl;
    menuEl = document.createElement('div');
    menuEl.id = 'gate-processing-context-menu';
    menuEl.className = 'gate-processing-context-menu hidden';
    menuEl.setAttribute('role', 'menu');
    menuEl.setAttribute('aria-label', 'Processing dorm actions');
    document.body.appendChild(menuEl);
    return menuEl;
  }

  function cardDormId(card) {
    const onclick = card?.getAttribute?.('onclick') || '';
    const contextmenu = card?.getAttribute?.('oncontextmenu') || '';
    const match = onclick.match(/openDormModal\('([^']+)'\)/) || contextmenu.match(/openDormEditModal\([^,]+,\s*'([^']+)'\)/);
    return match ? match[1] : '';
  }

  function hideMenu() {
    if (menuEl) menuEl.classList.add('hidden');
  }

  function syncLocalRecord(record) {
    if (!record || !record.__backendId) return;
    const list = getAllDataSafe();
    if (!Array.isArray(list)) return;
    const index = list.findIndex(item => item && item.__backendId === record.__backendId);
    if (index >= 0) list[index] = { ...list[index], ...record };
    else list.push(record);
  }

  function forceRecordRefresh() {
    try { if (typeof renderAll === 'function') renderAll(); } catch (error) { console.warn('GATE Processing render refresh failed:', error); }
    try { window.GateDormBoardController?.refresh?.(); } catch (_) {}
    try { window.GateActiveBusController?.render?.({ force: true }); } catch (_) {}
    try { window.runGateHooks?.('afterDataChanged', { source: 'processing-record-update' }); } catch (_) {}
    schedulePass();
  }

  function showEditMessage(message, isError = false) {
    const msg = document.getElementById('dorm-edit-msg');
    if (!msg) return;
    msg.textContent = message;
    msg.style.color = isError ? 'var(--red)' : 'var(--green)';
    msg.classList.remove('hidden');
  }

  function openEditModal(id) {
    hideMenu();
    if (typeof openDormEditModal === 'function') {
      openDormEditModal({ preventDefault() {}, stopPropagation() {} }, id);
      syncEditRecordFields(id);
    }
  }

  function openProcessingModal(id) {
    hideMenu();
    if (typeof openDormModal === 'function') openDormModal(id);
  }

  async function updateDormRecord(payload, options = {}) {
    if (!payload || payload.type !== 'dorm' || !payload.__backendId) return { isOk: false, error: 'Missing dorm record.' };
    const result = await window.dataSdk.update(payload);
    if (result?.isOk) {
      syncLocalRecord(result.data || payload);
      if (options.soundType && typeof createSoundEvent === 'function') {
        try { await createSoundEvent(options.soundType, options.soundPayload || {}); } catch (error) { console.warn('GATE Processing sound event failed:', error); }
      }
      forceRecordRefresh();
    }
    return result;
  }

  async function openRecord(id) {
    hideMenu();
    if (!isInstructor()) return;
    const dorm = getDormById(id);
    if (!dorm) return;
    const now = new Date().toISOString();
    const result = await updateDormRecord({
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
      soundType: 'dorm_open',
      soundPayload: { dorm_id: id, dorm_name: dorm.dorm_name || '', action: 'open_dorm' }
    });
    if (!result?.isOk) showEditMessage(result?.error || 'Failed to open dorm.', true);
  }

  async function closeRecord(id) {
    hideMenu();
    if (!isInstructor()) return;
    const dorm = getDormById(id);
    if (!dorm) return;
    const finalTime = computeFinalTime(dorm);
    const now = new Date().toISOString();
    const result = await updateDormRecord({
      ...dorm,
      state: 'closed',
      phase: 'Closed',
      closed_timer: finalTime,
      closed_at: now,
      updated_at: now
    }, {
      soundType: 'dorm_closed',
      soundPayload: { dorm_id: id, dorm_name: dorm.dorm_name || '', final_time: finalTime, action: 'close_dorm' }
    });
    if (!result?.isOk) showEditMessage(result?.error || 'Failed to close dorm.', true);
    if (typeof closeDormModal === 'function') closeDormModal();
  }

  function deleteViaEditModal(id) {
    hideMenu();
    openEditModal(id);
    setTimeout(() => {
      if (typeof deleteDormitoryFromEditModal === 'function') deleteDormitoryFromEditModal();
    }, 50);
  }

  function stateActionMarkup(dorm) {
    const state = String(dorm?.state || '').toLowerCase();
    if (state === 'empty') return '<button type="button" class="gate-processing-context-action" data-action="open" role="menuitem">Open Record <span>▶</span></button>';
    if (state === 'open') return '<button type="button" class="gate-processing-context-action danger" data-action="close" role="menuitem">Close Record <span>■</span></button>';
    return '';
  }

  function showMenu(event, card, dorm) {
    const menu = ensureMenu();
    const state = dorm.state ? String(dorm.state).toUpperCase() : 'UNKNOWN';
    const info = [dorm.sdq, dorm.section, dorm.inter_sec].filter(Boolean).join(' · ');

    menu.innerHTML = `
      <div class="gate-processing-context-title">
        ${esc(dorm.dorm_name || 'Dorm Record')}
        <span class="gate-processing-context-subtitle">${esc(info || state)} · ${esc(state)}</span>
      </div>
      <button type="button" class="gate-processing-context-action" data-action="edit" role="menuitem">Edit Record <span>↵</span></button>
      ${stateActionMarkup(dorm)}
      <button type="button" class="gate-processing-context-action" data-action="processing" role="menuitem">Open Processing Controls <span>⌘</span></button>
      <button type="button" class="gate-processing-context-action danger" data-action="delete" role="menuitem">Delete Record <span>!</span></button>
    `;

    menu.querySelector('[data-action="edit"]')?.addEventListener('click', () => openEditModal(dorm.__backendId));
    menu.querySelector('[data-action="open"]')?.addEventListener('click', () => openRecord(dorm.__backendId));
    menu.querySelector('[data-action="close"]')?.addEventListener('click', () => closeRecord(dorm.__backendId));
    menu.querySelector('[data-action="processing"]')?.addEventListener('click', () => openProcessingModal(dorm.__backendId));
    menu.querySelector('[data-action="delete"]')?.addEventListener('click', () => deleteViaEditModal(dorm.__backendId));

    menu.classList.remove('hidden');

    const rect = menu.getBoundingClientRect();
    const pad = 10;
    const x = Math.min(event.clientX, window.innerWidth - rect.width - pad);
    const y = Math.min(event.clientY, window.innerHeight - rect.height - pad);
    menu.style.left = `${Math.max(pad, x)}px`;
    menu.style.top = `${Math.max(pad, y)}px`;

    const firstAction = menu.querySelector('.gate-processing-context-action');
    if (firstAction) firstAction.focus({ preventScroll: true });
  }

  function handleProcessingContext(event) {
    const card = event.target?.closest?.('#page-processing .proc-card');
    if (!card) return;

    if (!isInstructor()) {
      hideMenu();
      return;
    }

    const id = cardDormId(card);
    const dorm = id ? getDormById(id) : null;
    if (!dorm) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    showMenu(event, card, dorm);
  }

  function ensureEditRecordFields() {
    const notes = document.getElementById('edit-notes');
    if (!notes || document.getElementById('edit-assigned-airman')) return;

    const notesWrapper = notes.closest('div');
    if (!notesWrapper) return;

    notesWrapper.insertAdjacentHTML('beforebegin', `
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

  function syncEditRecordFields(id) {
    ensureEditRecordFields();
    const dormId = id || getEditDormIdSafe();
    const dorm = dormId ? getDormById(dormId) : null;
    const airman = document.getElementById('edit-assigned-airman');
    const auditorium = document.getElementById('edit-auditorium-location');
    const finalTime = document.getElementById('edit-closed-timer');
    if (!dorm) return;
    if (airman) airman.value = dorm.assigned_airman || '';
    if (auditorium) auditorium.value = dorm.auditorium_location || '';
    if (finalTime && String(dorm.state || '').toLowerCase() === 'closed' && !finalTime.value) finalTime.value = normalizeFinalTime(dorm.closed_timer, '00:00');
  }

  function patchEditOpen() {
    if (editOpenPatched || typeof openDormEditModal !== 'function') return;
    const originalOpen = openDormEditModal;
    const patchedOpen = function patchedProcessingEditOpen(event, id) {
      const result = originalOpen.apply(this, arguments);
      syncEditRecordFields(id);
      return result;
    };
    window.openDormEditModal = patchedOpen;
    try { openDormEditModal = patchedOpen; } catch (_) {}
    editOpenPatched = true;
  }

  function patchCloseDorm() {
    if (closeDormPatched || typeof closeDorm !== 'function') return;
    const patchedCloseDorm = function patchedProcessingCloseDorm(id) {
      return closeRecord(id);
    };
    window.closeDorm = patchedCloseDorm;
    try { closeDorm = patchedCloseDorm; } catch (_) {}
    closeDormPatched = true;
  }

  function patchDataSdkUpdate() {
    if (sdkPatched || !window.dataSdk || typeof window.dataSdk.update !== 'function') return;
    const originalUpdate = window.dataSdk.update.bind(window.dataSdk);
    window.dataSdk.update = async function patchedProcessingContextUpdate(payload) {
      const editModal = document.getElementById('dorm-edit-modal');
      if (payload && payload.type === 'dorm' && editModal && !editModal.classList.contains('hidden')) {
        const airman = document.getElementById('edit-assigned-airman');
        const auditorium = document.getElementById('edit-auditorium-location');
        const finalTimeInput = document.getElementById('edit-closed-timer');
        const isClosed = String(payload.state || '').toLowerCase() === 'closed';
        payload = Object.assign({}, payload, {
          assigned_airman: airman ? normalizeUpper(airman.value) : payload.assigned_airman,
          auditorium_location: auditorium ? normalizeUpper(auditorium.value) : payload.auditorium_location,
          updated_at: new Date().toISOString(),
          ...(isClosed && finalTimeInput ? { closed_timer: normalizeFinalTime(finalTimeInput.value, payload.closed_timer || '00:00') } : {})
        });
      }

      const result = await originalUpdate(payload);
      if (result?.isOk && payload?.type === 'dorm') {
        syncLocalRecord(result.data || payload);
        forceRecordRefresh();
      }
      return result;
    };
    sdkPatched = true;
  }

  function runPass() {
    passScheduled = false;
    ensureMenu();
    ensureEditRecordFields();
    patchEditOpen();
    patchCloseDorm();
    patchDataSdkUpdate();

    const editModal = document.getElementById('dorm-edit-modal');
    if (editModal && !editModal.classList.contains('hidden')) syncEditRecordFields();
  }

  function schedulePass() {
    if (passScheduled) return;
    passScheduled = true;
    requestAnimationFrame(runPass);
  }

  function observeModalTargets() {
    const observer = new MutationObserver(schedulePass);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function start() {
    if (started) return;
    started = true;
    document.addEventListener('contextmenu', handleProcessingContext, true);
    document.addEventListener('click', event => {
      if (!event.target?.closest?.('#gate-processing-context-menu')) hideMenu();
      schedulePass();
    }, true);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') hideMenu();
      if (event.key === 'Enter' && !menuEl?.classList.contains('hidden')) {
        const focused = document.activeElement;
        if (focused?.classList?.contains('gate-processing-context-action')) focused.click();
      }
    }, true);
    document.addEventListener('blur', event => {
      if (event.target?.matches?.('#edit-closed-timer')) {
        event.target.value = normalizeFinalTime(event.target.value, '00:00');
      }
    }, true);
    document.addEventListener('input', event => {
      if (event.target?.matches?.('#edit-assigned-airman, #edit-auditorium-location, #edit-closed-timer')) schedulePass();
    }, true);
    window.addEventListener('scroll', hideMenu, true);
    window.addEventListener('resize', () => { hideMenu(); schedulePass(); }, true);
    observeModalTargets();
    schedulePass();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
