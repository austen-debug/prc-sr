// GATE archive and print controller
// Final owner for archive print/current summary button behavior. Existing report renderers remain available as implementation paths.
(function () {
  'use strict';

  let installed = false;
  let hooksRegistered = false;
  let passQueued = false;
  let priorArchivePrint = null;
  let priorCurrentPrint = null;

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getAllDataSafe() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function getEditArchiveIdSafe() {
    try { return editArchiveId || ''; } catch (_) { return window.editArchiveId || ''; }
  }

  function getArchive(id = getEditArchiveIdSafe()) {
    return getAllDataSafe().find(record => record && record.type === 'archive' && record.__backendId === id) || null;
  }

  function archiveRecords() {
    return getAllDataSafe().filter(record => record && record.type === 'archive');
  }

  function getArchiveSpaceForceTotal(record) {
    if (!record) return 0;
    const explicit = n(record.space_force_total);
    const arrived = n(record.arrived_space_force_total);
    if (explicit || arrived) return explicit || arrived;

    try {
      const buses = JSON.parse(record.bus_data || '[]');
      return buses.reduce((sum, bus) => sum + n(bus.space_force_count), 0);
    } catch (_) {
      return 0;
    }
  }

  function getVisibleArchiveRecords() {
    const archiveCards = Array.from(document.querySelectorAll('#archive-history [data-archive-id]'));
    if (!archiveCards.length) return archiveRecords();

    const ids = new Set(archiveCards.map(card => card.dataset.archiveId).filter(Boolean));
    return archiveRecords().filter(record => ids.has(record.__backendId));
  }

  function archiveSpaceForceTotal(records) {
    return records.reduce((sum, record) => sum + getArchiveSpaceForceTotal(record), 0);
  }

  function ensureArchiveSpaceForcePill(card, record) {
    if (!card || !record) return;
    const stats = card.querySelector('.gate-archive-record-stats');
    if (!stats) return;

    let pill = stats.querySelector('[data-archive-space-force-pill="true"]');
    if (!pill) {
      pill = document.createElement('span');
      pill.className = 'gate-archive-stat-pill';
      pill.dataset.archiveSpaceForcePill = 'true';
      stats.appendChild(pill);
    }

    pill.textContent = `${getArchiveSpaceForceTotal(record)} Space Force`;
    card.dataset.spaceForceTotal = String(getArchiveSpaceForceTotal(record));
  }

  function enhanceArchiveCardsWithSpaceForce() {
    document.querySelectorAll('#archive-history [data-archive-id]').forEach(card => {
      const record = getArchive(card.dataset.archiveId);
      ensureArchiveSpaceForcePill(card, record);
    });
  }

  function enhanceArchiveToolbarWithSpaceForce() {
    const toolbarCopy = document.querySelector('#archive-history .gate-archive-toolbar-copy');
    if (!toolbarCopy) return;

    const visible = getVisibleArchiveRecords();
    const total = archiveSpaceForceTotal(visible);
    if (/Space Force/i.test(toolbarCopy.textContent || '')) return;
    toolbarCopy.textContent = `${toolbarCopy.textContent} · ${total} Space Force`;
  }

  function enhanceArchiveSummaryLabelsWithSpaceForce() {
    document.querySelectorAll('#archive-history details.gate-archive-year, #archive-history details.gate-archive-month').forEach(details => {
      const label = details.querySelector(':scope > summary .gate-archive-year-count, :scope > summary .gate-archive-month-count');
      if (!label || /Space Force/i.test(label.textContent || '')) return;

      const cards = Array.from(details.querySelectorAll('[data-archive-id]'));
      const total = cards.reduce((sum, card) => sum + getArchiveSpaceForceTotal(getArchive(card.dataset.archiveId)), 0);
      label.textContent = `${label.textContent} · ${total} Space Force`;
    });
  }

  function enhanceArchiveSpaceForceUi() {
    enhanceArchiveCardsWithSpaceForce();
    enhanceArchiveToolbarWithSpaceForce();
    enhanceArchiveSummaryLabelsWithSpaceForce();
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
    enhanceArchiveSpaceForceUi();
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
      getArchive,
      getArchiveSpaceForceTotal,
      enhanceArchiveSpaceForceUi
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('load', start, { once: true });
})();
