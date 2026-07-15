import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ACCESSIBILITY_REQUIREMENTS,
  ACCESSIBILITY_STANDARD,
  ACCESSIBLE_STATE_PRESENTATIONS,
  GateAccessibilityFoundation,
  MINIMUM_TOUCH_TARGET,
  FOCUSABLE_SELECTOR,
  getAccessibleStatePresentation,
  normalizeAnnouncement,
  resolveTabDestination,
  validateAccessibilityContracts,
  validateOverlayDescriptor
} from '../../../public/app/accessibility/index.mjs';
import {
  renderGateDialog,
  renderGateSheet,
  renderGateStatusPill
} from '../../../public/app/components/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, '../../..');

async function repositoryFile(path) {
  return readFile(resolve(repositoryRoot, path), 'utf8');
}

test('Phase 2E establishes a valid WCAG 2.2 AA contract', () => {
  assert.equal(ACCESSIBILITY_STANDARD, 'WCAG 2.2 AA');
  assert.equal(GateAccessibilityFoundation.standard, 'WCAG 2.2 AA');
  assert.equal(GateAccessibilityFoundation.runtimeStatus, 'staged');
  assert.deepEqual(validateAccessibilityContracts(), { valid: true, errors: [] });
  assert.equal(MINIMUM_TOUCH_TARGET, 44);
  assert.equal(ACCESSIBILITY_REQUIREMENTS.presentation.zoom200Required, true);
  assert.equal(ACCESSIBILITY_REQUIREMENTS.presentation.reflow320CssPixelsRequired, true);
});

test('every operational and persistence state has visible text and a non-color symbol', () => {
  const required = ['arrived', 'enroute', 'processing', 'closed', 'overtime', 'warning', 'failed', 'saved', 'pending', 'stale', 'conflict'];
  assert.deepEqual(Object.keys(ACCESSIBLE_STATE_PRESENTATIONS), required);
  for (const state of required) {
    const presentation = getAccessibleStatePresentation(state);
    assert.ok(presentation.label, `${state} label`);
    assert.ok(presentation.symbol, `${state} symbol`);
    const markup = renderGateStatusPill({ state, label: `${presentation.symbol} ${presentation.label}` });
    assert.match(markup, new RegExp(`data-state="${state}"`));
    assert.match(markup, new RegExp(presentation.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(markup, /gate-status-pill__marker/);
  }
});

test('focus order wraps deterministically in both directions', () => {
  assert.match(FOCUSABLE_SELECTOR, /button:not\(\[disabled\]\)/);
  assert.equal(resolveTabDestination({ currentIndex: 0, count: 3, shiftKey: true }), 2);
  assert.equal(resolveTabDestination({ currentIndex: 2, count: 3, shiftKey: false }), 0);
  assert.equal(resolveTabDestination({ currentIndex: 1, count: 3, shiftKey: false }), 2);
  assert.equal(resolveTabDestination({ currentIndex: 0, count: 0 }), -1);
});

test('overlay descriptors require names, Escape, contained focus, and focus return', () => {
  const valid = validateOverlayDescriptor({
    kind: 'dialog',
    id: 'confirm',
    labelledBy: 'confirm-title',
    escapeCloses: true,
    returnFocus: true,
    containFocus: true
  });
  assert.deepEqual(valid, { valid: true, errors: [] });
  assert.equal(validateOverlayDescriptor({ kind: 'sheet' }).valid, false);
});

test('routine and blocking announcements use distinct live-region contracts', () => {
  assert.deepEqual(normalizeAnnouncement({ message: 'Saved' }), {
    message: 'Saved', urgency: 'polite', role: 'status', atomic: true
  });
  assert.deepEqual(normalizeAnnouncement({ message: 'Save failed', blocking: true }), {
    message: 'Save failed', urgency: 'assertive', role: 'alert', atomic: true
  });
});

test('GateDialog and GateSheet expose one canonical modal-overlay contract', () => {
  const dialog = renderGateDialog({ id: 'confirm', title: 'Confirm', description: 'Review', actions: [{ label: 'Close', action: 'close' }] });
  const sheet = renderGateSheet({ id: 'detail', title: 'Detail', description: 'Review', actions: [{ label: 'Close', action: 'close' }] });
  for (const markup of [dialog, sheet]) {
    assert.match(markup, /data-gate-overlay=/);
    assert.match(markup, /data-gate-overlay-state="closed"/);
    assert.match(markup, /aria-modal="true"/);
    assert.match(markup, /aria-labelledby=/);
    assert.match(markup, /aria-describedby=/);
    assert.match(markup, /data-gate-initial-focus/);
    assert.match(markup, /data-gate-action="close"/);
  }
});

test('shared overlay controller owns Escape, Tab containment, inert background, and focus return', async () => {
  const source = await repositoryFile('public/app/accessibility/overlay-controller.mjs');
  assert.match(source, /event\.key !== 'Tab'/);
  assert.match(source, /isEscapeKey\(event\)/);
  assert.match(source, /resolveTabDestination/);
  assert.match(source, /child\.inert = true/);
  assert.match(source, /aria-hidden/);
  assert.match(source, /returnFocus/);
  assert.match(source, /preventScroll: true/);
  assert.doesNotMatch(source, /fetch\s*\(|\/api\/records|Gate\w+Repository|localStorage|sessionStorage/);
});

test('live announcer owns polite and assertive regions without operational dependencies', async () => {
  const source = await repositoryFile('public/app/accessibility/announcer.mjs');
  assert.match(source, /gate-live-polite/);
  assert.match(source, /gate-live-assertive/);
  assert.match(source, /aria-live/);
  assert.match(source, /aria-atomic/);
  assert.doesNotMatch(source, /fetch\s*\(|\/api\/records|Gate\w+Repository/);
});

test('accessibility CSS covers visible focus, touch, reflow, contrast, forced colors, and reduced motion', async () => {
  const css = await repositoryFile('public/app/accessibility/gate-accessibility.css');
  assert.match(css, /:focus-visible/);
  assert.match(css, /outline: max\(2px/);
  assert.match(css, /scroll-margin-block/);
  assert.match(css, /\(pointer: coarse\), \(pointer: none\)/);
  assert.match(css, /min-block-size: 44px/);
  assert.match(css, /max-width: 20rem/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /prefers-contrast: more/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.doesNotMatch(css, /outline\s*:\s*none/i);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(css, /navigator\.userAgent|iPhone|iPad|Android/i);
  assert.doesNotMatch(css, /#page-|\.page-board|\.page-processing|\.page-airport/i);
});

test('accessibility workshop exercises overlays, announcements, themes, density, and reflow', async () => {
  const html = await repositoryFile('public/app/accessibility/workshop/index.html');
  const source = await repositoryFile('public/app/accessibility/workshop/workshop.mjs');
  assert.match(html, /gate-accessibility\.css/);
  assert.match(html, /href="#accessibility-main"/);
  assert.match(html, /type="module" src="\.\/workshop\.mjs"/);
  assert.match(source, /createGateOverlayController/);
  assert.match(source, /createGateAnnouncer/);
  assert.match(source, /open-dialog/);
  assert.match(source, /open-sheet/);
  assert.match(source, /announce-failure/);
  assert.match(source, /renderGateDataTable/);
});

test('Build 1 middleware does not load Phase 2E assets', async () => {
  const middleware = await repositoryFile('functions/_middleware.js');
  assert.doesNotMatch(middleware, /\/app\/accessibility|accessibility\/workshop|gate-accessibility\.css/);
});
