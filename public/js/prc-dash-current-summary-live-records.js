// GATE Current Summary live-record report override
// Uses explicit Receiving Day One/Two datetime windows as the source of truth.
(function () {
  const BUTTON_ID = 'print-current-summary-btn';
  const WINDOW_STORAGE_PREFIX = 'gate_receiving_windows_';
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
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function parseTs(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function fmtDate(value) {
    const date = parseTs(value);
    return date ? esc(date.toLocaleDateString([], { year: 'numeric', month: 'long', day: '2-digit' })) : '';
  }

  function fmtDateTime(value) {
    const date = parseTs(value);
    return date ? esc(date.toLocaleString()) : '';
  }

  function firstValidTimestamp(values) {
    for (const value of values) if (parseTs(value)) return value;
    return '';
  }

  function inWindow(timestamp, start, end) {
    const date = parseTs(timestamp);
    const startDate = parseTs(start);
    const endDate = parseTs(end);
    return Boolean(date && startDate && endDate && date.getTime() >= startDate.getTime() && date.getTime() < endDate.getTime());
  }

  function getActiveWeekGroup() {
    try {
      if (typeof window.getActiveWG === 'function') {
        const wg = window.getActiveWG();
        if (wg) return wg;
      }
    } catch (_) {}

    const input = document.getElementById('wg-batch-input')?.value.trim();
    if (input) return input;

    const display = document.getElementById('week-group-display')?.textContent.trim();
    return display || '';
  }

  function storedWindows(weekGroup) {
    try { return JSON.parse(localStorage.getItem(`${WINDOW_STORAGE_PREFIX}${weekGroup || 'default'}`) || '{}'); } catch (_) { return {}; }
  }

  function collectReceivingWindows(weekGroup, dorms) {
    if (typeof window.collectReceivingWindowsForReport === 'function') {
      return window.collectReceivingWindowsForReport({ weekGroup, dorms });
    }

    const stored = storedWindows(weekGroup);
    const firstDormWithWindows = (Array.isArray(dorms) ? dorms : []).find(dorm => WINDOW_FIELDS.some(([key]) => dorm && dorm[key])) || {};
    const values = {};
    WINDOW_FIELDS.forEach(([key]) => {
      values[key] = document.getElementById(key)?.value || firstDormWithWindows[key] || stored[key] || '';
    });
    return values;
  }

  function isSpaceForceDorm(dorm) {
    return dorm && (dorm.space_force === true || dorm.space_force === 'true' || dorm.is_space_force === true || dorm.is_space_force === 'true');
  }

  function dormTs(dorm) {
    return firstValidTimestamp([dorm.closed_at, dorm.close_time, dorm.processed_at, dorm.updated_at, dorm.created_at]);
  }

  function busTs(bus) {
    return firstValidTimestamp([bus.arrived_at, bus.departed_at, bus.created_at, bus.updated_at]);
  }

  function nightStatement({ afToday, afExpected, afTotal, sfToday, sfExpected, sfTotal, natToday, natTotal, totalToday, totalExpected }) {
    return `Tonight, the PRC processed ${afToday} of the ${afExpected} projected Air Force trainees for a total of ${afTotal}, and ${sfToday} out of ${sfExpected} Space Force trainees for a total of ${sfTotal} — equalling ${totalToday} out of ${totalExpected} total projected trainees for this week group. ${natToday} trainees requested U.S. naturalization for a total of ${natTotal}.`;
  }

  function buildReceivingSummary(dorms, buses, windows) {
    const afExpected = dorms.filter(dorm => !isSpaceForceDorm(dorm)).reduce((sum, dorm) => sum + n(dorm.max_load), 0);
    const sfExpected = dorms.filter(isSpaceForceDorm).reduce((sum, dorm) => sum + n(dorm.max_load), 0);
    const totalExpected = afExpected + sfExpected;
    const nightDefs = [
      { key: 'nightOne', label: 'Receiving Night One (1)', start: windows.receiving_day_one_start, end: windows.receiving_day_one_end },
      { key: 'nightTwo', label: 'Receiving Night Two (2)', start: windows.receiving_day_two_start, end: windows.receiving_day_two_end }
    ];

    let afTotal = 0;
    let sfTotal = 0;
    let natTotal = 0;
    const summary = {};

    nightDefs.forEach(night => {
      const hasWindow = Boolean(parseTs(night.start) && parseTs(night.end));
      const dayDorms = hasWindow ? dorms.filter(dorm => inWindow(dormTs(dorm), night.start, night.end)) : [];
      const afToday = dayDorms.filter(dorm => !isSpaceForceDorm(dorm)).reduce((sum, dorm) => sum + n(dorm.current_load ?? dorm.loaded), 0);
      const sfToday = dayDorms.filter(isSpaceForceDorm).reduce((sum, dorm) => sum + n(dorm.current_load ?? dorm.loaded), 0);
      const natToday = hasWindow ? buses.filter(bus => inWindow(busTs(bus), night.start, night.end)).reduce((sum, bus) => sum + n(bus.nat_count), 0) : 0;

      afTotal += afToday;
      sfTotal += sfToday;
      natTotal += natToday;

      summary[night.key] = {
        date: night.start,
        statement: hasWindow
          ? nightStatement({
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

    return summary;
  }

  function rows(items, mapper, colspan) {
    return items.length ? items.map(mapper).join('') : `<tr><td colspan="${colspan}" class="empty-row">No records.</td></tr>`;
  }

  async function fetchRecords() {
    const response = await fetch('/api/records', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    const result = await response.json();
    if (!result.isOk) throw new Error(result.error || 'Failed to fetch records.');
    return Array.isArray(result.records) ? result.records : [];
  }

  function renderCurrentReport(payload, targetWindow) {
    const dormRows = rows(payload.dorms, dorm => `<tr><td class="strong">${esc(dorm.name || dorm.dorm_name || '')}</td><td>${esc(dorm.assigned_airman || '')}</td><td>${esc(dorm.sdq || '')}</td><td>${esc(dorm.section || '')}</td><td>${esc(dorm.inter_sec || '')}</td><td>${esc(dorm.sex || '')}</td><td>${esc(dorm.band === 'true' ? 'YES' : '')}</td><td class="num">${esc(dorm.current_load ?? dorm.loaded ?? 0)}</td><td class="num">${esc(dorm.max_load ?? 0)}</td><td>${fmtDateTime(dorm.opened_at || dorm.open_time)}</td><td>${fmtDateTime(dorm.closed_at || dorm.close_time)}</td><td>${esc(dorm.closed_timer || dorm.elapsed || '')}</td></tr>`, 12);
    const busRows = rows(payload.buses, bus => `<tr><td>${esc(bus.bus_type || '')}</td><td class="strong">${esc(bus.bus_id || '')}</td><td>${esc(bus.originating_destination || bus.destination || '')}</td><td class="num">${esc(bus.otw_count || 0)}</td><td class="num">${esc(bus.female_count || 0)}</td><td class="num">${esc(bus.nat_count || 0)}</td><td class="num">${esc(bus.space_force_count || 0)}</td><td>${fmtDateTime(bus.departed_at || bus.created_at)}</td><td>${fmtDateTime(bus.arrived_at)}</td><td>${esc(bus.status || '')}</td></tr>`, 10);
    const notes = payload.dorms.filter(dorm => String(dorm.notes || '').trim()).map(dorm => `<div class="note-item"><div class="note-title">${esc(dorm.name || dorm.dorm_name || 'Dorm')}</div><div>${esc(dorm.notes || '')}</div></div>`).join('') || '<div class="empty-row">No dorm notes recorded.</div>';

    const winOne = payload.receivingWindows.receiving_day_one_start && payload.receivingWindows.receiving_day_one_end;
    const winTwo = payload.receivingWindows.receiving_day_two_start && payload.receivingWindows.receiving_day_two_end;
    const windowStatus = winOne && winTwo ? 'Explicit Day One / Day Two Windows' : 'Receiving Windows Incomplete';
    const reportWindow = targetWindow || window.open('', '_blank');
    if (!reportWindow) {
      alert('Unable to open the print report. Allow pop-ups for this site and try again.');
      return;
    }

    reportWindow.document.open();
    reportWindow.document.write(`<!doctype html><html><head><title>${esc(payload.weekGroup)} GATE Receiving Current Summary</title><style>
      :root{--ink:#0f172a;--muted:#475569;--line:#cbd5e1;--header:#0f172a;--soft:#f8fafc;--green:#166534}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:var(--ink);margin:24px;background:#fff}.classification{display:flex;justify-content:center;align-items:center;min-height:28px;background:var(--green);color:#fff;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;border:1px solid #14532d}.no-print{margin:12px 0;padding:9px 16px;border:1px solid #94a3b8;border-radius:8px;background:#0f172a;color:#fff;font-weight:900;letter-spacing:.04em;cursor:pointer}.report-header{display:flex;justify-content:space-between;gap:24px;padding:18px 0 14px;border-bottom:2px solid var(--header);margin-bottom:14px}.title-block h1{margin:0;font-size:28px;letter-spacing:-.035em;text-transform:uppercase}.subtitle{margin-top:4px;color:var(--muted);font-size:12px;font-weight:900;letter-spacing:.055em;text-transform:uppercase}.meta{min-width:285px;border:1px solid var(--line);background:var(--soft);padding:10px;font-size:11px}.meta-row{display:flex;justify-content:space-between;gap:10px;margin-bottom:5px}.meta-label{color:var(--muted);font-weight:900;text-transform:uppercase}.meta-value{font-weight:900;text-align:right}.summary{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:14px 0 18px}.box{border:1px solid var(--line);background:#f8fafc;padding:10px;min-height:70px}.label{color:var(--muted);font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.value{margin-top:5px;font-size:23px;font-weight:900;letter-spacing:-.05em}h2{margin:18px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--line);font-size:15px;text-transform:uppercase;letter-spacing:.06em}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:10px;page-break-inside:auto}th,td{border:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top}th{background:#e2e8f0;color:#0f172a;font-size:9px;text-transform:uppercase;letter-spacing:.045em}tr:nth-child(even) td{background:#f8fafc}.strong{font-weight:900}.num{text-align:right;font-variant-numeric:tabular-nums}.empty-row{text-align:center;color:var(--muted);padding:14px}.receiving-summary{border:1px solid var(--line);background:#f8fafc;padding:12px;margin:10px 0 16px}.night{padding:8px 0;border-bottom:1px solid #e2e8f0}.night:last-child{border-bottom:none}.night-title{font-weight:900;text-transform:uppercase;letter-spacing:.05em;font-size:11px;margin-bottom:4px}.night-date{color:var(--muted);font-weight:800;margin-left:5px}.night-text{font-size:12px;line-height:1.45;font-weight:700}.notes-section{margin-top:12px;border:1px solid var(--line);background:#f8fafc;padding:10px}.note-item{padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:11px}.note-item:last-child{border-bottom:none}.note-title{font-weight:900;margin-bottom:2px}.footer{margin-top:22px;padding-top:8px;border-top:2px solid var(--header);color:var(--muted);font-size:10px;display:flex;justify-content:space-between;gap:18px}@media print{body{margin:10mm}.no-print{display:none}.classification,.box,th,tr:nth-child(even) td,.notes-section,.receiving-summary,.meta{print-color-adjust:exact;-webkit-print-color-adjust:exact}h2{page-break-after:avoid}tr,.night{page-break-inside:avoid}}
    </style></head><body>
      <div class="classification">UNCLASSIFIED / NO PII / STATUS COUNTS ONLY</div><button class="no-print" onclick="window.print()">Print Report</button>
      <header class="report-header"><div class="title-block"><h1>GATE Receiving Current Summary</h1><div class="subtitle">Gateway Arrival Tracking Environment — Pfingston Reception Center</div></div><div class="meta"><div class="meta-row"><span class="meta-label">Week Group</span><span class="meta-value">${esc(payload.weekGroup)}</span></div><div class="meta-row"><span class="meta-label">Date Logic</span><span class="meta-value">${esc(windowStatus)}</span></div><div class="meta-row"><span class="meta-label">Report Type</span><span class="meta-value">Current Summary</span></div><div class="meta-row"><span class="meta-label">Printed</span><span class="meta-value">${esc(payload.printedAt)}</span></div></div></header>
      <section class="summary"><div class="box"><div class="label">Expected</div><div class="value">${payload.expectedTotal}</div></div><div class="box"><div class="label">Arrived</div><div class="value">${payload.totalArrived}</div></div><div class="box"><div class="label">Loaded</div><div class="value">${payload.loadedTotal}</div></div><div class="box"><div class="label">Females</div><div class="value">${payload.femaleTotal}</div></div><div class="box"><div class="label">Naturalizations</div><div class="value">${payload.natTotal}</div></div><div class="box"><div class="label">Space Force</div><div class="value">${payload.sfTotal}</div></div></section>
      <h2>Receiving Processing Summary</h2><section class="receiving-summary"><div class="night"><div class="night-title">Receiving Night One (1):<span class="night-date">${fmtDate(payload.receivingSummary.nightOne.date)}</span></div><div class="night-text">${esc(payload.receivingSummary.nightOne.statement)}</div></div><div class="night"><div class="night-title">Receiving Night Two (2):<span class="night-date">${fmtDate(payload.receivingSummary.nightTwo.date)}</span></div><div class="night-text">${esc(payload.receivingSummary.nightTwo.statement)}</div></div></section>
      <h2>Dorm Table</h2><table><thead><tr><th>Dorm</th><th>Airman</th><th>SDQ</th><th>Section</th><th>Inter/Sec</th><th>Sex</th><th>Band</th><th>Loaded</th><th>Max</th><th>Opened</th><th>Closed</th><th>Elapsed</th></tr></thead><tbody>${dormRows}</tbody></table>
      <h2>Bus Table</h2><table><thead><tr><th>Type</th><th>Bus #</th><th>Originating Destination</th><th>Arrived/OTW</th><th>Females</th><th>Naturalizations</th><th>Space Force</th><th>Departed</th><th>Arrived</th><th>Status</th></tr></thead><tbody>${busRows}</tbody></table>
      <h2>Notes</h2><section class="notes-section">${notes}</section><footer class="footer"><div>UNCLASSIFIED / NO PII</div><div>Generated by GATE</div></footer><div class="classification" style="margin-top:10px;">UNCLASSIFIED / NO PII / STATUS COUNTS ONLY</div>
    </body></html>`);
    reportWindow.document.close();
    reportWindow.focus();
  }

  async function printLiveCurrentSummary(preOpenedWindow) {
    const weekGroup = getActiveWeekGroup();
    const reportWindow = preOpenedWindow || window.open('', '_blank');

    if (!reportWindow) {
      alert('Unable to open the print report. Allow pop-ups for this site and try again.');
      return;
    }

    reportWindow.document.write('<!doctype html><html><head><title>Loading Current Summary</title></head><body style="font-family:Arial,sans-serif;padding:24px;">Loading current summary records...</body></html>');
    reportWindow.document.close();

    if (!weekGroup) {
      reportWindow.close();
      alert('Initialize or select a Week Group before printing a current summary.');
      return;
    }

    try {
      const allRecords = await fetchRecords();
      const weekRecords = allRecords.filter(record => record && record.week_group === weekGroup);
      const dorms = weekRecords.filter(record => record.type === 'dorm');
      const buses = weekRecords.filter(record => record.type === 'bus');
      const arrivedBuses = buses.filter(bus => !bus.status || bus.status === 'arrived' || bus.bus_type === 'local');
      const receivingWindows = collectReceivingWindows(weekGroup, dorms);

      const payload = {
        weekGroup,
        printedAt: new Date().toLocaleString(),
        receivingWindows,
        dorms,
        buses,
        expectedTotal: dorms.reduce((sum, dorm) => sum + n(dorm.max_load), 0),
        loadedTotal: dorms.reduce((sum, dorm) => sum + n(dorm.current_load ?? dorm.loaded), 0),
        totalArrived: arrivedBuses.reduce((sum, bus) => sum + n(bus.otw_count), 0),
        femaleTotal: arrivedBuses.reduce((sum, bus) => sum + n(bus.female_count), 0),
        natTotal: arrivedBuses.reduce((sum, bus) => sum + n(bus.nat_count), 0),
        sfTotal: arrivedBuses.reduce((sum, bus) => sum + n(bus.space_force_count), 0),
        receivingSummary: buildReceivingSummary(dorms, buses, receivingWindows)
      };

      renderCurrentReport(payload, reportWindow);
    } catch (error) {
      console.error('Current summary report failed:', error);
      reportWindow.document.open();
      reportWindow.document.write('<!doctype html><html><body style="font-family:Arial,sans-serif;padding:24px;"><h1>Current Summary Failed</h1><p>Unable to load live records. Refresh the GATE page and try again.</p></body></html>');
      reportWindow.document.close();
      alert('Current summary report failed to load live records. Refresh the page and try again.');
    }
  }

  document.addEventListener('click', event => {
    const button = event.target && event.target.closest ? event.target.closest(`#${BUTTON_ID}`) : null;
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const reportWindow = window.open('', '_blank');
    printLiveCurrentSummary(reportWindow);
  }, true);

  window.printLiveCurrentSummaryReport = printLiveCurrentSummary;
})();
