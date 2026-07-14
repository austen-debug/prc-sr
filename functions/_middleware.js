const COOKIE_NAME = 'prc_sr_session';

const UI_STYLESHEETS = [
  '<link rel="stylesheet" href="/css/gate-index-legacy-shell.css">',
  '<link rel="stylesheet" href="/css/gate-base-tokens.css">',
  '<link rel="stylesheet" href="/css/gate-layout-pages.css">',
  '<link rel="stylesheet" href="/css/gate-components.css">',
  '<link rel="stylesheet" href="/css/gate-utilities-access.css?v=status-board-light-clarity-20260714">',
  '<link rel="stylesheet" href="/css/gate-premium-metrics.css?v=status-board-active-bus-strip-20260714">',
  '<link rel="stylesheet" href="/css/gate-app-shell.css?v=phase-7g-viewport-watermark-20260709">',
  '<link rel="stylesheet" href="/css/gate-mobile-corrective.css?v=phase-7h-ui-patch-retirement-20260709">',
  '<link rel="stylesheet" href="/css/gate-ui-ownership-correction.css?v=phase-8d-mobile-metric-containment-20260709">',
  '<link rel="stylesheet" href="/css/gate-light-mode-command-contrast.css?v=light-command-contrast-20260714">',
  '<link rel="stylesheet" href="/css/gate-light-mode-grid-correction.css?v=light-grid-correction-20260714">',
  '<link rel="stylesheet" href="/css/gate-tablet-shell.css?v=tablet-shell-20260714">',
  '<link rel="stylesheet" href="/css/gate-fullscreen-board-contract.css?v=fullscreen-desktop-status-20260714c">'
];

const UI_INLINE_ASSETS = [];

const UI_HEAD_SCRIPTS = [
  '<script src="/js/gate-record-display-contract.js?v=record-display-integrity-20260714b" defer></script>',
  '<script src="/js/gate-component-contracts.js" defer></script>',
  '<script src="/js/gate-ui-hooks.js?v=phase-6-hooks-20260709" defer></script>',
  '<script src="/js/gate-branding-controller.js" defer></script>',
  '<script src="/js/prc-dash-runtime-fixes.js?v=phase-8e-runtime-safeguards-20260709" defer></script>',
  '<script src="/js/prc-dash-sat-arrivals.js" defer></script>',
  '<script src="/js/prc-dash-space-force.js" defer></script>',
  '<script src="/js/prc-dash-dorm-reopen.js" defer></script>',
  '<script src="/js/prc-dash-final-audit.js?v=record-display-integrity-20260714" defer></script>',
  '<script src="/js/gate-status-board-controller.js?v=record-display-integrity-20260714" defer></script>',
  '<script src="/js/gate-processing-controller.js?v=record-display-integrity-20260714" defer></script>',
  '<script src="/js/prc-dash-dorm-flag-validation.js?v=record-display-integrity-20260714b" defer></script>',
  '<script src="/js/prc-dash-auditorium-location.js" defer></script>',
  '<script src="/js/gate-bus-workflow-controller.js?v=phase-3-bus-workflow-20260709" defer></script>',
  '<script src="/js/gate-airport-bus-delete-controller.js?v=airport-bus-delete-20260714" defer></script>',
  '<script src="/js/gate-input-page-controller.js?v=record-display-integrity-20260714" defer></script>',
  '<script src="/js/gate-archive-controller.js?v=phase-8c-report-wording-20260709" defer></script>',
  '<script src="/js/gate-permission-guard.js?v=phase-1a-permission-guard-20260709" defer></script>',
  '<script src="/js/gate-tablet-shell-classifier.js?v=tablet-shell-20260714" defer></script>',
  '<script src="/js/gate-app-shell-controller.js?v=phase-7g-viewport-watermark-20260709" defer></script>',
  '<script src="/js/gate-fullscreen-board-layout-controller.js?v=fullscreen-board-containment-20260714b" defer></script>',
  '<script src="/js/prc-dash-modal-mobile-validation.js?v=phase-7e-ui-ownership-20260709" defer></script>',
  '<script src="/js/gate-render-stability-fix.js?v=fullscreen-desktop-stability-20260714" defer></script>',
  '<script src="/js/prc-dash-processing-loaded-summary.js" defer></script>',
  '<script src="/js/gate-premium-metrics-controller.js?v=premium-metrics-20260709d" defer></script>',
  '<script src="/js/prc-dash-overtime-audit.js" defer></script>'
];

