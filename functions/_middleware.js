const COOKIE_NAME = 'prc_sr_session';

const UI_STYLESHEETS = [
  '<link rel="stylesheet" href="/css/liquid-command.css">',
  '<link rel="stylesheet" href="/css/prc-dash-nav.css">',
  '<link rel="stylesheet" href="/css/prc-dash-states-empty.css">',
  '<link rel="stylesheet" href="/css/prc-dash-watermark.css">',
  '<link rel="stylesheet" href="/css/prc-dash-danger-actions.css">'
];

const UI_HEAD_SCRIPTS = [
  '<script src="/js/prc-dash-runtime-fixes.js" defer></script>',
  '<script src="/js/prc-dash-sat-arrivals.js" defer></script>',
  '<script src="/js/prc-dash-space-force.js" defer></script>',
  '<script src="/js/prc-dash-dorm-reopen.js" defer></script>',
  '<script src="/js/prc-dash-final-audit.js" defer></script>',
  '<script src="/js/prc-dash-local-bus-edit.js" defer></script>'
];

const PRINT_ARCHIVE_FUNCTION = String.raw`
function printArchiveSpreadsheet() {
  if (!editArchiveId) return;

  const archive = allData.find(r => r.__backendId === editArchiveId);
  if (!archive) return;

  let dormData = [];
  let busData = [];

  try {
    dormData = parseJsonField('archive-edit-dorm-data', []);
    busData = parseJsonField('archive-edit-bus-data', []);
  } catch (error) {
    alert('Dorm Data JSON or Bus Data JSON is invalid. Fix the JSON before printing.');
    return;
  }

  function n(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  function dt(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? escapeHtml(value) : escapeHtml(date.toLocaleString());
  }

  function rows(items, builder, colspan) {
    if (!items || items.length === 0) return '<tr><td class="empty-row" colspan="' + colspan + '">No records.</td></tr>';
    return items.map(builder).join('');
  }

  const weekGroup = document.getElementById('archive-edit-wg').value.trim() || archive.week_group || '';
  const archivedAt = document.getElementById('archive-edit-archived-at').value.trim() || archive.archived_at || '';
  const totalArrived = n(document.getElementById('archive-edit-total-arrived').value);
  const femaleTotal = n(document.getElementById('archive-edit-female-total').value);
  const natTotal = n(document.getElementById('archive-edit-nat-total').value);
  const loadedTotal = dormData.reduce((s, d) => s + n(d.current_load || d.loaded || 0), 0);
  const expectedTotal = dormData.reduce((s, d) => s + n(d.max_load || 0), 0);
  const printedAt = new Date().toLocaleString();
  const narrative = 'Today, the PRC processed ' + totalArrived + ' of the ' + expectedTotal + ' projected trainees, for a total of ' + loadedTotal + ' trainees loaded to dorms. ' + natTotal + ' trainees requested U.S. Naturalization, for a total of ' + natTotal + ' naturalization requests.';

  const dormRows = rows(dormData, function(d) {
    return '<tr>' +
      '<td class="strong">' + escapeHtml(d.name || d.dorm_name || '') + '</td>' +
      '<td>' + escapeHtml(d.assigned_airman || '') + '</td>' +
      '<td>' + escapeHtml(d.sdq || '') + '</td>' +
      '<td>' + escapeHtml(d.section || '') + '</td>' +
      '<td>' + escapeHtml(d.inter_sec || '') + '</td>' +
      '<td>' + escapeHtml(d.sex || '') + '</td>' +
      '<td>' + escapeHtml(d.band === 'true' ? 'YES' : '') + '</td>' +
      '<td class="num">' + escapeHtml(d.current_load ?? d.loaded ?? 0) + '</td>' +
      '<td class="num">' + escapeHtml(d.max_load ?? 0) + '</td>' +
      '<td>' + escapeHtml(d.open_time || '') + '</td>' +
      '<td>' + escapeHtml(d.close_time || '') + '</td>' +
      '<td>' + escapeHtml(d.elapsed || '') + '</td>' +
    '</tr>';
  }, 12);

  const busRows = rows(busData, function(b) {
    return '<tr>' +
      '<td>' + escapeHtml(b.bus_type || '') + '</td>' +
      '<td class="strong">' + escapeHtml(b.bus_id || '') + '</td>' +
      '<td>' + escapeHtml(b.originating_destination || b.destination || '') + '</td>' +
      '<td class="num">' + escapeHtml(b.otw_count || 0) + '</td>' +
      '<td class="num">' + escapeHtml(b.female_count || 0) + '</td>' +
      '<td class="num">' + escapeHtml(b.nat_count || 0) + '</td>' +
      '<td>' + dt(b.departed_at) + '</td>' +
      '<td>' + dt(b.arrived_at) + '</td>' +
      '<td>' + escapeHtml(b.status || '') + '</td>' +
    '</tr>';
  }, 9);

  const notes = dormData
    .filter(d => String(d.notes || '').trim())
    .map(d => '<div class="note-item"><div class="note-title">' + escapeHtml(d.name || d.dorm_name || 'Dorm') + '</div><div>' + escapeHtml(d.notes || '') + '</div></div>')
    .join('') || '<div class="empty-row">No dorm notes recorded.</div>';

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Unable to open the archive report. Allow pop-ups for this site and try again.');
    return;
  }

  const html = [
    '<!doctype html><html><head><title>' + escapeHtml(weekGroup) + ' Archive Report</title>',
    '<style>',
    ':root{--ink:#111827;--muted:#475569;--line:#cbd5e1;--header:#0f172a;--soft:#f8fafc;--green:#166534}',
    '*{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:var(--ink);margin:24px;background:#fff}',
    '.classification{display:flex;justify-content:center;align-items:center;min-height:28px;background:var(--green);color:#fff;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;border:1px solid #14532d}',
    '.no-print{margin:12px 0;padding:9px 16px;border:1px solid #94a3b8;border-radius:8px;background:#0f172a;color:#fff;font-weight:800;letter-spacing:.04em;cursor:pointer}',
    '.report-header{display:flex;justify-content:space-between;gap:24px;padding:18px 0 14px;border-bottom:2px solid var(--header);margin-bottom:14px}',
    'h1{margin:0;font-size:28px;letter-spacing:-.04em;text-transform:uppercase}.subtitle{margin-top:4px;color:var(--muted);font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}',
    '.meta{min-width:255px;border:1px solid var(--line);background:var(--soft);padding:10px;font-size:11px}.meta-row{display:flex;justify-content:space-between;gap:10px;margin-bottom:5px}.meta-label{color:var(--muted);font-weight:800;text-transform:uppercase}.meta-value{font-weight:900;text-align:right}',
    '.summary{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:14px 0 18px}.box{border:1px solid var(--line);background:#f8fafc;padding:10px;min-height:70px}.label{color:var(--muted);font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.value{margin-top:5px;font-size:24px;font-weight:900;letter-spacing:-.05em}',
    'h2{margin:18px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--line);font-size:15px;text-transform:uppercase;letter-spacing:.06em}',
    'table{width:100%;border-collapse:collapse;margin-top:8px;font-size:10px;page-break-inside:auto} th,td{border:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top} th{background:#e2e8f0;color:#0f172a;font-size:9px;text-transform:uppercase;letter-spacing:.045em} tr:nth-child(even) td{background:#f8fafc}.strong{font-weight:900}.num{text-align:right;font-variant-numeric:tabular-nums}.empty-row{text-align:center;color:var(--muted);padding:14px}',
    '.notes-section,.narrative{margin-top:12px;border:1px solid var(--line);background:#f8fafc;padding:10px}.note-item{padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:11px}.note-item:last-child{border-bottom:none}.note-title{font-weight:900;margin-bottom:2px}.narrative{font-size:12px;line-height:1.45;font-weight:700}.footer{margin-top:22px;padding-top:8px;border-top:2px solid var(--header);color:var(--muted);font-size:10px;display:flex;justify-content:space-between;gap:18px}',
    '@media print{body{margin:10mm}.no-print{display:none}.classification,.box,th,tr:nth-child(even) td,.notes-section,.narrative,.meta{print-color-adjust:exact;-webkit-print-color-adjust:exact}h2{page-break-after:avoid}tr{page-break-inside:avoid}}',
    '</style></head><body>',
    '<div class="classification">CUI / NO PII</div><button class="no-print" onclick="window.print()">Print Report</button>',
    '<header class="report-header"><div><h1>PRC DASH Archive Report</h1><div class="subtitle">Pfingston Reception Center Dashboard</div></div><div class="meta">',
    '<div class="meta-row"><span class="meta-label">Week Group</span><span class="meta-value">' + escapeHtml(weekGroup) + '</span></div>',
    '<div class="meta-row"><span class="meta-label">Archived</span><span class="meta-value">' + dt(archivedAt) + '</span></div>',
    '<div class="meta-row"><span class="meta-label">Printed</span><span class="meta-value">' + escapeHtml(printedAt) + '</span></div></div></header>',
    '<section class="summary"><div class="box"><div class="label">Received</div><div class="value">' + totalArrived + '</div></div><div class="box"><div class="label">Projected</div><div class="value">' + expectedTotal + '</div></div><div class="box"><div class="label">Loaded to Dorms</div><div class="value">' + loadedTotal + '</div></div><div class="box"><div class="label">Females</div><div class="value">' + femaleTotal + '</div></div><div class="box"><div class="label">Naturalizations</div><div class="value">' + natTotal + '</div></div></section>',
    '<h2>Dorm Table</h2><table><thead><tr><th>Dorm</th><th>Airman</th><th>SDQ</th><th>Section</th><th>Inter/Sec</th><th>Sex</th><th>Band</th><th>Loaded</th><th>Max</th><th>Opened</th><th>Closed</th><th>Elapsed</th></tr></thead><tbody>' + dormRows + '</tbody></table>',
    '<h2>Bus Table</h2><table><thead><tr><th>Type</th><th>Bus #</th><th>Originating Destination</th><th>Arrived/OTW</th><th>Females</th><th>Naturalizations</th><th>Departed</th><th>Arrived</th><th>Status</th></tr></thead><tbody>' + busRows + '</tbody></table>',
    '<h2>Notes Section</h2><section class="notes-section">' + notes + '</section>',
    '<h2>Processing Summary</h2><section class="narrative">' + escapeHtml(narrative) + '</section>',
    '<footer class="footer"><div>CUI / NO PII</div><div>Generated by PRC DASH</div></footer><div class="classification" style="margin-top:10px;">CUI / NO PII</div>',
    '</body></html>'
  ].join('');

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
}
`;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = cookieHeader.split(';').map(cookie => cookie.trim());

  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split('=');

    if (key === name) {
      return valueParts.join('=');
    }
  }

  return '';
}

