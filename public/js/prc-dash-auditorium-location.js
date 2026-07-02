// PRC GATE Auditorium Location support
// Adds dorm-level auditorium_location config through the Processing modal.
// Renders on Status Board and Processing page only; intentionally excludes Squadron Board.
(function () {
  let started = false;
  let stylesReady = false;
  let modalPatched = false;
  let savePatched = false;
  let keyPatched = false;

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

  function ensureStyles() {
    if (stylesReady || document.getElementById('prc-gate-auditorium-location-styles')) return;

    const style = document.createElement('style');
    style.id = 'prc-gate-auditorium-location-styles';
    style.textContent = `
      .gate-auditorium-field {
        margin-top: 0.75rem !important;
      }

      .gate-airman-location-grid {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto !important;
        gap: 0.5rem !important;
        align-items: end !important;
      }

      .gate-auditorium-location {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        max-width: 100% !important;
        min-height: 1.18rem !important;
        padding: 0.16rem 0.48rem !important;
        border-radius: 999px !important;
        border: 1px solid rgba(251, 191, 36, 0.42) !important;
        background: rgba(251, 191, 36, 0.12) !important;
        color: #fde68a !important;
        font-size: 0.58rem !important;
        font-weight: 950 !important;
        line-height: 1 !important;
        letter-spacing: 0.075em !important;
        text-transform: uppercase !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 3px 10px rgba(0,0,0,0.12) !important;
      }

      #page-board .gate-auditorium-location {
        grid-area: flags !important;
        justify-self: end !important;
        align-self: start !important;
        max-width: min(48%, 9rem) !important;
      }

      #page-processing .gate-auditorium-location,
      .proc-card .gate-auditorium-location {
        margin-top: 0.5rem !important;
      }

      #page-squadron .gate-auditorium-location {
        display: none !important;
      }

      .theme-light .gate-auditorium-location {
        background: rgba(254, 243, 199, 0.72) !important;
        border-color: rgba(217, 119, 6, 0.28) !important;
        color: #78350f !important;
      }

      @media (max-width: 640px) {
        .gate-airman-location-grid {
          grid-template-columns: minmax(0, 1fr) !important;
        }
      }
    `;

    document.head.appendChild(style);
    stylesReady = true;
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
    ensureStyles();
    ensureAuditoriumInput();
    patchOpenDormModal();
    patchSaveAssignedAirman();
    patchAuditoriumKeyHandler();
    renderStatusBoardLocations();
    renderProcessingLocations();
    suppressSquadronLocations();
  }

  function start() {
    if (started) return;
    started = true;
    runPass();
    setInterval(runPass, 350);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
