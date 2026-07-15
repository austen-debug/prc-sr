import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  COMPONENT_NAMES,
  componentContracts,
  renderGateButton,
  renderGateDataTable,
  renderGateDialog,
  renderGateDormCard,
  renderGateFormField,
  renderGateNotification,
  renderGateSheet,
  validateComponentContracts
} from '../../../public/app/components/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, '../../..');

async function repositoryFile(path) {
  return readFile(resolve(repositoryRoot, path), 'utf8');
}

test('Phase 2B defines the twelve required foundational component contracts', () => {
  assert.equal(COMPONENT_NAMES.length, 12);
  assert.deepEqual(Object.keys(componentContracts).sort(), [...COMPONENT_NAMES].sort());
  assert.deepEqual(validateComponentContracts(), { valid: true, errors: [] });
});

test('every component supports all density modes and declares accessibility and responsive behavior', () => {
  for (const name of COMPONENT_NAMES) {
    const contract = componentContracts[name];
    assert.deepEqual(contract.densities, ['command', 'standard', 'touch'], name);
    assert.ok(Object.keys(contract.accessibility).length > 0, `${name} accessibility`);
    assert.ok(Object.keys(contract.responsive).length > 0, `${name} responsive`);
  }
});

test('interactive component contracts define keyboard, focus, or named-action requirements', () => {
  assert.deepEqual(componentContracts.GateButton.accessibility.keyboard, ['Enter', 'Space']);
  assert.equal(componentContracts.GateDialog.accessibility.focusTrapRequired, true);
  assert.equal(componentContracts.GateDialog.accessibility.focusReturnRequired, true);
  assert.equal(componentContracts.GateDialog.accessibility.visibleCloseRequired, true);
  assert.equal(componentContracts.GateSheet.accessibility.escapeCloses, true);
  assert.equal(componentContracts.GateCommandBar.accessibility.accessibleNameRequired, true);
});

test('component renderers escape user-controlled labels and do not emit inline handlers', () => {
  const hostile = '<img src=x onerror=alert(1)>';
  const button = renderGateButton({ label: hostile, action: 'save' });
  const dorm = renderGateDormCard({ id: 'd1', name: hostile, state: 'open', load: 1, capacity: 2 });
  assert.doesNotMatch(button, /<img/i);
  assert.match(button, /&lt;img/);
  assert.doesNotMatch(dorm, /<img/i);
  assert.doesNotMatch(`${button}${dorm}`, /<[^>]+\son[a-z]+=/i);
});

test('form fields preserve label, help, error, and invalid-state relationships', () => {
  const field = renderGateFormField({
    id: 'arrival-time',
    label: 'Arrival time',
    helpText: 'Confirm with the driver.',
    errorText: 'A valid time is required.',
    required: true
  });
  assert.match(field, /label for="arrival-time"/);
  assert.match(field, /id="arrival-time"/);
  assert.match(field, /aria-describedby="arrival-time-help arrival-time-error"/);
  assert.match(field, /aria-invalid="true"/);
  assert.match(field, /role="alert"/);
});

test('dialog and sheet references expose modal names, visible close controls, and host actions', () => {
  const dialog = renderGateDialog({ id: 'confirm', title: 'Confirm arrival', description: 'Review the bus.' });
  const sheet = renderGateSheet({ id: 'details', title: 'Dorm details' });
  assert.match(dialog, /^<dialog/);
  assert.match(dialog, /aria-labelledby="confirm-title"/);
  assert.match(dialog, /data-gate-action="close"/);
  assert.match(dialog, /aria-label="Close Confirm arrival"/);
  assert.match(sheet, /role="dialog"/);
  assert.match(sheet, /aria-modal="true"/);
  assert.match(sheet, /hidden/);
  assert.match(sheet, /data-gate-action="close"/);
});

test('data table uses captions and scoped column and row headers', () => {
  const table = renderGateDataTable({
    caption: 'Bus log',
    columns: [{ key: 'bus', label: 'Bus' }, { key: 'total', label: 'OTW' }],
    rows: [{ bus: '12', total: 50 }]
  });
  assert.match(table, /<caption>Bus log<\/caption>/);
  assert.match(table, /<th scope="col">Bus<\/th>/);
  assert.match(table, /<th scope="row">12<\/th>/);
  assert.match(table, /role="region"/);
  assert.match(table, /tabindex="0"/);
});

test('notifications expose urgency through live-region roles and text', () => {
  const info = renderGateNotification({ variant: 'info', message: 'Data refreshed.' });
  const error = renderGateNotification({ variant: 'error', title: 'Failed', message: 'Retry required.', dismissible: true });
  assert.match(info, /role="status"/);
  assert.match(info, /aria-live="polite"/);
  assert.match(error, /role="alert"/);
  assert.match(error, /aria-live="assertive"/);
  assert.match(error, /aria-label="Dismiss notification"/);
});

test('component CSS consumes GDL variables and contains no raw color literals or operational page selectors', async () => {
  const css = await repositoryFile('public/app/components/gate-components.css');
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(css, /\b(?:rgb|rgba|hsl|hsla)\s*\(/i);
  assert.doesNotMatch(css, /#page-|\.page-board|\.page-processing|\.page-airport/i);
  assert.match(css, /var\(--gate-/);
  assert.match(css, /@container/);
  assert.match(css, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(css, /prefers-reduced-motion/);
});

test('workshop is an isolated module surface containing all component renderer families', async () => {
  const html = await repositoryFile('public/app/workshop/index.html');
  const source = await repositoryFile('public/app/workshop/workshop.mjs');
  assert.match(html, /gdl-foundations\.css/);
  assert.match(html, /gate-components\.css/);
  assert.match(html, /type="module" src="\.\/workshop\.mjs"/);
  for (const renderer of ['renderGateButton', 'renderGateFormField', 'renderGateMetricCard', 'renderGateStatusPill', 'renderGateDormCard', 'renderGateBusCard', 'renderGateDataTable', 'renderGateDialog', 'renderGateSheet', 'renderGateNotification', 'renderGatePageHeader', 'renderGateCommandBar']) {
    assert.match(source, new RegExp(`\\b${renderer}\\b`), renderer);
  }
  assert.doesNotMatch(source, /navigator\.userAgent|iPhone|iPad|Android/i);
});

test('Build 1 middleware does not load Build 2 component or workshop assets', async () => {
  const middleware = await repositoryFile('functions/_middleware.js');
  assert.doesNotMatch(middleware, /\/app\/components|\/app\/workshop|public\/app\/components|public\/app\/workshop/);
});
