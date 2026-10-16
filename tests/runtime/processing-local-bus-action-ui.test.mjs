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
  const cssUrl = '/css/military-glass-terminal.css?v=squadron-help-centered-20261016-v2';
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

test('Add Local Bus uses the same transient command sweep as Processing popup buttons, not the dorm orbit', async () => {
  const css = await source('public/css/military-glass-terminal.css');
  const commandStart = css.indexOf('Processing command buttons: restrained gradient-sweep treatment.');
  const commandEnd = css.indexOf('/* The three Processing write paths show inline, accessible feedback',commandStart);
  assert.ok(commandStart > 0 && commandEnd > commandStart, 'Canonical modal button treatment missing');
  const commands = css.slice(commandStart, commandEnd);
  for (const rule of [
    '#page-processing #processing-add-local-bus {',
    '#page-processing #processing-add-local-bus::before {',
    '#page-processing #processing-add-local-bus:not(:disabled):hover::before {',
    '#page-processing #processing-add-local-bus:focus-visible::before {'
  ]) assert.ok(commands.includes(rule), 'Local Bus does not share modal CSS rule: ' + rule);
  assert.match(commands, /transform: scaleX\(0\)/);
  assert.match(commands, /transform: scaleX\(1\)/);
  assert.match(commands, /transition: transform 180ms ease/);
  assert.match(commands, /--gate-command-sweep: linear-gradient/);
  assert.match(commands, /#dorm-modal \.gate-processing-command--reopen,\s*#page-processing #processing-add-local-bus/);
  const busStart = css.indexOf('/* Add Local Bus shares');
  const busEnd = css.indexOf('#page-processing #proc-dorm-grid',busStart);
  assert.ok(busStart >= 0 && busEnd > busStart);
  const busCss = css.slice(busStart,busEnd);
  assert.doesNotMatch(busCss, /gate-board-alert-orbit|conic-gradient|infinite/, 'Idle button cannot reuse continuous dorm alert banding');
  assert.match(css, /#page-processing #processing-add-local-bus:focus-visible/);
  assert.match(css, /#page-processing #processing-add-local-bus:disabled/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
});

test('real Chromium verifies motionless idle, shared popup sweep, focus state, unchanged label and Local Bus action', async () => {
  const binary=chromeBinary();
  assert.ok(binary,'Chromium is required for Processing command button computed style checks');
  const processing=pageMarkup('processing','<!-- PAGE: ARCHIVES -->');
  const match=processing.match(/<button id="processing-add-local-bus"[\s\S]*?<\/button>/);
  assert.ok(match,'Local Bus must remain in the Processing markup');
  const src=pathToFileURL(resolve(root,'public/css/military-glass-terminal.css')).href;
  const script=[
    'window.busModalOpened=0;',
    'window.openLocalBusModal=function(){window.busModalOpened++;};',
    'const b=document.getElementById("processing-add-local-bus");',
    'const label=b.querySelector(".gate-processing-local-bus-action__label");',
    'const read=()=>{',
    ' const s=getComputedStyle(b),p=getComputedStyle(b,"::before");',
    ' const br=b.getBoundingClientRect(),lr=label.getBoundingClientRect();',
    ' return {width:br.width,height:br.height,buttonBackground:s.backgroundColor,',
    '  label:label.textContent.trim(), labelLeft:lr.left,labelRight:lr.right,',
    '  buttonLeft:br.left,buttonRight:br.right, pseudoContent:p.content,',
    '  gradient:p.backgroundImage,mask:p.maskImage||p.webkitMaskImage,',
    '  transform:p.transform,transition:p.transitionProperty,duration:p.transitionDuration,',
    '  animation:p.animationName,pointer:p.pointerEvents,',
    '  focusVisible:b.matches(":focus-visible"),outline:s.outlineStyle };',
    '};',
    'const data={};',
    'for(const theme of ["night","day"]){',
    ' document.body.classList.toggle("theme-light",theme==="day");',
    ' b.blur();',
    ' const idle=read();',
    ' b.focus();',
    ' const focused=read();',
    ' b.blur();',
    ' const again=read();',
    ' data[theme]={idle,focused,again};',
    '}',
    'b.click();data.clicked=window.busModalOpened;',
    'document.getElementById("result").textContent=JSON.stringify(data);'
  ].join('\n');
  const page='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<link rel="stylesheet" href="'+src+'"></head><body><main id="page-processing">'+match[0]+
    '</main><pre id="result"></pre><script>'+script+'</script></body></html>';
  const dir=await mkdtemp(join(tmpdir(),'gate-bus-command-'));
  try {
    const file=join(dir,'button.html');await writeFile(file,page,'utf8');
    for(const [name,opts] of [
      ['desktop',['--window-size=1280,850']],
      ['compact',['--window-size=375,810']],
      ['reduced',['--window-size=1280,850','--force-prefers-reduced-motion']]
    ]) {
      const run=spawnSync(binary,[
        '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
        '--no-first-run','--disable-background-networking','--user-data-dir='+join(dir,name),
        ...opts,'--dump-dom',pathToFileURL(file).href
      ],{encoding:'utf8',timeout:30000,maxBuffer:3*1024*1024});
      assert.equal(run.status,0,name+' Chromium failed: '+String(run.stderr||'').slice(-500));
      const m=run.stdout.match(/<pre id="result">([^<]+)<\/pre>/);
      assert.ok(m,name+' missing button computed styles');
      const data=JSON.parse(m[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));
      assert.equal(data.clicked,1,name+' existing openLocalBusModal handler changed');
      for(const [theme,states] of Object.entries({night:data.night,day:data.day})){
        const tag=name+'/'+theme,{idle,focused,again}=states;
        assert.ok(idle.width>150&&idle.height>=48,tag+' toolbar dimensions changed');
        assert.equal(idle.label,'+ ADD LOCAL BUS',tag+' label changed');
        assert.ok(idle.labelLeft>=idle.buttonLeft&&idle.labelRight<=idle.buttonRight,tag+' label clipped');
        assert.equal(idle.pseudoContent,'""',tag+' sweep overlay is missing');
        assert.equal(idle.pointer,'none',tag+' overlay intercepts click');
        assert.match(idle.gradient,/linear-gradient/,tag+' popup sweep is missing');
        assert.equal(idle.animation,'none',tag+' button must not animate continuously');
        assert.equal(idle.transform,'matrix(0, 0, 0, 1, 0, 0)',tag+' sweep must be collapsed at rest');
        assert.equal(idle.transition,'transform',tag+' popup sweep transition missing');
        assert.equal(idle.duration,name==='reduced'?'0s':'0.18s',tag+' transition duration mismatch');
        assert.equal(focused.focusVisible,true,tag+' keyboard focus must be visible');
        assert.equal(again.animation,'none',tag+' button should not orbit after focus');
      }
    }
  } finally {await rm(dir,{recursive:true,force:true});}
});
