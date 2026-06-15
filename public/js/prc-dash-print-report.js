// GATE Receiving Archive / Current Summary Report
// Isolated print/report helpers. Reads existing app data only; does not alter APIs or data flows.
(function () {
  const RECEIVING_DATE_STORAGE_PREFIX = 'gate_receiving_start_date_';
  let uiReady = false;
  let dataSdkPatched = false;

  function n(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function safeEscape(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function readJsonTextarea(fieldId) {
    if (typeof parseJsonField === 'function') return parseJsonField(fieldId, []);
    const el = document.getElementById(fieldId);
    const value = el ? el.value.trim() : '';
    return value ? JSON.parse(value) : [];
  }

  function getActiveWeekGroupSafe() {
    try { return typeof getActiveWG === 'function' ? getActiveWG() : ''; } catch (_) { return ''; }
  }

  function getAllData() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function dateKey(value) {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function addDays(key, days) {
    if (!key) return '';
    const date = new Date(`${key}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatReportDate(key) {
    if (!key) return '';
    const date = new Date(`${key}T00:00:00`);
    if (Number.isNaN(date.getTime())) return safeEscape(key);
    return safeEscape(date.toLocaleDateString([], { year: 'numeric', month: 'long', day: '2-digit' }));
  }

  function safeDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return safeEscape(value);
    return safeEscape(date.toLocaleString());
  }

  function storageKey() {
    const wg = document.getElementById('wg-batch-input')?.value.trim() || getActiveWeekGroupSafe() || 'default';
    return `${RECEIVING_DATE_STORAGE_PREFIX}${wg}`;
  }

  function getReceivingStartDateFromUi() {
    const input = document.getElementById('receiving-start-date-input');
    return input ? dateKey(input.value) : '';
  }

  function getReceivingStartDate(dormData, busData, explicitDate) {
    const explicit = dateKey(explicitDate);
    if (explicit) return explicit;

    const uiDate = getReceivingStartDateFromUi();
    if (uiDate) return uiDate;

    const stored = dateKey(localStorage.getItem(storageKey()) || '');
    if (stored) return stored;

    const fromDorm = (dormData || []).map(d => dateKey(d.receiving_start_date)).find(Boolean);
    if (fromDorm) return fromDorm;

    const activityDates = [];
    (dormData || []).forEach(d => {
      const key = dateKey(d.closed_at || d.close_time || d.updated_at);
      if (key) activityDates.push(key);
    });
    (busData || []).forEach(b => {
      const key = dateKey(b.arrived_at || b.departed_at || b.created_at);
      if (key) activityDates.push(key);
    });

    return activityDates.sort()[0] || '';
  }

  function getDormProcessedDate(dorm) {
    return dateKey(dorm.closed_at || dorm.close_time || dorm.updated_at || dorm.processed_at || '');
  }

  function getBusActivityDate(bus) {
    return dateKey(bus.arrived_at || bus.departed_at || bus.created_at || '');
  }

  function buildNightStatement({ processedToday, expectedTotal, processedTotal, naturalizationToday, naturalizationTotal, spaceForceToday, spaceForceTotal }) {
    return `Today, the PRC processed ${processedToday} trainees out of ${expectedTotal} expected for a total of ${processedTotal} processed. ${naturalizationToday} trainees requested U.S. naturalization for a total of ${naturalizationTotal}. ${spaceForceToday} Space Force trainees were processed for a total of ${spaceForceTotal}.`;
  }

  function buildReceivingNightSummary({ dormData, busData, receivingStartDate }) {
    const dorms = Array.isArray(dormData) ? dormData : [];
    const buses = Array.isArray(busData) ? busData : [];
    const startDate = getReceivingStartDate(dorms, buses, receivingStartDate);
    const nightOneDate = startDate;
    const nightTwoDate = startDate ? addDays(startDate, 1) : '';
    const expectedTotal = dorms.reduce((sum, dorm) => sum + n(dorm.max_load), 0);

    function processedForDate(key) {
      if (!key) return 0;
      return dorms
        .filter(dorm => getDormProcessedDate(dorm) === key)
        .reduce((sum, dorm) => sum + n(dorm.current_load ?? dorm.loaded), 0);
    }

    function natForDate(key) {
      if (!key) return 0;
      return buses
        .filter(bus => getBusActivityDate(bus) === key)
        .reduce((sum, bus) => sum + n(bus.nat_count), 0);
    }

    function sfForDate(key) {
      if (!key) return 0;
      return buses
        .filter(bus => getBusActivityDate(bus) === key)
        .reduce((sum, bus) => sum + n(bus.space_force_count), 0);
    }

    const nightOneProcessed = processedForDate(nightOneDate);
    const nightTwoProcessed = processedForDate(nightTwoDate);
    const nightOneNat = natForDate(nightOneDate);
    const nightTwoNat = natForDate(nightTwoDate);
    const nightOneSf = sfForDate(nightOneDate);
    const nightTwoSf = sfForDate(nightTwoDate);

    const nightOne = {
      date: nightOneDate,
      processedToday: nightOneProcessed,
      processedTotal: nightOneProcessed,
      naturalizationToday: nightOneNat,
      naturalizationTotal: nightOneNat,
      spaceForceToday: nightOneSf,
      spaceForceTotal: nightOneSf,
      statement: startDate
        ? buildNightStatement({
          processedToday: nightOneProcessed,
          expectedTotal,
          processedTotal: nightOneProcessed,
          naturalizationToday: nightOneNat,
          naturalizationTotal: nightOneNat,
          spaceForceToday: nightOneSf,
          spaceForceTotal: nightOneSf
        })
        : 'No receiving start date or processing activity date is available.'
    };

    const hasNightTwoActivity = Boolean(nightTwoProcessed || nightTwoNat || nightTwoSf);
    const nightTwo = {
      date: nightTwoDate,
      processedToday: nightTwoProcessed,
      processedTotal: nightOneProcessed + nightTwoProcessed,
      naturalizationToday: nightTwoNat,
      naturalizationTotal: nightOneNat + nightTwoNat,
      spaceForceToday: nightTwoSf,
      spaceForceTotal: nightOneSf + nightTwoSf,
      statement: startDate
        ? (hasNightTwoActivity
          ? buildNightStatement({
            processedToday: nightTwoProcessed,
            expectedTotal,
            processedTotal: nightOneProcessed + nightTwoProcessed,
            naturalizationToday: nightTwoNat,
            naturalizationTotal: nightOneNat + nightTwoNat,
            spaceForceToday: nightTwoSf,
            spaceForceTotal: nightOneSf + nightTwoSf
          })
          : 'No processing activity recorded.')
        : 'No processing activity recorded.'
    };

    return { expectedTotal, receivingStartDate: startDate, nightOne, nightTwo };
  }

  function buildRows(items, mapper, columnCount) {
    if (!items || items.length === 0) return `<tr><td colspan="${columnCount}" class="empty-row">No records.</td></tr>`;
    return items.map(mapper).join('');
  }

  function buildReportPayload({ weekGroup, archivedAt, dormData, busData, receivingStartDate }) {
    const dorms = Array.isArray(dormData) ? dormData : [];
    const buses = Array.isArray(busData) ? busData : [];
    const arrivedBuses = buses.filter(b => !b.status || b.status === 'arrived' || b.bus_type === 'local');
    const expectedTotal = dorms.reduce((sum, d) => sum + n(d.max_load), 0);
    const loadedTotal = dorms.reduce((sum, d) => sum + n(d.current_load ?? d.loaded), 0);
    const totalArrived = arrivedBuses.reduce((sum, b) => sum + n(b.otw_count), 0);
    const femaleTotal = arrivedBuses.reduce((sum, b) => sum + n(b.female_count), 0);
    const natTotal = arrivedBuses.reduce((sum, b) => sum + n(b.nat_count), 0);
    const sfTotal = arrivedBuses.reduce((sum, b) => sum + n(b.space_force_count), 0);
    const receivingSummary = buildReceivingNightSummary({ dormData: dorms, busData: buses, receivingStartDate });

    return {
      weekGroup,
      archivedAt,
      printedAt: new Date().toLocaleString(),
      receivingStartDate: receivingSummary.receivingStartDate,
      dorms,
      buses,
      expectedTotal,
      loadedTotal,
      totalArrived,
      femaleTotal,
      natTotal,
      sfTotal,
      receivingSummary
    };
  }

  function renderReport(payload) {
    const notesItems = payload.dorms
      .filter(d => String(d.notes || '').trim())
      .map(d => `
        <div class="note-item">
          <div class="note-title">${safeEscape(d.name || d.dorm_name || 'Dorm')}</div>
          <div>${safeEscape(d.notes || '')}</div>
        </div>
      `).join('');

    const dormRows = buildRows(payload.dorms, d => `
      <tr>
        <td class="strong">${safeEscape(d.name || d.dorm_name || '')}</td>
        <td>${safeEscape(d.assigned_airman || '')}</td>
        <td>${safeEscape(d.sdq || '')}</td>
        <td>${safeEscape(d.section || '')}</td>
        <td>${safeEscape(d.inter_sec || '')}</td>
        <td>${safeEscape(d.sex || '')}</td>
        <td>${safeEscape(d.band === 'true' ? 'YES' : '')}</td>
        <td class="num">${safeEscape(d.current_load ?? d.loaded ?? 0)}</td>
        <td class="num">${safeEscape(d.max_load ?? 0)}</td>
        <td>${safeDateTime(d.opened_at || d.open_time)}</td>
        <td>${safeDateTime(d.closed_at || d.close_time)}</td>
        <td>${safeEscape(d.closed_timer || d.elapsed || '')}</td>
      </tr>
    `, 12);

    const busRows = buildRows(payload.buses, b => `
      <tr>
        <td>${safeEscape(b.bus_type || '')}</td>
        <td class="strong">${safeEscape(b.bus_id || '')}</td>
        <td>${safeEscape(b.originating_destination || b.destination || '')}</td>
        <td class="num">${safeEscape(b.otw_count || 0)}</td>
        <td class="num">${safeEscape(b.female_count || 0)}</td>
        <td class="num">${safeEscape(b.nat_count || 0)}</td>
        <td class="num">${safeEscape(b.space_force_count || 0)}</td>
        <td>${safeDateTime(b.departed_at || b.created_at)}</td>
        <td>${safeDateTime(b.arrived_at)}</td>
        <td>${safeEscape(b.status || '')}</td>
      </tr>
    `, 10);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Unable to open the print report. Allow pop-ups for this site and try again.');
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
      <head>
        <title>${safeEscape(payload.weekGroup)} GATE Receiving Archive Report</title>
        <style>
          :root { --ink:#0f172a; --muted:#475569; --line:#cbd5e1; --header:#0f172a; --soft:#f8fafc; --green:#166534; }
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; color: var(--ink); margin: 24px; background: #ffffff; }
          .classification { display:flex; justify-content:center; align-items:center; min-height:28px; background:var(--green); color:#fff; font-size:11px; font-weight:900; letter-spacing:.12em; text-transform:uppercase; border:1px solid #14532d; }
          .no-print { margin:12px 0; padding:9px 16px; border:1px solid #94a3b8; border-radius:8px; background:#0f172a; color:#fff; font-weight:900; letter-spacing:.04em; cursor:pointer; }
          .report-header { display:flex; justify-content:space-between; gap:24px; padding:18px 0 14px; border-bottom:2px solid var(--header); margin-bottom:14px; }
          .title-block h1 { margin:0; font-size:28px; letter-spacing:-.035em; text-transform:uppercase; }
          .subtitle { margin-top:4px; color:var(--muted); font-size:12px; font-weight:900; letter-spacing:.055em; text-transform:uppercase; }
          .meta { min-width:285px; border:1px solid var(--line); background:var(--soft); padding:10px; font-size:11px; }
          .meta-row { display:flex; justify-content:space-between; gap:10px; margin-bottom:5px; }
          .meta-row:last-child { margin-bottom:0; }
          .meta-label { color:var(--muted); font-weight:900; text-transform:uppercase; }
          .meta-value { font-weight:900; text-align:right; }
          .summary { display:grid; grid-template-columns: repeat(6, 1fr); gap:8px; margin:14px 0 18px; }
          .box { border:1px solid var(--line); background:#f8fafc; padding:10px; min-height:70px; }
          .label { color:var(--muted); font-size:9px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
          .value { margin-top:5px; font-size:23px; font-weight:900; letter-spacing:-.05em; }
          h2 { margin:18px 0 8px; padding-bottom:4px; border-bottom:1px solid var(--line); font-size:15px; text-transform:uppercase; letter-spacing:.06em; }
          table { width:100%; border-collapse:collapse; margin-top:8px; font-size:10px; page-break-inside:auto; }
          th, td { border:1px solid var(--line); padding:5px 6px; text-align:left; vertical-align:top; }
          th { background:#e2e8f0; color:#0f172a; font-size:9px; text-transform:uppercase; letter-spacing:.045em; }
          tr:nth-child(even) td { background:#f8fafc; }
          .strong { font-weight:900; } .num { text-align:right; font-variant-numeric:tabular-nums; } .empty-row { text-align:center; color:var(--muted); padding:14px; }
          .receiving-summary { border:1px solid var(--line); background:#f8fafc; padding:12px; margin:10px 0 16px; }
          .night { padding:8px 0; border-bottom:1px solid #e2e8f0; }
          .night:last-child { border-bottom:none; }
          .night-title { font-weight:900; text-transform:uppercase; letter-spacing:.05em; font-size:11px; margin-bottom:4px; }
          .night-date { color:var(--muted); font-weight:800; margin-left:5px; }
          .night-text { font-size:12px; line-height:1.45; font-weight:700; }
          .notes-section { margin-top:12px; border:1px solid var(--line); background:#f8fafc; padding:10px; }
          .note-item { padding:7px 0; border-bottom:1px solid #e2e8f0; font-size:11px; }
          .note-item:last-child { border-bottom:none; } .note-title { font-weight:900; margin-bottom:2px; }
          .footer { margin-top:22px; padding-top:8px; border-top:2px solid var(--header); color:var(--muted); font-size:10px; display:flex; justify-content:space-between; gap:18px; }
          @media print { body { margin:10mm; } .no-print { display:none; } .classification,.box,th,tr:nth-child(even) td,.notes-section,.receiving-summary,.meta { print-color-adjust:exact; -webkit-print-color-adjust:exact; } h2 { page-break-after:avoid; } tr,.night { page-break-inside:avoid; } }
        </style>
      </head>
      <body>
        <div class="classification">UNCLASSIFIED / NO PII / STATUS COUNTS ONLY</div>
        <button class="no-print" onclick="window.print()">Print Report</button>
        <header class="report-header">
          <div class="title-block">
            <h1>GATE Receiving Archive Report</h1>
            <div class="subtitle">Gateway Arrival Tracking Environment — Pfingston Reception Center</div>
          </div>
          <div class="meta">
            <div class="meta-row"><span class="meta-label">Week Group</span><span class="meta-value">${safeEscape(payload.weekGroup)}</span></div>
            <div class="meta-row"><span class="meta-label">Receiving Start</span><span class="meta-value">${payload.receivingStartDate ? formatReportDate(payload.receivingStartDate) : '—'}</span></div>
            <div class="meta-row"><span class="meta-label">Archived</span><span class="meta-value">${safeDateTime(payload.archivedAt) || 'Current Summary'}</span></div>
            <div class="meta-row"><span class="meta-label">Printed</span><span class="meta-value">${safeEscape(payload.printedAt)}</span></div>
          </div>
        </header>
        <section class="summary">
          <div class="box"><div class="label">Expected</div><div class="value">${payload.expectedTotal}</div></div>
          <div class="box"><div class="label">Arrived</div><div class="value">${payload.totalArrived}</div></div>
          <div class="box"><div class="label">Loaded</div><div class="value">${payload.loadedTotal}</div></div>
          <div class="box"><div class="label">Females</div><div class="value">${payload.femaleTotal}</div></div>
          <div class="box"><div class="label">Naturalizations</div><div class="value">${payload.natTotal}</div></div>
          <div class="box"><div class="label">Space Force</div><div class="value">${payload.sfTotal}</div></div>
        </section>
        <h2>Receiving Processing Summary</h2>
        <section class="receiving-summary">
          <div class="night"><div class="night-title">Receiving Night One (1):<span class="night-date">${formatReportDate(payload.receivingSummary.nightOne.date)}</span></div><div class="night-text">${safeEscape(payload.receivingSummary.nightOne.statement)}</div></div>
          <div class="night"><div class="night-title">Receiving Night Two (2):<span class="night-date">${formatReportDate(payload.receivingSummary.nightTwo.date)}</span></div><div class="night-text">${safeEscape(payload.receivingSummary.nightTwo.statement)}</div></div>
        </section>
        <h2>Dorm Table</h2>
        <table><thead><tr><th>Dorm</th><th>Airman</th><th>SDQ</th><th>Section</th><th>Inter/Sec</th><th>Sex</th><th>Band</th><th>Loaded</th><th>Max</th><th>Opened</th><th>Closed</th><th>Elapsed</th></tr></thead><tbody>${dormRows}</tbody></table>
        <h2>Bus Table</h2>
        <table><thead><tr><th>Type</th><th>Bus #</th><th>Originating Destination</th><th>Arrived/OTW</th><th>Females</th><th>Naturalizations</th><th>Space Force</th><th>Departed</th><th>Arrived</th><th>Status</th></tr></thead><tbody>${busRows}</tbody></table>
        <h2>Notes</h2>
        <section class="notes-section">${notesItems || '<div class="empty-row">No dorm notes recorded.</div>'}</section>
        <footer class="footer"><div>UNCLASSIFIED / NO PII</div><div>Generated by GATE</div></footer>
        <div class="classification" style="margin-top:10px;">UNCLASSIFIED / NO PII / STATUS COUNTS ONLY</div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
  }

  function printArchiveSpreadsheet() {
    if (typeof editArchiveId === 'undefined' || !editArchiveId) return;
    const archive = getAllData().find(r => r.__backendId === editArchiveId);
    if (!archive) return;

    let dormData = [];
    let busData = [];
    try {
      dormData = readJsonTextarea('archive-edit-dorm-data');
      busData = readJsonTextarea('archive-edit-bus-data');
    } catch (error) {
      alert('Dorm Data JSON or Bus Data JSON is invalid. Fix the JSON before printing.');
      return;
    }

    const weekGroup = document.getElementById('archive-edit-wg')?.value.trim() || archive.week_group || '';
    const archivedAt = document.getElementById('archive-edit-archived-at')?.value.trim() || archive.archived_at || '';
    const receivingStartDate = getReceivingStartDate(dormData, busData, archive.receiving_start_date || '');
    renderReport(buildReportPayload({ weekGroup, archivedAt, dormData, busData, receivingStartDate }));
  }

  function printCurrentSummaryReport() {
    const wg = getActiveWeekGroupSafe();
    if (!wg) {
      alert('Initialize or select a Week Group before printing a current summary.');
      return;
    }

    const records = getAllData().filter(record => record && record.week_group === wg);
    const dormData = records.filter(record => record.type === 'dorm');
    const busData = records.filter(record => record.type === 'bus');
    const receivingStartDate = getReceivingStartDate(dormData, busData, getReceivingStartDateFromUi());
    renderReport(buildReportPayload({ weekGroup: wg, archivedAt: '', dormData, busData, receivingStartDate }));
  }

  function ensureReceivingStartDateInput() {
    const wgInput = document.getElementById('wg-batch-input');
    if (!wgInput || document.getElementById('receiving-start-date-input')) return;

    const wgWrapper = wgInput.closest('.flex-1') || wgInput.parentElement;
    if (!wgWrapper || !wgWrapper.parentElement) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'flex-1 max-w-xs';
    wrapper.innerHTML = `
      <label for="receiving-start-date-input" class="block text-xs uppercase tracking-wider font-medium text-muted mb-1">Receiving Start Date</label>
      <input id="receiving-start-date-input" type="date" class="w-full border rounded px-3 py-2 bg-transparent text-base" style="border-color:var(--border);color:var(--text);">
    `;
    wgWrapper.insertAdjacentElement('afterend', wrapper);

    const input = document.getElementById('receiving-start-date-input');
    const stored = localStorage.getItem(storageKey());
    if (stored) input.value = stored;

    input.addEventListener('change', () => {
      const value = dateKey(input.value);
      if (value) localStorage.setItem(storageKey(), value);
      else localStorage.removeItem(storageKey());
    });

    wgInput.addEventListener('change', () => {
      const next = localStorage.getItem(storageKey()) || '';
      input.value = next;
    });
  }

  function ensureCurrentPrintButton() {
    const page = document.getElementById('page-archives');
    if (!page || document.getElementById('print-current-summary-btn')) return;

    const container = page.querySelector('.max-w-3xl') || page;
    const title = container.querySelector('h2, h3');
    const button = document.createElement('button');
    button.id = 'print-current-summary-btn';
    button.type = 'button';
    button.textContent = 'Print Current Summary';
    button.className = 'px-4 py-2 rounded-lg font-bold text-white text-sm mb-4';
    button.style.background = 'var(--blue)';
    button.addEventListener('click', printCurrentSummaryReport);

    if (title) title.insertAdjacentElement('afterend', button);
    else container.insertAdjacentElement('afterbegin', button);
  }

  function patchDataSdkCreateForReceivingDate() {
    if (dataSdkPatched || !window.dataSdk || typeof window.dataSdk.create !== 'function') return;
    const originalCreate = window.dataSdk.create.bind(window.dataSdk);
    window.dataSdk.create = function patchedCreate(payload) {
      if (payload && payload.type === 'dorm' && !payload.receiving_start_date) {
        const receivingDate = getReceivingStartDateFromUi();
        if (receivingDate) payload = Object.assign({}, payload, { receiving_start_date: receivingDate });
      }
      return originalCreate(payload);
    };
    dataSdkPatched = true;
  }

  function runUiPass() {
    ensureReceivingStartDateInput();
    ensureCurrentPrintButton();
    patchDataSdkCreateForReceivingDate();
    window.printArchiveSpreadsheet = printArchiveSpreadsheet;
    window.printCurrentSummaryReport = printCurrentSummaryReport;
    window.buildReceivingNightSummary = buildReceivingNightSummary;
  }

  function start() {
    if (!uiReady) {
      uiReady = true;
      runUiPass();
      setInterval(runUiPass, 750);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
