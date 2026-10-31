import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sound = readFileSync(new URL('../../public/js/prc-dash-dorm-reopen.js', import.meta.url), 'utf8');
const squadron = readFileSync(new URL('../../public/js/prc-dash-final-audit.js', import.meta.url), 'utf8');

function extract(start, end) {
  const first = sound.indexOf(start);
  const last = sound.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `Missing audio function: ${start}`);
  return sound.slice(first, last);
}

const patternText = sound.match(/const ERROR_TEXT_PATTERN = (\/[^\n]+\/i);/)?.[1];
assert.ok(patternText, 'Operational error classifier must remain declared');
const pattern = new Function(`return ${patternText};`)();

function detector() {
  let sounds = 0;
  const policy = new Function('ERROR_TEXT_PATTERN','recentErrorSignals','playGateErrorSound','elementIsVisible',
    extract('  function elementLooksLikeError(el) {','  function scanVisibleErrors(root) {') +
    '\nreturn {elementLooksLikeError,signalErrorFromElement};'
  )(pattern,new WeakMap(),()=>sounds++,()=>true);
  return { ...policy, get sounds() {return sounds;} };
}

function status(text) {
  return {
    nodeType: 1,
    textContent: text,
    id: 'squadron-status',
    className: 'gate-squadron-status',
    classList: {contains:()=>false},
    style: {color:''},
    tagName:'DIV'
  };
}

test('no active Week Group is an idle state, not an error event on repeated Squadron refreshes',()=>{
  const policy=detector();
  const el=status('Read-only SITREP · last refresh 21:55 · no active group');
  policy.signalErrorFromElement(el);
  el.textContent='Read-only SITREP · last refresh 21:56 · no active group';
  policy.signalErrorFromElement(el);
  el.textContent='Read-only SITREP · last refresh 22:00 · no active group';
  policy.signalErrorFromElement(el);
  assert.equal(policy.sounds,0);
  assert.equal(policy.elementLooksLikeError(el),false);
  assert.match(squadron,/no active group/);
  assert.match(squadron,/POLL_MS = 15000/);
});

test('unchanged true errors only sound once until resolved, but new messages remain audible',()=>{
  const policy=detector();
  const el=status('Data unavailable · Unable to refresh');
  policy.signalErrorFromElement(el);
  policy.signalErrorFromElement(el);
  assert.equal(policy.sounds,1);
  el.textContent='Data unavailable · Connection failed';
  policy.signalErrorFromElement(el);
  assert.equal(policy.sounds,2);
  el.textContent='Read-only SITREP · no active group';
  policy.signalErrorFromElement(el);
  el.textContent='Data unavailable · Unable to refresh';
  policy.signalErrorFromElement(el);
  assert.equal(policy.sounds,3,'new transition after recovery should still sound');
});

test('recurrent identical global errors have a 60-second audio cooldown',()=>{
  let sounds=0;
  let now=1000;
  const fn=new Function('recentGlobalErrorSignals','GLOBAL_ERROR_SOUND_COOLDOWN_MS','playGateErrorSound','Date',
    extract('  function signalGlobalError(event) {','  function patchGlobalErrorSounds() {') +
    '\nreturn signalGlobalError;'
  )(new Map(),60000,()=>sounds++,{now:()=>now});
  fn({type:'error',message:'Squadron poll failed'});
  now=16000;
  fn({type:'error',message:'Squadron poll failed'});
  assert.equal(sounds,1);
  fn({type:'error',message:'Independent error'});
  assert.equal(sounds,2);
  now=62000;
  fn({type:'error',message:'Squadron poll failed'});
  assert.equal(sounds,3);
});
