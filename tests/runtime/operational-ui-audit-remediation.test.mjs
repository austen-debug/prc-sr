import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

async function source(path) {
  return readFile(resolve(root, path), 'utf8');
}

test('canonical layer pipeline keeps modals and critical overlays above the shell', async () => {
  const css = await source('public/css/military-glass-terminal.css');

  assert.match(css, /--mg-z-base:\s*0/);
  assert.match(css, /--mg-z-static:\s*10/);
  assert.match(css, /--mg-z-shell:\s*100/);
  assert.match(css, /--mg-z-popover:\s*500/);
  assert.match(css, /--mg-z-modal:\s*50000/);
  assert.match(css, /--mg-z-critical:\s*999999/);
  assert.match(css, /\.confirm-overlay,[\s\S]*z-index:\s*var\(--mg-z-modal\)/);
  assert.match(css, /\.gate-critical-alert[\s\S]*z-index:\s*var\(--mg-z-critical\)/);
});

test('mobile navigation sheet stays above its non-blurring outside-tap scrim', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const mobileStart = css.indexOf('@media (max-width: 767px)');
  assert.ok(mobileStart >= 0, 'mobile shell media query must exist');
  const mobile = css.slice(mobileStart);

  assert.match(mobile, /#gate-mobile-menu-scrim\s*\{[\s\S]*z-index:\s*var\(--mg-z-popover\)[\s\S]*backdrop-filter:\s*none[\s\S]*-webkit-backdrop-filter:\s*none/);
  assert.match(mobile, /#gate-mobile-nav-sheet\s*\{[\s\S]*z-index:\s*var\(--mg-z-modal\)[\s\S]*isolation:\s*isolate[\s\S]*translate3d\(0,\s*0,\s*0\)[\s\S]*touch-action:\s*manipulation/);
  assert.match(mobile, /gate-mobile-drawer-open #gate-mobile-menu-scrim\s*\{[\s\S]*pointer-events:\s*auto/);
  assert.match(mobile, /gate-mobile-nav-sheet\.gate-mobile-sheet-open[\s\S]*pointer-events:\s*auto/);
});

test('Processing modal tablet reachability uses contained scrolling and sticky action rails', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const tabletStart = css.indexOf('@media (min-width: 768px) and (max-width: 1199px)');
  const mobileStart = css.indexOf('@media (max-width: 767px)', tabletStart);
  assert.ok(tabletStart >= 0);
  const tablet = css.slice(tabletStart, mobileStart > tabletStart ? mobileStart : undefined);

  assert.match(tablet, /#dorm-modal\.confirm-overlay:not\(\.hidden\)[\s\S]*align-items:\s*flex-start/);
  assert.match(tablet, /#dorm-modal \.gate-processing-workspace[\s\S]*max-height:\s*calc\(100dvh - 1\.5rem\)/);
  assert.match(tablet, /#dorm-modal \.gate-processing-workspace[\s\S]*overflow-y:\s*auto/);
  assert.match(tablet, /scrollbar-gutter:\s*stable/);
  assert.match(tablet, /\.gate-processing-workspace__header,[\s\S]*position:\s*sticky/);
  assert.match(tablet, /\.gate-processing-workspace__footer[\s\S]*bottom:\s*0/);
});

test('coarse-pointer tablet Processing retains route-owned scrolling and touch stability through 1366px', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const start = css.indexOf('@media (any-pointer: coarse) and (min-width: 768px) and (max-width: 1366px) and (min-height: 561px)');
  assert.ok(start >= 0, 'coarse-pointer tablet restoration media query must exist');
  const nextMedia = css.indexOf('@media ', start + 8);
  const tablet = css.slice(start, nextMedia > start ? nextMedia : undefined);

  assert.doesNotMatch(tablet, /gate-app-shell-mobile/, 'tablet recovery must not depend on the legacy mobile-shell class');
  assert.match(tablet, /html\s*\{[\s\S]*overscroll-behavior-y:\s*none/);
  assert.match(tablet, /body\.gate-app-shell-ready\[data-gate-active-page=['"]processing['"]\][\s\S]*height:\s*100dvh[\s\S]*overflow-y:\s*hidden/);
  assert.match(tablet, /#page-processing\.active[\s\S]*display:\s*flex[\s\S]*height:\s*100dvh[\s\S]*overflow-y:\s*auto[\s\S]*overscroll-behavior-y:\s*contain/);
  assert.match(tablet, /\.security-banner-fixed,[\s\S]*position:\s*fixed[\s\S]*translate3d\(0,\s*0,\s*0\)/);
  assert.match(tablet, /#gate-mobile-nav-sheet[\s\S]*overscroll-behavior:\s*contain[\s\S]*-webkit-overflow-scrolling:\s*touch/);
  assert.match(tablet, /#page-processing \.proc-card:hover[\s\S]*transform:\s*none/);
  assert.match(tablet, /#dorm-modal\.confirm-overlay:not\(\.hidden\)[\s\S]*overflow-y:\s*auto/);
  assert.match(tablet, /#dorm-modal \.gate-processing-workspace__header,[\s\S]*position:\s*sticky/);
  assert.match(tablet, /#dorm-modal \.gate-processing-workspace__footer[\s\S]*position:\s*sticky/);
});

test('short-height Processing workspace retains compact controls without losing action reachability', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const start = css.indexOf('@media (max-height: 800px) and (min-width: 761px)');
  assert.ok(start >= 0, 'short-height Processing restoration media query must exist');
  const nextMedia = css.indexOf('@media ', start + 8);
  const compact = css.slice(start, nextMedia > start ? nextMedia : undefined);

  assert.match(compact, /#dorm-modal \.gate-processing-workspace[\s\S]*gap:\s*\.5rem \.75rem[\s\S]*padding:\s*\.72rem/);
  assert.match(compact, /\.gate-processing-workspace__header[\s\S]*min-height:\s*3\.2rem[\s\S]*padding:\s*\.48rem \.68rem/);
  assert.match(compact, /#modal-dorm-name[\s\S]*font-size:\s*clamp\(1\.7rem,\s*3vw,\s*2\.2rem\)/);
  assert.match(compact, /\.phase-btn[\s\S]*min-height:\s*2\.3rem/);
});

test('touch Input workflow retains stacked setup controls and a controlled scrollable dorm matrix', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const start = css.indexOf('@media (max-width: 900px), (pointer: coarse) and (max-width: 1024px)');
  assert.ok(start >= 0, 'touch Input restoration media query must exist');
  const nextMedia = css.indexOf('@media ', start + 8);
  const touch = css.slice(start, nextMedia > start ? nextMedia : undefined);

  assert.match(touch, /#page-input > \.flex-shrink-0\.px-4\.py-3 > \.flex[\s\S]*display:\s*grid[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(touch, /#wg-batch-input,[\s\S]*#init-wg-btn[\s\S]*min-height:\s*46px/);
  assert.match(touch, /#init-wg-btn[\s\S]*width:\s*100%/);
  assert.match(touch, /#receiving-windows-panel,[\s\S]*#archive-receiving-windows-panel[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(touch, /#receiving-windows-panel input,[\s\S]*min-height:\s*44px/);
  assert.match(touch, /#batch-grid-wrapper[\s\S]*overflow-x:\s*auto[\s\S]*-webkit-overflow-scrolling:\s*touch/);
  assert.match(touch, /#batch-grid-wrapper > div[\s\S]*min-width:\s*860px/);
  assert.match(touch, /#batch-rows-container input,[\s\S]*#batch-rows-container select,[\s\S]*#batch-rows-container button[\s\S]*min-height:\s*42px/);
});

test('narrow fine-pointer desktops keep a single fixed command shell and non-wrapping route lane', async () => {
  const css = await source('public/css/military-glass-terminal.css');

  assert.match(css, /\.app-nav,[\s\S]*position:\s*fixed/);
  assert.match(css, /@media \(hover:\s*hover\) and \(pointer:\s*fine\) and \(min-width:\s*768px\) and \(max-width:\s*1279px\)/);
  assert.match(css, /#main-nav-menu\.nav-group-left[\s\S]*flex-flow:\s*row nowrap[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /#main-nav-menu\.nav-group-left > \.nav-btn[\s\S]*flex:\s*0 0 auto/);
});

test('GateAppShell owns durable page URLs without adding a second routing runtime', async () => {
  const [shell, guard, middleware, budgetText] = await Promise.all([
    source('public/js/gate-app-shell-controller.js'),
    source('public/js/gate-permission-guard.js'),
    source('functions/_middleware.js'),
    source('docs/build-2/ACTIVE_RUNTIME_BUDGET.json')
  ]);
  const budget = JSON.parse(budgetText);

  for (const [page, path] of [
    ['board','/board/'],
    ['airport','/airport/'],
    ['input','/input/'],
    ['processing','/processing/'],
    ['archives','/archives/'],
    ['squadron','/squadron-board/']
  ]) {
    assert.ok(shell.includes(`${page}: '${path}'`), `${page} must have a canonical browser path`);
    assert.ok(middleware.includes(`'${path}'`), `${path} must be recognized server-side`);
  }

  assert.match(shell, /window\.history\.pushState\(state, '', path\)/, 'normal page navigation must create browser history');
  assert.match(shell, /window\.history\.replaceState\(state, '', path\)/, 'authorization/canonical fallback must replace browser history');
  assert.match(shell, /window\.addEventListener\('popstate', handlePopState\)/, 'Back and Forward must be owned by GateAppShell');
  assert.match(shell, /go\(requested, \{ silent: true, history: 'none' \}\)/, 'Back/Forward must not recursively create history entries');
  assert.match(shell, /window\.location\.pathname === path/, 'reselecting the active route must not duplicate history entries');
  assert.match(shell, /document\.body\?\.dataset\.gateInitialRoute/, 'server-selected refresh route must hydrate the client shell');
  assert.match(shell, /document\.body\?\.dataset\.gateSessionRole/, 'server-verified role must be available before async session hydration');
  assert.match(guard, /document\.body\?\.dataset\.gateSessionRole/, 'permission guard must use the same verified role during initial hydration');
  assert.doesNotMatch(shell, /localStorage[\s\S]{0,120}(active|route)|sessionStorage[\s\S]{0,120}(active|route)/i, 'route continuity must come from the URL, not browser-storage state');

  const routeScript = '/js/gate-app-shell-controller.js?v=repo-audit-20260922';
  assert.ok(middleware.includes(routeScript), 'middleware must ship the cache-busted canonical shell controller');
  assert.ok(budget.currentDirectScripts.includes(routeScript), 'runtime inventory must match the shell route version');
  assert.equal((budget.currentDirectScripts.filter(item => item.includes('gate-app-shell-controller.js')).length),1, 'routing must extend the one existing shell owner');
});

test('fullscreen Active Bus cards remain bounded non-stretching tiles', async () => {
  const css = await source('public/css/military-glass-terminal.css');

  assert.match(css, /body\.fullscreen-board #page-board #active-buses[\s\S]*flex-flow:\s*row wrap/);
  assert.match(css, /gate-component-active-bus-card[\s\S]*flex:\s*0 0 clamp\(280px,\s*17vw,\s*320px\)/);
  assert.match(css, /gate-component-active-bus-card[\s\S]*width:\s*clamp\(280px,\s*17vw,\s*320px\)/);
  assert.match(css, /gate-component-active-bus-card[\s\S]*max-width:\s*clamp\(280px,\s*17vw,\s*320px\)/);
});

test('Processing BAND designator uses rounded-rectangle geometry', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const marker = css.match(/#page-processing \.proc-card\.border-band > \.text-xl\.font-black\.font-tabular::before\s*\{([\s\S]*?)\}/);
  assert.ok(marker, 'Processing BAND marker selector must exist');
  assert.match(marker[1], /content:\s*\"BAND\"/);
  assert.match(marker[1], /border-radius:\s*var\(--mg-radius-sm\)/);
  assert.doesNotMatch(marker[1], /border-radius:\s*var\(--mg-radius-pill\)/);
});

test('middleware delivers one canonical stylesheet and no retired CSS assets', async () => {
  const middleware = await source('functions/_middleware.js');

  assert.match(middleware, /military-glass-terminal\.css\?v=military-glass-terminal-20260922-archives1/);
  assert.equal((middleware.match(/<link rel="stylesheet"/g) || []).length, 1);
  assert.doesNotMatch(middleware, /gate-ui-ownership-correction\.css|gate-fullscreen-board-contract\.css|gate-tablet-shell\.css|gate-mobile-corrective\.css/);
});


test('Squadron SITREP ships current canonical assets and preserves lightweight communication UI', async () => {
  const version = 'military-glass-terminal-20260922-archives1';
  const url = `/css/military-glass-terminal.css?v=${version}`;
  const scriptUrl = '/js/prc-dash-final-audit.js?v=squadron-sitrep-20260922-live-sync1';
  const [middleware, standalone, budgetText, stack, css, controller, index] = await Promise.all([
    source('functions/_middleware.js'), source('public/squadron/index.html'),
    source('docs/build-2/ACTIVE_RUNTIME_BUDGET.json'), source('docs/ACTIVE_RUNTIME_STACK.md'),
    source('public/css/military-glass-terminal.css'), source('public/js/prc-dash-final-audit.js'),
    source('public/index.html')
  ]);
  const budget = JSON.parse(budgetText);
  assert.ok(middleware.includes(url), 'instructor middleware must reference fresh CSS');
  assert.ok(standalone.includes(url), 'standalone must use the same CSS version');
  assert.ok(middleware.includes(scriptUrl), 'instructor middleware must reference fresh Squadron controller');
  assert.ok(standalone.includes(scriptUrl), 'standalone must use the same Squadron controller version');
  assert.deepEqual(budget.currentDirectStyles, [url]);
  assert.ok(budget.currentDirectScripts.includes(scriptUrl));
  assert.ok(stack.includes(url), 'runtime documentation must match');
  assert.equal((middleware.match(/<link rel="stylesheet"/g) || []).length, 1);
  assert.doesNotMatch(middleware + standalone, /military-glass-terminal-20260915-bandshape1|military-glass-terminal-20260922-squadron-sitrep1|squadron-sitrep-20260921/);

  const squadronCss = css.slice(css.indexOf('/* GATE SQUADRON SITREP'));
  assert.ok(squadronCss.startsWith('/* GATE SQUADRON SITREP'), 'scoped Squadron rules must exist');
  assert.match(squadronCss, /#page-squadron \.gate-squadron-topbar\s*\{[^}]*display:grid/);
  assert.match(squadronCss, /#page-squadron \.gate-squadron-metrics\s*\{[^}]*grid-template-areas:none;[^}]*margin:0/);
  assert.match(squadronCss, /#page-squadron \.gate-squadron-tempo-options\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(squadronCss, /#page-squadron \.gate-squadron-columns\s*\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(squadronCss, /#page-squadron \.gate-squadron-dorm\s*\{[^}]*background:var\(--mg-surface-strong\)/);
  assert.match(squadronCss, /#page-squadron \.gate-info\s*\{[^}]*border:0;[^}]*font-size:17px/);

  assert.ok(controller.includes('>ⓘ</button>'), 'tooltips use the requested information glyph');
  assert.ok(controller.includes('id="squadron-metric-local" class="gate-squadron-value">--:--:--</div>'));
  assert.ok(!controller.includes('id="squadron-metric-local" class="gate-squadron-value is-time"'));
  assert.ok(squadronCss.includes('display:flex; flex-direction:column; align-items:center;'), 'metric cards share one vertical layout');
  assert.ok(squadronCss.includes('margin-top:auto; padding-top:7px;'), 'metric values share bottom alignment');
  assert.ok(squadronCss.includes('.gate-squadron-value.is-time { font-size:clamp(24px,3.2vw,40px); }'), 'time values use the same point size as numeric values');
  assert.ok(!squadronCss.includes('.gate-squadron-value.is-time { font-size:17px; }'), 'mobile must not shrink time metrics independently');
  assert.ok(controller.includes('dispatched in the last 60 minutes'));
  assert.ok(!controller.includes('dispatched in the rolling last 60 minutes'));
  assert.ok(controller.includes('id="squadron-information-form"'));
  assert.ok(controller.includes("'X-Gate-Information': 'save'"));
  assert.ok(controller.includes('id="squadron-clear-notice"'), 'MTI editor exposes a Clear Live Update action');
  assert.ok(controller.includes("'X-Gate-Notice': 'clear'"), 'clear uses the protected Squadron notice endpoint');
  assert.ok(controller.includes("window.confirm('Clear the current Live Update?')"), 'clear requires intentional confirmation');
  assert.match(controller, /const cleared = Boolean\(notice\?\.cleared\)/, 'client consumes explicit durable clear state');
  assert.match(controller, /clearButton\.hidden = !editor \|\| !activeMessage/, 'clear is visible only to MTI editors when an active live update exists');
  assert.match(controller, /const unread = standalone\(\) && activeMessage/, 'a cleared revision cannot generate a Squadron unread alert');
  assert.ok(controller.includes("document.addEventListener('visibilitychange'"), 'Squadron Access refreshes when a background tab becomes active');
  assert.ok(controller.includes("window.addEventListener('focus', renderSquadronBoard)"), 'Squadron Access refreshes on window focus');
  assert.ok(controller.includes("window.addEventListener('pageshow', renderSquadronBoard)"), 'restored Squadron pages revalidate immediately');
  assert.match(controller, /displayNotice\(\{ week_group: activeWeek, notice: data\.notice \}\)/, 'clear response is rendered immediately without waiting for the next poll');
  assert.match(squadronCss, /\.gate-squadron-publish-actions\s*\{[^}]*display:grid;[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\);[^}]*gap:10px/, 'publish and clear controls use explicit equal-width spacing');
  assert.match(squadronCss, /\.gate-squadron-publish,[\s\S]*\.gate-squadron-clear\s*\{[^}]*min-height:42px;[^}]*padding:10px 14px;[^}]*white-space:nowrap/, 'publish and clear controls share stable padding and text geometry');
  assert.match(controller, /const nodes = new Map\(\)/, 'condensed dorm cards keep keyed DOM identity');
  assert.doesNotMatch(controller, /id="active-buses"/, 'no active bus strip on Squadron Board');

  const { onRequest } = await import('../../functions/_middleware.js');
  const { onRequestPost: login } = await import('../../functions/api/login.js');
  const env = { AUTH_SECRET:'css-delivery-test', MTI_USERNAME:'css-instructor', MTI_PASSWORD:'test-password' };
  const auth = await login({ env, request:new Request('https://gate.example/api/login', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({username:env.MTI_USERNAME,password:env.MTI_PASSWORD})
  }) });
  assert.equal(auth.status, 200);
  const cookie = auth.headers.get('set-cookie').split(';')[0];
  const response = await onRequest({ env,
    request:new Request('https://gate.example/board/', {headers:{Cookie:cookie}}),
    next:async () => new Response(index, {headers:{'Content-Type':'text/html; charset=UTF-8'}})
  });
  assert.equal(response.status,200);
  const html = await response.text();
  assert.equal(html.split(url).length-1,1, 'served HTML must inject one fresh stylesheet');
  assert.equal((html.match(/href="\/css\/military-glass-terminal\.css\?v=/g)||[]).length,1);
  assert.ok(html.includes(scriptUrl));
  assert.ok(!html.includes('military-glass-terminal-20260915-bandshape1'));
});


test('Squadron Access requires a non-dismissible acknowledgment once per authenticated Squadron login', async () => {
  const [standalone, gate, css, login] = await Promise.all([
    source('public/squadron/index.html'),
    source('public/js/gate-squadron-access-gate.js'),
    source('public/css/military-glass-terminal.css'),
    source('public/login/index.html')
  ]);

  assert.match(standalone, /gate-squadron-access-gate\.js\?v=squadron-access-gate-20260922-authsession1/);
  assert.match(login, /window\.location\.replace\(destinationForRole\(session\.role\)\)/);

  assert.match(gate, /gate-squadron-standalone/);
  assert.match(gate, /sessionStorage/);
  assert.match(gate, /gate-squadron-access-acknowledged/);
  assert.match(gate, /meta\[name="gate-auth-session"\]/);
  assert.match(gate, /stored\(ACK_KEY\) === SESSION_MARKER/);
  assert.match(gate, /page\.inert = true/);
  assert.match(gate, /page\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(gate, /event\.key === 'Escape'/);
  assert.match(gate, /event\.preventDefault\(\)/);
  assert.doesNotMatch(gate, /aria-label=["']Close|>\s*[×X]\s*</);

  assert.match(gate, /Attention:/);
  assert.match(gate, /Gateway Arrival Tracking Environment \(GATE\) is currently in testing/);
  assert.match(gate, /DO NOT INPUT CUI \/ OR PII information into this system/);
  assert.match(gate, /not disseminate usernames and passwords/);
  assert.match(gate, /U\.S\. Government \(USG\) Information System \(IS\)/);
  assert.match(gate, /routinely monitors, records, and audits actions/);
  assert.match(gate, /Unauthorized use of this system is strictly prohibited/);
  assert.match(gate, /no reasonable expectation of privacy/);

  assert.match(gate, /Agree &amp; Continue/);
  assert.match(gate, />Cancel</);
  assert.match(gate, /store\(ACK_KEY, SESSION_MARKER\)/);
  assert.match(gate, /page\.inert = false/);
  assert.match(gate, /overlay\.remove\(\)/);
  assert.match(gate, /fetch\('\/api\/logout', \{ method: 'POST', credentials: 'same-origin' \}\)/);
  assert.match(gate, /window\.location\.replace\('\/login\/'\)/);

  assert.match(css, /gate-squadron-access-pending #page-squadron[\s\S]*filter:blur\(8px\)[\s\S]*pointer-events:none/);
  assert.match(css, /\.gate-squadron-access-gate[\s\S]*position:fixed[\s\S]*inset:0[\s\S]*z-index:var\(--mg-z-critical\)/);
  assert.match(css, /backdrop-filter:blur\(4px\)/);

  const { onRequest } = await import('../../functions/_middleware.js');
  const { onRequestPost: authenticate } = await import('../../functions/api/login.js');
  const env = {
    AUTH_SECRET:'squadron-ack-session-test',
    SQUADRON_USERNAME:'sq-test',
    SQUADRON_PASSWORD:'sq-password'
  };
  const loginOnce = async () => {
    const response = await authenticate({
      env,
      request:new Request('https://gate.example/api/login', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({username:env.SQUADRON_USERNAME,password:env.SQUADRON_PASSWORD})
      })
    });
    assert.equal(response.status,200);
    return response.headers.get('set-cookie').split(';')[0];
  };
  const serveSquadron = async cookie => onRequest({
    env,
    request:new Request('https://gate.example/squadron/', {headers:{Cookie:cookie}}),
    next:async () => new Response(standalone, {headers:{'Content-Type':'text/html; charset=UTF-8'}})
  });

  const firstCookie = await loginOnce();
  const firstPage = await serveSquadron(firstCookie);
  assert.equal(firstPage.headers.get('cache-control'),'no-store');
  const firstHtml = await firstPage.text();
  const firstMarker = firstHtml.match(/<meta name="gate-auth-session" content="([^"]+)">/)?.[1];
  assert.ok(firstMarker, 'authenticated Squadron HTML must include an auth-session marker');

  const sameSessionPage = await serveSquadron(firstCookie);
  const sameSessionMarker = (await sameSessionPage.text()).match(/<meta name="gate-auth-session" content="([^"]+)">/)?.[1];
  assert.equal(sameSessionMarker, firstMarker, 'refresh/navigation in the same authenticated login keeps the same acknowledgment marker');

  await new Promise(resolve => setTimeout(resolve, 2));
  const secondCookie = await loginOnce();
  const secondPage = await serveSquadron(secondCookie);
  const secondMarker = (await secondPage.text()).match(/<meta name="gate-auth-session" content="([^"]+)">/)?.[1];
  assert.ok(secondMarker && secondMarker !== firstMarker, 'a new authenticated login must receive a new acknowledgment marker');
});

test('Archives use a full-width read-only historical workspace and exact Letter landscape reports', async () => {
  const [index, controller, css, middleware, budgetText] = await Promise.all([
    source('public/index.html'),
    source('public/js/gate-archive-controller.js'),
    source('public/css/military-glass-terminal.css'),
    source('functions/_middleware.js'),
    source('docs/build-2/ACTIVE_RUNTIME_BUDGET.json')
  ]);
  const budget = JSON.parse(budgetText);

  assert.match(index, /id="gate-archive-workspace" class="gate-archive-workspace"/);
  assert.match(index, /const LIVE_API_URL = '\/api\/records\?scope=live'/);
  assert.match(index, /data-gate-legacy-arrivals-compat="true"/);
  assert.match(index, /function renderArchives\(\) \{\s*return window\.GateArchiveController\?\.renderArchives\?\.\(\);\s*\}/, 'legacy inline archive renderer must delegate to the canonical workspace');
  assert.doesNotMatch(index, /function renderArchives\(\)[\s\S]{0,2200}Right-click to edit archived week group/, 'legacy raw archive cards must not remain active');
  assert.doesNotMatch(index, /id="page-archives"[\s\S]{0,180}max-w-3xl/);

  assert.match(controller, /archiveApi\('\/api\/archives'\)/);
  assert.ok(controller.includes("archiveApi(`/api/archives?id=${encodeURIComponent(key)}`)"));
  assert.match(controller, /Read-only presentation\. The stored D1 archive and any lossless source snapshot are not rewritten by this view\./);
  assert.match(controller, /groupedArchiveHtml\(visible\)/);
  assert.match(controller, /selectArchive\(card\.dataset\.archiveId\)/);
  assert.doesNotMatch(controller, /if \(card\) \{\s*openArchiveEditModalCanonical/);

  assert.match(controller, /String\(bus\?\.status \|\| ''\)\.toLowerCase\(\) === 'arrived'/);
  assert.match(controller, /completed\.filter\(bus => inWindow\(bus\.arrived_at, start, end\)\)/);
  assert.match(controller, /@page\{size:11in 8\.5in;margin:\.35in\}/);
  assert.match(controller, /\.report-page\{width:10\.3in;height:7\.8in/);
  assert.match(controller, /thead\{display:table-header-group\}/);
  assert.match(controller, /break-inside:avoid;page-break-inside:avoid/);

  assert.match(css, /\.gate-archive-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(300px,\s*\.78fr\) minmax\(0,\s*2\.22fr\)/);
  assert.match(css, /\.gate-archive-metrics\s*\{[\s\S]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
  const archiveScript = '/js/gate-archive-controller.js?v=repo-audit-20260922';
  assert.ok(middleware.includes(archiveScript));
  assert.ok(budget.currentDirectScripts.includes(archiveScript));
});
