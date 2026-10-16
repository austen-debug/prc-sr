import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = path => readFile(resolve(root, path), 'utf8');

function findBrowser() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    const check = spawnSync(name, ['--version'], { encoding: 'utf8', timeout: 3000 });
    if (check.status === 0) return name;
  }
  return null;
}

test('real Chromium computed styles make all five Processing commands visible in Night and Day', async () => {
  const browser = findBrowser();
  assert.ok(browser, 'Google Chrome or Chromium must be installed for the rendering regression test');
  const sourceHtml = await source('public/index.html');
  const start = sourceHtml.indexOf('<div id="dorm-modal"');
  const end = sourceHtml.indexOf('<!-- End Dorm Processing Modal -->', start);
  assert.ok(start >= 0 && end > start, 'Missing real Processing modal markup');

  let modal = sourceHtml.slice(start, end)
    .replace('class="confirm-overlay hidden"', 'class="confirm-overlay"');
  const buttons = [
    '<button type="button" class="gate-processing-command gate-processing-command--reopen" data-processing-action="reopen-dorm"><span class="gate-processing-command__label">REOPEN DORM</span></button>',
    '<button type="button" class="gate-processing-command gate-processing-command--secondary" data-processing-action="edit-record"><span class="gate-processing-command__label">EDIT RECORD</span></button>'
  ].join('');
  modal = modal.replace(
    '<div id="modal-action-section" class="flex gap-3 justify-center"></div>',
    '<div id="modal-action-section" class="flex gap-3 justify-center">' + buttons + '</div>'
  );
  const cssUrl = pathToFileURL(resolve(root, 'public/css/military-glass-terminal.css')).href;
  const capture = [
    '(function () {',
    '  const selectors = [',
    '    ["SAVE", "#dorm-modal button[onclick=\u0022saveAssignedAirman()\u0022]"],',
    '    ["FULL", "#dorm-modal button[onclick=\u0022setLoadFull()\u0022]"],',
    '    ["SAVE LOAD", "#dorm-modal button[onclick=\u0022saveLoad()\u0022]"],',
    '    ["REOPEN DORM", "#dorm-modal [data-processing-action=\u0022reopen-dorm\u0022]"],',
    '    ["EDIT RECORD", "#dorm-modal [data-processing-action=\u0022edit-record\u0022]"]',
    '  ];',
    '  const results = {};',
    '  for (const theme of ["night", "day"]) {',
    '    document.body.classList.toggle("theme-light", theme === "day");',
    '    results[theme] = selectors.map(([name, selector]) => {',
    '      const button = document.querySelector(selector);',
    '      if (!button) return { name, missing: true };',
    '      const style = getComputedStyle(button);',
    '      const pseudo = getComputedStyle(button, "::before");',
    '      const bounds = button.getBoundingClientRect();',
    '      return { name, height: bounds.height, background: style.backgroundColor,',
    '        borderStyle: style.borderTopStyle, borderWidth: style.borderTopWidth,',
    '        gradient: pseudo.backgroundImage, label: button.textContent.trim() };',
    '    });',
    '  }',
    '  document.getElementById("gate-style-results").textContent = JSON.stringify(results);',
    '}());'
  ].join('\n');
  const html = '<!doctype html><html><head><meta charset="utf-8">' +
    '<link rel="stylesheet" href="' + cssUrl + '"></head><body>' + modal +
    '<pre id="gate-style-results"></pre><script>' + capture + '</script></body></html>';

  const dir = await mkdtemp(join(tmpdir(), 'gate-browser-'));
  try {
    const fixture = join(dir, 'processing-buttons.html');
    await writeFile(fixture, html, 'utf8');
    const run = spawnSync(browser, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--disable-background-networking', '--no-first-run',
      '--user-data-dir=' + join(dir, 'chrome-profile'),
      '--dump-dom', pathToFileURL(fixture).href
    ], { encoding: 'utf8', timeout: 25000, maxBuffer: 1024 * 1024 * 2 });
    assert.equal(run.status, 0, 'Headless browser could not finish: ' + String(run.stderr || '').slice(-500));
    const match = run.stdout.match(/<pre id="gate-style-results">([^<]+)<\/pre>/);
    assert.ok(match, 'Browser did not return computed Processing button styles');
    const results = JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
    for (const [theme, entries] of Object.entries(results)) {
      assert.equal(entries.length, 5);
      for (const value of entries) {
        assert.equal(value.missing, undefined, theme + ': ' + value.name + ' is missing');
        assert.ok(value.height >= 43.9, theme + ': ' + value.name + ' is under the touch target');
        assert.equal(value.borderStyle, 'solid', theme + ': ' + value.name + ' has no visible border');
        assert.ok(parseFloat(value.borderWidth) > 0, theme + ': ' + value.name + ' has no border width');
        assert.notEqual(value.background, 'rgba(0, 0, 0, 0)', theme + ': ' + value.name + ' is transparent');
        assert.match(value.gradient, /linear-gradient/, theme + ': ' + value.name + ' has no sweep layer');
        assert.equal(value.label, value.name, theme + ': label changed');
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
