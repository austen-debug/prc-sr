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

test('tablet workspaces use independent contained scroll lanes', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const tabletStart = css.indexOf('@media (min-width: 768px) and (max-width: 1199px)');
  const mobileStart = css.indexOf('@media (max-width: 767px)', tabletStart);
  const tablet = css.slice(tabletStart, mobileStart > tabletStart ? mobileStart : undefined);

  assert.match(tablet, /#page-board \.dorm-column,[\s\S]*max-height:\s*calc\(100dvh - var\(--mg-shell-top\) - 2rem\)/);
  assert.match(tablet, /overflow-y:\s*auto/);
  assert.match(tablet, /scrollbar-gutter:\s*stable/);
  assert.match(tablet, /overscroll-behavior:\s*contain/);
});

test('narrow desktops retain a single fixed command shell with scrollable nav lane', async () => {
  const css = await source('public/css/military-glass-terminal.css');

  assert.match(css, /\.app-nav,[\s\S]*position:\s*fixed/);
  assert.match(css, /\.app-nav \.nav-group-left,[\s\S]*display:\s*flex/);
  assert.match(css, /\.app-nav \.nav-group-left,[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /@media \(min-width:\s*768px\) and \(max-width:\s*1199px\)[\s\S]*grid-template-columns:\s*112px minmax\(0,\s*1fr\) max-content/);
});

test('fullscreen Active Bus cards remain bounded non-stretching tiles', async () => {
  const css = await source('public/css/military-glass-terminal.css');

  assert.match(css, /body\.fullscreen-board #page-board #active-buses[\s\S]*flex-flow:\s*row wrap/);
  assert.match(css, /gate-component-active-bus-card[\s\S]*flex:\s*0 0 clamp\(280px,\s*17vw,\s*320px\)/);
  assert.match(css, /gate-component-active-bus-card[\s\S]*width:\s*clamp\(280px,\s*17vw,\s*320px\)/);
  assert.match(css, /gate-component-active-bus-card[\s\S]*max-width:\s*clamp\(280px,\s*17vw,\s*320px\)/);
});

test('middleware delivers one canonical stylesheet and no retired CSS assets', async () => {
  const middleware = await source('functions/_middleware.js');

  assert.match(middleware, /military-glass-terminal\.css\?v=military-glass-terminal-20260914/);
  assert.equal((middleware.match(/<link rel="stylesheet"/g) || []).length, 1);
  assert.doesNotMatch(middleware, /gate-ui-ownership-correction\.css|gate-fullscreen-board-contract\.css|gate-tablet-shell\.css|gate-mobile-corrective\.css/);
});
