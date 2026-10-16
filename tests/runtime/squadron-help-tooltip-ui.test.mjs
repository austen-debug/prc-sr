import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = path => readFile(resolve(root, path), 'utf8');
const js = await source('public/js/prc-dash-final-audit.js');
const css = await source('public/css/military-glass-terminal.css');

function section(code, from, to) {
  const a = code.indexOf(from), b = code.indexOf(to, a);
  assert.ok(a >= 0 && b > a, 'Cannot find Squadron tooltip owner: ' + from);
  return code.slice(a, b);
}
function chromium() {
  for (const binary of [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean))
    if (spawnSync(binary, ['--version'], { encoding:'utf8', timeout:3000 }).status === 0) return binary;
  return null;
}

const template = section(js,'  // Compact, decorative icon;', '  function ensureDocumentIdentity()');
const binder = section(js,'  // One floating tooltip keeps long descriptions', '  function bindSquadronControls(page)');
const escaped = text => String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const tooltipFactory = new Function('esc', template + '\nreturn tooltip;')(escaped);
const help = [
  ['Inbound Traffic','Trainees on their way from the Airport to the PRC.'],
  ['Arrived','Trainees that have arrived to the PRC.'],
  ['Expected','Number of Trainees expected to arrive this week.'],
  ['Last Confirmed','The last flight into San Antonio tonight.'],
  ['Empty','These dorms have not been opened yet.'],
  ['Open','These dorms have all required trainees and are currently processing at the PRC.'],
  ['Closed','These dorms have completed PRC processing.']
];

