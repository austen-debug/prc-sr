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

  assert.match(middleware, /military-glass-terminal\.css\?v=military-glass-terminal-20260922-squadron-info2/);
  assert.equal((middleware.match(/<link rel="stylesheet"/g) || []).length, 1);
  assert.doesNotMatch(middleware, /gate-ui-ownership-correction\.css|gate-fullscreen-board-contract\.css|gate-tablet-shell\.css|gate-mobile-corrective\.css/);
});


test('Squadron SITREP ships current canonical assets and preserves lightweight communication UI', async () => {
  const version = 'military-glass-terminal-20260922-squadron-info2';
  const url = `/css/military-glass-terminal.css?v=${version}`;
  const scriptUrl = '/js/prc-dash-final-audit.js?v=squadron-sitrep-20260922-info2';
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
  assert.ok(controller.includes('dispatched in the last 60 minutes'));
  assert.ok(!controller.includes('dispatched in the rolling last 60 minutes'));
  assert.ok(controller.includes('id="squadron-information-form"'));
  assert.ok(controller.includes("'X-Gate-Information': 'save'"));
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
    request:new Request('https://gate.example/', {headers:{Cookie:cookie}}),
    next:async () => new Response(index, {headers:{'Content-Type':'text/html; charset=UTF-8'}})
  });
  assert.equal(response.status,200);
  const html = await response.text();
  assert.equal(html.split(url).length-1,1, 'served HTML must inject one fresh stylesheet');
  assert.equal((html.match(/href="\/css\/military-glass-terminal\.css\?v=/g)||[]).length,1);
  assert.ok(html.includes(scriptUrl));
  assert.ok(!html.includes('military-glass-terminal-20260915-bandshape1'));
});
