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

function after(css, marker) {
  const start = css.indexOf(marker);
  assert.ok(start >= 0, `Expected marker: ${marker}`);
  return css.slice(start);
}

function ruleFrom(css, selector) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `Expected selector: ${selector}`);
  const brace = css.indexOf('{', start);
  assert.ok(brace >= 0, `Expected declaration block for: ${selector}`);
  const end = css.indexOf('}', brace);
  assert.ok(end >= 0, `Expected closing brace for: ${selector}`);
  return css.slice(start, end + 1);
}

function mediaFrom(css, marker) {
  const start = css.indexOf(marker);
  assert.ok(start >= 0, `Expected media query: ${marker}`);
  const next = css.indexOf('\n@media ', start + marker.length);
  return css.slice(start, next >= 0 ? next : css.length);
}

test('Military Glass v2 separates telemetry green from interaction cyan', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const v2 = after(css, '/* 16. MILITARY GLASS TERMINAL V2 VISUAL SEMANTICS */');
  const telemetryRule = ruleFrom(css, '#page-board .metric-value,');
  const activeNavRule = ruleFrom(v2, '.nav-btn.active,');
  const focusRule = ruleFrom(v2, 'input:focus-visible,');
  const primaryRule = ruleFrom(v2, '.gate-primary-action,');
  const phaseRule = ruleFrom(v2, '#dorm-modal .phase-btn.selected');

  assert.match(css, /--mg-accent:\s*#3fd98a/);
  assert.match(css, /--mg-signal:\s*#4fc3e8/);
  assert.match(css, /--mg-focus:\s*rgba\(var\(--mg-signal-rgb\),\s*0\.30\)/);
  assert.match(v2, /\.metric-value,[\s\S]*font-family:\s*var\(--mg-font-mono\)/);
  assert.match(telemetryRule, /color:\s*var\(--mg-accent\)/);
  assert.match(activeNavRule, /color:\s*var\(--mg-signal\)/);
  assert.match(focusRule, /outline-color:\s*var\(--mg-signal\)/);
  assert.match(primaryRule, /var\(--mg-signal-deep\)/);
  assert.match(phaseRule, /color:\s*var\(--mg-signal\)/);
});

test('elevation ladder is explicit from L1 planes through L4 modals', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const v2 = after(css, '/* 16. MILITARY GLASS TERMINAL V2 VISUAL SEMANTICS */');

  assert.match(css, /--mg-blur-1:\s*14px/);
  assert.match(css, /--mg-blur-2:\s*20px/);
  assert.match(css, /--mg-blur-3:\s*30px/);
  assert.match(css, /--mg-blur-4:\s*40px/);
  assert.match(ruleFrom(v2, '.surface,'), /blur\(var\(--mg-blur-1\)\)/);
  assert.match(ruleFrom(v2, '.app-nav,'), /blur\(var\(--mg-blur-2\)\)/);
  assert.match(ruleFrom(v2, '.gate-processing-context-menu,'), /blur\(var\(--mg-blur-3\)\)/);
  assert.match(ruleFrom(v2, '.modal-content,'), /blur\(var\(--mg-blur-4\)\)/);
});

test('female dorm identity retains red perimeter treatment on every dorm surface', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const v2 = after(css, '/* 16. MILITARY GLASS TERMINAL V2 VISUAL SEMANTICS */');
  const flags = await source('public/js/prc-dash-dorm-flag-validation.js');
  const processing = await source('public/js/gate-processing-controller.js');
  const boardFemaleRule = ruleFrom(v2, '#page-board .gate-dorm-card.border-female,');
  const processingFemaleRule = ruleFrom(v2, '#page-processing #proc-dorm-grid .proc-card.border-female');

  assert.match(flags, /classList\.toggle\('border-female',\s*flags\.female\)/);
  assert.match(flags, /dataset\.femaleDorm\s*=\s*flags\.female \? 'true' : 'false'/);
  assert.match(processing, /female \? 'border-female' : ''/);
  assert.match(processing, /spaceForce \? 'border-space-force' : ''/);

  assert.ok(boardFemaleRule.includes('#page-squadron .dorm-card[data-female-dorm="true"]'));
  assert.match(boardFemaleRule, /border-width:\s*2px/);
  assert.match(boardFemaleRule, /border-color:\s*var\(--gate-flag-female-red\)/);
  assert.match(processingFemaleRule, /border-width:\s*3px/);
  assert.match(processingFemaleRule, /border-color:\s*var\(--gate-flag-female-red\)/);
});