function base64urlDecodeString(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return atob(base64);
}

function base64urlEncodeBytes(bytes) {
  let binary = '';
  const array = new Uint8Array(bytes);

  for (const byte of array) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

async function sign(value, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret || 'missing-secret'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return base64urlEncodeBytes(signature);
}

async function verifySession(request, env) {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = await sign(body, env.AUTH_SECRET);
  if (!safeEqual(signature, expected)) return null;

  const payload = JSON.parse(base64urlDecodeString(body));
  if (!payload.exp || payload.exp < Date.now()) return null;

  return payload;
}

function extractUrl(assetTag, attributeName) {
  const match = assetTag.match(new RegExp(`${attributeName}="([^"]+)"`));
  return match ? match[1] : '';
}

function applyNativeFunctionReplacements(html) {
  if (!html.includes('function printArchiveSpreadsheet()')) return html;

  const pattern = /function printArchiveSpreadsheet\(\) \{[\s\S]*?\n\s*async function deleteArchiveWithOverride\(\)/;
  if (!pattern.test(html)) return html;

  return html.replace(pattern, `${PRINT_ARCHIVE_FUNCTION}\n\nasync function deleteArchiveWithOverride()`);
}

function applyUiAssets(html) {
  const linksToAdd = UI_STYLESHEETS.filter(link => {
    const href = extractUrl(link, 'href');
    return href && !html.includes(href);
  });

  const scriptsToAdd = UI_HEAD_SCRIPTS.filter(script => {
    const src = extractUrl(script, 'src');
    return src && !html.includes(src);
  });

  const assetsToAdd = [...linksToAdd, ...scriptsToAdd];
  let nextHtml = applyNativeFunctionReplacements(html);

  if (assetsToAdd.length === 0) {
    return nextHtml;
  }

  return nextHtml.replace(/<\/head>/i, `  ${assetsToAdd.join('\n  ')}\n </head>`);
}

async function maybeApplyUiAssets(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const html = applyUiAssets(await response.text());
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=UTF-8');
  headers.delete('content-length');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  if (pathname === '/login' || pathname === '/login/' || pathname === '/login.html') {
    return context.next();
  }

  if (pathname === '/api/login' || pathname === '/api/logout' || pathname === '/api/ping') {
    return context.next();
  }

  if (
    pathname === '/favicon.ico' ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.mp3')
  ) {
    return context.next();
  }

  const session = await verifySession(context.request, context.env);

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return jsonResponse({ isOk: false, error: 'Unauthorized.' }, 401);
    }

    return Response.redirect(`${url.origin}/login/`, 302);
  }

  return maybeApplyUiAssets(await context.next());
}
