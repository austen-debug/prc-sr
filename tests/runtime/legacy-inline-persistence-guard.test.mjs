import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');
function portion(from, to) {
  const start = html.indexOf(from);
  const end = html.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, 'Legacy fallback function markers must remain visible to this guard');
  return html.slice(start, end);
}
test('legacy inline Week Group initialization is fail-closed and cannot create individual dorm records', () => {
  const code = portion('async function initializeWeekGroup() {', 'function returnToBoard() {');
  assert.doesNotMatch(code, /dataSdk\.(?:create|update|delete)\s*\(/);
  assert.match(code, /no records were changed/i);
});
test('legacy inline closeout cannot archive then delete source records one at a time', () => {
  const code = portion('function initiateCloseout() {', 'function showMsg(elId, msg, isErr) {');
  assert.doesNotMatch(code, /dataSdk\.(?:create|update|delete)\s*\(/);
  assert.match(code, /no records were changed/i);
});