const STATUS_BOARD_METRICS_HTML = `<div class="board-header gate-premium-metrics-enabled" data-owner="gate-status-metrics-source" data-phase="1B">
      <div class="gate-metrics-container">
       <div class="metric-card arrived-card">
        <div class="metric-header">
         <span class="status-dot led-green" aria-hidden="true"></span>
         <span class="metric-label">ARRIVED</span>
        </div>
        <div class="metric-value" id="stat-arrived">0</div>
       </div>
       <div class="metric-card expected-card">
        <div class="metric-header">
         <span class="metric-label">EXPECTED</span>
        </div>
        <div class="metric-value" id="stat-expected">0</div>
       </div>
       <div class="metric-card last-card">
        <div class="metric-header">
         <span class="metric-label">LAST</span>
        </div>
        <div class="metric-value" id="stat-last">00:00</div>
       </div>
       <div class="metric-card local-card">
        <div class="metric-header">
         <span class="metric-label">LOCAL</span>
        </div>
        <div class="metric-value" id="stat-local">00:00</div>
       </div>
      </div>
      <section class="gate-active-buses-block" aria-label="Active buses en route">
       <div class="gate-active-buses-label">ACTIVE BUSES</div>
       <div id="active-buses" class="flex gap-2 flex-wrap items-center"></div>
      </section>
     </div>`;

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
    if (key === name) return valueParts.join('=');
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
  for (const byte of array) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
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

function extractId(assetTag) {
  const match = assetTag.match(/id="([^"]+)"/);
  return match ? match[1] : '';
}

function applyAppShellIdentity(html) {
  let output = html.replace(
    /<title>\s*Pfingston Reception Status Board\s*<\/title>/i,
    '<title>GATE — Gateway Arrival Tracking Environment | Pfingston Reception Center</title>'
  );

  output = output.replace(
    /<title>\s*GATE\s*—\s*Gateway Arrival Tracking Environment\s*<\/title>/i,
    '<title>GATE — Gateway Arrival Tracking Environment | Pfingston Reception Center</title>'
  );

  return output;
}

function normalizeServedBranding(html) {
  return html
    .replace(/\bPRC\s*DASH\b/g, 'GATE')
    .replace(/\bPRC\s*GATE\b/g, 'GATE')
    .replace(/\bPRC[-\s]*SR\b/g, 'GATE')
    .replace(/\bPfingston Reception Status Board\b/g, 'GATE — Gateway Arrival Tracking Environment');
}

function stripLegacyInlineShellCss(html) {
  return html.replace(
    /\s*<style>\s*:root\s*\{[\s\S]*?<\/style>\s*/i,
    '\n'
  );
}

function applyStatusBoardMetricSourceRefactor(html) {
  let output = html.replace(
    /<div class="board-header">\s*<div class="metric-block">[\s\S]*?<div id="active-buses" class="flex gap-2 flex-wrap items-center"><\/div>\s*<\/div>\s*<\/div>/,
    STATUS_BOARD_METRICS_HTML
  );

  output = output.replace(
    /function updateAirportMetric\(\) \{[\s\S]*?\n\}\n\n function updateSoundButton/,
    `function updateAirportMetric() {
  const lastAirport = getConfig('last_airport') || '—';
  const lastEl = document.getElementById('stat-last');
  const localEl = document.getElementById('stat-local');

  if (lastEl) lastEl.textContent = lastAirport;
  if (localEl) localEl.textContent = getLocalTime24();
}

 function updateSoundButton`
  );

  output = output.replace(
    /document\.getElementById\('metric-arrived'\)\.textContent = `ARRIVED: \$\{totalArrived\} \| EXPECTED: \$\{totalExpected\}`;/,
    `const arrivedMetricEl = document.getElementById('stat-arrived');
      const expectedMetricEl = document.getElementById('stat-expected');
      if (arrivedMetricEl) arrivedMetricEl.textContent = String(totalArrived);
      if (expectedMetricEl) expectedMetricEl.textContent = String(totalExpected);`
  );

  return output;
}

function prepareAppShellHtml(html) {
  return applyStatusBoardMetricSourceRefactor(
    normalizeServedBranding(stripLegacyInlineShellCss(applyAppShellIdentity(html)))
  );
}

function applyUiAssets(html) {
  const updatedHtml = prepareAppShellHtml(html);

  const linksToAdd = UI_STYLESHEETS.filter(link => {
    const href = extractUrl(link, 'href');
    return href && !updatedHtml.includes(href);
  });

  const inlineAssetsToAdd = UI_INLINE_ASSETS.filter(asset => {
    const id = extractId(asset);
    return id ? !updatedHtml.includes(`id="${id}"`) : !updatedHtml.includes(asset);
  });

  const scriptsToAdd = UI_HEAD_SCRIPTS.filter(script => {
    const src = extractUrl(script, 'src');
    return src && !updatedHtml.includes(src);
  });

  const assetsToAdd = [...linksToAdd, ...inlineAssetsToAdd, ...scriptsToAdd];
  if (assetsToAdd.length === 0) return updatedHtml;

  return updatedHtml.replace(/<\/head>/i, `  ${assetsToAdd.join('\n  ')}\n </head>`);
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

  if (pathname === '/login' || pathname === '/login/' || pathname === '/login.html') return context.next();
  if (pathname === '/api/login' || pathname === '/api/logout' || pathname === '/api/ping') return context.next();

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
    if (pathname.startsWith('/api/')) return jsonResponse({ isOk: false, error: 'Unauthorized.' }, 401);
    return Response.redirect(`${url.origin}/login/`, 302);
  }

  return maybeApplyUiAssets(await context.next());
}
