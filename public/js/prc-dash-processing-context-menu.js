// PRC GATE Processing page instructor context menu
// Behavior-only layer. Canonical styles live in /css/prc-dash-modal-systems.css.
(function () {
  let started = false;
  let menuEl = null;
  let sdkPatched = false;
  let editOpenPatched = false;
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

  function deleteViaEditModal(id) {
    hideMenu();
    openEditModal(id);
    setTimeout(() => {
      if (typeof deleteDormitoryFromEditModal === 'function') deleteDormitoryFromEditModal();
    }, 50);
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
      <button type="button" class="gate-processing-context-action" data-action="processing" role="menuitem">Open Processing Controls <span>⌘</span></button>
      <button type="button" class="gate-processing-context-action danger" data-action="delete" role="menuitem">Delete Record <span>!</span></button>
    `;

    menu.querySelector('[data-action="edit"]')?.addEventListener('click', () => openEditModal(dorm.__backendId));
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
    if (!dorm || !airman || !auditorium) return;
    airman.value = dorm.assigned_airman || '';
    auditorium.value = dorm.auditorium_location || '';
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

  function patchDataSdkUpdate() {
    if (sdkPatched || !window.dataSdk || typeof window.dataSdk.update !== 'function') return;
    const originalUpdate = window.dataSdk.update.bind(window.dataSdk);
    window.dataSdk.update = function patchedProcessingContextUpdate(payload) {
      const editModal = document.getElementById('dorm-edit-modal');
      if (payload && payload.type === 'dorm' && editModal && !editModal.classList.contains('hidden')) {
        const airman = document.getElementById('edit-assigned-airman');
        const auditorium = document.getElementById('edit-auditorium-location');
        if (airman || auditorium) {
          payload = Object.assign({}, payload, {
            assigned_airman: airman ? normalizeUpper(airman.value) : payload.assigned_airman,
            auditorium_location: auditorium ? normalizeUpper(auditorium.value) : payload.auditorium_location
          });
        }
      }
      return originalUpdate(payload);
    };
    sdkPatched = true;
  }

  function runPass() {
    passScheduled = false;
    ensureMenu();
    ensureEditRecordFields();
    patchEditOpen();
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
    document.addEventListener('input', event => {
      if (event.target?.matches?.('#edit-assigned-airman, #edit-auditorium-location')) schedulePass();
    }, true);
    window.addEventListener('scroll', hideMenu, true);
    window.addEventListener('resize', () => { hideMenu(); schedulePass(); }, true);
    observeModalTargets();
    schedulePass();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
