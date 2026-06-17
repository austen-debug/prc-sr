// GATE receiving summary handoff override
// Corrects end-of-day reporting windows without touching processing, airport, or archive data flows.
(function () {
  const WINDOWS = [
    { label: 'Receiving Night One (1)', startOffset: 0, startHour: 15, endOffset: 1, endHour: 13 },
    { label: 'Receiving Night Two (2)', startOffset: 1, startHour: 13, endOffset: 2, endHour: 12 }
  ];
  let installed = false;

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

  function records() {
    try { return Array.isArray(window.allData) ? window.allData : []; } catch (_) { return []; }
  }

  function activeWg() {
    try { return typeof window.getActiveWG === 'function' ? window.getActiveWG() : ''; } catch (_) { return ''; }
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

  function atHour(key, hour) {
    const d = new Date(`${key}T${String(hour).padStart(2, '0')}:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function parseTs(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function firstTs(values) {
    for (const value of values) {
      if (parseTs(value)) return value;
    }
    return '';
  }

  function inWindow(timestamp, win) {
    const d = parseTs(timestamp);
    return Boolean(d && win && d.getTime() >= win.start.getTime() && d.getTime() < win.end.getTime());
  }

  function buildWindow(startDate, index) {
    const spec = WINDOWS[index];
    if (!startDate || !spec) return null;
    const startKey = addDays(startDate, spec.startOffset);
    const endKey = addDays(startDate, spec.endOffset);
    const start = atHour(startKey, spec.startHour);
    const end = atHour(endKey, spec.endHour);
    return start && end ? { labelDate: startKey, start, end } : null;
  }

  function fmtDate(key) {
    if (!key) return '';
    const d = new Date(`${key}T00:00:00`);
    return Number.isNaN(d.getTime()) ? key : d.toLocaleDateString([], { year: 'numeric', month: 'long', day: '2-digit' });
  }

  function fmtDateTime(value) {
    const d = parseTs(value);
    return d ? d.toLocaleString() : '';
  }

  function getStartDate(dorms, buses, explicit) {
    const fromExplicit = dateKey(explicit);
    if (fromExplicit) return fromExplicit;
    const ui = dateKey(document.getElementById('receiving-start-date-input')?.value || '');
    if (ui) return ui;
    const wg = document.getElementById('wg-batch-input')?.value.trim() || activeWg() || 'default';
    const stored = dateKey(localStorage.getItem(`gate_receiving_start_date_${wg}`) || '');
    if (stored) return stored;
    const fromDorm = dorms.map(d => dateKey(d.receiving_start_date)).find(Boolean);
    if (fromDorm) return fromDorm;
    const fallbackDates = [];
    dorms.forEach(d => {
      const key = dateKey(d.closed_at || d.close_time || d.processed_at || d.updated_at || d.created_at);
      if (key) fallbackDates.push(key);
    });
    buses.forEach(b => {
      const key = dateKey(b.arrived_at || b.departed_at || b.created_at || b.updated_at);
      if (key) fallbackDates.push(key);
    });
    return fallbackDates.sort()[0] || '';
  }

  function dormTs(dorm) {
    return firstTs([dorm.closed_at, dorm.close_time, dorm.processed_at, dorm.updated_at, dorm.created_at]);
  }

  function busTs(bus) {
    return firstTs([bus.arrived_at, bus.departed_at, bus.created_at, bus.updated_at]);
  }

  function sentence(processedToday, expected, processedTotal, natToday, natTotal, sfToday, sfTotal) {
    return `Tonight, the PRC processed ${processedToday} of the ${expected} projected trainees for a total of ${processedTotal}. ${natToday} trainees requested U.S. naturalization for a total of ${natTotal}. ${sfToday} Space Force trainees were processed for a total of ${sfTotal}.`;
  }

  function buildReceivingNightSummary({ dormData, busData, receivingStartDate } = {}) {
    const dorms = Array.isArray(dormData) ? dormData : [];
    const buses = Array.isArray(busData) ? busData : [];
    const startDate = getStartDate(dorms, buses, receivingStartDate);
    const expected = dorms.reduce((sum, d) => sum + n(d.max_load), 0);
    const win1 = buildWindow(startDate, 0);
    const win2 = buildWindow(startDate, 1);

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
    const nightTwoHasActivity = Boolean(p2 || nat2 || sf2);

    return {
      expectedTotal: expected,
      receivingStartDate: startDate,
      nightOne: {
        date: win1 ? win1.labelDate : startDate,
        processedToday: p1,
        processedTotal: p1,
        naturalizationToday: nat1,
        naturalizationTotal: nat1,
        spaceForceToday: sf1,
        spaceForceTotal: sf1,
        statement: startDate ? sentence(p1, expected, p1, nat1, nat1, sf1, sf1) : 'No receiving start date or processing activity date is available.'
      },
      nightTwo: {
        date: win2 ? win2.labelDate : (startDate ? addDays(startDate, 1) : ''),
        processedToday: p2,
        processedTotal: p1 + p2,
        naturalizationToday: nat2,
        naturalizationTotal: nat1 + nat2,
        spaceForceToday: sf2,
        spaceForceTotal: sf1 + sf2,
        statement: startDate ? (nightTwoHasActivity ? sentence(p2, expected, p1 + p2, nat2, nat1 + nat2, sf2, sf1 + sf2) : 'No processing activity recorded.') : 'No processing activity recorded.'
      }
    };
  }

  function reportPayload(weekGroup, archivedAt, dorms, buses, startDate) {
    const arrivedBuses = buses.filter(b => !b.status || b.status === 'arrived' || b.bus_type === 'local');
    const receivingSummary = buildReceivingNightSummary({ dormData: dorms, busData: buses, receivingStartDate: startDate });
    return {
      weekGroup,
      archivedAt,
      printedAt: new Date().toLocaleString(),
      receivingStartDate: receivingSummary.receivingStartDate,
      dorms,
      buses,
      expectedTotal: dorms.reduce((sum, d) => sum + n(d.max_load), 0),
      loadedTotal: dorms.reduce((sum, d) => sum + n(d.current_load ?? d.loaded), 0),
      totalArrived: arrivedBuses.reduce((sum, b) => sum + n(b.otw_count), 0),
      femaleTotal: arrivedBuses.reduce((sum, b) => sum + n(b.female_count), 0),
      natTotal: arrivedBuses.reduce((sum, b) => sum + n(b.nat_count), 0),
      sfTotal: arrivedBuses.reduce((sum, b) => sum + n(b.space_force_count), 0),
      receivingSummary
    };
  }

  function rows(items, mapper, colspan) {
    return items.length ? items.map(mapper).join('') : `<tr><td colspan="${colspan}" class="empty-row">No records.</td></tr>`;
  }

  function renderReport(payload) {
    const dormRows = rows(payload.dorms, d => `
      <tr><td class="strong">${esc(d.name || d.dorm_name || '')}</td><td>${esc(d.assigned_airman || '')}</td><td>${esc(d.sdq || '')}</td><td>${esc(d.section || '')}</td><td>${esc(d.inter_sec || '')}</td><td>${esc(d.sex || '')}</td><td>${esc(d.band === 'true' ? 'YES' : '')}</td><td class="num">${esc(d.current_load ?? d.loaded ?? 0)}</td><td class="num">${esc(d.max_load ?? 0)}</td><td>${esc(fmtDateTime(d.opened_at || d.open_time))}</td><td>${esc(fmtDateTime(d.closed_at || d.close_time))}</td><td>${esc(d.closed_timer || d.elapsed || '')}</td></tr>`, 12);
    const busRows = rows(payload.buses, b => `
      <tr><td>${esc(b.bus_type || '')}</td><td class="strong">${esc(b.bus_id || '')}</td><td>${esc(b.originating_destination || b.destination || '')}</td><td class="num">${esc(b.otw_count || 0)}</td><td class="num">${esc(b.female_count || 0)}</td><td class="num">${esc(b.nat_count || 0)}</td><td class="num">${esc(b.space_force_count || 0)}</td><td>${esc(fmtDateTime(b.departed_at || b.created_at))}</td><td>${esc(fmtDateTime(b.arrived_at))}</td><td>${esc(b.status || '')}</td></tr>`, 10);
    const notes = payload.dorms.filter(d => String(d.notes || '').trim()).map(d => `<div class="note-item"><div class="note-title">${esc(d.name || d.dorm_name || 'Dorm')}</div><div>${esc(d.notes || '')}</div></div>`).join('') || '<div class="empty-row">No dorm notes recorded.</div>';

    const w = window.open('', '_blank');
    if (!w) {
      alert('Unable to open the print report. Allow pop-ups for this site and try again.');
      return;
    }

    w.document.write(`<!doctype html><html><head><title>${esc(payload.weekGroup)} GATE Receiving Archive Report</title><style>
      :root{--ink:#0f172a;--muted:#475569;--line:#cbd5e1;--header:#0f172a;--soft:#f8fafc;--green:#166534}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:var(--ink);margin:24px;background:#fff}.classification{display:flex;justify-content:center;align-items:center;min-height:28px;background:var(--green);color:#fff;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;border:1px solid #14532d}.no-print{margin:12px 0;padding:9px 16px;border:1px solid #94a3b8;border-radius:8px;background:#0f172a;color:#fff;font-weight:900;letter-spacing:.04em;cursor:pointer}.report-header{display:flex;justify-content:space-between;gap:24px;padding:18px 0 14px;border-bottom:2px solid var(--header);margin-bottom:14px}.title-block h1{margin:0;font-size:28px;letter-spacing:-.035em;text-transform:uppercase}.subtitle{margin-top:4px;color:var(--muted);font-size:12px;font-weight:900;letter-spacing:.055em;text-transform:uppercase}.meta{min-width:285px;border:1px solid var(--line);background:var(--soft);padding:10px;font-size:11px}.meta-row{display:flex;justify-content:space-between;gap:10px;margin-bottom:5px}.meta-label{color:var(--muted);font-weight:900;text-transform:uppercase}.meta-value{font-weight:900;text-align:right}.summary{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:14px 0 18px}.box{border:1px solid var(--line);background:#f8fafc;padding:10px;min-height:70px}.label{color:var(--muted);font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.value{margin-top:5px;font-size:23px;font-weight:900;letter-spacing:-.05em}h2{margin:18px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--line);font-size:15px;text-transform:uppercase;letter-spacing:.06em}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:10px}th,td{border:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top}th{background:#e2e8f0;color:#0f172a;font-size:9px;text-transform:uppercase;letter-spacing:.045em}tr:nth-child(even) td{background:#f8fafc}.strong{font-weight:900}.num{text-align:right;font-variant-numeric:tabular-nums}.empty-row{text-align:center;color:var(--muted);padding:14px}.receiving-summary{border:1px solid var(--line);background:#f8fafc;padding:12px;margin:10px 0 16px}.night{padding:8px 0;border-bottom:1px solid #e2e8f0}.night:last-child{border-bottom:none}.night-title{font-weight:900;text-transform:uppercase;letter-spacing:.05em;font-size:11px;margin-bottom:4px}.night-date{color:var(--muted);font-weight:800;margin-left:5px}.night-text{font-size:12px;line-height:1.45;font-weight:700}.notes-section{margin-top:12px;border:1px solid var(--line);background:#f8fafc;padding:10px}.note-item{padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:11px}.footer{margin-top:22px;padding-top:8px;border-top:2px solid var(--header);color:var(--muted);font-size:10px;display:flex;justify-content:space-between}@media print{body{margin:10mm}.no-print{display:none}.classification,.box,th,tr:nth-child(even) td,.notes-section,.receiving-summary,.meta{print-color-adjust:exact;-webkit-print-color-adjust:exact}tr,.night{page-break-inside:avoid}}
    </style></head><body><div class="classification">UNCLASSIFIED / NO PII / STATUS COUNTS ONLY</div><button class="no-print" onclick="window.print()">Print Report</button><header class="report-header"><div class="title-block"><h1>GATE Receiving Archive Report</h1><div class="subtitle">Gateway Arrival Tracking Environment — Pfingston Reception Center</div></div><div class="meta"><div class="meta-row"><span class="meta-label">Week Group</span><span class="meta-value">${esc(payload.weekGroup)}</span></div><div class="meta-row"><span class="meta-label">Receiving Start</span><span class="meta-value">${payload.receivingStartDate ? esc(fmtDate(payload.receivingStartDate)) : '—'}</span></div><div class="meta-row"><span class="meta-label">Archived</span><span class="meta-value">${esc(fmtDateTime(payload.archivedAt) || 'Current Summary')}</span></div><div class="meta-row"><span class="meta-label">Printed</span><span class="meta-value">${esc(payload.printedAt)}</span></div></div></header><section class="summary"><div class="box"><div class="label">Expected</div><div class="value">${payload.expectedTotal}</div></div><div class="box"><div class="label">Arrived</div><div class="value">${payload.totalArrived}</div></div><div class="box"><div class="label">Loaded</div><div class="value">${payload.loadedTotal}</div></div><div class="box"><div class="label">Females</div><div class="value">${payload.femaleTotal}</div></div><div class="box"><div class="label">Naturalizations</div><div class="value">${payload.natTotal}</div></div><div class="box"><div class="label">Space Force</div><div class="value">${payload.sfTotal}</div></div></section><h2>Receiving Processing Summary</h2><section class="receiving-summary"><div class="night"><div class="night-title">Receiving Night One (1):<span class="night-date">${esc(fmtDate(payload.receivingSummary.nightOne.date))}</span></div><div class="night-text">${esc(payload.receivingSummary.nightOne.statement)}</div></div><div class="night"><div class="night-title">Receiving Night Two (2):<span class="night-date">${esc(fmtDate(payload.receivingSummary.nightTwo.date))}</span></div><div class="night-text">${esc(payload.receivingSummary.nightTwo.statement)}</div></div></section><h2>Dorm Table</h2><table><thead><tr><th>Dorm</th><th>Airman</th><th>SDQ</th><th>Section</th><th>Inter/Sec</th><th>Sex</th><th>Band</th><th>Loaded</th><th>Max</th><th>Opened</th><th>Closed</th><th>Elapsed</th></tr></thead><tbody>${dormRows}</tbody></table><h2>Bus Table</h2><table><thead><tr><th>Type</th><th>Bus #</th><th>Originating Destination</th><th>Arrived/OTW</th><th>Females</th><th>Naturalizations</th><th>Space Force</th><th>Departed</th><th>Arrived</th><th>Status</th></tr></thead><tbody>${busRows}</tbody></table><h2>Notes</h2><section class="notes-section">${notes}</section><footer class="footer"><div>UNCLASSIFIED / NO PII</div><div>Generated by GATE</div></footer><div class="classification" style="margin-top:10px;">UNCLASSIFIED / NO PII / STATUS COUNTS ONLY</div></body></html>`);
    w.document.close();
    w.focus();
  }

  function currentReport() {
    const wg = activeWg();
    if (!wg) {
      alert('Initialize or select a Week Group before printing a current summary.');
      return;
    }
    const scoped = records().filter(r => r && r.week_group === wg);
    const dorms = scoped.filter(r => r.type === 'dorm');
    const buses = scoped.filter(r => r.type === 'bus');
    renderReport(reportPayload(wg, '', dorms, buses, getStartDate(dorms, buses, '')));
  }

  function archiveReport() {
    if (typeof window.editArchiveId === 'undefined' || !window.editArchiveId) return;
    const archive = records().find(r => r.__backendId === window.editArchiveId);
    if (!archive) return;
    try {
      const dormEl = document.getElementById('archive-edit-dorm-data');
      const busEl = document.getElementById('archive-edit-bus-data');
      const dorms = dormEl?.value ? JSON.parse(dormEl.value) : [];
      const buses = busEl?.value ? JSON.parse(busEl.value) : [];
      const wg = document.getElementById('archive-edit-wg')?.value.trim() || archive.week_group || '';
      const archivedAt = document.getElementById('archive-edit-archived-at')?.value.trim() || archive.archived_at || '';
      renderReport(reportPayload(wg, archivedAt, dorms, buses, getStartDate(dorms, buses, archive.receiving_start_date || '')));
    } catch (_) {
      alert('Dorm Data JSON or Bus Data JSON is invalid. Fix the JSON before printing.');
    }
  }

  function install() {
    window.buildReceivingNightSummary = buildReceivingNightSummary;
    window.printCurrentSummaryReport = currentReport;
    window.printArchiveSpreadsheet = archiveReport;

    const btn = document.getElementById('print-current-summary-btn');
    if (btn && !btn.dataset.gateCorrectedSummary) {
      btn.dataset.gateCorrectedSummary = 'true';
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        currentReport();
      }, true);
    }
  }

  function start() {
    if (installed) return;
    installed = true;
    install();
    setInterval(install, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
