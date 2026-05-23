// PRC DASH Archive Print Report Polish
(function () {
  function safeEscape(value) {
    if (typeof escapeHtml === 'function') {
      return escapeHtml(value);
    }

    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function safeDateTime(value) {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return safeEscape(value);

    return safeEscape(date.toLocaleString());
  }

  function readJsonTextarea(fieldId) {
    if (typeof parseJsonField === 'function') {
      return parseJsonField(fieldId, []);
    }

    const el = document.getElementById(fieldId);
    const value = el ? el.value.trim() : '';
    return value ? JSON.parse(value) : [];
  }

  function buildRows(items, mapper, columnCount) {
    if (!items || items.length === 0) {
      return `<tr><td colspan="${columnCount}" class="empty-row">No records.</td></tr>`;
    }

    return items.map(mapper).join('');
  }

  window.printArchiveSpreadsheet = function printArchiveSpreadsheet() {
    if (typeof editArchiveId === 'undefined' || !editArchiveId) {
      return;
    }

    const archive = allData.find(r => r.__backendId === editArchiveId);

    if (!archive) {
      return;
    }

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
    const totalArrived = Number(document.getElementById('archive-edit-total-arrived')?.value || 0);
    const femaleTotal = Number(document.getElementById('archive-edit-female-total')?.value || 0);
    const natTotal = Number(document.getElementById('archive-edit-nat-total')?.value || 0);
    const loadedTotal = dormData.reduce((s, d) => s + Number(d.current_load || d.loaded || 0), 0);
    const expectedTotal = dormData.reduce((s, d) => s + Number(d.max_load || 0), 0);
    const printedAt = new Date().toLocaleString();

    const notesItems = dormData
      .filter(d => String(d.notes || '').trim())
      .map(d => `
        <div class="note-item">
          <div class="note-title">${safeEscape(d.name || d.dorm_name || 'Dorm')}</div>
          <div>${safeEscape(d.notes || '')}</div>
        </div>
      `).join('');

    const dormRows = buildRows(dormData, d => `
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
        <td>${safeEscape(d.open_time || '')}</td>
        <td>${safeEscape(d.close_time || '')}</td>
        <td>${safeEscape(d.elapsed || '')}</td>
      </tr>
    `, 12);

    const busRows = buildRows(busData, b => `
      <tr>
        <td>${safeEscape(b.bus_type || '')}</td>
        <td class="strong">${safeEscape(b.bus_id || '')}</td>
        <td>${safeEscape(b.originating_destination || b.destination || '')}</td>
        <td class="num">${safeEscape(b.otw_count || 0)}</td>
        <td class="num">${safeEscape(b.female_count || 0)}</td>
        <td class="num">${safeEscape(b.nat_count || 0)}</td>
        <td>${safeDateTime(b.departed_at)}</td>
        <td>${safeDateTime(b.arrived_at)}</td>
        <td>${safeEscape(b.status || '')}</td>
      </tr>
    `, 9);

    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      alert('Unable to open the print report. Allow pop-ups for this site and try again.');
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
      <head>
        <title>${safeEscape(weekGroup)} Archive Report</title>
        <style>
          :root {
            --ink: #111827;
            --muted: #4b5563;
            --line: #cbd5e1;
            --header: #0f172a;
            --soft: #f1f5f9;
          }

          * { box-sizing: border-box; }

          body {
            font-family: Arial, Helvetica, sans-serif;
            color: var(--ink);
            margin: 24px;
            background: #ffffff;
          }

          .classification {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 28px;
            background: #166534;
            color: #ffffff;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            border: 1px solid #14532d;
          }

          .report-header {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            padding: 18px 0 14px;
            border-bottom: 2px solid var(--header);
            margin-bottom: 14px;
          }

          .title-block h1 {
            margin: 0;
            font-size: 28px;
            letter-spacing: -0.04em;
            text-transform: uppercase;
          }

          .title-block .subtitle {
            margin-top: 4px;
            color: var(--muted);
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          .meta {
            min-width: 245px;
            border: 1px solid var(--line);
            background: var(--soft);
            padding: 10px;
            font-size: 11px;
          }

          .meta-row {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 5px;
          }

          .meta-row:last-child { margin-bottom: 0; }
          .meta-label { color: var(--muted); font-weight: 700; text-transform: uppercase; }
          .meta-value { font-weight: 800; text-align: right; }

          .summary {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 8px;
            margin: 14px 0 18px;
          }

          .box {
            border: 1px solid var(--line);
            background: linear-gradient(180deg, #ffffff, #f8fafc);
            padding: 10px;
            min-height: 70px;
          }

          .label {
            color: var(--muted);
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .value {
            margin-top: 5px;
            font-size: 24px;
            font-weight: 900;
            letter-spacing: -0.05em;
          }

          h2 {
            margin: 18px 0 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid var(--line);
            font-size: 15px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            font-size: 10px;
            page-break-inside: auto;
          }

          th, td {
            border: 1px solid var(--line);
            padding: 5px 6px;
            text-align: left;
            vertical-align: top;
          }

          th {
            background: #e2e8f0;
            color: #0f172a;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.045em;
          }

          tr:nth-child(even) td { background: #f8fafc; }
          .strong { font-weight: 800; }
          .num { text-align: right; font-variant-numeric: tabular-nums; }
          .empty-row { text-align: center; color: var(--muted); padding: 14px; }

          .notes-section {
            margin-top: 12px;
            border: 1px solid var(--line);
            background: #f8fafc;
            padding: 10px;
          }

          .note-item {
            padding: 7px 0;
            border-bottom: 1px solid #e2e8f0;
            font-size: 11px;
          }

          .note-item:last-child { border-bottom: none; }
          .note-title { font-weight: 900; margin-bottom: 2px; }

          .footer {
            margin-top: 22px;
            padding-top: 8px;
            border-top: 2px solid var(--header);
            color: var(--muted);
            font-size: 10px;
            display: flex;
            justify-content: space-between;
            gap: 18px;
          }

          .no-print {
            margin: 12px 0;
            padding: 9px 16px;
            border: 1px solid #94a3b8;
            border-radius: 8px;
            background: #0f172a;
            color: #ffffff;
            font-weight: 800;
            letter-spacing: 0.04em;
            cursor: pointer;
          }

          @media print {
            body { margin: 10mm; }
            .no-print { display: none; }
            .classification { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .box, th, tr:nth-child(even) td, .notes-section, .meta { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            h2 { page-break-after: avoid; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="classification">CUI / NO PII</div>
        <button class="no-print" onclick="window.print()">Print Report</button>

        <header class="report-header">
          <div class="title-block">
            <h1>PRC DASH Archive Report</h1>
            <div class="subtitle">Pfingston Reception Center Dashboard</div>
          </div>

          <div class="meta">
            <div class="meta-row"><span class="meta-label">Week Group</span><span class="meta-value">${safeEscape(weekGroup)}</span></div>
            <div class="meta-row"><span class="meta-label">Archived</span><span class="meta-value">${safeDateTime(archivedAt)}</span></div>
            <div class="meta-row"><span class="meta-label">Printed</span><span class="meta-value">${safeEscape(printedAt)}</span></div>
          </div>
        </header>

        <section class="summary">
          <div class="box"><div class="label">Total Arrived</div><div class="value">${totalArrived}</div></div>
          <div class="box"><div class="label">Loaded to Dorms</div><div class="value">${loadedTotal}</div></div>
          <div class="box"><div class="label">Expected Capacity</div><div class="value">${expectedTotal}</div></div>
          <div class="box"><div class="label">Females</div><div class="value">${femaleTotal}</div></div>
          <div class="box"><div class="label">Naturalizations</div><div class="value">${natTotal}</div></div>
        </section>

        <h2>Dorm Table</h2>
        <table>
          <thead>
            <tr>
              <th>Dorm</th>
              <th>Airman</th>
              <th>SDQ</th>
              <th>Section</th>
              <th>Inter/Sec</th>
              <th>Sex</th>
              <th>Band</th>
              <th>Loaded</th>
              <th>Max</th>
              <th>Opened</th>
              <th>Closed</th>
              <th>Elapsed</th>
            </tr>
          </thead>
          <tbody>${dormRows}</tbody>
        </table>

        <h2>Bus Table</h2>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Bus #</th>
              <th>Originating Destination</th>
              <th>Arrived/OTW</th>
              <th>Females</th>
              <th>Naturalizations</th>
              <th>Departed</th>
              <th>Arrived</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${busRows}</tbody>
        </table>

        <h2>Notes Section</h2>
        <section class="notes-section">
          ${notesItems || '<div class="empty-row">No dorm notes recorded.</div>'}
        </section>

        <footer class="footer">
          <div>CUI / NO PII</div>
          <div>Generated by PRC DASH</div>
        </footer>
        <div class="classification" style="margin-top: 10px;">CUI / NO PII</div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
  };
})();
