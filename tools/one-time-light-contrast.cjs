'use strict';
// One-time, strictly scoped source edit for GATE's existing canonical stylesheet.
const fs = require('node:fs');
const path = 'public/css/military-glass-terminal.css';
let css = fs.readFileSync(path, 'utf8');
const startToken = '/* Block B — primitives, light */';
const endToken = '/* Block C — derived tokens and legacy aliases, resolved per theme */';
const start = css.indexOf(startToken);
const end = css.indexOf(endToken, start + startToken.length);
if (start < 0 || end <= start || css.indexOf(startToken, start + 1) !== -1) throw new Error('Canonical light-theme block must be uniquely identified.');
let light = css.slice(start, end);
const replacements = [
  ['--mg-bg: #eef2f6;', '--mg-bg: #e7eef7;'],
  ['--mg-surface: rgba(255, 255, 255, 0.86);', '--mg-surface: rgba(255, 255, 255, 0.97);'],
  ['--mg-surface-strong: rgba(251, 252, 254, 0.97);', '--mg-surface-strong: rgba(255, 255, 255, 0.99);'],
  ['--mg-surface-soft: rgba(228, 234, 241, 0.78);', '--mg-surface-soft: rgba(213, 226, 240, 0.95);'],
  ['--mg-surface-muted: rgba(40, 62, 90, 0.07);', '--mg-surface-muted: rgba(29, 74, 117, 0.13);'],
  ['--mg-l2: rgba(248, 250, 253, 0.92);', '--mg-l2: rgba(238, 245, 252, 0.97);'],
  ['--mg-text: #131b25;', '--mg-text: #10243a;'],
  ['--mg-text-soft: #3b4a5c;', '--mg-text-soft: #29445f;'],
  ['--mg-text-muted: #647387;', '--mg-text-muted: #3e5873;'],
  ['--mg-accent: #2f6f8a;', '--mg-accent: #175c92;'],
  ['--mg-accent-rgb: 47, 111, 138;', '--mg-accent-rgb: 23, 92, 146;'],
  ['--mg-accent-deep: #245b73;', '--mg-accent-deep: #10466f;'],
  ['--mg-accent-ink: #245b73;', '--mg-accent-ink: #10466f;'],
  ['--mg-blue: #3f6f80;', '--mg-blue: #175c92;'],
  ['--mg-border-glass: rgba(40, 62, 90, 0.22);', '--mg-border-glass: rgba(28, 64, 103, 0.34);'],
  ['--mg-border-soft: rgba(40, 62, 90, 0.12);', '--mg-border-soft: rgba(28, 64, 103, 0.21);'],
  ['--mg-border-strong: rgba(40, 62, 90, 0.36);', '--mg-border-strong: rgba(28, 64, 103, 0.49);'],
  ['--mg-line: rgba(47, 111, 138, 0.12);', '--mg-line: rgba(23, 92, 146, 0.23);'],
  ['--mg-field: rgba(255, 255, 255, 0.94);', '--mg-field: rgba(255, 255, 255, 1);'],
  ['--mg-focus: rgba(47, 111, 138, 0.20);', '--mg-focus: rgba(23, 92, 146, 0.32);'],
  ['--mg-board-plane: rgba(255, 255, 255, 0.88);', '--mg-board-plane: rgba(244, 249, 254, 0.99);'],
  ['--mg-board-edge: rgba(40, 62, 90, 0.22);', '--mg-board-edge: rgba(28, 64, 103, 0.36);'],
  ['--mg-board-card: rgba(250, 252, 254, 0.92);', '--mg-board-card: rgba(255, 255, 255, 0.99);'],
  ['--mg-board-card-edge: rgba(40, 62, 90, 0.24);', '--mg-board-card-edge: rgba(28, 64, 103, 0.39);']
];
for (const [before, after] of replacements) {
  if (light.split(before).length !== 2) throw new Error(`Expected one exact light token: ${before}`);
  light = light.replace(before, after);
}
css = css.slice(0, start) + light + css.slice(end);
const marker = '/* GATE LIGHT THEME: native form controls and option-list contrast */';
if (css.includes(marker)) throw new Error('Duplicate light-theme patch refused.');
css += `\n\n${marker}\nbody.theme-light :is(input[type="text"], input[type="number"], input[type="date"], input[type="time"], textarea, select),\n.theme-light :is(input[type="text"], input[type="number"], input[type="date"], input[type="time"], textarea, select) {\n  background-color: var(--mg-field);\n  border-color: var(--mg-border-glass);\n  color: var(--mg-text);\n}\n\nbody.theme-light select option,\n.theme-light select option,\nbody.theme-light #page-input select.batch-sex option {\n  background-color: #ffffff;\n  color: #10243a;\n}\n\nbody.theme-light select:focus-visible,\nbody.theme-light :is(input, textarea):focus-visible {\n  outline: 2px solid var(--mg-accent);\n  outline-offset: 2px;\n}\n`;
fs.writeFileSync(path, css);
console.log('Updated existing canonical stylesheet; no added CSS asset or import.');
