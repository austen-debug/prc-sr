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

function fullscreenContract(css) {
  const start = css.indexOf('13. FULLSCREEN COMMAND BOARD');
  const end = css.indexOf('14. RESPONSIVE MATRIX', start);
  assert.ok(start >= 0, 'fullscreen command-board contract must exist');
  assert.ok(end > start, 'fullscreen command-board contract must be bounded');
  return css.slice(start, end);
}

test('fullscreen separates telemetry from the Active Buses lane', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const fullscreen = fullscreenContract(css);

  assert.match(fullscreen, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(fullscreen, /grid-template-areas:[\s\S]*"metrics metrics metrics metrics"[\s\S]*"active active active active"/);
  assert.match(fullscreen, /gate-active-buses-block[\s\S]*grid-template-columns:\s*130px minmax\(0,\s*1fr\)/);
});

test('fullscreen telemetry remains distance-readable', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const fullscreen = fullscreenContract(css);

  assert.match(fullscreen, /metric-card[\s\S]*min-height:\s*clamp\(88px,\s*11vh,\s*126px\)/);
  assert.match(fullscreen, /metric-value[\s\S]*font-size:\s*clamp\(2\.2rem,\s*3\.15vw,\s*4\.3rem\)/);
  assert.match(css, /\.font-tabular,[\s\S]*font-variant-numeric:\s*tabular-nums/);
});

test('fullscreen Active Buses wraps bounded tiles without an internal horizontal scroller', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const fullscreen = fullscreenContract(css);

  assert.match(fullscreen, /#active-buses[\s\S]*display:\s*flex/);
  assert.match(fullscreen, /flex-flow:\s*row wrap/);
  assert.match(fullscreen, /justify-content:\s*flex-start/);
  assert.match(fullscreen, /#active-buses[\s\S]*overflow:\s*visible/);
  assert.doesNotMatch(fullscreen, /overflow-x:\s*auto/);
  assert.match(fullscreen, /flex:\s*0 0 clamp\(280px,\s*17vw,\s*320px\)/);
  assert.match(fullscreen, /width:\s*clamp\(280px,\s*17vw,\s*320px\)/);
  assert.match(fullscreen, /max-width:\s*clamp\(280px,\s*17vw,\s*320px\)/);
});

test('phone fullscreen converts metrics to a two-column posture and buses to full-width rows', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const mobileStart = css.indexOf('@media (max-width: 767px)');
  assert.ok(mobileStart >= 0);
  const mobile = css.slice(mobileStart);

  assert.match(mobile, /body\.fullscreen-board #page-board \.gate-metrics-container,[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(mobile, /body\.fullscreen-board #page-board #active-buses \.prc-bus-card,[\s\S]*flex-basis:\s*100%/);
  assert.match(mobile, /body\.fullscreen-board #page-board #active-buses \.prc-bus-card,[\s\S]*width:\s*100%/);
});
