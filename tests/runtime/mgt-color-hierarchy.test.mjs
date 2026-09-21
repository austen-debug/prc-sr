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

// Read a complete, bounded CSS declaration rather than assuming a following theme override.
function block(startNeedle) {
  const start = css.indexOf(startNeedle);
  assert.ok(start >= 0, `Missing CSS block start: ${startNeedle}`);
  const brace = css.indexOf('{', start + startNeedle.length);
  const end = css.indexOf('}', brace + 1);
  assert.ok(brace > start && end > brace, `Missing CSS declaration after: ${startNeedle}`);
  return css.slice(start, end + 1);
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

test('light theme keeps accessible blue interaction and separate green nominal state', () => {
  const start = css.indexOf('body.theme-light,');
  const end = css.indexOf('/* --------------------------------------------------------------------------\n   2. BASE', start);
  assert.ok(start >= 0 && end > start);
  const light = css.slice(start, end);
  assert.match(light, /--mg-accent:\s*#175c92\s*;/i);
  assert.match(light, /--mg-accent-rgb:\s*23,\s*92,\s*146\s*;/i);
  assert.match(light, /--mg-ok:\s*#12805a\s*;/i);
  assert.match(light, /--mg-ok-deep:\s*#0f6247\s*;/i);
});

test('navigation and focus continue to use the interaction accent', () => {
  const nav = block('.nav-btn.active,');
  assert.match(nav, /var\(--mg-accent\)/);
  assert.match(nav, /color:\s*var\(--mg-text\)/);

  const focus = block('input:focus-visible,');
  assert.match(focus, /var\(--mg-accent\)/);
});

test('primary telemetry typography uses text tokens while status indicators remain green', () => {
  const metrics = block('#page-board .metric-value,');
  assert.match(metrics, /color:\s*var\(--mg-text\)/);
  assert.doesNotMatch(metrics, /color:\s*var\(--mg-accent\)/);

  const busTitle = block('#page-board #active-buses .prc-bus-card-title');
  assert.match(busTitle, /color:\s*var\(--mg-text\)/);

  const statusDot = block('.status-dot,');
  assert.match(statusDot, /background:\s*var\(--mg-ok\)/);
  assert.match(css, /--mg-glow-ok:\s*0 0 10px rgba\(var\(--mg-ok-rgb\)/);

  const openStatus = block('.gate-dorm-state-open .gate-dorm-status,');
  assert.match(openStatus, /var\(--mg-ok-rgb\)/);
  assert.match(openStatus, /color:\s*var\(--mg-ok-ink\)/);
  assert.match(css, /--mg-ok-ink:\s*#3fd08c/);
});

test('committed workflow actions use blue while semantic status badges remain green', () => {
  assert.match(indexHtml, /onclick="saveAssignedAirman\(\)"[\s\S]*?style="background:var\(--blue\);"/);
  assert.match(indexHtml, /onclick="saveLoad\(\)"[\s\S]*?style="background:var\(--blue\);"/);
  assert.match(processing, /data-processing-action="open-dorm"[\s\S]*?style="background:var\(--blue\);">OPEN DORM/);

  assert.match(processing, />OPEN<\/span>/);
  assert.match(processing, /style="background:var\(--green\);">OPEN<\/span>/);
});

test('dorm progress uses nominal green, while female and service identity contracts remain intact', () => {
  const progress = block('.gate-dorm-progress-fill {');
  assert.match(progress, /background:\s*linear-gradient\(90deg,\s*var\(--mg-ok-deep\)/);
  assert.match(progress, /var\(--mg-ok\)/);
  const full = block('.gate-dorm-card.is-full .gate-dorm-progress-fill,');
  assert.match(full, /background:\s*linear-gradient\(90deg,\s*var\(--mg-ok-deep\),\s*var\(--mg-ok\)\)/);

  assert.match(css, /#page-processing #proc-dorm-grid \.proc-card\.border-female[\s\S]*border-color:\s*var\(--gate-flag-female-red\)/);
  assert.match(css, /\.proc-card\.border-space-force[\s\S]*content:\s*"SPACE FORCE"/);
  assert.match(css, /\.proc-card\.border-band[\s\S]*content:\s*"BAND"/);
  assert.match(css, /\.gate-dorm-flag-chip\.flag-band\s*\{\s*color:\s*var\(--gate-flag-band-green\)/);
  assert.match(css, /\.gate-dorm-flag-chip\.flag-space-force\s*\{\s*color:\s*var\(--gate-flag-space-force-bluebird\)/);
});
