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

function blockAfter(css, marker) {
  const start = css.indexOf(marker);
  assert.ok(start >= 0, `Expected marker: ${marker}`);
  return css.slice(start);
}

test('Military Glass v2 separates telemetry green from interaction cyan', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const v2 = blockAfter(css, '/* 16. MILITARY GLASS TERMINAL V2 VISUAL SEMANTICS */');

  assert.match(css, /--mg-accent:\s*#3fd98a/);
  assert.match(css, /--mg-signal:\s*#4fc3e8/);
  assert.match(css, /--mg-focus:\s*rgba\(var\(--mg-signal-rgb\),\s*0\.30\)/);
  assert.match(v2, /\.metric-value,[\s\S]*font-family:\s*var\(--mg-font-mono\)/);
  assert.match(v2, /\.nav-btn\.active,[\s\S]*color:\s*var\(--mg-signal\)/);
  assert.match(v2, /input:focus-visible,[\s\S]*outline-color:\s*var\(--mg-signal\)/);
  assert.match(v2, /\.gate-primary-action,[\s\S]*var\(--mg-signal-deep\)/);
  assert.match(v2, /#dorm-modal \.phase-btn\.selected[\s\S]*color:\s*var\(--mg-signal\)/);

  const telemetry = css.match(/#page-board \.metric-value,[\s\S]*?\{([\s\S]*?)\}/);
  assert.ok(telemetry);
  assert.match(telemetry[1], /color:\s*var\(--mg-accent\)/);
});

test('elevation ladder is explicit from L1 planes through L4 modals', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const v2 = blockAfter(css, '/* 16. MILITARY GLASS TERMINAL V2 VISUAL SEMANTICS */');

  assert.match(css, /--mg-blur-1:\s*14px/);
  assert.match(css, /--mg-blur-2:\s*20px/);
  assert.match(css, /--mg-blur-3:\s*30px/);
  assert.match(css, /--mg-blur-4:\s*40px/);
  assert.match(v2, /\.surface,[\s\S]*blur\(var\(--mg-blur-1\)\)/);
  assert.match(v2, /\.app-nav,[\s\S]*blur\(var\(--mg-blur-2\)\)/);
  assert.match(v2, /\.gate-processing-context-menu,[\s\S]*blur\(var\(--mg-blur-3\)\)/);
  assert.match(v2, /\.modal-content,[\s\S]*blur\(var\(--mg-blur-4\)\)/);
});

test('female dorm identity retains red perimeter treatment on every dorm surface', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const v2 = blockAfter(css, '/* 16. MILITARY GLASS TERMINAL V2 VISUAL SEMANTICS */');
  const flags = await source('public/js/prc-dash-dorm-flag-validation.js');
  const processing = await source('public/js/gate-processing-controller.js');

  assert.match(flags, /classList\.toggle\('border-female',\s*flags\.female\)/);
  assert.match(flags, /dataset\.femaleDorm\s*=\s*flags\.female \? 'true' : 'false'/);
  assert.match(processing, /female \? 'border-female' : ''/);
  assert.match(processing, /spaceForce \? 'border-space-force' : ''/);

  assert.match(v2, /#page-board \.gate-dorm-card\.border-female,[\s\S]*#page-squadron \.dorm-card\[data-female-dorm="true"\][\s\S]*border-width:\s*2px[\s\S]*border-color:\s*var\(--gate-flag-female-red\)/);
  assert.match(v2, /#page-processing #proc-dorm-grid \.proc-card\.border-female[\s\S]*border-width:\s*3px[\s\S]*border-color:\s*var\(--gate-flag-female-red\)/);
});

test('Space Force and Band identity remains visible and independently composable with female state', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const flags = await source('public/js/prc-dash-dorm-flag-validation.js');
  const processing = await source('public/js/gate-processing-controller.js');

  assert.match(flags, /flag-space-force">Space Force/);
  assert.match(flags, /flag-band">Band/);
  assert.match(flags, /banner-space-force">Space Force/);
  assert.match(flags, /banner-band">Band/);
  assert.match(flags, /classList\.toggle\('border-space-force',\s*flags\.spaceForce\)/);
  assert.match(flags, /classList\.toggle\('border-band',\s*flags\.band\)/);

  const cardStart = processing.indexOf('function processingCard(dorm)');
  const cardEnd = processing.indexOf('function renderProcessingPageCanonical', cardStart);
  const card = processing.slice(cardStart, cardEnd);
  assert.match(card, /const borderClasses\s*=\s*\[/);
  assert.match(card, /female \? 'border-female' : ''/);
  assert.match(card, /spaceForce \? 'border-space-force' : ''/);
  assert.match(card, /!spaceForce && band \? 'border-band' : ''/);

  assert.match(css, /\.gate-dorm-top-banner\.banner-space-force/);
  assert.match(css, /\.gate-dorm-top-banner\.banner-band/);
  assert.match(css, /#page-processing \.proc-card\.border-space-force > \.text-xl\.font-black\.font-tabular::before[\s\S]*content:\s*"SPACE FORCE"/);
  assert.match(css, /#page-processing \.proc-card\.border-band > \.text-xl\.font-black\.font-tabular::before[\s\S]*content:\s*"BAND"/);
});

test('canonical source owns responsive Processing geometry without legacy inline CSS authority', async () => {
  const html = await source('public/index.html');
  const css = await source('public/css/military-glass-terminal.css');

  assert.doesNotMatch(html, /<style>\s*:root/);
  assert.doesNotMatch(html, /id="proc-dorm-grid"[^>]*style="[^"]*grid-template-columns/);
  assert.match(css, /#page-processing #proc-dorm-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(min-width:\s*768px\) and \(max-width:\s*1199px\)[\s\S]*#page-processing #proc-dorm-grid[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*767px\),[\s\S]*#page-processing #proc-dorm-grid[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test('static primary and destructive controls no longer carry legacy inline color authority', async () => {
  const html = await source('public/index.html');

  assert.doesNotMatch(html, /<button[^>]*style="background:(?:#16a34a|#2563eb|#dc2626|var\(--green\)|var\(--blue\))/i);
  assert.match(html, /class="gate-primary-action[^"]*">DISPATCH BUS<\/button>/);
  assert.match(html, /id="init-wg-btn"[^>]*class="gate-primary-action/);
  assert.match(html, /id="closeout-btn"[^>]*class="gate-danger-action/);
});

test('light mode uses paper-field surfaces without neon interaction glow', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  assert.match(css, /\.theme-light[\s\S]*--mg-bg:\s*#eef2f7/);
  assert.match(css, /\.theme-light[\s\S]*--mg-text:\s*#101a26/);
  assert.match(css, /\.theme-light[\s\S]*--mg-signal:\s*#0e7fa6/);
  assert.match(css, /body\.theme-light \.gate-primary-action,[\s\S]*background:\s*var\(--mg-signal-deep\)/);
  assert.match(css, /body\.theme-light #page-processing #proc-dorm-grid \.proc-card\.border-female[\s\S]*var\(--mg-shadow-soft\)/);
});

test('v2 keeps one canonical stylesheet with no import graph or priority locks', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const middleware = await source('functions/_middleware.js');
  const login = await source('public/login/index.html');

  assert.doesNotMatch(css, /@import\s+/);
  assert.doesNotMatch(css, /!important\s*;/);
  assert.match(middleware, /military-glass-terminal\.css\?v=military-glass-terminal-v2-20260914/);
  assert.equal((middleware.match(/<link rel="stylesheet"/g) || []).length, 1);
  assert.match(login, /military-glass-terminal\.css\?v=military-glass-terminal-v2-20260914/);
});
