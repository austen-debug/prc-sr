// PRC GATE archive edit / print action reliability
(function () {
  let started = false;
  let passScheduled = false;
  let originalPrintArchive = null;

  function getAllDataSafe() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function getEditArchiveIdSafe() {
    try { return editArchiveId || ''; } catch (_) { return window.editArchiveId || ''; }
  }

  function setEditArchiveIdSafe(id) {
    try { editArchiveId = id; } catch (_) { window.editArchiveId = id; }
  }

  function safeJsonPrettyLocal(value, fallback = []) {
    try {
      if (typeof safeJsonPretty === 'function') return safeJsonPretty(value, fallback);
      if (!value) return JSON.stringify(fallback, null, 2);
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch (_) {
      return JSON.stringify(fallback, null, 2);
    }
  }

  function showArchiveMsg(text) {
    const msg = document.getElementById('archive-edit-msg');
    if (!msg) return;
    msg.textContent = text;
    msg.style.color = 'var(--red)';
    msg.classList.remove('hidden');
  }

  function clearArchiveMsg() {
    const msg = document.getElementById('archive-edit-msg');
    if (!msg) return;
    msg.textContent = '';
    msg.classList.add('hidden');
  }

  function getArchive(id) {
    return getAllDataSafe().find(record => record && record.type === 'archive' && record.__backendId === id);
  }

  function setField(id, value) {
    const field = document.getElementById(id);
    if (field) field.value = value;
  }

  function openArchiveEditor(event, id) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }

    try {
      if (typeof currentRole !== 'undefined' && currentRole !== 'instructor') return;
    } catch (_) {}

    const archive = getArchive(id);
    if (!archive) return;

    setEditArchiveIdSafe(id);
    setField('archive-edit-wg', archive.week_group || '');
    setField('archive-edit-archived-at', archive.archived_at || '');
    setField('archive-edit-dorm-count', archive.dorm_count || 0);
    setField('archive-edit-bus-count', archive.bus_count || 0);
    setField('archive-edit-total-arrived', archive.total_arrived || 0);
    setField('archive-edit-female-total', archive.female_total || 0);
    setField('archive-edit-nat-total', archive.nat_total || 0);
    setField('archive-edit-dorm-data', safeJsonPrettyLocal(archive.dorm_data, []));
    setField('archive-edit-bus-data', safeJsonPrettyLocal(archive.bus_data, []));
    clearArchiveMsg();

    const modal = document.getElementById('archive-edit-modal');
    if (modal) modal.classList.remove('hidden');
    schedulePass();
  }

  function getCardArchiveId(card) {
    const attr = card.getAttribute('oncontextmenu') || '';
    const match = attr.match(/openArchiveEditModal\(event,\s*['"]([^'"]+)['"]\)/);
    return match ? match[1] : '';
  }

  function bindArchiveCards() {
    document.querySelectorAll('#archive-history [oncontextmenu*="openArchiveEditModal"]').forEach(card => {
      if (card.dataset.archiveActionBound === 'true') return;
      const id = getCardArchiveId(card);
      if (!id) return;

      card.dataset.archiveActionBound = 'true';
      card.dataset.archiveId = id;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.title = 'Right-click, double-click, or press Enter to edit archived week group';
      card.addEventListener('contextmenu', event => openArchiveEditor(event, id), true);
      card.addEventListener('dblclick', event => openArchiveEditor(event, id), true);
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter') openArchiveEditor(event, id);
      }, true);
    });
  }

  function printArchiveReport(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }

    const archiveId = getEditArchiveIdSafe();
    if (!archiveId) {
      showArchiveMsg('Open an archived week group before printing.');
      return;
    }

    const archive = getArchive(archiveId);
    if (!archive) {
      showArchiveMsg('Archived week group could not be found.');
      return;
    }

    if (typeof originalPrintArchive === 'function') {
      originalPrintArchive();
      return;
    }

    if (typeof window.printArchiveSpreadsheet === 'function' && window.printArchiveSpreadsheet !== printArchiveReport) {
      window.printArchiveSpreadsheet();
      return;
    }

    window.print();
  }

  function bindArchivePrintButton() {
    const button = document.querySelector('#archive-edit-modal button[onclick="printArchiveSpreadsheet()"]');
    if (!button) return;

    if (!originalPrintArchive && typeof window.printArchiveSpreadsheet === 'function' && window.printArchiveSpreadsheet !== printArchiveReport) {
      originalPrintArchive = window.printArchiveSpreadsheet;
    }

    if (button.dataset.archivePrintBound !== 'true') {
      button.dataset.archivePrintBound = 'true';
      button.textContent = 'PRINT / PDF';
      button.addEventListener('click', printArchiveReport, true);
    }
  }

  function runPass() {
    passScheduled = false;
    window.openArchiveEditModal = openArchiveEditor;
    if (!originalPrintArchive && typeof window.printArchiveSpreadsheet === 'function' && window.printArchiveSpreadsheet !== printArchiveReport) {
      originalPrintArchive = window.printArchiveSpreadsheet;
    }
    window.printArchiveSpreadsheet = printArchiveReport;
    bindArchiveCards();
    bindArchivePrintButton();
  }

  function schedulePass() {
    if (passScheduled) return;
    passScheduled = true;
    requestAnimationFrame(runPass);
  }

  function observeArchiveSurfaces() {
    if (typeof MutationObserver === 'undefined' || !document.body) return;
    const observer = new MutationObserver(mutations => {
      const shouldSchedule = mutations.some(mutation => {
        if (mutation.type === 'childList') return true;
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (!target?.closest) return false;
          return Boolean(target.closest('#archive-history, #archive-edit-modal'));
        }
        return false;
      });
      if (shouldSchedule) schedulePass();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'oncontextmenu']
    });
  }

  function start() {
    if (started) return;
    started = true;
    document.addEventListener('click', event => {
      if (event.target?.closest?.('#archive-history, #archive-edit-modal')) schedulePass();
    }, true);
    document.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === 'Escape') schedulePass();
    }, true);
    observeArchiveSurfaces();
    schedulePass();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
