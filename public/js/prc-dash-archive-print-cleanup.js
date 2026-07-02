// PRC GATE Archive Print / PDF cleanup
// UI/UX print-output only. Does not alter archive data, API calls, or save logic.
(function () {
  let started = false;
  let passScheduled = false;

  const WINDOW_FIELDS = [
    'receiving_day_one_start',
    'receiving_day_one_end',
    'receiving_day_two_start',
    'receiving_day_two_end'
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

  function clean(value, fallback = '—') {
    const text = String(value ?? '').trim();
    return text ? text : fallback;
  }

  function getAllDataSafe() {
    try { return Array.isArray(allData) ? allData : []; } catch (_) { return []; }
  }

  function getEditArchiveIdSafe() {
    try { return editArchiveId || ''; } catch (_) { return window.editArchiveId || ''; }
  }

  function getArchive() {
    const id = getEditArchiveIdSafe();
    return getAllDataSafe().find(record => record && record.type === 'archive' && record.__backendId === id) || null;
  }

  function parseJsonField(id, fallback = []) {
    const value = document.getElementById(id)?.value || '';
    if (!value.trim()) return fallback;
    return JSON.parse(value);
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

  function formatDate(value) {
    const date = parseTime(value);
    if (!date) return 'Date not set';
    return date.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function formatDateTime(value) {
    const date = parseTime(value);
    if (!date) return '—';
    return date.toLocaleString([], { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function isSpaceForceDorm(dorm) {
    return dorm && (dorm.space_force === true || dorm.space_force === 'true' || dorm.is_space_force === true || dorm.is_space_force === 'true');
  }

  function dormTime(dorm) {
    return dorm.closed_at || dorm.close_time || dorm.processed_at || dorm.updated_at || '';
  }

  function busTime(bus) {
    return bus.arrived_at || bus.departed_at || bus.created_at || bus.updated_at || '';
  }

  function windowValues(archive) {
    const values = {};
    WINDOW_FIELDS.forEach(key => {
      values[key] = document.getElementById(`archive-edit-${key}`)?.value || archive?.[key] || '';
    });
    return values;
  }

  function summarize(dorms, buses, windows) {
    const afExpected = dorms.filter(d => !isSpaceForceDorm(d)).reduce((sum, d) => sum + n(d.max_load), 0);
    const sfExpected = dorms.filter(isSpaceForceDorm).reduce((sum, d) => sum + n(d.max_load), 0);
    const totalExpected = afExpected + sfExpected;
    const days = [
      { label: 'Receiving Night One (1)', start: windows.receiving_day_one_start, end: windows.receiving_day_one_end },
      { label: 'Receiving Night Two (2)', start: windows.receiving_day_two_start, end: windows.receiving_day_two_end }
    ];

    let afCum = 0;
    let sfCum = 0;
    let natCum = 0;

    const dayRows = days.map(day => {
      const dayDorms = dorms.filter(d => inWindow(dormTime(d), day.start, day.end));
      const afDay = dayDorms.filter(d => !isSpaceForceDorm(d)).reduce((sum, d) => sum + n(d.current_load ?? d.loaded), 0);
      const sfDay = dayDorms.filter(isSpaceForceDorm).reduce((sum, d) => sum + n(d.current_load ?? d.loaded), 0);
      const natDay = buses.filter(b => inWindow(busTime(b), day.start, day.end)).reduce((sum, b) => sum + n(b.nat_count), 0);
      afCum += afDay;
      sfCum += sfDay;
      natCum += natDay;
      const totalCum = afCum + sfCum;
      return Object.assign({}, day, { afDay, sfDay, natDay, afCum, sfCum, natCum, totalCum });
    });

    const loadedTotal = dorms.reduce((sum, d) => sum + n(d.current_load ?? d.loaded), 0);
    const femaleTotal = buses.reduce((sum, b) => sum + n(b.female_count), 0);
    const arrivedTotal = buses.reduce((sum, b) => sum + n(b.otw_count), 0);
    return { afExpected, sfExpected, totalExpected, loadedTotal, femaleTotal, arrivedTotal, dayRows };
  }

  function componentRows(dorms) {
    const groups = [
      ['Air Force', dorms.filter(d => !isSpaceForceDorm(d))],
      ['Space Force', dorms.filter(isSpaceForceDorm)]
    ];

    return groups.map(([name, items]) => {
      const expected = items.reduce((sum, d) => sum + n(d.max_load), 0);
      const loaded = items.reduce((sum, d) => sum + n(d.current_load ?? d.loaded), 0);
      const male = items.filter(d => String(d.sex || '').toLowerCase().startsWith('m')).reduce((sum, d) => sum + n(d.current_load ?? d.loaded), 0);
      const female = items.filter(d => String(d.sex || '').toLowerCase().startsWith('f')).reduce((sum, d) => sum + n(d.current_load ?? d.loaded), 0);
      const band = items.filter(d => d.band === true || d.band === 'true').reduce((sum, d) => sum + n(d.current_load ?? d.loaded), 0);
      return `<tr><td>${esc(name)}</td><td class="num">${loaded}</td><td class="num">${expected}</td><td class="num">${male}</td><td class="num">${female}</td><td class="num">${band}</td></tr>`;
    }).join('');
  }

  function busSummaryRows(buses) {
    const totals = buses.reduce((acc, bus) => {
      const key = clean(bus.bus_type || 'Bus', 'Bus');
      acc[key] ||= { count: 0, arrived: 0, female: 0, nat: 0, sf: 0 };
      acc[key].count += 1;
      acc[key].arrived += n(bus.otw_count);
      acc[key].female += n(bus.female_count);
      acc[key].nat += n(bus.nat_count);
      acc[key].sf += n(bus.space_force_count);
      return acc;
    }, {});

    const rows = Object.entries(totals).map(([type, item]) => `<tr><td>${esc(type)}</td><td class="num">${item.count}</td><td class="num">${item.arrived}</td><td class="num">${item.female}</td><td class="num">${item.nat}</td><td class="num">${item.sf}</td></tr>`);
    return rows.join('') || '<tr><td colspan="6" class="muted center">No bus activity recorded</td></tr>';
  }

  function printableHtml({ archive, dorms, buses, windows }) {
    const weekGroup = clean(document.getElementById('archive-edit-wg')?.value || archive.week_group, 'Week Group');
    const archivedAt = clean(document.getElementById('archive-edit-archived-at')?.value || archive.archived_at);
    const summary = summarize(dorms, buses, windows);
    const generated = new Date().toLocaleString();
    const safeWeekGroup = esc(weekGroup);

    return `<!doctype html><html><head><meta charset="utf-8"><title>${safeWeekGroup} GATE Archive Report</title><style>
      @page{size:Letter landscape;margin:0.25in}*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#0f172a;font-family:Arial,Helvetica,sans-serif}.sheet{width:10.5in;min-height:7.95in;margin:0 auto;padding:0.12in;overflow:hidden}.classification{height:0.24in;display:flex;align-items:center;justify-content:center;background:#166534;color:#fff;border:1px solid #14532d;font-size:8.5px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.top{display:grid;grid-template-columns:1fr 2.75in;gap:.16in;padding:.12in 0;border-bottom:2px solid #0f172a}.title h1{margin:0;font-size:20px;line-height:1;text-transform:uppercase;letter-spacing:-.035em}.subtitle{margin-top:4px;color:#475569;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.meta{border:1px solid #cbd5e1;background:#f8fafc;padding:.07in;font-size:8px}.row{display:flex;justify-content:space-between;gap:8px;margin-bottom:3px}.row:last-child{margin-bottom:0}.label{color:#475569;font-weight:900;text-transform:uppercase}.value{font-weight:900;text-align:right}.metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:.07in;margin:.12in 0}.box{border:1px solid #cbd5e1;background:#f8fafc;padding:.07in;min-height:.48in}.box .label{font-size:7px;letter-spacing:.08em}.box .big{font-size:18px;font-weight:900;line-height:1;margin-top:3px}.section-title{margin:.08in 0 .045in;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #cbd5e1;padding-bottom:2px}.nights{display:grid;grid-template-columns:1fr 1fr;gap:.08in}.night{border:1px solid #cbd5e1;background:#f8fafc;padding:.07in;min-height:.76in}.night-title{font-size:8.5px;font-weight:900;text-transform:uppercase;margin-bottom:3px}.night-text{font-size:8.6px;line-height:1.25;font-weight:700}.tables{display:grid;grid-template-columns:1fr 1fr;gap:.1in;margin-top:.08in}table{width:100%;border-collapse:collapse;font-size:7.8px}th,td{border:1px solid #cbd5e1;padding:3px 4px;text-align:left;vertical-align:top}th{background:#e2e8f0;font-size:7px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}.num{text-align:right;font-variant-numeric:tabular-nums}.muted{color:#64748b}.center{text-align:center}.footer{display:flex;justify-content:space-between;align-items:center;margin-top:.08in;border-top:2px solid #0f172a;padding-top:.045in;color:#475569;font-size:7.5px;font-weight:800}.no-print{margin:6px 0 0;padding:6px 10px;border:1px solid #94a3b8;border-radius:6px;background:#0f172a;color:#fff;font-weight:900;cursor:pointer}@media print{.no-print{display:none!important}.classification,.box,.night,th,.meta{print-color-adjust:exact;-webkit-print-color-adjust:exact}body{margin:0}.sheet{margin:0;width:auto;min-height:auto;page-break-after:avoid}tr,.night,.box{break-inside:avoid;page-break-inside:avoid}}
    </style></head><body><main class="sheet"><div class="classification">UNCLASSIFIED / NO PII / STATUS COUNTS ONLY</div><button class="no-print" onclick="window.print()">Print / Save as PDF</button><header class="top"><div class="title"><h1>GATE Receiving Archive Report</h1><div class="subtitle">Gateway Arrival Tracking Environment — Pfingston Reception Center</div></div><div class="meta"><div class="row"><span class="label">Week Group</span><span class="value">${safeWeekGroup}</span></div><div class="row"><span class="label">Archived</span><span class="value">${esc(formatDateTime(archivedAt))}</span></div><div class="row"><span class="label">Generated</span><span class="value">${esc(generated)}</span></div></div></header><section class="metrics"><div class="box"><div class="label">AF Expected</div><div class="big">${summary.afExpected}</div></div><div class="box"><div class="label">SF Expected</div><div class="big">${summary.sfExpected}</div></div><div class="box"><div class="label">Total Expected</div><div class="big">${summary.totalExpected}</div></div><div class="box"><div class="label">Loaded</div><div class="big">${summary.loadedTotal}</div></div><div class="box"><div class="label">Arrived / OTW</div><div class="big">${summary.arrivedTotal}</div></div><div class="box"><div class="label">Females</div><div class="big">${summary.femaleTotal}</div></div></section><div class="section-title">Receiving Processing Summary</div><section class="nights">${summary.dayRows.map(day => `<div class="night"><div class="night-title">${esc(day.label)}: ${esc(formatDate(day.start))}</div><div class="night-text">Tonight, the PRC processed ${day.afDay} of the ${summary.afExpected} projected Air Force trainees for a total of ${day.afCum}, and ${day.sfDay} out of ${summary.sfExpected} Space Force trainees for a total of ${day.sfCum} — equalling ${day.totalCum} out of ${summary.totalExpected} total projected trainees for this week group. ${day.natDay} trainees requested U.S. naturalization for a total of ${day.natCum}.</div></div>`).join('')}</section><section class="tables"><div><div class="section-title">Component Roll-Up</div><table><thead><tr><th>Component</th><th>Loaded</th><th>Expected</th><th>Male</th><th>Female</th><th>Band</th></tr></thead><tbody>${componentRows(dorms)}</tbody></table></div><div><div class="section-title">Bus / Processing Roll-Up</div><table><thead><tr><th>Type</th><th>Buses</th><th>Arr/OTW</th><th>Female</th><th>Nat</th><th>SF</th></tr></thead><tbody>${busSummaryRows(buses)}</tbody></table></div></section><div class="footer"><span>Prepared by PRC GATE</span><span>No PII / generated from archived status records</span></div><div class="classification">UNCLASSIFIED / NO PII / STATUS COUNTS ONLY</div></main></body></html>`;
  }

  function printCleanArchiveReport() {
    const archive = getArchive();
    if (!archive) {
      alert('Archive record not found.');
      return;
    }

    let dorms;
    let buses;
    try {
      dorms = parseJsonField('archive-edit-dorm-data', []);
      buses = parseJsonField('archive-edit-bus-data', []);
    } catch (error) {
      alert('Archive JSON is invalid. Save or correct the archive data before printing.');
      return;
    }

    const windows = windowValues(archive);
    const weekGroup = clean(document.getElementById('archive-edit-wg')?.value || archive.week_group, 'week-group').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'week-group';
    const printUrl = `${window.location.origin}/print/gate-archive-report/${weekGroup}`;
    const printWindow = window.open(printUrl, '_blank');
    if (!printWindow) {
      alert('Popup blocked. Allow popups to print or save the archive report.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(printableHtml({ archive, dorms, buses, windows }));
    printWindow.document.close();
    printWindow.focus();
  }

  function interceptArchivePrint(event) {
    const button = event.target && event.target.closest ? event.target.closest('#archive-edit-modal button[onclick="printArchiveSpreadsheet()"]') : null;
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    printCleanArchiveReport();
  }

  function runPass() {
    passScheduled = false;
    window.printArchiveSpreadsheet = printCleanArchiveReport;
    const button = document.querySelector('#archive-edit-modal button[onclick="printArchiveSpreadsheet()"]');
    if (button) button.textContent = 'PRINT / PDF';
  }

  function schedulePass() {
    if (passScheduled) return;
    passScheduled = true;
    requestAnimationFrame(runPass);
  }

  function observeArchiveModal() {
    const observer = new MutationObserver(schedulePass);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function start() {
    if (started) return;
    started = true;
    document.addEventListener('click', interceptArchivePrint, true);
    observeArchiveModal();
    schedulePass();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
