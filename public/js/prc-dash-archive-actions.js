// PRC GATE archive edit / print action reliability + archive management view
(function () {
  let started = false;
  let passScheduled = false;
  let originalPrintArchive = null;
  let archiveViewSignature = '';

  function getAllDataSafe() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function getEditArchiveIdSafe() {
    try { return editArchiveId || ''; } catch (_) { return window.editArchiveId || ''; }
  }

  function setEditArchiveIdSafe(id) {
    try { editArchiveId = id; } catch (_) { window.editArchiveId = id; }
  }

  function esc(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
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

  function archiveRecords() {
    return getAllDataSafe()
      .filter(record => record && record.type === 'archive')
      .sort((a, b) => archiveTime(b).getTime() - archiveTime(a).getTime());
  }

  function archiveTime(archive) {
    const raw = archive?.archived_at || archive?.created_at || archive?.updated_at || '';
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }

  function monthName(date) {
    return date.toLocaleString([], { month: 'long' });
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

  function archiveSignature(records) {
    return records.map(record => [
      record.__backendId,
      record.week_group,
      record.archived_at,
      record.dorm_count,
      record.bus_count,
      record.total_arrived,
      record.female_total,
      record.nat_total
    ].join('|')).join('~');
  }

  function groupArchives(records) {
    const years = new Map();
    records.forEach(record => {
      const date = archiveTime(record);
      const year = date.getFullYear() || 'Unknown';
      const monthIndex = Number.isFinite(date.getTime()) && date.getTime() > 0 ? date.getMonth() : 12;
      const monthLabel = monthIndex === 12 ? 'Unscheduled' : monthName(date);
      const yearKey = String(year);
      const monthKey = `${String(monthIndex).padStart(2, '0')}|${monthLabel}`;

      if (!years.has(yearKey)) years.set(yearKey, new Map());
      const months = years.get(yearKey);
      if (!months.has(monthKey)) months.set(monthKey, []);
      months.get(monthKey).push(record);
    });
    return years;
  }

  function archiveRecordCard(record) {
    const id = esc(record.__backendId || '');
    const date = archiveTime(record);
    const dateText = date.getTime() > 0 ? date.toLocaleString([], { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No archive timestamp';
    return `
      <button type="button" class="gate-archive-record-card" data-archive-id="${id}" title="Open archived week group">
        <span>
          <span class="gate-archive-record-title">${esc(record.week_group || 'Archived Week Group')}</span>
          <span class="gate-archive-record-meta">Archived ${esc(dateText)}</span>
        </span>
        <span class="gate-archive-record-stats" aria-label="Archive statistics">
          <span class="gate-archive-stat-pill">${n(record.dorm_count)} Dorms</span>
          <span class="gate-archive-stat-pill">${n(record.bus_count)} Buses</span>
          <span class="gate-archive-stat-pill">${n(record.total_arrived)} Arrived</span>
          <span class="gate-archive-stat-pill">${n(record.female_total)} Female</span>
          <span class="gate-archive-stat-pill">${n(record.nat_total)} NAT</span>
        </span>
      </button>
    `;
  }

  function renderArchiveManagementView() {
    const container = document.getElementById('archive-history');
    if (!container) return;

    const records = archiveRecords();
    const signature = archiveSignature(records);
    if (container.dataset.archiveManagerReady === 'true' && archiveViewSignature === signature) return;
    archiveViewSignature = signature;
    container.dataset.archiveManagerReady = 'true';
    container.className = 'gate-archive-manager';

    if (!records.length) {
      container.innerHTML = '<div class="gate-archive-empty">No archived week groups.</div>';
      return;
    }

    const grouped = groupArchives(records);
    const years = Array.from(grouped.entries()).sort((a, b) => Number(b[0]) - Number(a[0]));

    container.innerHTML = years.map(([year, months], yearIndex) => {
      const monthEntries = Array.from(months.entries()).sort((a, b) => b[0].localeCompare(a[0]));
      const yearCount = monthEntries.reduce((sum, [, list]) => sum + list.length, 0);
      return `
        <details class="gate-archive-year" ${yearIndex === 0 ? 'open' : ''}>
          <summary><span>${esc(year)}</span><span class="gate-archive-year-count">${yearCount} Record${yearCount === 1 ? '' : 's'}</span></summary>
          ${monthEntries.map(([monthKey, list], monthIndex) => {
            const label = monthKey.split('|')[1];
            return `
              <details class="gate-archive-month" ${yearIndex === 0 && monthIndex === 0 ? 'open' : ''}>
                <summary><span>${esc(label)}</span><span class="gate-archive-month-count">${list.length} Week Group${list.length === 1 ? '' : 's'}</span></summary>
                <div class="gate-archive-record-list">
                  ${list.map(archiveRecordCard).join('')}
                </div>
              </details>
            `;
          }).join('')}
        </details>
      `;
    }).join('');
  }

  function getCardArchiveId(card) {
    if (!card) return '';
    if (card.dataset.archiveId) return card.dataset.archiveId;
    const attr = card.getAttribute('oncontextmenu') || '';
    const match = attr.match(/openArchiveEditModal\(event,\s*['"]([^'"]+)['"]\)/);
    return match ? match[1] : '';
  }

  function bindArchiveCards() {
    document.querySelectorAll('#archive-history [data-archive-id], #archive-history [oncontextmenu*="openArchiveEditModal"]').forEach(card => {
      if (card.dataset.archiveActionBound === 'true') return;
      const id = getCardArchiveId(card);
      if (!id) return;

      card.dataset.archiveActionBound = 'true';
      card.dataset.archiveId = id;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.title = 'Open archived week group';
      card.addEventListener('contextmenu', event => openArchiveEditor(event, id), true);
      card.addEventListener('dblclick', event => openArchiveEditor(event, id), true);
      card.addEventListener('click', event => openArchiveEditor(event, id), true);
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') openArchiveEditor(event, id);
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
    renderArchiveManagementView();
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
      attributeFilter: ['class', 'open', 'data-archive-id']
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
