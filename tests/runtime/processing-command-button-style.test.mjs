import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = path => readFile(resolve(root, path), 'utf8');

test('Processing modal uses the shared command family for exactly the requested static controls', async () => {
  const html = await source('public/index.html');
  const modalStart = html.indexOf('<div id="dorm-modal"');
  const modalEnd = html.indexOf('<!-- End Dorm Processing Modal -->', modalStart);
  assert.ok(modalStart >= 0 && modalEnd > modalStart);
  const modal = html.slice(modalStart, modalEnd);
  assert.match(modal, /onclick="saveAssignedAirman\(\)"[\s\S]*gate-processing-command--commit[\s\S]*gate-processing-command__label">SAVE<\/span>/);
  assert.match(modal, /onclick="setLoadFull\(\)" class="gate-processing-command gate-processing-command--shortcut"/);
  assert.match(modal, /onclick="saveLoad\(\)" class="gate-processing-command gate-processing-command--commit"/);
  assert.match(modal, /gate-processing-command__label">SAVE LOAD<\/span>/);
  assert.match(modal, /id="modal-load-input"/);
  assert.match(modal, /id="modal-action-section"/);
});

test('Processing dynamic actions preserve state routing, roles and record IDs', async () => {
  const controller = await source('public/js/gate-processing-controller.js');
  assert.match(controller, /data-processing-action="reopen-dorm" data-dorm-id="\$\{esc\(id\)\}" class="gate-processing-command gate-processing-command--reopen"/);
  assert.match(controller, /data-processing-action="edit-record" data-dorm-id="\$\{esc\(id\)\}" class="gate-processing-command gate-processing-command--secondary"/);
  assert.match(controller, /if \(!isInstructor\(\)\)/);
  assert.match(controller, /if \(action\.dataset\.processingAction === 'reopen-dorm'\) reopenDormCanonical\(id\)/);
  assert.match(controller, /if \(action\.dataset\.processingAction === 'edit-record'\) openDormEditModalCanonical\(event, id\)/);
});

test('Assignment adapter updates nested label without replacing live save button DOM', async () => {
  const adapter = await source('public/js/prc-dash-auditorium-location.js');
  assert.match(adapter, /function setAssignmentSaveLabel\(button, text\)/);
  assert.match(adapter, /button\.querySelector\('\.gate-processing-command__label'\)/);
  assert.match(adapter, /setAssignmentSaveLabel\(button, 'SAVING\.\.\.'\)/);
  assert.match(adapter, /setAssignmentSaveLabel\(button, originalText\)/);
  assert.match(adapter, /button\.disabled = true/);
  assert.match(adapter, /button\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(adapter, /button\.removeAttribute\('aria-busy'\)/);
  assert.match(adapter, /controller\.updateDorm\(payload, \{ source: 'processing-assignment-location-update' \}\)/);
});

test('Button styling is scoped to existing stylesheet and respects theme, focus and motion', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  assert.match(css, /#dorm-modal \.gate-processing-command \{/);
  assert.match(css, /#dorm-modal \.gate-processing-command::before \{/);
  for (const variant of ['commit', 'shortcut', 'reopen', 'secondary']) {
    assert.ok(css.includes('#dorm-modal .gate-processing-command--' + variant));
  }
  assert.match(css, /body\.theme-light #dorm-modal \.gate-processing-command--commit/);
  assert.match(css, /#dorm-modal \.gate-processing-command:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.doesNotMatch(css, /^\s*@import\s+/m);
});
