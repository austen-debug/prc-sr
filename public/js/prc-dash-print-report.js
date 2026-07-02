// GATE Receiving Archive / Current Summary Report
// Report helper using explicit Receiving Day One/Two datetime windows as the source of truth.
(function () {
  const WINDOW_STORAGE_PREFIX = 'gate_receiving_windows_';
  const WINDOW_FIELDS = [
    ['receiving_day_one_start', 'RECEIVING DAY ONE START DATE / TIME'],
    ['receiving_day_one_end', 'RECEIVING DAY ONE END DATE / TIME'],
    ['receiving_day_two_start', 'RECEIVING DAY TWO START DATE / TIME'],
    ['receiving_day_two_end', 'RECEIVING DAY TWO END DATE / TIME']
  ];

  let uiReady = false;

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

  function parseDateTime(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatReportDate(value) {
    const date = parseDateTime(value);
    if (!date) return '';
    return safeEscape(date.toLocaleDateString([], { year: 'numeric', month: 'long', day: '2-digit' }));
  }

  function safeDateTime(value) {
    const date = parseDateTime(value);
    return date ? safeEscape(date.toLocaleString()) : '';
  }

  function storedWindows(weekGroup) {
    try {
      const key = `${WINDOW_STORAGE_PREFIX}${weekGroup || getActiveWeekGroupSafe() || 'default'}`;
      return JSON.parse(localStorage.getItem(key) || '{}');
    } catch (_) {
      return {};
    }
  }

  function collectReceivingWindows({ weekGroup = '', archive = {}, dorms = [] } = {}) {
    const stored = storedWindows(weekGroup);
    const firstDormWithWindows = (Array.isArray(dorms) ? dorms : []).find(dorm => WINDOW_FIELDS.some(([key]) => dorm && dorm[key])) || {};
    const values = {};

    WINDOW_FIELDS.forEach(([key]) => {
      values[key] =
        document.getElementById(`archive-edit-${key}`)?.value ||
        document.getElementById(key)?.value ||
        archive[key] ||
        firstDormWithWindows[key] ||
        stored[key] ||
        '';
    });

    return values;
  }

  function inWindow(timestamp, start, end) {
    const date = parseDateTime(timestamp);
    const startDate = parseDateTime(start);
    const endDate = parseDateTime(end);
    return Boolean(date && startDate && endDate && date.getTime() >= startDate.getTime() && date.getTime() < endDate.getTime());
  }

  function firstValidTimestamp(values) {
    for (const value of values) if (parseDateTime(value)) return value;
    return '';
  }

  function getDormProcessedTimestamp(dorm) {
    return firstValidTimestamp([dorm.closed_at, dorm.close_time, dorm.processed_at, dorm.updated_at, dorm.created_at]);
  }

  function getBusActivityTimestamp(bus) {
    return firstValidTimestamp([bus.arrived_at, bus.departed_at, bus.created_at, bus.updated_at]);
  }

  function isSpaceForceDorm(dorm) {
    return dorm && (dorm.space_force === true || dorm.space_force === 'true' || dorm.is_space_force === true || dorm.is_space_force === 'true');
  }

  function buildNightStatement({ afToday, afExpected, afTotal, sfToday, sfExpected, sfTotal, natToday, natTotal, totalToday, totalExpected }) {
    return `Tonight, the PRC processed ${afToday} of the ${afExpected} projected Air Force trainees for a total of ${afTotal}, and ${sfToday} out of ${sfExpected} Space Force trainees for a total of ${sfTotal} — equalling ${totalToday} out of ${totalExpected} total projected trainees for this week group. ${natToday} trainees requested U.S. naturalization for a total of ${natTotal}.`;
  }

  function buildReceivingNightSummary({ dormData, busData, windows }) {
    const dorms = Array.isArray(dormData) ? dormData : [];
    const buses = Array.isArray(busData) ? busData : [];
    const afExpected = dorms.filter(dorm => !isSpaceForceDorm(dorm)).reduce((sum, dorm) => sum + n(dorm.max_load), 0);
    const sfExpected = dorms.filter(isSpaceForceDorm).reduce((sum, dorm) => sum + n(dorm.max_load), 0);
    const totalExpected = afExpected + sfExpected;

    const nights = [
      { key: 'nightOne', label: 'Receiving Night One (1)', start: windows.receiving_day_one_start, end: windows.receiving_day_one_end },
      { key: 'nightTwo', label: 'Receiving Night Two (2)', start: windows.receiving_day_two_start, end: windows.receiving_day_two_end }
    ];

    let afTotal = 0;
    let sfTotal = 0;
    let natTotal = 0;
    const result = { expectedTotal: totalExpected, afExpected, sfExpected, receivingWindows: windows };

    nights.forEach(night => {
      const hasWindow = Boolean(parseDateTime(night.start) && parseDateTime(night.end));
      const dayDorms = hasWindow ? dorms.filter(dorm => inWindow(getDormProcessedTimestamp(dorm), night.start, night.end)) : [];
      const afToday = dayDorms.filter(dorm => !isSpaceForceDorm(dorm)).reduce((sum, dorm) => sum + n(dorm.current_load ?? dorm.loaded), 0);
      const sfToday = dayDorms.filter(isSpaceForceDorm).reduce((sum, dorm) => sum + n(dorm.current_load ?? dorm.loaded), 0);
      const natToday = hasWindow ? buses.filter(bus => inWindow(getBusActivityTimestamp(bus), night.start, night.end)).reduce((sum, bus) => sum + n(bus.nat_count), 0) : 0;

      afTotal += afToday;
      sfTotal += sfToday;
      natTotal += natToday;

      result[night.key] = {
        date: night.start,
        windowStart: night.start || '',
        windowEnd: night.end || '',
        processedToday: afToday + sfToday,
        processedTotal: afTotal + sfTotal,
        naturalizationToday: natToday,
        naturalizationTotal: natTotal,
        spaceForceToday: sfToday,
        spaceForceTotal: sfTotal,
        statement: hasWindow
          ? buildNightStatement({
            afToday,
            afExpected,
            afTotal,
            sfToday,
            sfExpected,
            sfTotal,
            natToday,
            natTotal,
            totalToday: afTotal + sfTotal,
            totalExpected
          })
          : `${night.label} date/time window is not configured.`
      };
    });

    return result;
  }

  function buildRows(items, mapper, columnCount) {
    if (!items || items.length === 0) return `<tr><td colspan="${columnCount}" class="empty-row">No records.</td></tr>`;
    return items.map(mapper).join('');
  }

  function buildReportPayload({ weekGroup, archivedAt, dormData, busData, windows }) {
    const dorms = Array.isArray(dormData) ? dormData : [];
    const buses = Array.isArray(busData) ? busData : [];
    const arrivedBuses = buses.filter(bus => !bus.status || bus.status === 'arrived' || bus.bus_type === 'local');
    const receivingSummary = buildReceivingNightSummary({ dormData: dorms, busData: buses, windows });

    return {
      weekGroup,
      archivedAt,
      printedAt: new Date().toLocaleString(),
      receivingWindows: windows,
      dorms,
      buses,
      expectedTotal: dorms.reduce((sum, dorm) => sum + n(dorm.max_load), 0),
      loadedTotal: dorms.reduce((sum, dorm) => sum + n(dorm.current_load ?? dorm.loaded), 0),
      totalArrived: arrivedBuses.reduce((sum, bus) => sum + n(bus.otw_count), 0),
      femaleTotal: arrivedBuses.reduce((sum, bus) => sum + n(bus.female_count), 0),
      natTotal: arrivedBuses.reduce((sum, bus) => sum + n(bus.nat_count), 0),
      sfTotal: arrivedBuses.reduce((sum, bus) => sum + n(bus.space_force_count), 0),
      receivingSummary
    };
  }

  function renderReport(payload) {
    const notesItems = payload.dorms.filter(dorm => String(dorm.notes || '').trim()).map(dorm => `<div class="note-item"><div class="note-title">${safeEscape(dorm.name || dorm.dorm_name || 'Dorm')}</div><div>${safeEscape(dorm.notes || '')}</div></div>`).join('');
    const dormRows = buildRows(payload.dorms, dorm => `<tr><td class="strong">${safeEscape(dorm.name || dorm.dorm_name || '')}</td><td>${safeEscape(dorm.assigned_airman || '')}</td><td>${safeEscape(dorm.sdq || '')}</td><td>${safeEscape(dorm.section || '')}</td><td>${safeEscape(dorm.inter_sec || '')}</td><td>${safeEscape(dorm.sex || '')}</td><td>${safeEscape(dorm.band === 'true' ? 'YES' : '')}</td><td class="num">${safeEscape(dorm.current_load ?? dorm.loaded ?? 0)}</td><td class="num">${safeEscape(dorm.max_load ?? 0)}</td><td>${safeDateTime(dorm.opened_at || dorm.open_time)}</td><td>${safeDateTime(dorm.closed_at || dorm.close_time)}</td><td>${safeEscape(dorm.closed_timer || dorm.elapsed || '')}</td></tr>`, 12);
    const busRows = buildRows(payload.buses, bus => `<tr><td>${safeEscape(bus.bus_type || '')}</td><td class="strong">${safeEscape(bus.bus_id || '')}</td><td>${safeEscape(bus.originating_destination || bus.destination || '')}</td><td class="num">${safeEscape(bus.otw_count || 0)}</td><td class="num">${safeEscape(bus.female_count || 0)}</td><td class="num">${safeEscape(bus.nat_count || 0)}</td><td class="num">${safeEscape(bus.space_force_count || 0)}</td><td>${safeDateTime(bus.departed_at || bus.created_at)}</td><td>${safeDateTime(bus.arrived_at)}</td><td>${safeEscape(bus.status || '')}</td></tr>`, 10);
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      alert('Unable to open the print report. Allow pop-ups for this site and try again.');
      return;
    }

    reportWindow.document.open();
    reportWindow.document.write(`<!doctype html><html><head><title>${safeEscape(payload.weekGroup)} GATE Receiving Report</title><style>
      :root{--ink:#0f172a;--muted:#475569;--line:#cbd5e1;--header:#0f172a;--soft:#f8fafc;--green:#166534}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:var(--ink);margin:24px;background:#fff}.classification{display:flex;justify-content:center;align-items:center;min-height:28px;background:var(--green);color:#fff;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;border:1px solid #14532d}.no-print{margin:12px 0;padding:9px 16px;border:1px solid #94a3b8;border-radius:8px;background:#0f172a;color:#fff;font-weight:900;letter-spacing:.04em;cursor:pointer}.report-header{display:flex;justify-content:space-between;gap:24px;padding:18px 0 14px;border-bottom:2px solid var(--header);margin-bottom:14px}.title-block h1{margin:0;font-size:28px;letter-spacing:-.035em;text-transform:uppercase}.subtitle{margin-top:4px;color:var(--muted);font-size:12px;font-weight:900;letter-spacing:.055em;text-transform:uppercase}.meta{min-width:285px;border:1px solid var(--line);background:var(--soft);padding:10px;font-size:11px}.meta-row{display:flex;justify-content:space-between;gap:10px;margin-bottom:5px}.meta-label{color:var(--muted);font-weight:900;text-transform:uppercase}.meta-value{font-weight:900;text-align:right}.summary{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:14px 0 18px}.box{border:1px solid var(--line);background:#f8fafc;padding:10px;min-height:70px}.label{color:var(--muted);font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.value{margin-top:5px;font-size:23px;font-weight:900;letter-spacing:-.05em}h2{margin:18px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--line);font-size:15px;text-transform:uppercase;letter-spacing:.06em}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:10px;page-break-inside:auto}th,td{border:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top}th{background:#e2e8f0;color:#0f172a;font-size:9px;text-transform:uppercase;letter-spacing:.045em}tr:nth-child(even) td{background:#f8fafc}.strong{font-weight:900}.num{text-align:right;font-variant-numeric:tabular-nums}.empty-row{text-align:center;color:var(--muted);padding:14px}.receiving-summary{border:1px solid var(--line);background:#f8fafc;padding:12px;margin:10px 0 16px}.night{padding:8px 0;border-bottom:1px solid #e2e8f0}.night:last-child{border-bottom:none}.night-title{font-weight:900;text-transform:uppercase;letter-spacing:.05em;font-size:11px;margin-bottom:4px}.night-date{color:var(--muted);font-weight:800;margin-left:5px}.night-text{font-size:12px;line-height:1.45;font-weight:700}.notes-section{margin-top:12px;border:1px solid var(--line);background:#f8fafc;padding:10px}.note-item{padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:11px}.note-item:last-child{border-bottom:none}.note-title{font-weight:900;margin-bottom:2px}.footer{margin-top:22px;padding-top:8px;border-top:2px solid var(--header);color:var(--muted);font-size:10px;display:flex;justify-content:space-between;gap:18px}@media print{body{margin:10mm}.no-print{display:none}.classification,.box,th,tr:nth-child(even) td,.notes-section,.receiving-summary,.meta{print-color-adjust:exact;-webkit-print-color-adjust:exact}h2{page-break-after:avoid}tr,.night{page-break-inside:avoid}}
    </style></head><body>
      <div class="classification">UNCLASSIFIED / NO PII / STATUS COUNTS ONLY</div><button class="no-print" onclick="window.print()">Print Report</button>
      <header class="report-header"><div class="title-block"><h1>GATE Receiving Report</h1><div class="subtitle">Gateway Arrival Tracking Environment — Pfingston Reception Center</div></div><div class="meta"><div class="meta-row"><span class="meta-label">Week Group</span><span class="meta-value">${safeEscape(payload.weekGroup)}</span></div><div class="meta-row"><span class="meta-label">Archived</span><span class="meta-value">${safeDateTime(payload.archivedAt) || 'Current Summary'}</span></div><div class="meta-row"><span class="meta-label">Printed</span><span class="meta-value">${safeEscape(payload.printedAt)}</span></div></div></header>
      <section class="summary"><div class="box"><div class="label">Expected</div><div class="value">${payload.expectedTotal}</div></div><div class="box"><div class="label">Arrived</div><div class="value">${payload.totalArrived}</div></div><div class="box"><div class="label">Loaded</div><div class="value">${payload.loadedTotal}</div></div><div class="box"><div class="label">Females</div><div class="value">${payload.femaleTotal}</div></div><div class="box"><div class="label">Naturalizations</div><div class="value">${payload.natTotal}</div></div><div class="box"><div class="label">Space Force</div><div class="value">${payload.sfTotal}</div></div></section>
      <h2>Receiving Processing Summary</h2><section class="receiving-summary"><div class="night"><div class="night-title">Receiving Night One (1):<span class="night-date">${formatReportDate(payload.receivingSummary.nightOne.date)}</span></div><div class="night-text">${safeEscape(payload.receivingSummary.nightOne.statement)}</div></div><div class="night"><div class="night-title">Receiving Night Two (2):<span class="night-date">${formatReportDate(payload.receivingSummary.nightTwo.date)}</span></div><div class="night-text">${safeEscape(payload.receivingSummary.nightTwo.statement)}</div></div></section>
      <h2>Dorm Table</h2><table><thead><tr><th>Dorm</th><th>Airman</th><th>SDQ</th><th>Section</th><th>Inter/Sec</th><th>Sex</th><th>Band</th><th>Loaded</th><th>Max</th><th>Opened</th><th>Closed</th><th>Elapsed</th></tr></thead><tbody>${dormRows}</tbody></table>
      <h2>Bus Table</h2><table><thead><tr><th>Type</th><th>Bus #</th><th>Originating Destination</th><th>Arrived/OTW</th><th>Females</th><th>Naturalizations</th><th>Space Force</th><th>Departed</th><th>Arrived</th><th>Status</th></tr></thead><tbody>${busRows}</tbody></table>
      <h2>Notes</h2><section class="notes-section">${notesItems || '<div class="empty-row">No dorm notes recorded.</div>'}</section><footer class="footer"><div>UNCLASSIFIED / NO PII</div><div>Generated by GATE</div></footer><div class="classification" style="margin-top:10px;">UNCLASSIFIED / NO PII / STATUS COUNTS ONLY</div>
    </body></html>`);
    reportWindow.document.close();
    reportWindow.focus();
  }

  function printArchiveSpreadsheet() {
    if (typeof editArchiveId === 'undefined' || !editArchiveId) return;
    const archive = getAllData().find(record => record.__backendId === editArchiveId);
    if (!archive) return;

    let dormData = [];
    let busData = [];
    try {
      dormData = readJsonTextarea('archive-edit-dorm-data');
      busData = readJsonTextarea('archive-edit-bus-data');
    } catch (_) {
      alert('Dorm Data JSON or Bus Data JSON is invalid. Fix the JSON before printing.');
      return;
    }

    const weekGroup = document.getElementById('archive-edit-wg')?.value.trim() || archive.week_group || '';
    const archivedAt = document.getElementById('archive-edit-archived-at')?.value.trim() || archive.archived_at || '';
    const windows = collectReceivingWindows({ weekGroup, archive, dorms: dormData });
    renderReport(buildReportPayload({ weekGroup, archivedAt, dormData, busData, windows }));
  }

  function printCurrentSummaryReport() {
    const weekGroup = getActiveWeekGroupSafe();
    if (!weekGroup) {
      alert('Initialize or select a Week Group before printing a current summary.');
      return;
    }

    const records = getAllData().filter(record => record && record.week_group === weekGroup);
    const dormData = records.filter(record => record.type === 'dorm');
    const busData = records.filter(record => record.type === 'bus');
    const windows = collectReceivingWindows({ weekGroup, dorms: dormData });
    renderReport(buildReportPayload({ weekGroup, archivedAt: '', dormData, busData, windows }));
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

  function runUiPass() {
    document.getElementById('receiving-start-date-input')?.closest('.flex-1, div')?.remove();
    ensureCurrentPrintButton();
    window.printArchiveSpreadsheet = printArchiveSpreadsheet;
    window.printCurrentSummaryReport = printCurrentSummaryReport;
    window.buildReceivingNightSummary = buildReceivingNightSummary;
    window.collectReceivingWindowsForReport = collectReceivingWindows;
  }

  function start() {
    if (uiReady) return;
    uiReady = true;
    runUiPass();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
