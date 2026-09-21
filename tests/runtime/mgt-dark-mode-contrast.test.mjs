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

test('dark theme preserves the current cool-slate contrast ladder and semantic accent colors', () => {
  const dark = sliceBetween(':root {', 'body.theme-light,');

  assert.match(dark, /--mg-bg:\s*#10141a\s*;/i);
  assert.match(dark, /--mg-bg-elevated:\s*#181e26\s*;/i);
  assert.match(dark, /--mg-surface:\s*rgba\(30,\s*38,\s*49,\s*0\.86\)\s*;/i);
  assert.match(dark, /--mg-surface-strong:\s*rgba\(21,\s*28,\s*37,\s*0\.96\)\s*;/i);
  assert.match(dark, /--mg-surface-soft:\s*rgba\(66,\s*81,\s*100,\s*0\.50\)\s*;/i);
  assert.match(dark, /--mg-surface-muted:\s*rgba\(112,\s*133,\s*160,\s*0\.20\)\s*;/i);
  assert.match(dark, /--mg-text:\s*#f2f6fa\s*;/i);
  assert.match(dark, /--mg-text-soft:\s*#d3dce6\s*;/i);
  assert.match(dark, /--mg-text-muted:\s*#9eacbc\s*;/i);
  assert.match(dark, /--mg-border-glass:\s*rgba\(200,\s*216,\s*236,\s*0\.22\)\s*;/i);
  assert.match(dark, /--mg-border-soft:\s*rgba\(200,\s*216,\s*236,\s*0\.13\)\s*;/i);
  assert.match(dark, /--mg-border-strong:\s*rgba\(200,\s*216,\s*236,\s*0\.38\)\s*;/i);

  assert.match(dark, /--mg-accent:\s*#58b9dd\s*;/i);
  assert.match(dark, /--mg-ok:\s*#3fd08c\s*;/i);
  assert.match(dark, /--mg-red:\s*#ff5a54\s*;/i);
  assert.match(dark, /--mg-yellow:\s*#e7c34c\s*;/i);
});

test('light theme retains a separate high-contrast blue-gray palette and blue interaction', () => {
  const light = sliceBetween('body.theme-light,', '/* --------------------------------------------------------------------------\n   2. BASE');
  assert.match(light, /--mg-bg:\s*#e7eef7\s*;/i);
  assert.match(light, /--mg-surface:\s*rgba\(255,\s*255,\s*255,\s*0\.97\)\s*;/i);
  assert.match(light, /--mg-text:\s*#10243a\s*;/i);
  assert.match(light, /--mg-accent:\s*#175c92\s*;/i);
});

test('Status Board contrasts derive from dedicated board tokens without changing its geometry', () => {
  const dark = sliceBetween(':root {', 'body.theme-light,');
  assert.match(dark, /--mg-board-plane:\s*rgba\(34,\s*43,\s*55,\s*0\.94\)\s*;/i);
  assert.match(dark, /--mg-board-edge:\s*rgba\(200,\s*216,\s*236,\s*0\.29\)\s*;/i);
  assert.match(dark, /--mg-board-card:\s*rgba\(44,\s*56,\s*71,\s*0\.98\)\s*;/i);
  assert.match(dark, /--mg-board-card-edge:\s*rgba\(200,\s*216,\s*236,\s*0\.36\)\s*;/i);
  const board = sliceBetween('/* Board planes: raised opacity for wall-display legibility.', '/* --------------------------------------------------------------------------\n   6. DORM BOARDS');
  assert.match(board, /border-color:\s*var\(--mg-board-edge\)/);
  assert.match(board, /background:\s*var\(--mg-board-plane\)/);
  assert.doesNotMatch(board, /\b(?:width|height|min-width|max-width|min-height|max-height|padding|margin|gap|border-radius|display|position|grid-template|transform)\s*:/i);
});

test('female, Space Force, and Band identity color contracts remain present', () => {
  assert.match(css, /--gate-flag-female-red:\s*#ff4d47\s*;/i);
  assert.match(css, /--gate-flag-band-green:\s*#59c877\s*;/i);
  assert.match(css, /--gate-flag-space-force-bluebird:\s*#5bc9f0\s*;/i);
  assert.match(css, /\.proc-card\.border-space-force[\s\S]*content:\s*"SPACE FORCE"/);
  assert.match(css, /\.proc-card\.border-band[\s\S]*content:\s*"BAND"/);
});
