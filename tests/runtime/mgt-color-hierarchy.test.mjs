import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const css = await readFile(resolve(root, 'public/css/military-glass-terminal.css'), 'utf8');
const indexHtml = await readFile(resolve(root, 'public/index.html'), 'utf8');
const processing = await readFile(resolve(root, 'public/js/gate-processing-controller.js'), 'utf8');

function block(startNeedle, endNeedle) {
  const start = css.indexOf(startNeedle);
  assert.ok(start >= 0, `Missing CSS block start: ${startNeedle}`);
  const end = css.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(end > start, `Missing CSS block end after: ${startNeedle}`);
  return css.slice(start, end);
}

test('interaction accent is soft blue while nominal status remains green', () => {
  assert.match(css, /--mg-accent:\s*#58b9dd\s*;/i);
  assert.match(css, /--mg-accent-rgb:\s*88,\s*185,\s*221\s*;/i);
  assert.match(css, /--mg-accent-deep:\s*#2d7490\s*;/i);
  assert.match(css, /--mg-ok:\s*#3fd08c\s*;/i);
  assert.match(css, /--mg-ok-rgb:\s*63,\s*208,\s*140\s*;/i);
  assert.match(css, /--mg-ok-deep:\s*#21845c\s*;/i);
  assert.match(css, /--green:\s*var\(--mg-ok-deep\)\s*;/);
  assert.match(css, /--green-bright:\s*var\(--mg-ok\)\s*;/);
});

test('light theme keeps blue interaction and separate green nominal state', () => {
  const light = block('body.theme-light,', '/* --------------------------------------------------------------------------\n   2. BASE');
  assert.match(light, /--mg-accent:\s*#2f6f8a\s*;/i);
  assert.match(light, /--mg-accent-rgb:\s*47,\s*111,\s*138\s*;/i);
  assert.match(light, /--mg-ok:\s*#12805a\s*;/i);
  assert.match(light, /--mg-ok-deep:\s*#0f6247\s*;/i);
});

test('navigation and focus continue to use the interaction accent', () => {
  const nav = block('.nav-btn.active,', 'body.theme-light .nav-btn.active,');
  assert.match(nav, /var\(--mg-accent\)/);
  assert.match(nav, /color:\s*var\(--mg-text\)/);

  const focus = block('input:focus-visible,', 'button,\n.button,');
  assert.match(focus, /var\(--mg-accent\)/);
});

test('primary telemetry typography is white while status indicators remain green', () => {
  const metrics = block('#page-board .metric-value,', 'body.theme-light #page-board .metric-value,');
  assert.match(metrics, /color:\s*var\(--mg-text\)/);
  assert.doesNotMatch(metrics, /color:\s*var\(--mg-accent\)/);

  const busTitle = block('#page-board #active-buses .prc-bus-card-title', 'body.theme-light #page-board #active-buses .prc-bus-card-title');
  assert.match(busTitle, /color:\s*var\(--mg-text\)/);

  const statusDot = block('.status-dot,', 'body.theme-light .status-dot,');
  assert.match(statusDot, /background:\s*var\(--mg-ok\)/);
  assert.match(statusDot, /var\(--mg-ok-rgb\)/);

  const openStatus = block('.gate-dorm-state-open .gate-dorm-status,', 'body.theme-light .gate-dorm-state-open .gate-dorm-status,');
  assert.match(openStatus, /var\(--mg-ok-rgb\)/);
  assert.match(openStatus, /color:\s*var\(--mg-ok\)/);
});

test('committed workflow actions use blue while semantic status badges remain green', () => {
  assert.match(indexHtml, /onclick="saveAssignedAirman\(\)"[\s\S]*?style="background:var\(--blue\);"/);
  assert.match(indexHtml, /onclick="saveLoad\(\)"[\s\S]*?style="background:var\(--blue\);"/);
  assert.match(processing, /data-processing-action="open-dorm"[\s\S]*?style="background:var\(--blue\);">OPEN DORM/);

  assert.match(processing, />OPEN<\/span>/);
  assert.match(processing, /style="background:var\(--green\);">OPEN<\/span>/);
});

test('dorm progress uses nominal green, while female and service identity contracts remain intact', () => {
  const progress = block('.gate-dorm-progress-fill {', '.gate-dorm-card.is-over .gate-dorm-progress-fill,');
  assert.match(progress, /background:\s*var\(--mg-ok-deep\)/);
  assert.match(progress, /background:\s*var\(--mg-ok\)/);

  assert.match(css, /#page-processing #proc-dorm-grid \.proc-card\.border-female[\s\S]*border-color:\s*var\(--gate-flag-female-red\)/);
  assert.match(css, /\.proc-card\.border-space-force[\s\S]*content:\s*"SPACE FORCE"/);
  assert.match(css, /\.proc-card\.border-band[\s\S]*content:\s*"BAND"/);
  assert.match(css, /\.gate-dorm-flag-chip\.flag-band\s*\{\s*color:\s*var\(--gate-flag-band-green\)/);
  assert.match(css, /\.gate-dorm-flag-chip\.flag-space-force\s*\{\s*color:\s*var\(--gate-flag-space-force-bluebird\)/);
});
