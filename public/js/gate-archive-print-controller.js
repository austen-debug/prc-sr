// GATE archive and print controller
// Final owner for archive print/current summary button behavior. Existing report renderers remain available as implementation paths.
(function () {
  'use strict';

  let installed = false;
  let hooksRegistered = false;
  let passQueued = false;
  let priorArchivePrint = null;
  let priorCurrentPrint = null;

  function getAllDataSafe() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function getEditArchiveIdSafe() {
    try { return editArchiveId || ''; } catch (_) { return window.editArchiveId || ''; }
  }

  function getArchive(id = getEditArchiveIdSafe()) {
    return getAllDataSafe().find(record => record && record.type === 'archive' && record.__backendId === id) || null;
  }

  function showArchiveMessage(text, isError = true) {
    const msg = document.getElementById('archive-edit-msg');
    if (!msg) {
      if (isError) alert(text);
      return;
    }

    msg.textContent = text;
    msg.style.color = isError ? 'var(--red)' : 'var(--green)';
    msg.classList.remove('hidden');
  }

  function parseArchiveJsonField(id, fallback = []) {
    const field = document.getElementById(id);
    const value = field ? field.value.trim() : '';
    if (!value) return fallback;
    return JSON.parse(value);
  }

  function validateOpenArchiveForPrint() {
    const archiveId = getEditArchiveIdSafe();
    if (!archiveId) {
      showArchiveMessage('Open an archived week group before printing.');
      return false;
    }

    if (!getArchive(archiveId)) {
      showArchiveMessage('Archived week group could not be found.');
      return false;
    }

    try {
      parseArchiveJsonField('archive-edit-dorm-data', []);
      parseArchiveJsonField('archive-edit-bus-data', []);
    } catch (_) {
      showArchiveMessage('Archive JSON is invalid. Save or correct the archive data before printing.');
      return false;
    }

    return true;
  }

  function callPriorArchivePrint() {
    if (typeof priorArchivePrint === 'function' && priorArchivePrint !== printArchiveReport) {
      priorArchivePrint();
      return true;
    }

    return false;
  }

  function callPriorCurrentPrint() {
    if (typeof priorCurrentPrint === 'function' && priorCurrentPrint !== printCurrentSummaryReport) {
      priorCurrentPrint();
      return true;
    }

    return false;
  }

  function printArchiveReport(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }

    if (!validateOpenArchiveForPrint()) return;
    if (callPriorArchivePrint()) return;
    window.print();
  }

  function printCurrentSummaryReport(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }

    if (callPriorCurrentPrint()) return;

    const weekGroup = typeof getActiveWG === 'function' ? getActiveWG() : '';
    if (!weekGroup) {
      alert('Initialize or select a Week Group before printing a current summary.');
      return;
    }

    window.print();
  }

  function ensureCurrentSummaryButton() {
    const page = document.getElementById('page-archives');
    if (!page) return;

    let button = document.getElementById('print-current-summary-btn');
    if (!button) {
      const container = page.querySelector('.max-w-3xl') || page;
      const title = container.querySelector('h2, h3');
      button = document.createElement('button');
      button.id = 'print-current-summary-btn';
      button.type = 'button';
      button.className = 'px-4 py-2 rounded-lg font-bold text-white text-sm mb-4';
      button.style.background = 'var(--blue)';
      if (title) title.insertAdjacentElement('afterend', button);
      else container.insertAdjacentElement('afterbegin', button);
    }

    button.textContent = 'Print Current Summary';
    button.dataset.owner = 'gate-archive-print-controller';
    button.onclick = printCurrentSummaryReport;
  }

  function bindArchivePrintButton() {
    const button = document.querySelector('#archive-edit-modal button[onclick="printArchiveSpreadsheet()"], #archive-edit-modal button[data-archive-print="true"]');
    if (!button) return;

    button.textContent = 'PRINT / PDF';
    button.dataset.owner = 'gate-archive-print-controller';
    button.dataset.archivePrint = 'true';
    button.onclick = printArchiveReport;
  }

  function capturePrintClicks(event) {
    const target = event.target;
    const archiveButton = target?.closest?.('#archive-edit-modal button[data-archive-print="true"], #archive-edit-modal button[onclick="printArchiveSpreadsheet()"]');
    if (archiveButton) {
      printArchiveReport(event);
      return;
    }

    const currentButton = target?.closest?.('#print-current-summary-btn');
    if (currentButton) printCurrentSummaryReport(event);
  }

  function installGlobals() {
    if (!priorArchivePrint && typeof window.printArchiveSpreadsheet === 'function' && window.printArchiveSpreadsheet !== printArchiveReport) {
      priorArchivePrint = window.printArchiveSpreadsheet;
    }

    if (!priorCurrentPrint && typeof window.printCurrentSummaryReport === 'function' && window.printCurrentSummaryReport !== printCurrentSummaryReport) {
      priorCurrentPrint = window.printCurrentSummaryReport;
    }

    window.printArchiveSpreadsheet = printArchiveReport;
    window.printCurrentSummaryReport = printCurrentSummaryReport;
  }

  function runPass() {
    passQueued = false;
    installGlobals();
    ensureCurrentSummaryButton();
    bindArchivePrintButton();
  }

  function schedulePass() {
    if (passQueued) return;
    passQueued = true;
    window.requestAnimationFrame(runPass);
  }

  function registerHooksOnce() {
    if (hooksRegistered || typeof window.registerGateHook !== 'function') return;
    window.registerGateHook('afterRenderAll', schedulePass);
    window.registerGateHook('afterPageChange', schedulePass);
    window.registerGateHook('afterDataChanged', schedulePass);
    window.registerGateHook('afterModalOpen', schedulePass);
    hooksRegistered = true;
  }

  function start() {
    if (!installed) {
      document.addEventListener('click', capturePrintClicks, true);
      installed = true;
    }

    registerHooksOnce();
    schedulePass();

    window.GateArchivePrintController = Object.freeze({
      isCanonicalOwner: true,
      printArchiveReport,
      printCurrentSummaryReport,
      refresh: schedulePass,
      getArchive
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('load', start, { once: true });
})();
