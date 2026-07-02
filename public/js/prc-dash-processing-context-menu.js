// PRC GATE Processing page instructor context menu
// Adds a clean right-click action menu for Processing dorm cards and exposes all dorm-level correction fields.
(function () {
  let started = false;
  let stylesReady = false;
  let menuEl = null;
  let sdkPatched = false;
  let editOpenPatched = false;

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

  function ensureStyles() {
    if (stylesReady || document.getElementById('prc-gate-processing-context-menu-styles')) return;

    const style = document.createElement('style');
    style.id = 'prc-gate-processing-context-menu-styles';
    style.textContent = `
      .gate-processing-context-menu {
        position: fixed !important;
        z-index: calc(var(--z-modal-window, 600) + 40) !important;
        width: min(86vw, 260px) !important;
        padding: 0.42rem !important;
        border: 1px solid var(--gate-glass-border-strong, rgba(255,255,255,0.18)) !important;
        border-radius: var(--radius-lg, 18px) !important;
        background:
          radial-gradient(circle at 18% 0%, rgba(56, 189, 248, 0.16), transparent 42%),
          var(--gate-glass-bg-strong, rgba(15,23,42,0.92)) !important;
        box-shadow: var(--gate-glass-edge, inset 0 1px 0 rgba(255,255,255,0.12)), var(--gate-shadow-strong, 0 18px 40px rgba(0,0,0,0.34)) !important;
        -webkit-backdrop-filter: blur(var(--gate-glass-blur-strong, 22px)) saturate(1.22) !important;
        backdrop-filter: blur(var(--gate-glass-blur-strong, 22px)) saturate(1.22) !important;
      }

      .gate-processing-context-title {
        padding: 0.42rem 0.52rem 0.5rem !important;
        border-bottom: 1px solid var(--gate-glass-border, rgba(255,255,255,0.12)) !important;
        color: var(--text, #fff) !important;
        font-size: 0.72rem !important;
        font-weight: 950 !important;
        line-height: 1.05 !important;
        letter-spacing: 0.075em !important;
        text-transform: uppercase !important;
      }

      .gate-processing-context-subtitle {
        display: block !important;
        margin-top: 0.22rem !important;
        color: var(--text-muted, #94a3b8) !important;
        font-size: 0.58rem !important;
        font-weight: 850 !important;
        letter-spacing: 0.06em !important;
      }

      .gate-processing-context-action {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 0.7rem !important;
        width: 100% !important;
        margin-top: 0.32rem !important;
        padding: 0.58rem 0.62rem !important;
        border: 1px solid transparent !important;
        border-radius: var(--radius-md, 14px) !important;
        background: transparent !important;
        color: var(--text, #fff) !important;
        font-size: 0.72rem !important;
        font-weight: 900 !important;
        letter-spacing: 0.055em !important;
        text-align: left !important;
        text-transform: uppercase !important;
        cursor: pointer !important;
      }

      .gate-processing-context-action:hover,
      .gate-processing-context-action:focus-visible {
        border-color: rgba(125, 211, 252, 0.46) !important;
        background: rgba(56, 189, 248, 0.14) !important;
        outline: none !important;
      }

      .gate-processing-context-action.danger:hover,
      .gate-processing-context-action.danger:focus-visible {
        border-color: rgba(248, 113, 113, 0.52) !important;
        background: rgba(248, 113, 113, 0.12) !important;
      }

      .gate-edit-record-grid {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
        gap: 0.5rem !important;
      }

      .gate-edit-record-grid input {
        text-transform: uppercase !important;
      }

      @media (max-width: 640px) {
        .gate-edit-record-grid {
          grid-template-columns: minmax(0, 1fr) !important;
        }
      }
    `;

    document.head.appendChild(style);
    stylesReady = true;
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
    ensureStyles();
    ensureMenu();
    ensureEditRecordFields();
    patchEditOpen();
    patchDataSdkUpdate();

    const editModal = document.getElementById('dorm-edit-modal');
    if (editModal && !editModal.classList.contains('hidden')) syncEditRecordFields();
  }

  function start() {
    if (started) return;
    started = true;
    document.addEventListener('contextmenu', handleProcessingContext, true);
    document.addEventListener('click', event => {
      if (!event.target?.closest?.('#gate-processing-context-menu')) hideMenu();
    }, true);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') hideMenu();
      if (event.key === 'Enter' && !menuEl?.classList.contains('hidden')) {
        const focused = document.activeElement;
        if (focused?.classList?.contains('gate-processing-context-action')) focused.click();
      }
    }, true);
    window.addEventListener('scroll', hideMenu, true);
    window.addEventListener('resize', hideMenu, true);
    runPass();
    setInterval(runPass, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
