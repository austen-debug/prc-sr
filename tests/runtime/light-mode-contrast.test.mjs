import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../../public/css/military-glass-terminal.css', import.meta.url), 'utf8');
const block = css.split('/* Block B — primitives, light */')[1]?.split('/* Block C — derived tokens')[0];
function value(key) {
  const match = block?.match(new RegExp(`--${key}:\\s*(#[0-9a-fA-F]{6});`));
  assert.ok(match, `Expected solid light-theme token ${key}`);
  return match[1];
}
function luminance(hex) {
  const [r,g,b] = [1,3,5].map(offset => parseInt(hex.slice(offset,offset+2),16)/255)
    .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return r*.2126 + g*.7152 + b*.0722;
}
function contrast(first, second) {
  const [hi,lo] = [luminance(first),luminance(second)].sort((a,b) => b-a);
  return (hi + .05)/(lo + .05);
}
test('light theme retains readable blue-gray foreground on light backgrounds', () => {
  for (const token of ['mg-text','mg-text-soft','mg-text-muted','mg-accent']) {
    assert.ok(contrast(value(token), value('mg-bg')) >= 4.5, `${token} must meet normal-text contrast on the canvas`);
    assert.ok(contrast(value(token), '#ffffff') >= 4.5, `${token} must meet normal-text contrast on white surfaces`);
  }
});
test('native sex dropdown options explicitly use dark ink on white and preserve one canonical CSS asset', () => {
  assert.match(css, /GATE LIGHT THEME: native form controls and option-list contrast/);
  assert.match(css, /body\.theme-light #page-input select\.batch-sex option\s*\{[\s\S]*?background-color:\s*#ffffff;[\s\S]*?color:\s*#10243a;/);
  assert.doesNotMatch(css, /@import\s+url\(/);
  assert.doesNotMatch(css, /!important\s*;/);
});
