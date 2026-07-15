import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { GDL, validateGdlTokens } from '../../../public/app/design/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(here, '../../../public/app/design/themes/gdl-foundations.css');
const css = await readFile(cssPath, 'utf8');

test('GDL foundation registry is complete', () => {
  assert.deepEqual(validateGdlTokens(GDL), { valid: true, errors: [] });
});

test('approved spacing scale is exact and contains no arbitrary values', () => {
  assert.deepEqual(GDL.primitive.spacing, [2, 4, 8, 12, 16, 20, 24, 32, 40, 48]);
});

test('density modes preserve command, standard, and touch contracts', () => {
  assert.equal(GDL.density.command.controlHeight, 32);
  assert.equal(GDL.density.standard.controlHeight, 40);
  assert.equal(GDL.density.touch.controlHeight, 48);
  assert.ok(GDL.density.touch.targetMinimum >= GDL.interaction.minimumTouchTarget);
});

test('operational and persistence states are semantic tokens', () => {
  ['arrived', 'enroute', 'processing', 'closed', 'overtime', 'warning', 'failed', 'saved', 'pending', 'stale', 'conflict']
    .forEach(state => assert.match(GDL.semantic.state[state], /^#[0-9a-f]{6}$/i));
});

test('light and dark themes expose the same semantic surface contract', () => {
  assert.deepEqual(Object.keys(GDL.semantic.dark), Object.keys(GDL.semantic.light));
});

test('CSS theme artifact exposes required semantic variables', () => {
  [
    '--gate-surface-canvas', '--gate-surface-panel', '--gate-surface-raised', '--gate-surface-command',
    '--gate-text-primary', '--gate-text-secondary', '--gate-state-arrived', '--gate-state-enroute',
    '--gate-state-processing', '--gate-state-overtime', '--gate-state-failed', '--gate-state-conflict',
    '--gate-target-touch-min', '--gate-safe-top'
  ].forEach(token => assert.match(css, new RegExp(token)));
});

test('reduced motion contract removes tokenized durations', () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /--gate-motion-standard:\s*0ms/);
});

test('Build 2 design foundations do not import production runtime modules', () => {
  assert.doesNotMatch(css, /public\/js|functions\/_middleware/);
});
