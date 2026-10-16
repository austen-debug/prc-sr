import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = name => readFile(resolve(root, name), 'utf8');
const html = await source('public/index.html');
const css = await source('public/css/military-glass-terminal.css');
const placement = await source('public/app/features/input/week-group-action-placement.mjs');

function chromeBinary() {
  for (const bin of [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 3000 }).status === 0) return bin;
  }
  return null;
}
function pageMarkup(id, next) {
  const from = html.indexOf('<div id="page-' + id + '"');
  const to = html.indexOf(next, from);
  assert.ok(from >= 0 && to > from, 'Page source is missing: ' + id);
  return html.slice(from, to);
}

test('raw served HTML never contains Week Group closeout inside Processing even before any scripts', async () => {
  const input = pageMarkup('input', '<!-- PAGE: PROCESSING -->');
  const processing = pageMarkup('processing', '<!-- PAGE: ARCHIVES -->');
  assert.match(input, /id="closeout-btn"[^>]*onclick="initiateCloseout\(\)"/);
  assert.equal((html.match(/id="closeout-btn"/g) || []).length, 1, 'single original closeout handler node');
  assert.doesNotMatch(processing, /id="closeout-btn"|CLOSE OUT WEEK GROUP|initiateCloseout/);
  assert.match(processing, /id="processing-add-local-bus"[^>]*onclick="openLocalBusModal\(\)"/);
  assert.match(processing, /gate-processing-local-bus-action__label">\+ ADD LOCAL BUS/);
  assert.doesNotMatch(placement, /const processing = byId\(doc, 'page-processing'\)/);
  assert.match(placement, /!page.contains\(closeout\)/);
  assert.match(placement, /closeout.parentElement !== closeoutPanel/);
  assert.match(await source('public/js/gate-bus-workflow-controller.js'), /window.openLocalBusModal = openLocalBusModalCanonical/);
  assert.match(await source('public/js/gate-archive-controller.js'), /function initiateCloseoutCanonical\(/);
});

test('Input placement module and stylesheet references have fresh independent release URLs', async () => {
  const middleware = await source('functions/_middleware.js');
  const standalone = await source('public/squadron/index.html');
  const budget = JSON.parse(await source('docs/build-2/ACTIVE_RUNTIME_BUDGET.json'));
  const flight = await source('public/app/features/input/flight-alert-import.mjs');
  const cssUrl = '/css/military-glass-terminal.css?v=squadron-help-blue-20261016-v1';
  const importUrl = '/app/features/input/flight-alert-import.mjs?v=flight-alert-import-20261016-input-closeout-v1';
  assert.ok(middleware.includes(cssUrl));
  assert.ok(standalone.includes(cssUrl));
  assert.ok(budget.currentDirectStyles.includes(cssUrl));
  assert.ok(middleware.includes(importUrl));
  assert.ok(budget.currentDirectScripts.includes(importUrl));
  assert.match(flight, /week-group-action-placement\.mjs\?v=input-closeout-native-20261016-v1/);
  assert.ok(middleware.includes('/js/gate-processing-controller.js?v=processing-dorm-cards-20261016-v2'));
  assert.doesNotMatch(css, /#page-processing #closeout-btn/);
});

test('real Chromium verifies continuous inner orbit, untouched text, no input interception, and local-bus click handling', async () => {
  const binary = chromeBinary();
  assert.ok(binary, 'Chromium is required for browser-computed button animation');
  const processing = pageMarkup('processing', '<!-- PAGE: ARCHIVES -->');
  const match = processing.match(/<button id="processing-add-local-bus"[\s\S]*?<\/button>/);
  assert.ok(match, 'Local Bus button is required in Processing raw HTML');
  const src = pathToFileURL(resolve(root,'public/css/military-glass-terminal.css')).href;
  const script = [
    'window.busModalOpened=0;',
    'window.openLocalBusModal=function(){window.busModalOpened++;};',
    'const button=document.getElementById("processing-add-local-bus");',
    'const label=button.querySelector(".gate-processing-local-bus-action__label");',
    'const read=()=>{',
    ' const s=getComputedStyle(button),p=getComputedStyle(button,"::before"),l=getComputedStyle(label);',
    ' const rect=button.getBoundingClientRect(),labelRect=label.getBoundingClientRect();',
    ' return {width:rect.width,height:rect.height,background:s.backgroundColor,color:s.color,',
    '  display:s.display,outline:s.outlineWidth,pseudoContent:p.content,',
    '  pseudoInset:p.top,pseudoBg:p.backgroundImage,pseudoMask:p.maskImage||p.webkitMaskImage,',
    '  pseudoPointer:p.pointerEvents,animation:p.animationName,animationDuration:p.animationDuration,',
    '  labelZ:l.zIndex,labelText:label.textContent,labelX:labelRect.x,labelRight:labelRect.right,',
    '  buttonX:rect.x,buttonRight:rect.right};',
    '};',
    'const output={};',
    'for(const mode of ["night","day"]){document.body.classList.toggle("theme-light",mode==="day");output[mode]=read();}',
    'button.click();output.clicked=window.busModalOpened;',
    'document.getElementById("result").textContent=JSON.stringify(output);'
  ].join('\n');
  const page = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<link rel="stylesheet" href="'+src+'"></head><body><main id="page-processing">'+match[0]+
    '</main><pre id="result"></pre><script>'+script+'</script></body></html>';
  const dir = await mkdtemp(join(tmpdir(),'gate-bus-action-'));
  try {
    const file = join(dir,'bus-button.html');
    await writeFile(file,page,'utf8');
    for (const [name,opts] of [
      ['desktop', ['--window-size=1280,850']],
      ['compact', ['--window-size=375,810']],
      ['reduced', ['--window-size=1280,850','--force-prefers-reduced-motion']]
    ]) {
      const run = spawnSync(binary,[
        '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
        '--no-first-run','--disable-background-networking','--user-data-dir='+join(dir,name),
        ...opts,'--dump-dom',pathToFileURL(file).href
      ],{encoding:'utf8',timeout:30000,maxBuffer:3*1024*1024});
      assert.equal(run.status,0,name+' chromium failure '+String(run.stderr).slice(-400));
      const found=run.stdout.match(/<pre id="result">([^<]+)<\/pre>/);
      assert.ok(found,name+' computed styles were not output');
      const data=JSON.parse(found[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));
      assert.equal(data.clicked,1,name+' original local bus handler did not execute');
      for (const theme of ['night','day']) {
        const t=data[theme],tag=name+'/'+theme;
        assert.ok(t.width>150&&t.height>=48,tag+' button size too small');
        assert.equal(t.pseudoContent,'""',tag+' missing orbit layer');
        assert.equal(t.pseudoPointer,'none',tag+' orbit intercepts pointer events');
        assert.equal(t.pseudoInset,'3px',tag+' orbit must stay inside button');
        assert.match(t.pseudoBg,/conic-gradient/i,tag+' rotating gradient absent');
        assert.match(t.pseudoMask,/linear-gradient/i,tag+' orbit not masked to edge');
        assert.equal(t.animation,name==='reduced'?'none':'gate-board-alert-orbit',tag+' incorrect motion preference');
        assert.equal(t.labelText,'+ ADD LOCAL BUS',tag+' label not visible');
        assert.ok(t.labelX>=t.buttonX&&t.labelRight<=t.buttonRight,tag+' label clips');
      }
    }
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});
