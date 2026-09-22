import { verifyRequestSession } from './api/session-contract.mjs';

const APP_ROUTES = Object.freeze({
  '/board/': Object.freeze({ page: 'board', roles: Object.freeze(['instructor', 'airman']) }),
  '/airport/': Object.freeze({ page: 'airport', roles: Object.freeze(['instructor']) }),
  '/input/': Object.freeze({ page: 'input', roles: Object.freeze(['instructor']) }),
  '/processing/': Object.freeze({ page: 'processing', roles: Object.freeze(['instructor', 'airman']) }),
  '/archives/': Object.freeze({ page: 'archives', roles: Object.freeze(['instructor']) }),
  '/squadron-board/': Object.freeze({ page: 'squadron', roles: Object.freeze(['instructor']) })
});
const APP_ROUTE_ALIASES = Object.freeze(Object.fromEntries(
  Object.keys(APP_ROUTES).map(path => [path.slice(0, -1), path])
));
const ROLE_HOME = Object.freeze({
  instructor: '/board/',
  airman: '/board/',
  squadron: '/squadron/'
});

const UI_STYLESHEETS = [
  '<link rel="stylesheet" href="/css/military-glass-terminal.css?v=military-glass-terminal-20260922-archives1">'
];

const UI_INLINE_ASSETS = [];

const UI_HEAD_SCRIPTS = [
  '<script src="/js/gate-record-display-contract.js?v=record-display-integrity-20260714b" defer></script>',
  '<script src="/js/gate-component-contracts.js" defer></script>',
  '<script src="/js/gate-ui-hooks.js?v=repo-audit-20260922" defer></script>',
  '<script src="/js/gate-branding-controller.js" defer></script>',
  '<script src="/js/prc-dash-sat-arrivals.js" defer></script>',
  '<script src="/js/prc-dash-dorm-reopen.js" defer></script>',
  '<script src="/js/prc-dash-final-audit.js?v=squadron-sitrep-20260922-live-sync1" defer></script>',
  '<script src="/js/gate-status-board-controller.js?v=dorm-timer-record-lifecycle-20260722" defer></script>',
  '<script src="/js/gate-processing-controller.js?v=repo-audit-20260922" defer></script>',
  '<script src="/js/prc-dash-dorm-flag-validation.js?v=processing-band-designator-20260915" defer></script>',
  '<script src="/js/prc-dash-auditorium-location.js?v=processing-modal-record-binding-20260721" defer></script>',
  '<script src="/js/gate-bus-workflow-controller.js?v=repo-audit-20260922" defer></script>',
  '<script src="/js/gate-airport-bus-delete-controller.js?v=repo-audit-20260922" defer></script>',
  '<script src="/js/gate-input-page-controller.js?v=record-display-integrity-20260714" defer></script>',
  '<script src="/js/gate-archive-controller.js?v=repo-audit-20260922" defer></script>',
  '<script src="/js/gate-permission-guard.js?v=permission-server-role-20260922" defer></script>',
  '<script type="module" src="/app/features/input/flight-alert-import.mjs?v=flight-alert-import-20260920"></script>',
  '<script src="/js/gate-app-shell-controller.js?v=repo-audit-20260922" defer></script>',
  '<script src="/js/gate-fullscreen-board-layout-controller.js?v=fullscreen-board-containment-20260714b" defer></script>',
  '<script src="/js/prc-dash-modal-mobile-validation.js?v=phase-7e-ui-ownership-20260709" defer></script>',
  '<script src="/js/gate-premium-metrics-controller.js?v=metric-live-clock-20260722" defer></script>',
  '<script src="/js/prc-dash-overtime-audit.js?v=repo-audit-20260922" defer></script>',
  '<script src="/js/gate-status-board-shadow-controller.js?v=phase-3a-status-board-shadow-20260715" defer></script>'
];

