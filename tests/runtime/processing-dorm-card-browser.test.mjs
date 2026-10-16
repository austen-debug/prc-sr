import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = name => readFile(resolve(root, name), 'utf8');
function chromeBinary() {
  for (const binary of [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    if (spawnSync(binary, ['--version'], { encoding:'utf8', timeout:3000 }).status === 0) return binary;
  }
  return null;
}
function sourcePart(text, first, last) {
  const a = text.indexOf(first), b = text.indexOf(last, a);
  assert.ok(a >= 0 && b > a, 'Source method missing: ' + first);
  return text.slice(a,b);
}
function makeCards(controller) {
  const render = new Function('recordDisplay','getElapsedTimer','esc','n',
    sourcePart(controller,'  // Presentation only.','  function renderProcessingPageCanonical(') +
    '\nreturn { processingCard };')(
      () => ({normalizeDormFlags:d=>({band:d.band==='true',spaceForce:d.space_force==='true'})}),
      opened => {
        const sec = Math.max(0,Math.floor((Date.now()-new Date(opened).getTime())/1000));
        return {valid:true,minutes:Math.floor(sec/60),text:String(Math.floor(sec/60))+':'+String(sec%60).padStart(2,'0')};
      },
      value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
      value=>Number(value)||0
    );
  const now = Date.now();
  const d = (id, state, minutes, extra) => ({
    __backendId:id, dorm_name:id, type:'dorm',state,sdq:'321 TRS',section:'1',inter_sec:'4',
    current_load:47,max_load:47,sex:'female',band:'true',space_force:'false',
    assigned_airman:'AIRMAN',auditorium_location:'BM',phase:'AUDITORIUM',
    opened_at:new Date(now-minutes*60000-10000).toISOString(),closed_timer:'45:40',...extra
  });
  const dorms = [
    d('F-WARNING','open',45,{}),
    d('M-SPACE','open',55,{sex:'male',band:'false',space_force:'true',current_load:60,max_load:60}),
    d('F-OVERTIME','open',65,{}),
    d('F-CLOSED','closed',45,{})
  ];
  return {dorms, markup:dorms.map(render.processingCard).join('')};
}

test('real Chromium validates Processing reference hierarchy, inset band, female glow and no overlap across themes and widths', async () => {
  const chrome = chromeBinary();
  assert.ok(chrome,'Chromium is required for computed card styles and geometry regression checks');
  const controller = await source('public/js/gate-processing-controller.js');
  const adapter = await source('public/js/prc-dash-auditorium-location.js');
  const {dorms,markup} = makeCards(controller);
  const adapterCode = sourcePart(adapter,'  function setLocation(card, dorm) {','  function boardDormsForColumn(');
  const cssUrl = pathToFileURL(resolve(root,'public/css/military-glass-terminal.css')).href;
  const script = [
    '(function(){',
    'const normalizeLocation = value => String(value || "").toUpperCase();',
    'const esc = value => String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll("\"","&quot;");',
    adapterCode,
    'document.getElementById("proc-dorm-grid").innerHTML = '+JSON.stringify(markup)+';',
    'const dorms = '+JSON.stringify(dorms)+';',
    'const cards = Array.from(document.querySelectorAll("#proc-dorm-grid .gate-processing-card"));',
    'cards.forEach((card,i)=>setLocation(card,dorms[i]));',
    'function rect(el) { const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; }',
    'function snap(card) {',
    ' const css=getComputedStyle(card),pseudo=getComputedStyle(card,"::after");',
    ' const timer=card.querySelector(".gate-processing-card__timer");',
    ' const loc=card.querySelector(".gate-auditorium-location");',
    ' return {card:rect(card),pad:css.paddingLeft,border:css.borderLeftColor,borderWidth:css.borderLeftWidth,shadow:css.boxShadow,',
    '   pseudoContent:pseudo.content,pseudoInset:pseudo.top,pseudoPointer:pseudo.pointerEvents,',
    '   pseudoBg:pseudo.backgroundImage,pseudoMask:pseudo.maskImage||pseudo.webkitMaskImage,',
    '   pseudoAnim:pseudo.animationName,pseudoDuration:pseudo.animationDuration,',
    '   name:rect(card.querySelector(".gate-processing-card__name")),',
    '   status:rect(card.querySelector(".gate-processing-card__state")),',
    '   header:rect(card.querySelector(".gate-processing-card__header")),',
    '   center:rect(card.querySelector(".gate-processing-card__center")),',
    '   footer:rect(card.querySelector(".gate-processing-card__footer")),',
    '   load:rect(card.querySelector(".gate-processing-card__load")),',
    '   location:loc?rect(loc):null,',
    '   phase:rect(card.querySelector(".gate-processing-card__phase")),',
    '   timer:rect(timer),timerAnim:getComputedStyle(timer).animationName,',
    '   identity:rect(card.querySelector(".gate-processing-card__identity")),',
    '   identityColor:getComputedStyle(card.querySelector(".gate-processing-card__identity")).color };',
    '}',
    'const output={themes:{},closed:null};',
    'for(const theme of ["night","day"]){',
    ' document.body.classList.toggle("theme-light",theme==="day");',
    ' const female=cards[0];output.themes[theme]={};',
    ' for(const level of ["normal","warning","critical","overtime"]){',
    '  female.dataset.gateTimeAlert=level;',
    '  const timer=female.querySelector(".gate-processing-card__timer");',
    '  timer.classList.toggle("timer-yellow",level==="warning");',
    '  timer.classList.toggle("timer-red",level==="critical"||level==="overtime");',
    '  timer.classList.toggle("timer-flash",level==="overtime");',
    '  output.themes[theme][level]=snap(female);',
    ' }',
    ' output.themes[theme].space=snap(cards[1]);',
    ' output.themes[theme].closed=snap(cards[3]);',
    '}',
    'cards[3].dataset.gateTimeAlert="overtime";output.closed=snap(cards[3]);',
    'document.getElementById("results").textContent=JSON.stringify(output);',
    '}());'
  ].join('\n');
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<link rel="stylesheet" href="'+cssUrl+'"></head><body>'+
    '<main id="page-processing"><div id="proc-dorm-grid" style="width:100%;grid-template-columns:minmax(0,1fr)"></div></main>'+
    '<pre id="results"></pre><script>'+script.replaceAll('</script>','<\\/script>')+'</script></body></html>';
  const dir = await mkdtemp(join(tmpdir(),'gate-processing-cards-'));
  try {
    const fixture=join(dir,'cards.html');
    await writeFile(fixture,html,'utf8');
    for (const [name,width,args] of [
      ['desktop',420,['--window-size=1280,850']],
      ['compact',285,['--window-size=375,800']],
      ['reduced',320,['--window-size=800,850','--force-prefers-reduced-motion']]
    ]) {
      // Limit the actual card to the supplied width, rather than allowing the
      // headless Chromium viewport minimum to determine the responsive case.
      const browserHtml = html.replace('style="width:100%;grid-template-columns:minmax(0,1fr)"',
        'style="width:'+width+'px;grid-template-columns:minmax(0,1fr)"');
      await writeFile(fixture,browserHtml,'utf8');
      const run=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
        '--no-first-run','--disable-background-networking','--user-data-dir='+join(dir,'chrome-'+name),
        ...args,'--dump-dom',pathToFileURL(fixture).href],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
      assert.equal(run.status,0,name+' Chromium launch failed: '+String(run.stderr||'').slice(-800));
      const m=run.stdout.match(/<pre id="results">([^<]+)<\/pre>/);
      assert.ok(m,name+' result missing '+run.stdout.slice(-450));
      const data=JSON.parse(m[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));
      assert.equal(data.closed.pseudoContent,'none',name+' closed dorm must not get band even if alert attribute is forced');
      for(const [theme,states] of Object.entries(data.themes)){
        const base=states.normal;
        assert.equal(base.pseudoContent,'none',name+'/'+theme+' normal band should be absent');
        for(const level of ['warning','critical','overtime']){
          const snap=states[level],tag=name+'/'+theme+'/'+level;
          assert.equal(snap.border,base.border,tag+' female ring color changed');
          assert.equal(snap.borderWidth,'3px',tag+' female ring is no longer 3px');
          assert.equal(snap.shadow,base.shadow,tag+' female halo changed');
          assert.equal(snap.pad,base.pad,tag+' card padding changed');
          assert.equal(snap.card.width,base.card.width,tag+' card width changed');
          assert.equal(snap.card.height,base.card.height,tag+' card height changed');
          assert.equal(snap.pseudoPointer,'none',tag+' pseudo intercepts click');
          assert.equal(snap.pseudoInset,'6px',tag+' band not inset');
          assert.match(snap.pseudoBg,/conic-gradient/,tag+' orbit gradient absent');
          assert.match(snap.pseudoMask,/linear-gradient/,tag+' orbit mask absent');
          assert.ok(snap.name.right <= snap.status.x + 1,tag+' dorm name/status collision');
          assert.ok(snap.header.bottom <= snap.center.y + 1,tag+' header collides with center');
          assert.ok(snap.center.bottom <= snap.footer.y + 1,tag+' center overlaps footer');
          assert.ok(snap.location && snap.location.y >= snap.load.y,tag+' auditorium location missing/misplaced');
          assert.ok(snap.footer.bottom <= snap.card.bottom+1,tag+' footer clips below card');
          assert.ok(snap.timer.x >= snap.card.x,tag+' timer clips horizontally');
          assert.ok(snap.identity.right <= snap.card.right,tag+' identity clips horizontally');
          assert.equal(snap.pseudoAnim,name==='reduced'?'none':'gate-board-alert-orbit',tag+' animation mismatch');
          if (name!=='reduced')assert.equal(snap.pseudoDuration,'4.5s',tag+' wrong orbit duration');
          if(level==='overtime')assert.equal(snap.timerAnim,name==='reduced'?'none':'mg-crit-pulse',tag+' timer pulse mismatch');
          else assert.equal(snap.timerAnim,'none',tag+' timer must remain steady below 60');
        }
        assert.equal(states.closed.pseudoContent,'none',name+'/'+theme+' closed dorm animated');
        assert.ok(states.space.identityColor && states.space.identityColor!=='rgba(0, 0, 0, 0)',name+'/'+theme+' SPACE identity color missing');
      }
    }
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});
