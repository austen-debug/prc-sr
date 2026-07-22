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

function desktopFullscreenContract(css) {
  const start = css.indexOf('@media (min-width: 768px)');
  const end = css.indexOf('\nbody.fullscreen-board #page-board .dorm-dashboard', start);
  assert.ok(start >= 0, 'fullscreen desktop media contract must exist');
  assert.ok(end > start, 'fullscreen desktop media contract must have a bounded section');
  return css.slice(start, end);
}

test('fullscreen desktop separates metrics from the Active Buses lane', async () => {
  const css = await source('public/css/gate-fullscreen-board-contract.css');
  const desktop = desktopFullscreenContract(css);

  assert.match(desktop, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(desktop, /grid-template-areas:[\s\S]*'arrived expected last local'[\s\S]*'active active active active'/);
  assert.match(desktop, /grid-template-rows:\s*var\(--gate-fullscreen-metric-height\) auto/);
});

test('fullscreen desktop metrics are distance-readable', async () => {
  const css = await source('public/css/gate-fullscreen-board-contract.css');
  const desktop = desktopFullscreenContract(css);

  assert.match(css, /--gate-fullscreen-metric-height:\s*clamp\(88px,\s*11vh,\s*126px\)/);
  assert.match(desktop, /metric-label[\s\S]*font-size:\s*clamp\(0\.72rem,\s*0\.82vw,\s*1\.05rem\)/);
  assert.match(desktop, /metric-value[\s\S]*font-size:\s*clamp\(2\.2rem,\s*3\.15vw,\s*4\.3rem\)/);
  assert.match(desktop, /font-variant-numeric:\s*tabular-nums/);
});

test('fullscreen desktop Active Buses uses a wrapping grid without an internal scrollbar', async () => {
  const css = await source('public/css/gate-fullscreen-board-contract.css');
  const desktop = desktopFullscreenContract(css);

  assert.match(desktop, /#active-buses[\s\S]*display:\s*grid\s*!important/);
  assert.match(desktop, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(/);
  assert.match(desktop, /#active-buses[\s\S]*overflow:\s*visible\s*!important/);
  assert.doesNotMatch(desktop, /flex-wrap:\s*nowrap/);
  assert.doesNotMatch(desktop, /overflow-x:\s*auto/);
});

test('fullscreen desktop bus cards expose all values at command-display scale', async () => {
  const css = await source('public/css/gate-fullscreen-board-contract.css');
  const desktop = desktopFullscreenContract(css);

  assert.match(desktop, /gate-component-active-bus-card[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(desktop, /gate-component-active-bus-card[\s\S]*min-height:\s*78px/);
  assert.match(desktop, /prc-bus-card-title[\s\S]*font-size:\s*clamp\(1rem,\s*1\.05vw,\s*1\.35rem\)/);
  assert.match(desktop, /prc-bus-card-dept[\s\S]*grid-column:\s*3 \/ 5/);
  assert.match(desktop, /prc-bus-card-line:nth-child\(5\)[\s\S]*grid-column:\s*4/);
});

test('wide TV posture receives an additional command-display scale floor', async () => {
  const css = await source('public/css/gate-fullscreen-board-contract.css');

  assert.match(css, /@media \(min-width:\s*1600px\) and \(min-height:\s*800px\)/);
  assert.match(css, /--gate-fullscreen-bus-card-min:\s*350px/);
  assert.match(css, /min-height:\s*86px\s*!important/);
});

test('phone fullscreen retains its separate two-by-two metric posture', async () => {
  const css = await source('public/css/gate-fullscreen-board-contract.css');
  const mobileStart = css.indexOf('@media (max-width: 767px)');
  assert.ok(mobileStart >= 0);
  const mobile = css.slice(mobileStart);

  assert.match(mobile, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(mobile, /'arrived expected'[\s\S]*'last local'[\s\S]*'active active'/);
});
