import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const INDEX_PATH = path.join(ROOT, 'public/index.html');
const MIDDLEWARE_PATH = path.join(ROOT, 'functions/_middleware.js');
const CSS_PATH = path.join(ROOT, 'public/css/gate-application-structure.css');
const DATA_SDK_PATH = path.join(ROOT, 'public/js/gate-data-sdk.js');
const BOOTSTRAP_PATH = path.join(ROOT, 'public/js/gate-application-bootstrap.js');

const UI_STYLESHEETS = [
  '<link rel="stylesheet" href="/css/gate-index-legacy-shell.css">',
  '<link rel="stylesheet" href="/css/gate-base-tokens.css">',
  '<link rel="stylesheet" href="/css/gate-layout-pages.css">',
  '<link rel="stylesheet" href="/css/gate-components.css">',
  '<link rel="stylesheet" href="/css/gate-utilities-access.css?v=status-board-stable-surfaces-20260721">',
  '<link rel="stylesheet" href="/css/gate-premium-metrics.css?v=status-board-fluid-metrics-20260721">',
  '<link rel="stylesheet" href="/css/gate-app-shell.css?v=phase-7g-viewport-watermark-20260709">',
  '<link rel="stylesheet" href="/css/gate-mobile-corrective.css?v=phase-7h-ui-patch-retirement-20260709">',
  '<link rel="stylesheet" href="/css/gate-ui-ownership-correction.css?v=operational-ui-audit-20260721">',
  '<link rel="stylesheet" href="/css/gate-light-mode-command-contrast.css?v=light-command-contrast-20260714">',
  '<link rel="stylesheet" href="/css/gate-light-mode-grid-correction.css?v=light-grid-correction-20260714">',
  '<link rel="stylesheet" href="/css/gate-tablet-shell.css?v=tablet-shell-20260714">',
  '<link rel="stylesheet" href="/css/gate-fullscreen-board-contract.css?v=fullscreen-compact-bus-tiles-20260721">'
];

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
  '<script src="/js/gate-status-board-controller.js?v=dorm-timer-record-lifecycle-20260722" defer></script>',
  '<script src="/js/gate-processing-controller.js?v=record-display-integrity-20260714" defer></script>',
  '<script src="/js/prc-dash-dorm-flag-validation.js?v=record-display-integrity-20260714b" defer></script>',
  '<script src="/js/prc-dash-auditorium-location.js?v=processing-modal-record-binding-20260721" defer></script>',
  '<script src="/js/gate-bus-workflow-controller.js?v=phase-3-bus-workflow-20260709" defer></script>',
  '<script src="/js/gate-airport-bus-delete-controller.js?v=airport-bus-delete-20260714" defer></script>',
  '<script src="/js/gate-input-page-controller.js?v=record-display-integrity-20260714" defer></script>',
  '<script src="/js/gate-archive-controller.js?v=phase-8c-report-wording-20260709" defer></script>',
  '<script src="/js/gate-permission-guard.js?v=phase-1a-permission-guard-20260709" defer></script>',
  '<script src="/js/gate-tablet-shell-classifier.js?v=tablet-shell-20260714" defer></script>',
  '<script src="/js/gate-app-shell-controller.js?v=phase-7g-viewport-watermark-20260709" defer></script>',
  '<script src="/js/gate-fullscreen-board-layout-controller.js?v=fullscreen-board-containment-20260714b" defer></script>',
  '<script src="/js/prc-dash-modal-mobile-validation.js?v=phase-7e-ui-ownership-20260709" defer></script>',
  '<script src="/js/gate-render-stability-fix.js?v=status-board-compositing-retired-20260721" defer></script>',
  '<script src="/js/prc-dash-processing-loaded-summary.js" defer></script>',
  '<script src="/js/gate-premium-metrics-controller.js?v=metric-live-clock-20260722" defer></script>',
  '<script src="/js/prc-dash-overtime-audit.js" defer></script>'
];

