import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const source = path => readFile(resolve(root, path), 'utf8');
const exists = path => access(resolve(root, path)).then(() => true, () => false);

const canonicalSounds = [
  'gate_bus_sound.mp3',
  'gate_closed_sound.mp3',
  'gate_enable_sound.mp3',
  'gate_error_sound.mp3',
  'gate_open_sound.mp3',
  'gate_overtime_sound.mp3',
  'gate_plop_sound.mp3'
];

test('canonical GATE sounds live only under assets/sounds', async () => {
  for (const file of canonicalSounds) {
    assert.equal(await exists(`public/assets/sounds/${file}`), true, `${file} must exist in assets/sounds`);
    assert.equal(await exists(`public/assets/${file}`), false, `${file} must not remain at the assets root`);
  }

  for (const file of ['sr_bus_sound.mp3', 'sr_closed_sound.mp3', 'sr_open_sound.mp3', 'sr_overtime_sound.mp3']) {
    assert.equal(await exists(`public/assets/${file}`), false, `${file} legacy asset must be deleted`);
  }

  assert.equal(await exists('public/assets/sounds/sounds'), false, 'sounds directory placeholder must be removed');
});

test('active runtime references only canonical sound assets', async () => {
  const paths = [
    'public/index.html',
    'public/js/prc-dash-runtime-fixes.js',
    'public/js/prc-dash-dorm-reopen.js',
    'public/js/prc-dash-final-audit.js'
  ];
  const sources = await Promise.all(paths.map(source));
  for (const text of sources) {
    assert.doesNotMatch(text, /\/assets\/sr_(?:bus|closed|open|overtime)_sound\.mp3/);
  }

  const soundLayer = sources[2];
  for (const file of canonicalSounds) {
    assert.match(soundLayer, new RegExp(`/assets/sounds/${file.replace('.', '\\.')}`));
  }
});

test('main SOUND button toggles operational sounds on and off', async () => {
  const [html, soundLayer] = await Promise.all([
    source('public/index.html'),
    source('public/js/prc-dash-dorm-reopen.js')
  ]);

  assert.match(html, /onclick="toggleOperationalSounds\(\)"/);
  assert.match(html, /function disableOperationalSounds\(\)/);
  assert.match(html, /function toggleOperationalSounds\(\)/);
  assert.match(soundLayer, /function disableGateOperationalSounds\(event\)/);
  assert.match(soundLayer, /async function toggleGateOperationalSounds\(event\)/);
  assert.match(soundLayer, /syncSoundEnabled\(false\)/);
  assert.match(soundLayer, /button\.onclick = toggleGateOperationalSounds/);
  assert.match(soundLayer, /toggle:\s*toggleGateOperationalSounds/);
});

test('popup plop is forced independently of the operational sound toggle', async () => {
  const [soundLayer, hooks, html] = await Promise.all([
    source('public/js/prc-dash-dorm-reopen.js'),
    source('public/js/gate-ui-hooks.js'),
    source('public/index.html')
  ]);

  assert.match(soundLayer, /plop:\s*'\/assets\/sounds\/gate_plop_sound\.mp3'/);
  assert.match(soundLayer, /const POPUP_SELECTOR = '[^']*\.confirm-overlay[^']*dialog[^']*role="dialog"[^']*role="alertdialog"[^']*'/);
  assert.match(soundLayer, /playGateSound\('plop', \{ force: true \}\)/);
  assert.match(soundLayer, /if \(!src \|\| \(!force && !soundIsEnabled\(\)\)\) return;/);
  assert.match(soundLayer, /popupVisibility = new WeakMap\(\)/);

  assert.match(hooks, /root\.className = 'confirm-overlay'/);
  assert.match(html, /id="init-success-overlay"[^>]*confirm-overlay/);
});

test('Squadron popup and alert audio use canonical sound paths', async () => {
  const squadron = await source('public/js/prc-dash-final-audit.js');
  assert.match(squadron, /PLOP_SOUND_SRC = '\/assets\/sounds\/gate_plop_sound\.mp3'/);
  assert.match(squadron, /new Audio\('\/assets\/sounds\/gate_bus_sound\.mp3'\)/);
  assert.match(squadron, /dialog\.showModal\(\);[\s\S]*playSquadronPopupSound\(\)/);
});