test('Space Force and Band identity remains visible and independently composable with female state', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const flags = await source('public/js/prc-dash-dorm-flag-validation.js');
  const processing = await source('public/js/gate-processing-controller.js');

  assert.ok(flags.includes('flag-space-force">Space Force'));
  assert.ok(flags.includes('flag-band">Band'));
  assert.ok(flags.includes('banner-space-force">Space Force'));
  assert.ok(flags.includes('banner-band">Band'));
  assert.match(flags, /classList\.toggle\('border-space-force',\s*flags\.spaceForce\)/);
  assert.match(flags, /classList\.toggle\('border-band',\s*flags\.band\)/);

  const cardStart = processing.indexOf('function processingCard(dorm)');
  const cardEnd = processing.indexOf('function renderProcessingPageCanonical', cardStart);
  assert.ok(cardStart >= 0 && cardEnd > cardStart, 'Processing card renderer must remain present.');
  const card = processing.slice(cardStart, cardEnd);
  assert.match(card, /const borderClasses\s*=\s*\[/);
  assert.match(card, /female \? 'border-female' : ''/);
  assert.match(card, /spaceForce \? 'border-space-force' : ''/);
  assert.match(card, /!spaceForce && band \? 'border-band' : ''/);

  assert.ok(css.includes('.gate-dorm-top-banner.banner-space-force'));
  assert.ok(css.includes('.gate-dorm-top-banner.banner-band'));
  assert.ok(css.includes('#page-processing .proc-card.border-space-force > .text-xl.font-black.font-tabular::before'));
  assert.ok(css.includes('content: "SPACE FORCE"'));
  assert.ok(css.includes('#page-processing .proc-card.border-band > .text-xl.font-black.font-tabular::before'));
  assert.ok(css.includes('content: "BAND"'));
});

test('canonical source owns responsive Processing geometry without legacy inline CSS authority', async () => {
  const html = await source('public/index.html');
  const css = await source('public/css/military-glass-terminal.css');
  const desktop = mediaFrom(css, '@media (min-width: 1200px)');
  const tablet = mediaFrom(css, '@media (min-width: 768px) and (max-width: 1199px)');
  const mobile = mediaFrom(css, '@media (max-width: 767px), (pointer: coarse) and (max-width: 1024px) and (max-height: 560px)');

  assert.doesNotMatch(html, /<style>\s*:root/);
  assert.doesNotMatch(html, /id="proc-dorm-grid"[^>]*style="[^"]*grid-template-columns/);
  assert.ok(desktop.includes('#page-processing #proc-dorm-grid'));
  assert.match(desktop, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.ok(tablet.includes('#page-processing #proc-dorm-grid'));
  assert.match(tablet, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.ok(mobile.includes('#page-processing #proc-dorm-grid'));
  assert.match(mobile, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
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
  const lightTokens = ruleFrom(css, 'body.theme-light,');
  const lightPrimary = ruleFrom(css, 'body.theme-light .gate-primary-action,');
  const lightFemale = ruleFrom(css, 'body.theme-light #page-board .gate-dorm-card.border-female,');

  assert.match(lightTokens, /--mg-bg:\s*#eef2f7/);
  assert.match(lightTokens, /--mg-text:\s*#101a26/);
  assert.match(lightTokens, /--mg-signal:\s*#0e7fa6/);
  assert.match(lightPrimary, /background:\s*var\(--mg-signal-deep\)/);
  assert.match(lightFemale, /var\(--mg-shadow-soft\)/);
});

test('v2 keeps one canonical stylesheet with no import graph or priority locks', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const middleware = await source('functions/_middleware.js');
  const login = await source('public/login/index.html');

  assert.doesNotMatch(css, /^[ \t]*@import\s+/m);
  assert.doesNotMatch(css, /!important\s*;/);
  assert.match(middleware, /military-glass-terminal\.css\?v=military-glass-terminal-v2-20260914/);
  assert.equal((middleware.match(/<link rel="stylesheet"/g) || []).length, 1);
  assert.match(login, /military-glass-terminal\.css\?v=military-glass-terminal-v2-20260914/);
});