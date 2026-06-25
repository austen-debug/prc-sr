// GATE Current Summary live-record report override
// The main page stores live records in a block-scoped variable, so external report scripts cannot read it directly.
// This override pulls the current summary from /api/records and intercepts the Print Current Summary button.
(function () {
  const BUTTON_ID = 'print-current-summary-btn';
  const RECEIVING_DATE_STORAGE_PREFIX = 'gate_receiving_start_date_';

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

  function dateKey(value) {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function addDays(key, days) {
    const d = new Date(`${key}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dateAtHour(key, hour) {
    if (!key) return null;
    const d = new Date(`${key}T${String(hour).padStart(2, '0')}:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function parseTs(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function firstValidTimestamp(values) {
    for (const value of values) {
      if (parseTs(value)) return value;
    }
    return '';
  }

  function inWindow(timestamp, win) {
    const d = parseTs(timestamp);
    return Boolean(d && win && d.getTime() >= win.start.getTime() && d.getTime() < win.end.getTime());
  }

  function fmtDate(key) {
    if (!key) return '';
    const d = new Date(`${key}T00:00:00`);
    return Number.isNaN(d.getTime()) ? esc(key) : esc(d.toLocaleDateString([], { year: 'numeric', month: 'long', day: '2-digit' }));
  }

  function fmtDateTime(value) {
    const d = parseTs(value);
    return d ? esc(d.toLocaleString()) : '';
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

  function getReceivingStartDate(dorms, buses, weekGroup) {
    const uiDate = dateKey(document.getElementById('receiving-start-date-input')?.value || '');
    if (uiDate) return uiDate;

    const stored = dateKey(localStorage.getItem(`${RECEIVING_DATE_STORAGE_PREFIX}${weekGroup || 'default'}`) || '');
    if (stored) return stored;

    const fromDorm = dorms.map(d => dateKey(d.receiving_start_date)).find(Boolean);
    if (fromDorm) return fromDorm;

    const activityDates = [];
    dorms.forEach(d => {
      const key = dateKey(d.closed_at || d.close_time || d.updated_at || d.processed_at || d.created_at);
      if (key) activityDates.push(key);
    });
    buses.forEach(b => {
      const key = dateKey(b.arrived_at || b.departed_at || b.created_at || b.updated_at);
      if (key) activityDates.push(key);
    });

    return activityDates.sort()[0] || '';
  }

  function buildNightWindow(startDate, nightIndex) {
    if (!startDate) return null;
    const startKey = addDays(startDate, nightIndex);
    const endKey = addDays(startDate, nightIndex + 1);
    const start = dateAtHour(startKey, 15);
    const end = dateAtHour(endKey, 15);
    return start && end ? { labelDate: startKey, start, end } : null;
  }

  function dormTs(dorm) {
    return firstValidTimestamp([dorm.closed_at, dorm.close_time, dorm.processed_at, dorm.updated_at, dorm.created_at]);
  }

  function busTs(bus) {
    return firstValidTimestamp([bus.arrived_at, bus.departed_at, bus.created_at, bus.updated_at]);
  }

  function nightStatement(processedToday, expected, processedTotal, natToday, natTotal, sfToday, sfTotal) {
    return `Tonight, the PRC processed ${processedToday} of the ${expected} projected trainees for a total of ${processedTotal}. ${natToday} trainees requested U.S. naturalization for a total of ${natTotal}. ${sfToday} Space Force trainees were processed for a total of ${sfTotal}.`;
  }

  function buildReceivingSummary(dorms, buses, receivingStartDate) {
    const expected = dorms.reduce((sum, d) => sum + n(d.max_load), 0);
    const win1 = buildNightWindow(receivingStartDate, 0);
    const win2 = buildNightWindow(receivingStartDate, 1);

    function processFor(win) {
      return win ? dorms.filter(d => inWindow(dormTs(d), win)).reduce((sum, d) => sum + n(d.current_load ?? d.loaded), 0) : 0;
    }

    function natFor(win) {
      return win ? buses.filter(b => inWindow(busTs(b), win)).reduce((sum, b) => sum + n(b.nat_count), 0) : 0;
    }

    function sfFor(win) {
      return win ? buses.filter(b => inWindow(busTs(b), win)).reduce((sum, b) => sum + n(b.space_force_count), 0) : 0;
    }

    const p1 = processFor(win1);
    const p2 = processFor(win2);
    const nat1 = natFor(win1);
    const nat2 = natFor(win2);
    const sf1 = sfFor(win1);
    const sf2 = sfFor(win2);

    return {
      nightOne: {
        date: win1 ? win1.labelDate : receivingStartDate,
        statement: receivingStartDate ? nightStatement(p1, expected, p1, nat1, nat1, sf1, sf1) : 'No receiving start date or processing activity date is available.'
      },
      nightTwo: {
        date: win2 ? win2.labelDate : (receivingStartDate ? addDays(receivingStartDate, 1) : ''),
        statement: receivingStartDate && (p2 || nat2 || sf2) ? nightStatement(p2, expected, p1 + p2, nat2, nat1 + nat2, sf2, sf1 + sf2) : 'No processing activity recorded.'
      }
    };
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
    const dormRows = rows(payload.dorms, d => `
      <tr><td class="strong">${esc(d.name || d.dorm_name || '')}</td><td>${esc(d.assigned_airman || '')}</td><td>${esc(d.sdq || '')}</td><td>${esc(d.section || '')}</td><td>${esc(d.inter_sec || '')}</td><td>${esc(d.sex || '')}</td><td>${esc(d.band === 'true' ? 'YES' : '')}</td><td class="num">${esc(d.current_load ?? d.loaded ?? 0)}</td><td class="num">${esc(d.max_load ?? 0)}</td><td>${fmtDateTime(d.opened_at || d.open_time)}</td><td>${fmtDateTime(d.closed_at || d.close_time)}</td><td>${esc(d.closed_timer || d.elapsed || '')}</td></tr>`, 12);
    const busRows = rows(payload.buses, b => `
      <tr><td>${esc(b.bus_type || '')}</td><td class="strong">${esc(b.bus_id || '')}</td><td>${esc(b.originating_destination || b.destination || '')}</td><td class="num">${esc(b.otw_count || 0)}</td><td class="num">${esc(b.female_count || 0)}</td><td class="num">${esc(b.nat_count || 0)}</td><td class="num">${esc(b.space_force_count || 0)}</td><td>${fmtDateTime(b.departed_at || b.created_at)}</td><td>${fmtDateTime(b.arrived_at)}</td><td>${esc(b.status || '')}</td></tr>`, 10);
    const notes = payload.dorms.filter(d => String(d.notes || '').trim()).map(d => `<div class="note-item"><div class="note-title">${esc(d.name || d.dorm_name || 'Dorm')}</div><div>${esc(d.notes || '')}</div></div>`).join('') || '<div class="empty-row">No dorm notes recorded.</div>';

    const w = targetWindow || window.open('', '_blank');
    if (!w) {
      alert('Unable to open the print report. Allow pop-ups for this site and try again.');
      return;
    }

    w.document.open();
    w.document.write(`<!doctype html><html><head><title>${esc(payload.weekGroup)} GATE Receiving Current Summary</title><style>
      :root{--ink:#0f172a;--muted:#475569;--line:#cbd5e1;--header:#0f172a;--soft:#f8fafc;--green:#166534}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:var(--ink);margin:24px;background:#fff}.classification{display:flex;justify-content:center;align-items:center;min-height:28px;background:var(--green);color:#fff;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;border:1px solid #14532d}.no-print{margin:12px 0;padding:9px 16px;border:1px solid #94a3b8;border-radius:8px;background:#0f172a;color:#fff;font-weight:900;letter-spacing:.04em;cursor:pointer}.report-header{display:flex;justify-content:space-between;gap:24px;padding:18px 0 14px;border-bottom:2px solid var(--header);margin-bottom:14px}.title-block h1{margin:0;font-size:28px;letter-spacing:-.035em;text-transform:uppercase}.subtitle{margin-top:4px;color:var(--muted);font-size:12px;font-weight:900;letter-spacing:.055em;text-transform:uppercase}.meta{min-width:285px;border:1px solid var(--line);background:var(--soft);padding:10px;font-size:11px}.meta-row{display:flex;justify-content:space-between;gap:10px;margin-bottom:5px}.meta-row:last-child{margin-bottom:0}.meta-label{color:var(--muted);font-weight:900;text-transform:uppercase}.meta-value{font-weight:900;text-align:right}.summary{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:14px 0 18px}.box{border:1px solid var(--line);background:#f8fafc;padding:10px;min-height:70px}.label{color:var(--muted);font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.value{margin-top:5px;font-size:23px;font-weight:900;letter-spacing:-.05em}h2{margin:18px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--line);font-size:15px;text-transform:uppercase;letter-spacing:.06em}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:10px;page-break-inside:auto}th,td{border:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top}th{background:#e2e8f0;color:#0f172a;font-size:9px;text-transform:uppercase;letter-spacing:.045em}tr:nth-child(even) td{background:#f8fafc}.strong{font-weight:900}.num{text-align:right;font-variant-numeric:tabular-nums}.empty-row{text-align:center;color:var(--muted);padding:14px}.receiving-summary{border:1px solid var(--line);background:#f8fafc;padding:12px;margin:10px 0 16px}.night{padding:8px 0;border-bottom:1px solid #e2e8f0}.night:last-child{border-bottom:none}.night-title{font-weight:900;text-transform:uppercase;letter-spacing:.05em;font-size:11px;margin-bottom:4px}.night-date{color:var(--muted);font-weight:800;margin-left:5px}.night-text{font-size:12px;line-height:1.45;font-weight:700}.notes-section{margin-top:12px;border:1px solid var(--line);background:#f8fafc;padding:10px}.note-item{padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:11px}.note-item:last-child{border-bottom:none}.note-title{font-weight:900;margin-bottom:2px}.footer{margin-top:22px;padding-top:8px;border-top:2px solid var(--header);color:var(--muted);font-size:10px;display:flex;justify-content:space-between;gap:18px}@media print{body{margin:10mm}.no-print{display:none}.classification,.box,th,tr:nth-child(even) td,.notes-section,.receiving-summary,.meta{print-color-adjust:exact;-webkit-print-color-adjust:exact}h2{page-break-after:avoid}tr,.night{page-break-inside:avoid}}
    </style></head><body>
      <div class="classification">UNCLASSIFIED / NO PII / STATUS COUNTS ONLY</div><button class="no-print" onclick="window.print()">Print Report</button>
      <header class="report-header"><div class="title-block"><h1>GATE Receiving Current Summary</h1><div class="subtitle">Gateway Arrival Tracking Environment — Pfingston Reception Center</div></div><div class="meta"><div class="meta-row"><span class="meta-label">Week Group</span><span class="meta-value">${esc(payload.weekGroup)}</span></div><div class="meta-row"><span class="meta-label">Receiving Start</span><span class="meta-value">${payload.receivingStartDate ? fmtDate(payload.receivingStartDate) : '—'}</span></div><div class="meta-row"><span class="meta-label">Report Type</span><span class="meta-value">Current Summary</span></div><div class="meta-row"><span class="meta-label">Printed</span><span class="meta-value">${esc(payload.printedAt)}</span></div></div></header>
      <section class="summary"><div class="box"><div class="label">Expected</div><div class="value">${payload.expectedTotal}</div></div><div class="box"><div class="label">Arrived</div><div class="value">${payload.totalArrived}</div></div><div class="box"><div class="label">Loaded</div><div class="value">${payload.loadedTotal}</div></div><div class="box"><div class="label">Females</div><div class="value">${payload.femaleTotal}</div></div><div class="box"><div class="label">Naturalizations</div><div class="value">${payload.natTotal}</div></div><div class="box"><div class="label">Space Force</div><div class="value">${payload.sfTotal}</div></div></section>
      <h2>Receiving Processing Summary</h2><section class="receiving-summary"><div class="night"><div class="night-title">Receiving Night One (1):<span class="night-date">${fmtDate(payload.receivingSummary.nightOne.date)}</span></div><div class="night-text">${esc(payload.receivingSummary.nightOne.statement)}</div></div><div class="night"><div class="night-title">Receiving Night Two (2):<span class="night-date">${fmtDate(payload.receivingSummary.nightTwo.date)}</span></div><div class="night-text">${esc(payload.receivingSummary.nightTwo.statement)}</div></div></section>
      <h2>Dorm Table</h2><table><thead><tr><th>Dorm</th><th>Airman</th><th>SDQ</th><th>Section</th><th>Inter/Sec</th><th>Sex</th><th>Band</th><th>Loaded</th><th>Max</th><th>Opened</th><th>Closed</th><th>Elapsed</th></tr></thead><tbody>${dormRows}</tbody></table>
      <h2>Bus Table</h2><table><thead><tr><th>Type</th><th>Bus #</th><th>Originating Destination</th><th>Arrived/OTW</th><th>Females</th><th>Naturalizations</th><th>Space Force</th><th>Departed</th><th>Arrived</th><th>Status</th></tr></thead><tbody>${busRows}</tbody></table>
      <h2>Notes</h2><section class="notes-section">${notes}</section><footer class="footer"><div>UNCLASSIFIED / NO PII</div><div>Generated by GATE</div></footer><div class="classification" style="margin-top:10px;">UNCLASSIFIED / NO PII / STATUS COUNTS ONLY</div>
    </body></html>`);

    w.document.close();
    w.focus();
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
      const receivingStartDate = getReceivingStartDate(dorms, buses, weekGroup);

      const payload = {
        weekGroup,
        printedAt: new Date().toLocaleString(),
        receivingStartDate,
        dorms,
        buses,
        expectedTotal: dorms.reduce((sum, d) => sum + n(d.max_load), 0),
        loadedTotal: dorms.reduce((sum, d) => sum + n(d.current_load ?? d.loaded), 0),
        totalArrived: arrivedBuses.reduce((sum, b) => sum + n(b.otw_count), 0),
        femaleTotal: arrivedBuses.reduce((sum, b) => sum + n(b.female_count), 0),
        natTotal: arrivedBuses.reduce((sum, b) => sum + n(b.nat_count), 0),
        sfTotal: arrivedBuses.reduce((sum, b) => sum + n(b.space_force_count), 0),
        receivingSummary: buildReceivingSummary(dorms, buses, receivingStartDate)
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