const STATUS_BOARD_METRICS_HTML = `<div class="board-header gate-premium-metrics-enabled" data-owner="gate-status-metrics-source" data-phase="3.0">
      <div class="gate-metrics-container">
       <div class="metric-card arrived-card"><div class="metric-header"><span class="status-dot led-green" aria-hidden="true"></span><span class="metric-label">ARRIVED</span></div><div class="metric-value" id="stat-arrived" data-gate-live-value="true" aria-live="off">0</div></div>
       <div class="metric-card expected-card"><div class="metric-header"><span class="metric-label">EXPECTED</span></div><div class="metric-value" id="stat-expected" data-gate-live-value="true" aria-live="off">0</div></div>
       <div class="metric-card last-card"><div class="metric-header"><span class="metric-label">LAST</span></div><div class="metric-value" id="stat-last" data-gate-live-value="true" aria-live="off">00:00</div></div>
       <div class="metric-card local-card"><div class="metric-header"><span class="metric-label">LOCAL</span></div><div class="metric-value" id="stat-local" data-gate-live-value="true" aria-live="off">00:00:00</div></div>
      </div>
      <section class="gate-active-buses-block" aria-label="Active buses en route"><div class="gate-active-buses-label">ACTIVE BUSES</div><div id="active-buses" class="flex gap-2 flex-wrap items-center"></div></section>
     </div>`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function injectBeforeClosingTag(html, closingTag, assets) {
  let output = html;
  for (const asset of assets) {
    const url = asset.match(/(?:href|src)="([^"]+)"/)?.[1];
    if (url && output.includes(url)) continue;
    output = output.replace(closingTag, `${asset}\n${closingTag}`);
  }
  return output;
}

