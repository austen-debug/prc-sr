// PRC GATE receiving window + dorm-level Space Force report logic
(function () {
  const WINDOW_KEY_PREFIX = 'gate_receiving_windows_';
  let started = false;
  let sdkPatched = false;
  let batchPatched = false;
  let passScheduled = false;

  const WINDOW_FIELDS = [
    ['receiving_day_one_start', 'RECEIVING DAY ONE START DATE / TIME'],
    ['receiving_day_one_end', 'RECEIVING DAY ONE END DATE / TIME'],
    ['receiving_day_two_start', 'RECEIVING DAY TWO START DATE / TIME'],
    ['receiving_day_two_end', 'RECEIVING DAY TWO END DATE / TIME']
  ];

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
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

  function getActiveWeekGroupSafe() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function getAllDataSafe() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function windowStorageKey(wg = '') {
    const key = wg || document.getElementById('wg-batch-input')?.value.trim() || getActiveWeekGroupSafe() || 'default';
    return `${WINDOW_KEY_PREFIX}${key}`;
  }

  function parseWindowsFromStorage(wg = '') {
    try { return JSON.parse(localStorage.getItem(windowStorageKey(wg)) || '{}'); } catch (_) { return {}; }
  }

  function collectWindowValues(wg = '') {
    const stored = parseWindowsFromStorage(wg);
    const values = {};
    WINDOW_FIELDS.forEach(([key]) => {
      const el = document.getElementById(key);
      values[key] = (el && el.value) || stored[key] || '';
    });
    return values;
  }

  function saveWindowValues(wg = '') {
    localStorage.setItem(windowStorageKey(wg), JSON.stringify(collectWindowValues(wg)));
  }

  function setWindowFieldValues(values) {
    WINDOW_FIELDS.forEach(([key]) => {
      const el = document.getElementById(key);
      if (el && values[key] && !el.matches(':focus')) el.value = values[key];
    });
  }

  function ensureReceivingWindowInputs() {
    const page = document.getElementById('page-input');
    const wgInput = document.getElementById('wg-batch-input');
    if (!page || !wgInput || document.getElementById('receiving-windows-panel')) return;

    const header = wgInput.closest('.flex-shrink-0');
    if (!header) return;

    const panel = document.createElement('div');
    panel.id = 'receiving-windows-panel';
    panel.className = 'mt-3 grid gap-3';
    panel.style.gridTemplateColumns = 'repeat(auto-fit, minmax(230px, 1fr))';
    panel.innerHTML = WINDOW_FIELDS.map(([key, label]) => `
      <div>
        <label for="${key}" class="block text-[10px] uppercase tracking-wider font-bold text-muted mb-1">${label}</label>
        <input id="${key}" type="datetime-local" class="w-full border rounded px-3 py-2 bg-transparent text-sm font-tabular" style="border-color:var(--border);color:var(--text);">
      </div>
    `).join('');

    header.appendChild(panel);
    setWindowFieldValues(parseWindowsFromStorage());

    WINDOW_FIELDS.forEach(([key]) => {
      document.getElementById(key)?.addEventListener('change', () => {
        saveWindowValues();
        schedulePass();
      });
    });

    wgInput.addEventListener('change', () => {
      setWindowFieldValues(parseWindowsFromStorage(wgInput.value.trim()));
      schedulePass();
    });
  }

  function ensureArchiveWindowInputs() {
    const form = document.getElementById('archive-edit-form');
    const anchor = document.getElementById('archive-edit-dorm-count')?.closest('.grid');
    if (!form || !anchor || document.getElementById('archive-receiving-windows-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'archive-receiving-windows-panel';
    panel.className = 'grid grid-cols-2 gap-3';
    panel.innerHTML = WINDOW_FIELDS.map(([key, label]) => `
      <div>
        <label for="archive-edit-${key}" class="block text-sm font-medium mb-1">${label}</label>
        <input id="archive-edit-${key}" type="datetime-local" class="w-full border rounded px-3 py-2 bg-transparent font-tabular" style="border-color:var(--border);color:var(--text);">
      </div>
    `).join('');

    anchor.insertAdjacentElement('beforebegin', panel);
  }

  function isSpaceForceDorm(dorm) {
    return dorm && (dorm.space_force === 'true' || dorm.space_force === true || dorm.is_space_force === 'true' || dorm.is_space_force === true);
  }

  function findBatchRowForDormPayload(payload) {
    try {
      if (!Array.isArray(batchRows)) return null;
      return batchRows.find(row => (
        String(row.dorm_name || '').trim() === String(payload.dorm_name || '').trim() &&
        String(row.sdq || '').trim() === String(payload.sdq || '').trim() &&
        String(row.sec || '').trim() === String(payload.section || '').trim() &&
        String(row.inter_sec || '').trim() === String(payload.inter_sec || '').trim() &&
        n(row.load) === n(payload.max_load)
      )) || null;
    } catch (_) {
      return null;
    }
  }

  function patchDataSdk() {
    if (sdkPatched || !window.dataSdk || typeof window.dataSdk.create !== 'function') return;

    const originalCreate = window.dataSdk.create.bind(window.dataSdk);
    const originalUpdate = typeof window.dataSdk.update === 'function' ? window.dataSdk.update.bind(window.dataSdk) : null;

    window.dataSdk.create = function patchedCreate(payload) {
      if (payload && payload.type === 'dorm') {
        const row = findBatchRowForDormPayload(payload);
        const windows = collectWindowValues(payload.week_group || '');
        payload = Object.assign({}, payload, windows, {
          space_force: row && row.space_force ? 'true' : (payload.space_force || 'false')
        });
      }

      if (payload && payload.type === 'archive') {
        const windows = collectWindowValues(payload.week_group || '');
        let dormData = payload.dorm_data;
        try {
          const dorms = JSON.parse(payload.dorm_data || '[]');
          const liveDorms = getAllDataSafe().filter(record => record.type === 'dorm' && record.week_group === payload.week_group);
          dormData = JSON.stringify(dorms.map(dorm => {
            const live = liveDorms.find(item => String(item.dorm_name || '') === String(dorm.dorm_name || dorm.name || '')) || {};
            return Object.assign({}, dorm, windows, { space_force: isSpaceForceDorm(live) ? 'true' : (dorm.space_force || 'false') });
          }));
        } catch (_) {}
        payload = Object.assign({}, payload, windows, { dorm_data: dormData });
      }

      return originalCreate(payload);
    };

    if (originalUpdate) {
      window.dataSdk.update = function patchedUpdate(payload) {
        if (payload && payload.type === 'archive') {
          const modalValues = {};
          WINDOW_FIELDS.forEach(([key]) => {
            const el = document.getElementById(`archive-edit-${key}`);
            if (el) modalValues[key] = el.value || payload[key] || '';
          });
          payload = Object.assign({}, payload, modalValues);
        }
        return originalUpdate(payload);
      };
    }

    sdkPatched = true;
  }

  function ensureBatchSpaceForceUi() {
    const header = document.querySelector('#batch-grid-wrapper .sticky');
    const rows = document.getElementById('batch-rows-container');
    if (!header || !rows) return;

    if (!header.querySelector('[data-sf-header="true"]')) {
      header.style.gridTemplateColumns = '1fr 1fr 1.5fr 1.5fr 1fr 0.5fr 0.5fr 1fr 40px';
      const loadHeader = Array.from(header.children).find(el => el.textContent.trim().toUpperCase() === 'LOAD');
      const sfHeader = document.createElement('div');
      sfHeader.dataset.sfHeader = 'true';
      sfHeader.className = 'text-[10px] uppercase font-bold tracking-wider text-muted';
      sfHeader.textContent = 'SPACE FORCE';
      if (loadHeader) header.insertBefore(sfHeader, loadHeader);
    }

    rows.querySelectorAll(':scope > div').forEach(rowEl => {
      const rowIndex = rowEl.querySelector('[data-row]')?.dataset.row;
      if (rowIndex === undefined || rowEl.querySelector('.batch-space-force')) return;
      rowEl.style.gridTemplateColumns = '1fr 1fr 1.5fr 1.5fr 1fr 0.5fr 0.5fr 1fr 40px';
      const loadInput = rowEl.querySelector('.batch-load');
      const checked = Array.isArray(batchRows) && batchRows[rowIndex]?.space_force ? 'checked' : '';
      const wrapper = document.createElement('label');
      wrapper.className = 'flex items-center justify-center';
      wrapper.innerHTML = `<input type="checkbox" class="batch-space-force w-4 h-4" data-row="${rowIndex}" ${checked}>`;
      if (loadInput) rowEl.insertBefore(wrapper, loadInput);
    });
  }

  function patchBatchHandlers() {
    if (batchPatched) return;

    try {
      if (typeof initBatchGrid === 'function') {
        const originalInit = initBatchGrid;
        const patchedInit = function patchedInitBatchGrid(...args) {
          const result = originalInit.apply(this, args);
          ensureBatchSpaceForceUi();
          schedulePass();
          return result;
        };
        window.initBatchGrid = patchedInit;
        try { initBatchGrid = patchedInit; } catch (_) {}
      }

      if (typeof clearBatchRow === 'function') {
        const originalClear = clearBatchRow;
        const patchedClear = function patchedClearBatchRow(index) {
          const result = originalClear.apply(this, arguments);
          if (Array.isArray(batchRows) && batchRows[index]) batchRows[index].space_force = false;
          ensureBatchSpaceForceUi();
          schedulePass();
          return result;
        };
        window.clearBatchRow = patchedClear;
        try { clearBatchRow = patchedClear; } catch (_) {}
      }
    } catch (_) {}

    document.addEventListener('change', event => {
      const target = event.target;
      if (!target || !target.classList || !target.classList.contains('batch-space-force')) return;
      const index = Number(target.dataset.row);
      if (Array.isArray(batchRows) && Number.isFinite(index) && batchRows[index]) {
        batchRows[index].space_force = target.checked;
      }
      schedulePass();
    }, true);

    batchPatched = true;
  }

  function parseTime(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function inWindow(value, start, end) {
    const date = parseTime(value);
    const s = parseTime(start);
    const e = parseTime(end);
    if (!date || !s || !e) return false;
    return date.getTime() >= s.getTime() && date.getTime() < e.getTime();
  }

  function dormTimestamp(dorm) {
    return dorm.closed_at || dorm.close_time || dorm.updated_at || dorm.processed_at || '';
  }

  function busTimestamp(bus) {
    return bus.arrived_at || bus.departed_at || bus.created_at || bus.updated_at || '';
  }

  function formatDateLabel(value) {
    const date = parseTime(value);
    if (!date) return 'Date not set';
    return date.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function buildReceivingSummary(dorms, buses, windows) {
    const afExpected = dorms.filter(d => !isSpaceForceDorm(d)).reduce((sum, d) => sum + n(d.max_load), 0);
    const sfExpected = dorms.filter(isSpaceForceDorm).reduce((sum, d) => sum + n(d.max_load), 0);
    const totalExpected = afExpected + sfExpected;

    const dayWindows = [
      { label: 'Receiving Night One (1)', start: windows.receiving_day_one_start, end: windows.receiving_day_one_end },
      { label: 'Receiving Night Two (2)', start: windows.receiving_day_two_start, end: windows.receiving_day_two_end }
    ];

    let afCum = 0;
    let sfCum = 0;
    let natCum = 0;

    return dayWindows.map(day => {
      const dayDorms = dorms.filter(d => inWindow(dormTimestamp(d), day.start, day.end));
      const afDay = dayDorms.filter(d => !isSpaceForceDorm(d)).reduce((sum, d) => sum + n(d.current_load ?? d.loaded), 0);
      const sfDay = dayDorms.filter(isSpaceForceDorm).reduce((sum, d) => sum + n(d.current_load ?? d.loaded), 0);
      const natDay = buses.filter(b => inWindow(busTimestamp(b), day.start, day.end)).reduce((sum, b) => sum + n(b.nat_count), 0);

      afCum += afDay;
      sfCum += sfDay;
      natCum += natDay;

      const totalCum = afCum + sfCum;
      const statement = `Tonight, the PRC processed ${afDay} of the ${afExpected} projected Air Force trainees for a total of ${afCum}, and ${sfDay} out of ${sfExpected} Space Force trainees for a total of ${sfCum} — equalling ${totalCum} out of ${totalExpected} total projected trainees for this week group. ${natDay} trainees requested U.S. naturalization for a total of ${natCum}.`;
      return Object.assign({}, day, { afDay, sfDay, natDay, afCum, sfCum, natCum, totalCum, totalExpected, statement });
    });
  }

  function getArchiveModalWindows(archive) {
    const values = {};
    WINDOW_FIELDS.forEach(([key]) => {
      values[key] = document.getElementById(`archive-edit-${key}`)?.value || archive[key] || '';
    });
    return values;
  }

  function reportHtml(archive, dorms, buses, windows) {
    const weekGroup = document.getElementById('archive-edit-wg')?.value.trim() || archive.week_group || '';
    const summary = buildReceivingSummary(dorms, buses, windows);
    const afExpected = dorms.filter(d => !isSpaceForceDorm(d)).reduce((sum, d) => sum + n(d.max_load), 0);
    const sfExpected = dorms.filter(isSpaceForceDorm).reduce((sum, d) => sum + n(d.max_load), 0);
    const totalExpected = afExpected + sfExpected;

    const dormRows = dorms.map(d => `<tr><td>${esc(d.name || d.dorm_name || '')}</td><td>${isSpaceForceDorm(d) ? 'Space Force' : 'Air Force'}</td><td>${esc(d.current_load ?? d.loaded ?? 0)}</td><td>${esc(d.max_load ?? 0)}</td><td>${esc(d.closed_timer || d.elapsed || '')}</td><td>${esc(d.notes || '')}</td></tr>`).join('') || '<tr><td colspan="6">No dorm records.</td></tr>';
    const busRows = buses.map(b => `<tr><td>${esc(b.bus_type || '')}</td><td>${esc(b.bus_id || '')}</td><td>${esc(b.otw_count || 0)}</td><td>${esc(b.female_count || 0)}</td><td>${esc(b.nat_count || 0)}</td><td>${b.arrived_at ? esc(new Date(b.arrived_at).toLocaleString()) : ''}</td></tr>`).join('') || '<tr><td colspan="6">No bus records.</td></tr>';

    return `<!doctype html><html><head><title>${esc(weekGroup)} Receiving Archive Report</title><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:24px;background:#fff} .classification{display:flex;justify-content:center;align-items:center;min-height:28px;background:#166534;color:#fff;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;border:1px solid #14532d}.no-print{margin:12px 0;padding:9px 16px;border:1px solid #94a3b8;border-radius:8px;background:#0f172a;color:#fff;font-weight:900;cursor:pointer}h1{margin:14px 0 4px;font-size:28px;text-transform:uppercase}.subtitle{color:#475569;font-size:12px;font-weight:900;text-transform:uppercase}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.box{border:1px solid #cbd5e1;background:#f8fafc;padding:10px}.label{color:#475569;font-size:9px;font-weight:900;text-transform:uppercase}.value{font-size:22px;font-weight:900}.night{border:1px solid #cbd5e1;background:#f8fafc;padding:10px;margin:8px 0}.night-title{font-weight:900;text-transform:uppercase}.night-text{font-weight:700;line-height:1.45;margin-top:4px}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:10px}th,td{border:1px solid #cbd5e1;padding:5px 6px;text-align:left;vertical-align:top}th{background:#e2e8f0;text-transform:uppercase;font-size:9px}@media print{body{margin:10mm}.no-print{display:none}.classification,.box,th,.night{print-color-adjust:exact;-webkit-print-color-adjust:exact}tr{page-break-inside:avoid}}
    </style></head><body><div class="classification">UNCLASSIFIED / NO PII / STATUS COUNTS ONLY</div><button class="no-print" onclick="window.print()">Print / Save as PDF</button><h1>GATE Receiving Archive Report</h1><div class="subtitle">Gateway Arrival Tracking Environment — Pfingston Reception Center</div><div><strong>Week Group:</strong> ${esc(weekGroup)} | <strong>Printed:</strong> ${esc(new Date().toLocaleString())}</div><section class="summary"><div class="box"><div class="label">Air Force Expected</div><div class="value">${afExpected}</div></div><div class="box"><div class="label">Space Force Expected</div><div class="value">${sfExpected}</div></div><div class="box"><div class="label">Total Expected</div><div class="value">${totalExpected}</div></div></section><h2>Receiving Processing Summary</h2>${summary.map(day => `<section class="night"><div class="night-title">${day.label}: <span>${formatDateLabel(day.start)}</span></div><div class="night-text">${esc(day.statement)}</div></section>`).join('')}<h2>Dorm Table</h2><table><thead><tr><th>Dorm</th><th>Component</th><th>Loaded</th><th>Max</th><th>Elapsed</th><th>Notes</th></tr></thead><tbody>${dormRows}</tbody></table><h2>Bus Table</h2><table><thead><tr><th>Type</th><th>Bus #</th><th>Arrived/OTW</th><th>Females</th><th>Naturalizations</th><th>Arrived</th></tr></thead><tbody>${busRows}</tbody></table><div class="classification" style="margin-top:10px">UNCLASSIFIED / NO PII / STATUS COUNTS ONLY</div></body></html>`;
  }

  function printHtml(html) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Unable to open the print report. Allow pop-ups for this site and try again.'); return; }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  }

  function printArchiveSpreadsheetPatched() {
    let archiveId = '';
    try { archiveId = editArchiveId || ''; } catch (_) {}
    const archive = getAllDataSafe().find(r => r.type === 'archive' && r.__backendId === archiveId);
    if (!archive) return;

    let dorms = [];
    let buses = [];
    try {
      dorms = JSON.parse(document.getElementById('archive-edit-dorm-data')?.value || archive.dorm_data || '[]');
      buses = JSON.parse(document.getElementById('archive-edit-bus-data')?.value || archive.bus_data || '[]');
    } catch (_) {
      alert('Dorm Data JSON or Bus Data JSON is invalid. Fix the JSON before printing.');
      return;
    }

    printHtml(reportHtml(archive, dorms, buses, getArchiveModalWindows(archive)));
  }

  function patchArchiveOpen() {
    if (typeof openArchiveEditModal !== 'function' || openArchiveEditModal.__receivingWindowsPatched) return;
    const original = openArchiveEditModal;
    const patched = function patchedOpenArchiveEditModal(event, id) {
      const result = original.apply(this, arguments);
      ensureArchiveWindowInputs();
      const archive = getAllDataSafe().find(r => r.type === 'archive' && r.__backendId === id);
      if (archive) WINDOW_FIELDS.forEach(([key]) => {
        const el = document.getElementById(`archive-edit-${key}`);
        if (el && !el.matches(':focus')) el.value = archive[key] || '';
      });
      schedulePass();
      return result;
    };
    patched.__receivingWindowsPatched = true;
    window.openArchiveEditModal = patched;
    try { openArchiveEditModal = patched; } catch (_) {}
  }

  function runPass() {
    passScheduled = false;
    ensureReceivingWindowInputs();
    ensureArchiveWindowInputs();
    ensureBatchSpaceForceUi();
    patchBatchHandlers();
    patchDataSdk();
    patchArchiveOpen();
    window.printArchiveSpreadsheet = printArchiveSpreadsheetPatched;
  }

  function schedulePass() {
    if (passScheduled) return;
    passScheduled = true;
    requestAnimationFrame(runPass);
  }

  function observeReceivingSurfaces() {
    if (typeof MutationObserver === 'undefined' || !document.body) return;
    const observer = new MutationObserver(mutations => {
      const shouldSchedule = mutations.some(mutation => {
        if (mutation.type === 'childList') return true;
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (!target?.closest) return false;
          return Boolean(target.closest('#page-input, #archive-edit-modal, #batch-grid-wrapper, #batch-rows-container'));
        }
        return false;
      });
      if (shouldSchedule) schedulePass();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-row']
    });
  }

  function start() {
    if (started) return;
    started = true;
    document.addEventListener('click', event => {
      if (event.target?.closest?.('#page-input, #archive-edit-modal')) schedulePass();
    }, true);
    document.addEventListener('change', event => {
      if (event.target?.closest?.('#page-input, #archive-edit-modal, #batch-rows-container')) schedulePass();
    }, true);
    observeReceivingSurfaces();
    schedulePass();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
