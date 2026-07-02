// PRC GATE Auditorium Location support
// Behavior-only layer. Canonical styles live in /css/prc-dash-dorm-cards.css and /css/prc-dash-modal-systems.css.
(function () {
  let started = false;
  let modalPatched = false;
  let savePatched = false;
  let keyPatched = false;
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

  function getActiveWeekGroupSafe() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function getModalDormIdSafe() {
    try { return modalDormId || ''; } catch (_) { return ''; }
  }

  function activeDorms() {
    const wg = getActiveWeekGroupSafe();
    return getAllDataSafe().filter(record => record && record.type === 'dorm' && record.week_group === wg);
  }

  function normalizeLocation(value) {
    return String(value ?? '').trim().toUpperCase();
  }

  function ensureAuditoriumInput() {
    const airmanInput = document.getElementById('modal-airman-input');
    if (!airmanInput || document.getElementById('modal-auditorium-input')) return;

    const container = airmanInput.closest('.mb-6');
    const flex = airmanInput.closest('.flex');
    if (!container || !flex) return;

    const label = container.querySelector('label[for="modal-airman-input"]');
    if (label) label.textContent = 'Airman / Auditorium Location';

    flex.classList.add('gate-airman-location-grid');
    airmanInput.classList.remove('flex-1');
    airmanInput.insertAdjacentHTML('afterend', `
      <input
        id="modal-auditorium-input"
        type="text"
        placeholder="AUDITORIUM LOCATION"
        class="border rounded px-3 py-2 bg-transparent text-sm uppercase"
        style="border-color:var(--border);color:var(--text);"
        onkeydown="handleAuditoriumInputKey(event)"
      >
    `);

    const saveButton = flex.querySelector('button[onclick="saveAssignedAirman()"]');
    if (saveButton) saveButton.textContent = 'SAVE';
  }

  function getDormById(id) {
    return getAllDataSafe().find(record => record && record.type === 'dorm' && record.__backendId === id) || null;
  }

  function patchOpenDormModal() {
    if (modalPatched || typeof openDormModal !== 'function') return;
    const originalOpen = openDormModal;
    const patchedOpen = function patchedOpenDormModal(id) {
      const result = originalOpen.apply(this, arguments);
      ensureAuditoriumInput();
      const dorm = getDormById(id);
      const input = document.getElementById('modal-auditorium-input');
      if (input && dorm) input.value = dorm.auditorium_location || '';
      return result;
    };
    window.openDormModal = patchedOpen;
    try { openDormModal = patchedOpen; } catch (_) {}
    modalPatched = true;
  }

  function patchSaveAssignedAirman() {
    if (savePatched || typeof saveAssignedAirman !== 'function') return;
    const patchedSave = async function patchedSaveAssignedAirman() {
      const id = getModalDormIdSafe();
      if (!id) return;
      const dorm = getDormById(id);
      if (!dorm) return;

      const assignedAirman = document.getElementById('modal-airman-input')?.value.trim().toUpperCase() || '';
      const auditoriumLocation = normalizeLocation(document.getElementById('modal-auditorium-input')?.value || '');

      await window.dataSdk.update({
        ...dorm,
        assigned_airman: assignedAirman,
        auditorium_location: auditoriumLocation
      });

      if (typeof closeDormModal === 'function') closeDormModal();
    };

    window.saveAssignedAirman = patchedSave;
    try { saveAssignedAirman = patchedSave; } catch (_) {}
    savePatched = true;
  }

  function patchAuditoriumKeyHandler() {
    if (keyPatched) return;
    window.handleAuditoriumInputKey = function handleAuditoriumInputKey(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (typeof saveAssignedAirman === 'function') saveAssignedAirman();
      }
    };
    keyPatched = true;
  }

  function cardId(card) {
    const onclick = card?.getAttribute?.('onclick') || '';
    const contextmenu = card?.getAttribute?.('oncontextmenu') || '';
    const match = onclick.match(/openDormModal\('([^']+)'\)/) || contextmenu.match(/openDormEditModal\([^,]+,\s*'([^']+)'\)/);
    return match ? match[1] : '';
  }

  function setLocation(card, dorm) {
    if (!card || !dorm) return;
    const location = normalizeLocation(dorm.auditorium_location || '');
    const existing = card.querySelector('.gate-auditorium-location');
    if (!location) {
      if (existing) existing.remove();
      return;
    }

    const text = `AUD: ${location}`;
    if (existing) {
      existing.textContent = text;
      existing.title = `Auditorium Location: ${location}`;
      return;
    }

    const html = `<div class="gate-auditorium-location" title="Auditorium Location: ${esc(location)}">${esc(text)}</div>`;
    const flags = card.querySelector('.gate-dorm-flags');
    const info = card.querySelector('.gate-dorm-info') || card.querySelector('.text-xs.text-muted.font-bold.uppercase') || card.querySelector('.text-xl.font-black.font-tabular');
    if (flags && card.closest('#page-board')) flags.insertAdjacentHTML('afterend', html);
    else if (info) info.insertAdjacentHTML('afterend', html);
    else card.insertAdjacentHTML('beforeend', html);
  }

  function boardDormsForColumn(columnId) {
    const dorms = activeDorms();
    if (columnId.includes('empty')) return dorms.filter(d => d.state === 'empty');
    if (columnId.includes('open')) return dorms.filter(d => d.state === 'open');
    if (columnId.includes('closed')) return dorms.filter(d => d.state === 'closed');
    return dorms;
  }

  function renderStatusBoardLocations() {
    ['col-empty', 'col-open', 'col-closed'].forEach(columnId => {
      const col = document.getElementById(columnId);
      if (!col) return;
      const dorms = boardDormsForColumn(columnId);
      col.querySelectorAll('.dorm-card, .gate-dorm-card').forEach((card, index) => setLocation(card, dorms[index]));
    });
  }

  function renderProcessingLocations() {
    const grid = document.getElementById('proc-dorm-grid');
    if (!grid) return;
    const dorms = activeDorms();
    grid.querySelectorAll('.proc-card').forEach((card, index) => {
      const id = cardId(card);
      const dorm = id ? dorms.find(item => item.__backendId === id) : dorms[index];
      setLocation(card, dorm);
    });
  }

  function suppressSquadronLocations() {
    document.querySelectorAll('#page-squadron .gate-auditorium-location, #page-squadron .dorm-card .gate-auditorium-location').forEach(el => el.remove());
  }

  function runPass() {
    passScheduled = false;
    ensureAuditoriumInput();
    patchOpenDormModal();
    patchSaveAssignedAirman();
    patchAuditoriumKeyHandler();
    renderStatusBoardLocations();
    renderProcessingLocations();
    suppressSquadronLocations();
  }

  function schedulePass() {
    if (passScheduled) return;
    passScheduled = true;
    requestAnimationFrame(runPass);
  }

  function observeRenderTargets() {
    const observer = new MutationObserver(schedulePass);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'onclick', 'oncontextmenu']
    });
  }

  function start() {
    if (started) return;
    started = true;
    document.addEventListener('click', schedulePass, true);
    document.addEventListener('input', event => {
      if (event.target && event.target.id === 'modal-auditorium-input') schedulePass();
    }, true);
    observeRenderTargets();
    schedulePass();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