function materializeServedHtml(source) {
  let html = source
    .replace(/<title>\s*Pfingston Reception Status Board\s*<\/title>/i, '<title>GATE — Gateway Arrival Tracking Environment | Pfingston Reception Center</title>')
    .replace(/\bPRC\s*DASH\b/g, 'GATE')
    .replace(/\bPRC\s*GATE\b/g, 'GATE')
    .replace(/\bPRC[-\s]*SR\b/g, 'GATE')
    .replace(/\bPfingston Reception Status Board\b/g, 'GATE — Gateway Arrival Tracking Environment');

  html = html.replace(
    /<div class="board-header">\s*<div class="metric-block">[\s\S]*?<div id="active-buses" class="flex gap-2 flex-wrap items-center"><\/div>\s*<\/div>\s*<\/div>/,
    STATUS_BOARD_METRICS_HTML
  );

  html = html.replace(
    /function updateAirportMetric\(\) \{[\s\S]*?\n\}\n\n function updateSoundButton/,
    `function updateAirportMetric() {
  const lastAirport = getConfig('last_airport') || '—';
  const lastEl = document.getElementById('stat-last');
  if (lastEl && lastEl.textContent !== String(lastAirport)) lastEl.textContent = String(lastAirport);
}

 function updateSoundButton`
  );

  html = html.replace(
    /document\.getElementById\('metric-arrived'\)\.textContent = `ARRIVED: \$\{totalArrived\} \| EXPECTED: \$\{totalExpected\}`;/,
    `const arrivedMetricEl = document.getElementById('stat-arrived');
      const expectedMetricEl = document.getElementById('stat-expected');
      if (arrivedMetricEl && arrivedMetricEl.textContent !== String(totalArrived)) arrivedMetricEl.textContent = String(totalArrived);
      if (expectedMetricEl && expectedMetricEl.textContent !== String(totalExpected)) expectedMetricEl.textContent = String(totalExpected);`
  );

  html = html.replace(/setInterval\(updateAirportMetric,\s*1000\);/, '/* Local metric is owned by GatePremiumMetricsController. */');

  html = html.replace(
    /(      const abEl = document\.getElementById\('active-buses'\);[\s\S]*?\n  \}\)\.join\(''\);)\n\n      renderDormColumns\(dorms\);/,
    (match, legacyBusBlock) => `      if (window.GateStatusBoardController?.renderActiveBuses) {
        window.GateStatusBoardController.renderActiveBuses();
      } else {
${legacyBusBlock}
      }

      if (window.GateStatusBoardController?.renderDormColumns) {
        window.GateStatusBoardController.renderDormColumns(dorms);
      } else {
        renderDormColumns(dorms);
      }`
  );

  html = html.replace(
    /function updateTimers\(\) \{[\s\S]*?\n\}\n\n     \/\/ BUS ARRIVAL CONFIRM/,
    `function updateTimers() {
  if (window.GateStatusBoardController?.tickTimers) {
    window.GateStatusBoardController.tickTimers();
    return;
  }
  document.querySelectorAll('#page-board .timer-display[data-opened]').forEach(el => {
    const timer = getElapsedTimer(el.dataset.opened);
    if (el.textContent !== timer.text) el.textContent = timer.text;
    const warning = timer.minutes >= 40 && timer.minutes < 50;
    const critical = timer.minutes >= 50;
    el.classList.toggle('timer-yellow', warning);
    el.classList.toggle('timer-red', critical);
    el.classList.remove('timer-flash');
    if (timer.minutes >= 60) triggerOvertimeSoundIfNeeded(el.dataset.dormId);
  });
}

     // BUS ARRIVAL CONFIRM`
  );

  html = html.replace(/el\.classList\.add\(['"]timer-flash['"]\);/g, "el.classList.remove('timer-flash');");
  html = injectBeforeClosingTag(html, '</head>', UI_STYLESHEETS);
  html = injectBeforeClosingTag(html, '</head>', UI_HEAD_SCRIPTS);
  return html;
}

function extractInlineAssets(html) {
  const styleBlocks = [];
  let output = html.replace(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi, (_match, css) => {
    styleBlocks.push(css.trim());
    return '';
  });

  const scriptBlocks = [];
  output = output.replace(/<script(?![^>]*\bsrc=)(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi, (_match, js) => {
    const index = scriptBlocks.length;
    scriptBlocks.push(js.trim());
    if (index === 0) return '<script src="/js/gate-data-sdk.js"></script>';
    if (index === 1) return '<script src="/js/gate-application-bootstrap.js"></script>';
    return `<script src="/js/gate-application-bootstrap-${index + 1}.js"></script>`;
  });

  assert(styleBlocks.length >= 1, 'Expected at least one inline style block.');
  assert(scriptBlocks.length >= 2, `Expected at least two inline script blocks; found ${scriptBlocks.length}.`);

  const structuralLink = '<link rel="stylesheet" href="/css/gate-application-structure.css?v=gate-3-bootstrap-extraction">';
  output = output.replace('</head>', `${structuralLink}\n</head>`);
  output = output.replace(/\n{3,}/g, '\n\n');

  return { html: output, styleBlocks, scriptBlocks };
}

const MINIMAL_MIDDLEWARE = `const COOKIE_NAME = 'prc_sr_session';

function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  for (const cookie of cookieHeader.split(';').map(value => value.trim())) {
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
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/g, '');
}

function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}

async function sign(value, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret || 'missing-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
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
  return payload.exp && payload.exp >= Date.now() ? payload : null;
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'same-origin');
  headers.set('X-Frame-Options', 'DENY');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return next();

  const isLogin = url.pathname === '/login.html' || url.pathname === '/login/' || url.pathname.startsWith('/login/');
  if (!isLogin) {
    const session = await verifySession(request, env);
    if (!session) return Response.redirect(new URL('/login.html', url.origin), 302);
  }

  return withSecurityHeaders(await next());
}
`;

async function main() {
  const original = await fs.readFile(INDEX_PATH, 'utf8');
  const served = materializeServedHtml(original);
  const { html, styleBlocks, scriptBlocks } = extractInlineAssets(served);

  await fs.mkdir(path.dirname(CSS_PATH), { recursive: true });
  await fs.mkdir(path.dirname(DATA_SDK_PATH), { recursive: true });

  await fs.writeFile(CSS_PATH, `${styleBlocks.join('\n\n')}\n`, 'utf8');
  await fs.writeFile(DATA_SDK_PATH, `${scriptBlocks[0]}\n`, 'utf8');
  await fs.writeFile(BOOTSTRAP_PATH, `${scriptBlocks[1]}\n`, 'utf8');
  for (let index = 2; index < scriptBlocks.length; index += 1) {
    await fs.writeFile(path.join(ROOT, `public/js/gate-application-bootstrap-${index + 1}.js`), `${scriptBlocks[index]}\n`, 'utf8');
  }

  await fs.writeFile(INDEX_PATH, html, 'utf8');
  await fs.writeFile(MIDDLEWARE_PATH, MINIMAL_MIDDLEWARE, 'utf8');

  const verification = await fs.readFile(INDEX_PATH, 'utf8');
  assert(!/<style(?:\s|>)/i.test(verification), 'Inline style block remains in public/index.html.');
  assert(!/<script(?![^>]*\bsrc=)/i.test(verification), 'Inline script block remains in public/index.html.');
  assert(!/applyAppShellIdentity|normalizeServedBranding|stripLegacyInlineShellCss|applyStatusBoardMetricSourceRefactor|injectUiAssets/.test(MINIMAL_MIDDLEWARE), 'Minimal middleware unexpectedly contains UI rewriting.');
  console.log(JSON.stringify({ styleBlocks: styleBlocks.length, scriptBlocks: scriptBlocks.length, middleware: 'security-session-static-only' }));
}

await main();
