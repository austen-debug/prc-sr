// GATE Auditorium Location support
// Field-specific adapter: delegates Processing mutations to GateProcessingController and augments dorm-card display.
(function () {
  'use strict';

  let started = false;
  let hooksRegistered = false;
  let passScheduled = false;
  let modalObserver = null;
  let saveInFlight = false;

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
    try { return String(modalDormId || ''); } catch (_) { return ''; }
  }

  function getDormById(id) {
    const target = String(id || '');
    if (!target) return null;
    return getAllDataSafe().find(record => record && record.type === 'dorm' && String(record.__backendId || '') === target) || null;
  }

  function activeDorms() {
    const wg = getActiveWeekGroupSafe();
    return getAllDataSafe().filter(record => record && record.type === 'dorm' && (!wg || record.week_group === wg));
  }

  function normalizeLocation(value) {
    return String(value ?? '').trim().toUpperCase();
  }

  function normalizeAirman(value) {
    return String(value ?? '').trim().toUpperCase();
  }

  function processingModal() {
    return document.getElementById('dorm-modal');
  }

  function ensureAuditoriumInput() {
    const airmanInput = document.getElementById('modal-airman-input');
    if (!airmanInput) return null;

    const container = airmanInput.closest('.mb-6');
    const flex = airmanInput.closest('.flex');
    if (!container || !flex) return null;

    const label = container.querySelector('label[for="modal-airman-input"]');
    if (label) label.textContent = 'Airman / Auditorium Location';

    flex.classList.add('gate-airman-location-grid');
    airmanInput.classList.remove('flex-1');

    let input = document.getElementById('modal-auditorium-input');
    if (!input) {
      airmanInput.insertAdjacentHTML('afterend', `
        <input
          id="modal-auditorium-input"
          type="text"
          placeholder="AUDITORIUM LOCATION"
          class="border rounded px-3 py-2 bg-transparent text-sm uppercase"
          style="border-color:var(--border);color:var(--text);"
          autocomplete="off"
          spellcheck="false"
        >
      `);
      input = document.getElementById('modal-auditorium-input');
    }

    if (input) {
      input.dataset.owner = 'gate-auditorium-location-controller';
      input.removeAttribute('onkeydown');
    }

    const saveButton = flex.querySelector('button[onclick="saveAssignedAirman()"]');
    if (saveButton) {
      saveButton.textContent = 'SAVE';
      saveButton.dataset.processingAssignmentSave = 'true';
    }

    return input;
  }

  function clearProcessingModalState() {
    const modal = processingModal();
    const airman = document.getElementById('modal-airman-input');
    const location = document.getElementById('modal-auditorium-input');

    if (airman) airman.value = '';
    if (location) {
      location.value = '';
      delete location.dataset.dormId;
    }
    if (modal) delete modal.dataset.processingDormId;
  }

  function hydrateProcessingModal(dormId) {
    const input = ensureAuditoriumInput();
    const modal = processingModal();
    const id = String(dormId || getModalDormIdSafe() || '');
    const dorm = getDormById(id);

    if (!input || !modal || !id || !dorm) {
      if (input) {
        input.value = '';
        delete input.dataset.dormId;
      }
      if (modal) delete modal.dataset.processingDormId;
      return false;
    }

    const location = normalizeLocation(dorm.auditorium_location || '');
    input.value = location;
    input.dataset.dormId = id;
    modal.dataset.processingDormId = id;
    modal.dataset.processingHydratedAt = String(Date.now());
    return true;
  }

  function activeBoundDormId() {
    const modal = processingModal();
    const input = document.getElementById('modal-auditorium-input');
    const activeId = getModalDormIdSafe();
    const modalId = String(modal?.dataset?.processingDormId || '');
    const inputId = String(input?.dataset?.dormId || '');

    if (!activeId || activeId !== modalId || activeId !== inputId) return '';
    return activeId;
  }

  function assignmentSaveButton() {
    return document.querySelector('#dorm-modal [data-processing-assignment-save="true"]') ||
      document.querySelector('#dorm-modal button[onclick="saveAssignedAirman()"]');
  }

  async function saveProcessingAssignmentAndLocation() {
    if (saveInFlight) return;

    ensureAuditoriumInput();
    const activeId = getModalDormIdSafe();
    const boundId = activeBoundDormId();

    if (!activeId || !boundId) {
      hydrateProcessingModal(activeId);
      console.warn('GATE Processing save blocked because the modal was not hydrated for the active dorm.', { activeId, boundId });
      return;
    }

    const dorm = getDormById(boundId);
    const controller = window.GateProcessingController;
    if (!dorm || typeof controller?.updateDorm !== 'function') {
      console.warn('GATE Processing save blocked because the canonical dorm mutation owner is unavailable.');
      return;
    }

    const airmanInput = document.getElementById('modal-airman-input');
    const locationInput = document.getElementById('modal-auditorium-input');
    if (!airmanInput || !locationInput) return;

    const payload = {
      ...dorm,
      assigned_airman: normalizeAirman(airmanInput.value),
      auditorium_location: normalizeLocation(locationInput.value),
      updated_at: new Date().toISOString()
    };

    const button = assignmentSaveButton();
    const originalText = button?.textContent || 'SAVE';
    saveInFlight = true;
    if (button) {
      button.disabled = true;
      button.textContent = 'SAVING...';
    }

    try {
      const result = await controller.updateDorm(payload, { source: 'processing-assignment-location-update' });
      if (!result?.isOk) {
        console.warn('GATE Processing assignment/location save failed.', result?.error || result);
        return;
      }

      if (getModalDormIdSafe() === boundId) controller.closeDormModal?.();
    } finally {
      saveInFlight = false;
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  function installProcessingSaveOwner() {
    window.saveAssignedAirman = saveProcessingAssignmentAndLocation;
    window.handleAuditoriumInputKey = function handleAuditoriumInputKey(event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      saveProcessingAssignmentAndLocation();
    };

    try { saveAssignedAirman = saveProcessingAssignmentAndLocation; } catch (_) {}
    try { handleAuditoriumInputKey = window.handleAuditoriumInputKey; } catch (_) {}
  }

  function handleWindowKeydown(event) {
    if (event.key !== 'Enter') return;
    if (!event.target?.matches?.('#modal-airman-input, #modal-auditorium-input')) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    saveProcessingAssignmentAndLocation();
  }

  function cardId(card) {
    const datasetId = String(card?.dataset?.dormId || '').trim();
    if (datasetId) return datasetId;

    const onclick = card?.getAttribute?.('onclick') || '';
    const contextmenu = card?.getAttribute?.('oncontextmenu') || '';
    const match = onclick.match(/openDormModal\('([^']+)'\)/) || contextmenu.match(/openDormEditModal\([^,]+,\s*'([^']+)'\)/);
    return match ? match[1] : '';
  }

  function dormForCard(card, fallback, dorms = activeDorms()) {
    const id = cardId(card);
    if (id) {
      const match = dorms.find(item => String(item.__backendId || '') === id);
      if (match) return match;
    }
    return fallback || null;
  }

  function setLocation(card, dorm) {
    if (!card || !dorm) return;
    const location = normalizeLocation(dorm.auditorium_location || '');
    const existing = card.querySelector('.gate-auditorium-location');

    if (!location) {
      existing?.remove();
      return;
    }

    const text = `AUD: ${location}`;
    const title = `Auditorium Location: ${location}`;
    if (existing) {
      if (existing.textContent !== text) existing.textContent = text;
      if (existing.title !== title) existing.title = title;
      return;
    }

    const html = `<div class="gate-auditorium-location" title="${esc(title)}">${esc(text)}</div>`;
    const flags = card.querySelector('.gate-dorm-flags');
    const info = card.querySelector('.gate-dorm-info') || card.querySelector('.text-xs.text-muted.font-bold.uppercase') || card.querySelector('.text-xl.font-black.font-tabular');
    if (flags && card.closest('#page-board')) flags.insertAdjacentHTML('afterend', html);
    else if (info) info.insertAdjacentHTML('afterend', html);
    else card.insertAdjacentHTML('beforeend', html);
  }

  function boardDormsForColumn(columnId) {
    const dorms = activeDorms();
    if (columnId.includes('empty')) return dorms.filter(dorm => dorm.state === 'empty');
    if (columnId.includes('open')) return dorms.filter(dorm => dorm.state === 'open');
    if (columnId.includes('closed')) return dorms.filter(dorm => dorm.state === 'closed');
    return dorms;
  }

  function renderStatusBoardLocations() {
    ['col-empty', 'col-open', 'col-closed'].forEach(columnId => {
      const column = document.getElementById(columnId);
      if (!column) return;
      const dorms = boardDormsForColumn(columnId);
      column.querySelectorAll('.dorm-card, .gate-dorm-card').forEach((card, index) => {
        setLocation(card, dormForCard(card, dorms[index], dorms));
      });
    });
  }

  function renderProcessingLocations() {
    const grid = document.getElementById('proc-dorm-grid');
    if (!grid) return;
    const dorms = activeDorms();
    grid.querySelectorAll('.proc-card').forEach((card, index) => {
      setLocation(card, dormForCard(card, dorms[index], dorms));
    });
  }

  function suppressSquadronLocations() {
    document.querySelectorAll('#page-squadron .gate-auditorium-location, #page-squadron .dorm-card .gate-auditorium-location').forEach(element => element.remove());
  }

  function runPass() {
    passScheduled = false;
    ensureAuditoriumInput();
    installProcessingSaveOwner();
    renderStatusBoardLocations();
    renderProcessingLocations();
    suppressSquadronLocations();
  }

  function schedulePass() {
    if (passScheduled) return;
    passScheduled = true;
    requestAnimationFrame(runPass);
  }

  function handleModalOpen(payload) {
    if (payload?.modal !== 'processing-dorm') return;
    hydrateProcessingModal(payload.dormId);
  }

  function registerHooksOnce() {
    if (hooksRegistered || typeof window.registerGateHook !== 'function') return;
    window.registerGateHook('afterModalOpen', handleModalOpen);
    window.registerGateHook('afterRenderAll', schedulePass);
    window.registerGateHook('afterDataChanged', schedulePass);
    window.registerGateHook('afterPageChange', schedulePass);
    hooksRegistered = true;
  }

  function observeModalVisibility() {
    if (modalObserver || typeof MutationObserver === 'undefined') return;
    const modal = processingModal();
    if (!modal) return;

    modalObserver = new MutationObserver(() => {
      const hidden = modal.classList.contains('hidden') || modal.getAttribute('aria-hidden') === 'true';
      if (hidden) clearProcessingModalState();
    });
    modalObserver.observe(modal, { attributes: true, attributeFilter: ['class', 'aria-hidden'] });
  }

  function start() {
    if (started) return;
    started = true;
    ensureAuditoriumInput();
    installProcessingSaveOwner();
    registerHooksOnce();
    observeModalVisibility();
    window.addEventListener('keydown', handleWindowKeydown, true);
    schedulePass();

    window.GateAuditoriumLocationController = Object.freeze({
      delegatesPersistenceTo: 'gate-processing-controller',
      hydrateProcessingModal,
      clearProcessingModalState,
      save: saveProcessingAssignmentAndLocation,
      refresh: schedulePass,
      diagnostics: () => Object.freeze({
        saveInFlight,
        activeDormId: getModalDormIdSafe(),
        boundDormId: activeBoundDormId(),
        hooksRegistered,
        modalObserverActive: Boolean(modalObserver)
      })
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('load', start, { once: true });
})();