test('all seven existing Squadron contextual explanations are preserved with compact accessible SVG buttons', () => {
  assert.equal(help.length, 7);
  assert.equal((js.match(/tooltip\(/g) || []).length, 5, 'One helper and three dynamic dorm labels plus four static metric usages');
  for (const [name, description] of help) {
    assert.ok(js.includes(description), 'Source tooltip lost explanation: ' + name);
    const button = tooltipFactory(name, description);
    assert.match(button, /class="gate-info"/);
    assert.match(button, new RegExp('aria-label="About ' + name + '"','i'));
    assert.match(button, /gate-info__icon/);
    assert.match(button, /aria-hidden="true"/);
  }
  assert.match(js, /<div id="squadron-tooltip" class="gate-squadron-tooltip" role="tooltip" hidden>/);
  assert.match(js, /bindSquadronTooltips\(page\)/);
  assert.match(js, /button\.setAttribute\('aria-describedby', 'squadron-tooltip'\)/);
  assert.match(js, /if \(event\.key === 'Escape'\)/);
  assert.match(js, /button\.addEventListener\('click', \(\) => showTip\(button\)\)/);
  assert.match(js, /tip\.dataset\.open = 'true'/);
  assert.match(css, /@keyframes gate-squadron-info-jello/);
  assert.doesNotMatch(template, /squadron-information/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
});

test('the standalone Squadron page and app shell use the same fresh tooltip CSS/JS revision', async () => {
  const mw = await source('functions/_middleware.js');
  const standalone = await source('public/squadron/index.html');
  const budget = JSON.parse(await source('docs/build-2/ACTIVE_RUNTIME_BUDGET.json'));
  for (const uri of [
    '/css/military-glass-terminal.css?v=squadron-help-blue-20261016-v1',
    '/js/prc-dash-final-audit.js?v=squadron-help-blue-20261016-v1'
  ]) {
    assert.ok(mw.includes(uri), 'Middleware lacks latest Squadron UI asset ' + uri);
    assert.ok(standalone.includes(uri), 'Standalone Squadron route lacks latest UI asset ' + uri);
    assert.ok([...budget.currentDirectStyles, ...budget.currentDirectScripts].includes(uri), 'Runtime inventory lacks ' + uri);
  }
});

test('real Chromium renders compact blue info icon with animated tooltip above/below, Night/Day, click, focus, Escape and motion reduction', async () => {
  const binary = chromium();
  assert.ok(binary, 'Chromium required to validate new Squadron tooltip visual behavior');
  const cssHref = pathToFileURL(resolve(root, 'public/css/military-glass-terminal.css')).href;
  const examples = help.map(([label,description]) =>
    '<div class="gate-squadron-metric-head"><span>' + escaped(label.toUpperCase()) + '</span>' +
    tooltipFactory(label,description) + '</div>').join('');
  const appScript = [
    'const byId = id => document.getElementById(id);',
    binder,
    '(async function(){',
    ' const page=document.getElementById("page-squadron");',
    ' bindSquadronTooltips(page);',
    ' const b=page.querySelector(".gate-info");',
    ' const icon=b.querySelector(".gate-info__icon");',
    ' const tip=byId("squadron-tooltip");',
    ' const row=b.closest(".gate-squadron-metric-head");',

    ' const dims=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};',
    ' const result={count:page.querySelectorAll(".gate-info").length,themes:{}};',
    ' for(const theme of ["night","day"]){',
    '  document.body.classList.toggle("theme-light",theme==="day");',
    '  const initial={button:dims(b),row:dims(row),gradient:getComputedStyle(b).backgroundImage,iconColor:getComputedStyle(icon).color,hidden:tip.hidden};',
    '  b.dispatchEvent(new Event("mouseenter"));',
    '  const style=getComputedStyle(tip);',
    '  const open={button:dims(b),row:dims(row),tip:dims(tip),text:tip.textContent,open:tip.dataset.open,',
    '    aria:b.getAttribute("aria-describedby"),background:style.backgroundImage,opacity:style.opacity,',
    '    placement:tip.dataset.placement,transform:style.transform,events:style.pointerEvents};',
    '  b.dispatchEvent(new Event("mouseleave"));',
    '  b.focus();',
    '  const focused={aria:b.getAttribute("aria-describedby"),open:tip.dataset.open,iconAnimation:getComputedStyle(icon).animationName};',
    '  b.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));',
    '  const escaped={aria:b.getAttribute("aria-describedby"),open:tip.dataset.open};',
    '  b.click();',
    '  const tapped={open:tip.dataset.open,aria:b.getAttribute("aria-describedby")};',
    '  result.themes[theme]={initial,open,focused,escaped,tapped};',
    '  b.dispatchEvent(new Event("mouseleave"));',
    ' }',
    ' result.allButtons=[...page.querySelectorAll(".gate-info")].every(x=>getComputedStyle(x).width==="22px");',
    ' document.getElementById("results").textContent=JSON.stringify(result);',
    '})();'
  ].join('\n');
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'+
    '<link rel="stylesheet" href="' + cssHref + '"></head><body><main id="page-squadron">' +
    '<section class="gate-squadron-view"><div class="gate-squadron-metrics" style="display:block;width:min(100%,320px);padding:14px">' +
    examples + '</div><div id="squadron-tooltip" class="gate-squadron-tooltip" role="tooltip" hidden></div></section>' +
    '</main><pre id="results"></pre><script>' + appScript.replaceAll('</script>', '<\\/script>') + '</script></body></html>';
  const dir = await mkdtemp(join(tmpdir(),'gate-squadron-help-'));
  try {
    const fixture=join(dir,'squadron-help.html');await writeFile(fixture,html,'utf8');
    for (const [mode,flags] of [
      ['desktop',['--window-size=1366,850']],
      ['compact',['--window-size=370,750']],
      ['reduced',['--window-size=800,850','--force-prefers-reduced-motion']]
    ]) {
      const run=spawnSync(binary,[
        '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run',
        '--disable-background-networking','--user-data-dir='+join(dir,'chromium-'+mode),
        '--virtual-time-budget=2200',...flags,'--dump-dom',pathToFileURL(fixture).href
      ],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
      assert.equal(run.status,0,mode+' Chrome failure: '+String(run.stderr||'').slice(-900));
      const m=run.stdout.match(/<pre id="results">([^<]+)<\/pre>/);
      assert.ok(m,mode+' browser produced no computed snapshot: '+run.stdout.slice(-360));
      const data=JSON.parse(m[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));
      assert.equal(data.count,7);
      assert.equal(data.allButtons,true,mode+' icon scale not uniform');
      for(const [theme,s] of Object.entries(data.themes)){
        const label=mode+'/'+theme;
        assert.equal(s.initial.hidden,true,label+' tooltip visible at rest');
        assert.equal(s.initial.button.width,22,label+' icon width changed');
        assert.equal(s.initial.button.height,22,label+' icon height changed');
        assert.match(s.initial.gradient,/linear-gradient/i,label+' blue gradient button missing');
        assert.equal(s.open.open,'true',label+' hover did not open tooltip');
        assert.equal(s.open.aria,'squadron-tooltip',label+' aria-describedby missing');
        assert.equal(s.open.events,'none',label+' tooltip could intercept clicks');
        assert.match(s.open.background,/linear-gradient/i,label+' tooltip gradient missing');
        assert.equal(s.open.text,help[0][1],label+' text changed');
        assert.ok(s.open.tip.width<=260,label+' tooltip oversized');
        assert.ok(s.open.tip.x>=7&&s.open.tip.right<=1366,label+' tooltip horizontal overflow');
        assert.equal(s.open.row.height,s.initial.row.height,label+' tooltip moved metric heading');
        assert.equal(s.focused.open,'true',label+' focus did not display tooltip');
        assert.equal(s.escaped.open,'false',label+' Escape did not close tooltip');
        assert.equal(s.escaped.aria,null,label+' Escape did not restore accessibility state');
        assert.equal(s.tapped.open,'true',label+' click did not display tooltip');
        assert.equal(s.tapped.aria,'squadron-tooltip',label+' click lost aria-describedby');
        if(mode==='reduced')assert.equal(s.focused.iconAnimation,'none',label+' motion preference ignored');
      }
    }
  } finally {await rm(dir,{recursive:true,force:true});}
});
