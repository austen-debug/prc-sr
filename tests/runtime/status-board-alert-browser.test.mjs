import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = name => readFile(resolve(root, name), 'utf8');

function chromium() {
  for (const binary of [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    const check = spawnSync(binary, ['--version'], { encoding: 'utf8', timeout: 3000 });
    if (check.status === 0) return binary;
  }
  return null;
}

test('real Chromium proves inset orbit, female outline invariance, layout stability, and route exclusion', async () => {
  const browser = chromium();
  assert.ok(browser, 'Chromium/Google Chrome is required to validate the actual computed alert presentation');
  const components = (await source('public/js/gate-component-contracts.js')).replaceAll('</script>', '<\/script>');
  const cssUrl = pathToFileURL(resolve(root, 'public/css/military-glass-terminal.css')).href;

  const capture = [
    '(function () {',
    '  function dorm(id, sex) { return { __backendId: id, dorm_name: id, state: "open", phase: "OPEN",',
    '    opened_at: "2026-10-16T00:00:00", current_load: 25, max_load: 50,',
    '    sex: sex, sdq:"SDQ", section:"A", inter_sec:"2" }; }',
    '  window.getElapsedTimer = function () { return { text: "45:32" }; };',
    '  document.getElementById("col-open").innerHTML = window.GateComponents.dormCard(dorm("FEMALE", "female"));',
    '  document.getElementById("squadron-test").innerHTML = window.GateComponents.dormCard(dorm("SQUADRON", "female"));',
    '  document.getElementById("proc-dorm-grid").innerHTML =',
    '    "<div class=\"proc-card border-female\" data-gate-time-alert=\"warning\"><div class=\"font-black\">PROCESSING</div></div>";',
    '  const board = document.querySelector("#page-board #col-open .gate-dorm-card");',
    '  const timer = board.querySelector(".gate-dorm-timer");',
    '  const squadron = document.querySelector("#page-squadron .gate-dorm-card");',
    '  const processing = document.querySelector("#page-processing .proc-card");',
    '  const states = ["normal", "warning", "critical", "overtime"];',
    '  function snapshot(card) {',
    '    const style = getComputedStyle(card), overlay = getComputedStyle(card, "::after");',
    '    const rect = card.getBoundingClientRect(), label = card.querySelector(".gate-dorm-name");',
    '    const labelRect = label ? label.getBoundingClientRect() : null;',
    '    return { width:rect.width, height:rect.height, padLeft:style.paddingLeft,',
    '      labelInset:labelRect ? labelRect.left - rect.left : null,',
    '      border:style.borderLeftColor, borderWidth:style.borderLeftWidth, shadow:style.boxShadow,',
    '      pseudoContent:overlay.content, pseudoPointer:overlay.pointerEvents,',
    '      pseudoInset:overlay.top, pseudoBg:overlay.backgroundImage,',
    '      pseudoAnim:overlay.animationName, pseudoDuration:overlay.animationDuration,',
    '      mask:overlay.maskImage || overlay.webkitMaskImage, borderRadius:overlay.borderRadius };',
    '  }',
    '  let data = { viewport:window.innerWidth, themes:{}, excluded:{} };',
    '  for (const theme of ["night", "day"]) {',
    '    document.body.classList.toggle("theme-light", theme === "day");',
    '    data.themes[theme] = {};',
    '    for (const state of states) {',
    '      board.dataset.gateTimeAlert = state;',
    '      timer.classList.toggle("timer-yellow", state === "warning");',
    '      timer.classList.toggle("timer-red", state === "critical" || state === "overtime");',
    '      timer.classList.toggle("timer-flash", state === "overtime");',
    '      data.themes[theme][state] = { card:snapshot(board),',
    '        timerColor:getComputedStyle(timer).color,',
    '        timerAnim:getComputedStyle(timer).animationName };',
    '    }',
    '  }',
    '  squadron.dataset.gateTimeAlert = "warning";',
    '  data.excluded.squadron = snapshot(squadron);',
    '  data.excluded.processing = { after:getComputedStyle(processing,"::after").content,',
    '    border:getComputedStyle(processing).borderLeftColor };',
    '  document.getElementById("gate-style-results").textContent = JSON.stringify(data);',
    '}());'
  ].join('\n');

  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<link rel="stylesheet" href="' + cssUrl + '"></head><body>' +
    '<main id="page-board"><div id="col-open" style="width:320px"></div></main>' +
    '<main id="page-squadron"><div id="squadron-test" style="width:320px"></div></main>' +
    '<main id="page-processing"><div id="proc-dorm-grid" style="width:320px"></div></main>' +
    '<pre id="gate-style-results"></pre><script>' + components + '</script><script>' + capture + '</script></body></html>';

  const dir = await mkdtemp(join(tmpdir(), 'gate-alert-band-'));
  try {
    const fixture = join(dir, 'status-board-alert.html');
    await writeFile(fixture, html, 'utf8');
    for (const [profile, extra] of [
      ['desktop', ['--window-size=1366,900']],
      ['compact', ['--window-size=600,850']],
      ['reduced-motion', ['--window-size=1366,900', '--force-prefers-reduced-motion']]
    ]) {
      const run = spawnSync(browser, [
        '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
        '--disable-background-networking', '--no-first-run',
        '--user-data-dir=' + join(dir, 'chrome-' + profile),
        ...extra, '--dump-dom', pathToFileURL(fixture).href
      ], { encoding: 'utf8', timeout: 25000, maxBuffer: 3 * 1024 * 1024 });
      assert.equal(run.status, 0, profile + ' browser failed: ' + String(run.stderr || '').slice(-900));
      const raw = run.stdout.match(/<pre id="gate-style-results">([^<]+)<\/pre>/);
      assert.ok(raw, profile + ' did not produce computed styles: ' + run.stdout.slice(-300));
      const data = JSON.parse(raw[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
      assert.equal(data.excluded.squadron.pseudoContent, 'none', 'Squadron must not get an alert band');
      assert.equal(data.excluded.processing.after, 'none', 'Processing must not get an alert band');
      for (const [theme, states] of Object.entries(data.themes)) {
        const original = states.normal.card;
        assert.equal(original.pseudoContent, 'none', theme + '/' + profile + ': normal card got a band');
        for (const level of ['warning', 'critical', 'overtime']) {
          const current = states[level].card;
          assert.equal(current.width, original.width, theme + '/' + profile + ': band changed card width');
          assert.equal(current.height, original.height, theme + '/' + profile + ': band changed card height');
          assert.equal(current.padLeft, original.padLeft, theme + '/' + profile + ': padding changed');
          assert.equal(current.border, original.border, theme + '/' + profile + ': female red border changed');
          assert.equal(current.borderWidth, original.borderWidth, theme + '/' + profile + ': female border size changed');
          assert.equal(current.shadow, original.shadow, theme + '/' + profile + ': female ring/glow changed');
          assert.ok(current.labelInset >= 11, theme + '/' + profile + ': name lost inner text clearance');
          assert.equal(current.pseudoPointer, 'none', theme + '/' + profile + ': pseudo-element blocks clicks');
          assert.equal(current.pseudoInset, '6px', theme + '/' + profile + ': band is not inset');
          assert.match(current.pseudoBg, /conic-gradient/i, theme + '/' + profile + ': rotating gradient missing');
          assert.match(current.mask, /linear-gradient/i, theme + '/' + profile + ': gradient no longer limited to perimeter');
          if (profile === 'reduced-motion') {
            assert.equal(current.pseudoAnim, 'none', theme + '/' + profile + ': reduced-motion band still animated');
          } else {
            assert.equal(current.pseudoAnim, 'gate-board-alert-orbit', theme + '/' + profile + ': band does not animate');
            assert.equal(current.pseudoDuration, '4.5s', theme + '/' + profile + ': unexpected orbit cadence');
          }
        }
        assert.equal(states.normal.timerAnim, 'none', theme + '/' + profile + ': normal timer animated');
        assert.equal(states.warning.timerAnim, 'none', theme + '/' + profile + ': amber timer animated');
        assert.equal(states.critical.timerAnim, 'none', theme + '/' + profile + ': red 50-59 timer animated');
        assert.equal(states.overtime.timerAnim, 'mg-crit-pulse', theme + '/' + profile + ': overtime timer did not pulse');
      }
    }
  } finally {
    await rm(dir, { recursive:true, force:true });
  }
});
