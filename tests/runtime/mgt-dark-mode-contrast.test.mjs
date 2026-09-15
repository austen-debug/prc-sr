import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const css = await readFile(resolve(root, 'public/css/military-glass-terminal.css'), 'utf8');

function sliceBetween(startNeedle, endNeedle) {
  const start = css.indexOf(startNeedle);
  assert.ok(start >= 0, `Missing CSS block start: ${startNeedle}`);
  const end = css.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(end > start, `Missing CSS block end after: ${startNeedle}`);
  return css.slice(start, end);
}

test('dark theme raises the tonal floor and text contrast without changing semantic accent colors', () => {
  const dark = sliceBetween(':root {', 'body.theme-light,');

  assert.match(dark, /--mg-bg:\s*#121712\s*;/i);
  assert.match(dark, /--mg-bg-elevated:\s*#1b221c\s*;/i);
  assert.match(dark, /--mg-surface:\s*rgba\(35,\s*44,\s*36,\s*0\.86\)\s*;/i);
  assert.match(dark, /--mg-surface-strong:\s*rgba\(28,\s*36,\s*29,\s*0\.96\)\s*;/i);
  assert.match(dark, /--mg-surface-soft:\s*rgba\(72,\s*88,\s*73,\s*0\.52\)\s*;/i);
  assert.match(dark, /--mg-surface-muted:\s*rgba\(112,\s*132,\s*113,\s*0\.24\)\s*;/i);
  assert.match(dark, /--mg-text:\s*#f5f8f4\s*;/i);
  assert.match(dark, /--mg-text-soft:\s*#d8e0d5\s*;/i);
  assert.match(dark, /--mg-text-muted:\s*#a7b2a3\s*;/i);
  assert.match(dark, /--mg-border-glass:\s*rgba\(216,\s*232,\s*211,\s*0\.26\)\s*;/i);
  assert.match(dark, /--mg-border-soft:\s*rgba\(216,\s*232,\s*211,\s*0\.16\)\s*;/i);
  assert.match(dark, /--mg-border-strong:\s*rgba\(216,\s*232,\s*211,\s*0\.42\)\s*;/i);

  assert.match(dark, /--mg-accent:\s*#58b9dd\s*;/i);
  assert.match(dark, /--mg-ok:\s*#3fd08c\s*;/i);
  assert.match(dark, /--mg-red:\s*#ff5a54\s*;/i);
  assert.match(dark, /--mg-yellow:\s*#e7c34c\s*;/i);
});

test('light theme palette remains unchanged by the dark-mode pass', () => {
  const light = sliceBetween('body.theme-light,', '/* --------------------------------------------------------------------------\n   2. BASE');
  assert.match(light, /--mg-bg:\s*#f1f4f0\s*;/i);
  assert.match(light, /--mg-surface:\s*rgba\(255,\s*255,\s*255,\s*0\.86\)\s*;/i);
  assert.match(light, /--mg-text:\s*#182016\s*;/i);
  assert.match(light, /--mg-accent:\s*#2f6f8a\s*;/i);
});

test('Status Board dark surfaces receive dedicated contrast without geometry changes', () => {
  const board = sliceBetween('body:not(.theme-light) #page-board .metric-card,', '/* --------------------------------------------------------------------------\n   6. DORM BOARDS');

  assert.match(board, /background:\s*rgba\(40,\s*50,\s*42,\s*\.93\)\s*;/i);
  assert.match(board, /border-color:\s*rgba\(216,\s*232,\s*211,\s*\.29\)\s*;/i);
  assert.match(board, /background:\s*rgba\(50,\s*63,\s*52,\s*\.98\)\s*;/i);
  assert.match(board, /border-color:\s*rgba\(216,\s*232,\s*211,\s*\.36\)\s*;/i);

  assert.doesNotMatch(board, /\b(?:width|height|min-width|max-width|min-height|max-height|padding|margin|gap|border-radius|display|position|grid-template|transform)\s*:/i);
});

test('female, Space Force, and Band identity color contracts remain present', () => {
  assert.match(css, /--gate-flag-female-red:\s*#ff4d47\s*;/i);
  assert.match(css, /--gate-flag-band-green:\s*#59c877\s*;/i);
  assert.match(css, /--gate-flag-space-force-bluebird:\s*#5bc9f0\s*;/i);
  assert.match(css, /\.proc-card\.border-space-force[\s\S]*content:\s*"SPACE FORCE"/);
  assert.match(css, /\.proc-card\.border-band[\s\S]*content:\s*"BAND"/);
});