const STATUS_BOARD_METRICS_HTML = `<div class="board-header gate-premium-metrics-enabled" data-owner="gate-status-metrics-source" data-phase="1B">
      <div class="gate-metrics-container">
       <div class="metric-card arrived-card">
        <div class="metric-header">
         <span class="status-dot led-green" aria-hidden="true"></span>
         <span class="metric-label">ARRIVED</span>
        </div>
        <div class="metric-value" id="stat-arrived" data-gate-live-value="true" aria-live="off">0</div>
       </div>
       <div class="metric-card expected-card">
        <div class="metric-header">
         <span class="metric-label">EXPECTED</span>
        </div>
        <div class="metric-value" id="stat-expected" data-gate-live-value="true" aria-live="off">0</div>
       </div>
       <div class="metric-card last-card">
        <div class="metric-header">
         <span class="metric-label">LAST</span>
        </div>
        <div class="metric-value" id="stat-last" data-gate-live-value="true" aria-live="off">00:00</div>
       </div>
       <div class="metric-card local-card">
        <div class="metric-header">
         <span class="metric-label">LOCAL</span>
        </div>
        <div class="metric-value" id="stat-local" data-gate-live-value="true" aria-live="off">00:00:00</div>
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
  if (lastEl && lastEl.textContent !== String(lastAirport)) lastEl.textContent = String(lastAirport);
}

 function updateSoundButton`
  );

  output = output.replace(
    /document\.getElementById\('metric-arrived'\)\.textContent = `ARRIVED: \$\{totalArrived\} \| EXPECTED: \$\{totalExpected\}`;/,
    `const arrivedMetricEl = document.getElementById('stat-arrived');
      const expectedMetricEl = document.getElementById('stat-expected');
      if (arrivedMetricEl && arrivedMetricEl.textContent !== String(totalArrived)) arrivedMetricEl.textContent = String(totalArrived);
      if (expectedMetricEl && expectedMetricEl.textContent !== String(totalExpected)) expectedMetricEl.textContent = String(totalExpected);`
  );

  output = output.replace(
    /setInterval\(updateAirportMetric,\s*1000\);/,
    '/* LOCAL metric live clock is owned by GatePremiumMetricsController. */'
  );

  output = output.replace(
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

  output = output.replace(
    /function updateTimers\(\) \{[\s\S]*?\n\}\n\n     \/\/ BUS ARRIVAL CONFIRM/,
    `function updateTimers() {
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

  output = output.replace(
    /el\.classList\.add\(['"]timer-flash['"]\);/g,
    `el.classList.remove('timer-flash');
      el.classList.add('timer-red');`
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

function applyInitialAppRoute(html, page, role) {
  let output = html.replace(
    /<body\b([^>]*)>/i,
    (match, attrs) => `<body${attrs} data-gate-initial-route="${page}" data-gate-session-role="${role}">`
  );

  output = output.replace(
    /<(main|div)([^>]*\bid="page-([^"]+)"[^>]*)>/gi,
    (match, tag, attrs, routePage) => {
      const classMatch = attrs.match(/\bclass="([^"]*)"/i);
      if (!classMatch) return match;
      const classes = classMatch[1].split(/\s+/).filter(Boolean).filter(token => token !== 'active');
      if (routePage === page) classes.push('active');
      return `<${tag}${attrs.replace(classMatch[0], `class="${classes.join(' ')}"`)}>`;
    }
  );

  return output;
}

async function maybeApplyUiAssets(response, routeContext = null) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = applyUiAssets(await response.text());
  if (routeContext?.page && routeContext?.role) {
    html = applyInitialAppRoute(html, routeContext.page, routeContext.role);
  }

  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=UTF-8');
  if (routeContext) headers.set('cache-control', 'no-store');
  headers.delete('content-length');

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function redirectTo(url, pathname, status = 302) {
  const target = new URL(url);
  target.pathname = pathname;
  target.search = '';
  target.hash = '';
  return Response.redirect(target.toString(), status);
}

function redirectToLogin(url, returnTo = '') {
  const target = new URL(url);
  target.pathname = '/login/';
  target.search = '';
  target.hash = '';
  if (returnTo) target.searchParams.set('returnTo', returnTo);
  return Response.redirect(target.toString(), 302);
}

function homeForRole(role) {
  return ROLE_HOME[role] || '/board/';
}

async function serveMainApp(context, route, session) {
  const rootUrl = new URL(context.request.url);
  rootUrl.pathname = '/';
  rootUrl.search = '';
  rootUrl.hash = '';
  const rootRequest = new Request(rootUrl.toString(), {
    method: context.request.method === 'HEAD' ? 'HEAD' : 'GET',
    headers: context.request.headers
  });
  const response = context.env?.ASSETS?.fetch
    ? await context.env.ASSETS.fetch(rootRequest)
    : await context.next(rootRequest);
  return maybeApplyUiAssets(response, { page: route.page, role: session.role });
}

async function bindSquadronAcknowledgmentToSession(response, session) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const marker = [session.role, session.iat, session.exp].join(':');
  const html = (await response.text()).replace(
    /<\/head>/i,
    `  <meta name="gate-auth-session" content="${marker}">\n</head>`
  );
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=UTF-8');
  headers.set('cache-control', 'no-store');
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

  const canonicalAppPath = APP_ROUTE_ALIASES[pathname];
  if (canonicalAppPath) return redirectTo(url, canonicalAppPath);
  if (pathname === '/squadron') return redirectTo(url, '/squadron/');

  const session = await verifyRequestSession(context.request, context.env);
  if (!session) {
    if (pathname.startsWith('/api/')) return jsonResponse({ isOk: false, code: 'unauthorized', error: 'Unauthorized.' }, 401);
    if (APP_ROUTES[pathname] || pathname === '/squadron/') return redirectToLogin(url, pathname);
    return redirectToLogin(url);
  }

  if (session.role === 'squadron') {
    if (pathname === '/squadron/') return bindSquadronAcknowledgmentToSession(await context.next(), session);
    if (pathname.startsWith('/api/')) {
      if (pathname === '/api/session' || pathname === '/api/squadron-board') return context.next();
      return jsonResponse({ isOk: false, code: 'forbidden', error: 'Squadron access is limited to the read-only Squadron Board.' }, 403);
    }
    return redirectTo(url, '/squadron/');
  }

  if (pathname.startsWith('/api/')) return context.next();
  if (pathname === '/') return redirectTo(url, homeForRole(session.role));

  if (pathname === '/squadron/') {
    return redirectTo(url, session.role === 'instructor' ? '/squadron-board/' : homeForRole(session.role));
  }

  const route = APP_ROUTES[pathname];
  if (route) {
    if (!route.roles.includes(session.role)) return redirectTo(url, homeForRole(session.role));
    return serveMainApp(context, route, session);
  }

  return maybeApplyUiAssets(await context.next());
}
