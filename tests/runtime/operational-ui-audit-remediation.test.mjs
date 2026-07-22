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

test('modal hierarchy remains above every phone and tablet shell layer', async () => {
  const css = await source('public/css/gate-ui-ownership-correction.css');

  assert.match(css, /--z-modal-backdrop:\s*13000/);
  assert.match(css, /--z-modal-window:\s*13010/);
  assert.match(css, /body\.gate-app-shell-ready \.confirm-overlay[\s\S]*z-index:\s*var\(--z-modal-backdrop\)\s*!important/);
  assert.match(css, /confirm-overlay > \.modal-content[\s\S]*z-index:\s*var\(--z-modal-window\)\s*!important/);
});

test('Processing modal tablet reachability covers the complete shell range', async () => {
  const css = await source('public/css/gate-ui-ownership-correction.css');

  assert.match(css, /any-pointer:\s*coarse[\s\S]*min-width:\s*768px[\s\S]*max-width:\s*1366px/);
  assert.match(css, /#dorm-modal\.confirm-overlay:not\(\.hidden\)[\s\S]*overflow-y:\s*auto\s*!important/);
  assert.match(css, /#dorm-modal\.confirm-overlay:not\(\.hidden\)[\s\S]*max-height:\s*calc\(100dvh/);
  assert.match(css, /modal-content > \.flex\.justify-between\.items-center\.mb-4[\s\S]*position:\s*sticky\s*!important/);
  assert.match(css, /#modal-action-section[\s\S]*position:\s*sticky\s*!important/);
  assert.match(css, /mb-4 > button[\s\S]*min-width:\s*44px\s*!important[\s\S]*min-height:\s*44px\s*!important/);
});

test('narrow fine-pointer desktops keep a single-row navigation shell', async () => {
  const css = await source('public/css/gate-ui-ownership-correction.css');

  assert.match(css, /hover:\s*hover[\s\S]*pointer:\s*fine[\s\S]*min-width:\s*768px[\s\S]*max-width:\s*1279px/);
  assert.match(css, /gate-app-shell-desktop \.app-nav\.command-header-bar[\s\S]*grid-template-rows:\s*54px\s*!important/);
  assert.match(css, /#main-nav-menu\.nav-group-left[\s\S]*flex-flow:\s*row nowrap\s*!important/);
  assert.match(css, /#main-nav-menu\.nav-group-left[\s\S]*overflow-x:\s*auto\s*!important/);
  assert.match(css, /#main-nav-menu\.nav-group-left > \.nav-btn[\s\S]*flex:\s*0 0 auto\s*!important/);
});

test('fullscreen Active Bus cards are exact-DOM bounded tiles', async () => {
  const css = await source('public/css/gate-ui-ownership-correction.css');

  assert.match(css, /--gate-command-bus-tile-width:\s*clamp\(280px,\s*17vw,\s*320px\)/);
  assert.match(css, /#active-buses\[data-owner='gate-status-board-controller'\][\s\S]*display:\s*flex\s*!important/);
  assert.match(css, /flex-flow:\s*row wrap\s*!important/);
  assert.match(css, /button\[data-component='active-bus-card'\]\.gate-component-active-bus-card[\s\S]*flex-grow:\s*0\s*!important/);
  assert.match(css, /button\[data-component='active-bus-card'\]\.gate-component-active-bus-card[\s\S]*flex-basis:\s*var\(--gate-command-bus-tile-width\)\s*!important/);
  assert.match(css, /button\[data-component='active-bus-card'\]\.gate-component-active-bus-card[\s\S]*min-width:\s*var\(--gate-command-bus-tile-width\)\s*!important/);
  assert.match(css, /button\[data-component='active-bus-card'\]\.gate-component-active-bus-card[\s\S]*max-width:\s*var\(--gate-command-bus-tile-width\)\s*!important/);
});

test('middleware advances both operational UI cache keys', async () => {
  const middleware = await source('functions/_middleware.js');

  assert.match(middleware, /gate-ui-ownership-correction\.css\?v=operational-ui-audit-20260721/);
  assert.match(middleware, /gate-fullscreen-board-contract\.css\?v=fullscreen-compact-bus-tiles-20260721/);
  assert.doesNotMatch(middleware, /gate-fullscreen-board-contract\.css\?v=fullscreen-desktop-status-20260714c/);
});
