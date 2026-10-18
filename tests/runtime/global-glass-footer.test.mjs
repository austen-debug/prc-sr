import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = path => readFile(resolve(root, path), 'utf8');
const authenticatedDocuments = [
  'public/index.html',
  'public/squadron/index.html',
  'public/administration/index.html'
];

test('every authenticated GATE document has exactly one organizational footer; login has none', async () => {
  for (const path of authenticatedDocuments) {
    const html = await source(path);
    assert.equal((html.match(/class="gate-global-footer"/g) || []).length, 1, path);
    assert.match(html, /CONTROLLED UNCLASSIFIED INFORMATION/, path);
    assert.match(html, /737 TRG <span aria-hidden="true">\|<\/span> BMT ENTERPRISE SOLUTION/, path);
    assert.match(html, /\/assets\/battalion_cpc_dark\.png/, path);
    assert.match(html, /\/assets\/battalion_cpc_light\.png/, path);
    assert.match(html, /class="gate-global-footer__mark gate-global-footer__mark--dark" src="\/assets\/battalion_cpc_light\.png"/, `${path}: dark theme uses the light logo`);
    assert.match(html, /class="gate-global-footer__mark gate-global-footer__mark--light" src="\/assets\/battalion_cpc_dark\.png"/, `${path}: light theme uses the dark logo`);
  }
  assert.doesNotMatch(await source('public/login/index.html'), /gate-global-footer/);
});

test('canonical footer preserves theme, fullscreen, mobile and print contracts', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const contract = css.slice(css.indexOf('AUTHENTICATED GLOBAL FOOTER'));
  assert.ok(contract.startsWith('AUTHENTICATED GLOBAL FOOTER'));
  assert.match(contract, /position:\s*fixed/);
  assert.match(contract, /backdrop-filter:\s*blur\(14px\)/);
  assert.match(contract, /:root \{ --gate-global-footer-height: 28px; \}/);
  assert.match(contract, /box-sizing:\s*border-box;\s*height:\s*calc\(var\(--gate-global-footer-height\) \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(contract, /padding:\s*1px 16px calc\(1px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(contract, /\.gate-global-footer__mark \{[^}]*height:\s*24px;/);
  assert.match(contract, /@media \(max-width: 760px\)\s*\{\s*:root \{ --gate-global-footer-height: 40px; \}/);
  assert.match(contract, /\.gate-global-footer__mark \{ max-width: 84px; height: 30px; \}/);
  assert.match(contract, /body\.theme-light \.gate-global-footer__mark--dark\s*\{\s*display:\s*none/);
  assert.match(contract, /body\.theme-light \.gate-global-footer__mark--light\s*\{\s*display:\s*block/);
  assert.match(contract, /body\.fullscreen-board #page-board,[\s\S]*padding-bottom:/);
  assert.match(contract, /@media \(max-width: 760px\)/);
  assert.match(contract, /@media print\s*\{\s*\.gate-global-footer\s*\{\s*display:\s*none/);
});

test('standalone Administration footer retains fixed dimensions while enlarging its emblem', async () => {
  const html = await source('public/administration/index.html');
  assert.match(html, /\.gate-global-footer \{[^}]*height:calc\(28px \+ env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(html, /\.gate-global-footer__mark\{[^}]*height:24px/);
  assert.match(html, /@media\(max-width:760px\)\{\.gate-global-footer\{[^}]*height:calc\(40px \+ env\(safe-area-inset-bottom,0px\)\)/);
  assert.match(html, /\.gate-global-footer__mark\{max-width:84px;height:30px\}/);
});

test('footer uses existing stylesheet and does not expand the active asset budget', async () => {
  const middleware = await source('functions/_middleware.js');
  const budget = JSON.parse(await source('docs/build-2/ACTIVE_RUNTIME_BUDGET.json'));
  const expected = '/css/military-glass-terminal.css?v=week-group-progress-20261018-v1';
  assert.ok(budget.currentDirectStyles.includes(expected));
  assert.ok(middleware.includes(expected));
  assert.equal(budget.currentDirectStyles.length, 1);
  assert.equal(budget.currentImportedStyles.length, 0);
});
