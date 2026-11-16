import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL('../../' + path, import.meta.url), 'utf8');

test('standalone Squadron phone controls occupy a dedicated row without moving the title', async () => {
  const [css, html, controller] = await Promise.all([
    source('public/css/military-glass-terminal.css'),
    source('public/squadron/index.html'),
    source('public/js/prc-dash-final-audit.js')
  ]);
  const start = css.indexOf('/* Standalone Squadron phone view:');
  const end = css.indexOf('@media(prefers-reduced-motion:reduce)', start);
  assert.ok(start > 0 && end > start, 'scoped mobile override must follow the existing Squadron rules');
  const mobile = css.slice(start, end);
  assert.match(mobile, /@media\s*\(max-width:620px\)/);
  assert.match(mobile, /\.gate-squadron-standalone #page-squadron \.gate-squadron-actions\s*\{[^}]*grid-column:1\/-1;[^}]*grid-row:2;[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(mobile, /\.gate-squadron-standalone #page-squadron \.gate-squadron-actions \.gate-squadron-utility\s*\{[^}]*min-height:44px;[^}]*white-space:normal/);
  assert.match(mobile, /\.gate-squadron-standalone #page-squadron \.gate-squadron-traffic\s*\{\s*grid-row:3;/);
  assert.doesNotMatch(mobile, /\.gate-squadron-heading\s*\{/, 'the mobile title layout stays untouched');
  assert.match(html, /\/css\/military-glass-terminal\.css\?v=squadron-mobile-actions-20261116-v1/);
  assert.match(controller, /id="squadron-enable-sound"/);
  assert.match(controller, /id="squadron-logout"/);
  assert.match(controller, /byId\('squadron-enable-sound'\)\?\.addEventListener\('click'/);
  assert.match(controller, /byId\('squadron-logout'\)\?\.addEventListener\('click'/);
});
