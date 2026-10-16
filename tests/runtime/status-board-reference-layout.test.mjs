import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const source=path=>readFile(resolve(root,path),'utf8');
const contracts=await source('public/js/gate-component-contracts.js');
const status=await source('public/js/gate-status-board-controller.js');
const flags=await source('public/js/prc-dash-dorm-flag-validation.js');
const auditorium=await source('public/js/prc-dash-auditorium-location.js');
const css=await source('public/css/military-glass-terminal.css');
const ctx={window:{getElapsedTimer:()=>({text:'45:40',minutes:45,valid:true})}};
vm.runInNewContext(contracts,ctx,{filename:'gate-component-contracts.js'});
const {dormCard}=ctx.window.GateComponents;
const dorm=(id,state,overrides={})=>({
  __backendId:id,type:'dorm',state,dorm_name:id,sdq:'321 TRS',section:'1',inter_sec:'4',
  assigned_airman:'AIRMAN',auditorium_location:'BM',phase:state==='open'?'PROCESSING':'Closed',
  current_load:47,max_load:47,closed_timer:'45:40',
  opened_at:'2026-10-16T16:00:00Z',sex:'male',band:'false',space_force:'false',...overrides
});
const records=[
  dorm('2D1','closed',{sex:'female',band:'true'}),
  dorm('2D2','closed',{space_force:'true',band:'true'}),
  dorm('3A1','open',{sex:'female',band:'true',phase:'RECEIVING'}),
  dorm('3A2','open',{space_force:'true',band:'false',current_load:42,max_load:60}),
  dorm('4B7','empty',{auditorium_location:'',assigned_airman:'',current_load:0,max_load:60}),
  dorm('6C7','closed',{assigned_airman:'VERY LONG AIRMAN ASSIGNMENT NAME',sdq:'LONG SQUADRON NAME',section:'9',inter_sec:'12',auditorium_location:'BMT'})
];
const card=(record,opts={})=>dormCard(record,{showAuditorium:true,statusBoardLayout:true,...opts});
const legacy=(record)=>dormCard(record,{showAuditorium:true});

test('reference markup follows both PDF examples without affecting Squadron rendering',()=>{
  const female=card(records[0]),space=card(records[1]),open=card(records[2]),squadron=legacy(records[0]);
  for(const value of [
    'data-gate-board-layout="reference-v2"','gate-board-card__header','gate-board-card__identification',
    'gate-board-card__squadron','gate-board-card__section','gate-board-card__identity--band',
    'gate-board-card__state-group','gate-dorm-status','gate-dorm-airman','gate-board-card__center',
    'gate-dorm-timer','gate-board-card__footer','data-board-auditorium-slot','gate-dorm-load',
    'gate-dorm-progress','AUD: BM','47 / 47'
  ])assert.ok(female.includes(value),'Missing PDF reference element: '+value);
  assert.match(female,/gate-board-card__identity--band">BAND/);
  assert.match(female,/gate-dorm-status" data-state="closed"[^>]*>CLOSED/);
  assert.match(female,/gate-board-card__section">1 - 4/);
  assert.match(female,/border-female/);
  assert.doesNotMatch(space,/gate-board-card__identity--band/);
  assert.match(space,/gate-board-card__identity--space">SPACE FORCE/);
  assert.match(open,/PHASE: RECEIVING/);
  assert.match(space,/data-space-force="true"/);
  assert.doesNotMatch(female,/gate-dorm-top-banner/);
  assert.match(squadron,/gate-dorm-top-banner banner-band/);
  assert.doesNotMatch(squadron,/gate-board-card--reference|data-gate-board-layout/);
});

test('render paths, API read and write ownership, auditoriums and flags stay separate',async()=>{
  assert.match(status,/components\(\)\.dormCard\(dorm, \{ showAuditorium: true, statusBoardLayout: true \}\)/);
  assert.match(status,/if \(!force && signature === lastDormSignatures\.get\(state\) && complete\) return/);
  assert.match(status,/timer\.textContent !== elapsed\.text/);
  assert.match(status,/if \(card\.dataset\.gateTimeAlert !== visualState\)/);
  assert.match(status,/window\.setTimeout\(\(\) => \{/);
  assert.doesNotMatch(status,/fetch\(|dataSdk\.(create|update|delete)|\.innerHTML\s*=\s*.*elapsed\.text/);
  assert.match(flags,/card\.closest\('#page-board'\) && card\.dataset\.gateBoardLayout === 'reference-v2'/);
  assert.match(flags,/existingBanner\?\.remove\(\)/);
  assert.match(auditorium,/card\.querySelector\('\[data-board-auditorium-slot\]'\)/);
  assert.match(auditorium,/boardSlot\.insertAdjacentHTML\('beforeend', html\)/);
  const input=await source('public/index.html');
  assert.match(input,/const LIVE_API_URL = '\/api\/records\?scope=live'/);
  assert.match(input,/setInterval\(\(\) => \{\s*refresh\(\)\.catch/);
  assert.match(input,/}\s*, 3000\)/);
  const api=await source('functions/api/records.js');
  assert.match(api,/mayReadRecords/);
  assert.match(api,/mayWriteRecords/);
  const shadow=await source('public/js/gate-status-board-shadow-controller.js');
  assert.match(shadow,/readOnly: true/);
  assert.match(shadow,/getDorms\?\.\(\)/);
  assert.doesNotMatch(shadow,/dataSdk\.(create|update|delete)|fetch\(/);
  const served=await source('functions/_middleware.js');
  assert.ok(served.indexOf('gate-component-contracts.js')<served.indexOf('gate-status-board-controller.js'),'Shared components must load before canonical owner');
});

test('reference CSS is Status Board-only and preserves fixed female exterior and animated inset',()=>{
  assert.match(css,/#page-board \.gate-dorm-card\.gate-board-card--reference/);
  assert.match(css,/#page-board \.gate-board-card--reference \.gate-board-card__identity--band/);
  assert.match(css,/#page-board \.gate-board-card--reference \.gate-board-card__identity--space/);
  assert.match(css,/#page-board \.gate-board-card--reference \.gate-dorm-timer/);
  assert.match(css,/#page-board \.gate-board-card--reference \.gate-dorm-progress/);
  assert.match(css,/#page-board \.gate-dorm-card\.border-female/);
  assert.match(css,/#page-board #col-open \.gate-dorm-card\[data-gate-time-alert="warning"\]/);
  assert.match(css,/animation: gate-board-alert-orbit 4\.5s linear infinite/);
  const style=css.slice(css.indexOf('/* Status Board reference card'),css.indexOf('STATUS BOARD ONLY: inset elapsed-time alert orbit'));
  assert.doesNotMatch(style,/#page-squadron|#page-processing|!important/);
});

function chromeBinary(){
  for(const exe of [process.env.CHROME_BIN,'google-chrome','chromium','chromium-browser'].filter(Boolean))
    if(spawnSync(exe,['--version'],{encoding:'utf8',timeout:3000}).status===0)return exe;
  return null;
}

test('Chromium card geometry avoids overlap and clipping at 260–420px, themes and alert states',async()=>{
  const chrome=chromeBinary();
  assert.ok(chrome,'Chromium required for authentic card sizing verification');
  const href=pathToFileURL(resolve(root,'public/css/military-glass-terminal.css')).href;
  const cardHtml=records.map(record=>card(record)).join('');
  const script=[
    '(function(){',
    'const board=document.getElementById("page-board");',
    'const elements=[...board.querySelectorAll(".gate-board-card--reference")];',
    'const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}};',
    'const overflow=e=>Math.max(0,e.scrollWidth-e.clientWidth);',
    'const snap=e=>{',
    ' const q=s=>e.querySelector(s),h=q(".gate-board-card__header"),left=q(".gate-board-card__identification"),',
    ' ident=q(".gate-board-card__identity"),right=q(".gate-board-card__state-group"),',
    ' center=q(".gate-board-card__center"),footer=q(".gate-board-card__footer"),',
    ' timer=q(".gate-dorm-timer"),load=q(".gate-dorm-load"),aud=q(".gate-auditorium-location"),',
    ' track=q(".gate-dorm-progress"),name=q(".gate-dorm-name"),state=q(".gate-dorm-status");',
    ' const ps=getComputedStyle(e,"::after"),base=getComputedStyle(e),cs=x=>getComputedStyle(x);',
    ' return {id:e.dataset.dormId,card:rect(e),header:rect(h),left:rect(left),ident:rect(ident),right:rect(right),',
    ' center:rect(center),footer:rect(footer),timer:rect(timer),load:rect(load),aud:aud?rect(aud):null,',
    ' track:rect(track),name:rect(name),status:rect(state),scroll:overflow(e),nameOver:overflow(name),',
    ' text:{name:parseFloat(cs(name).fontSize),squadron:parseFloat(cs(q(".gate-board-card__squadron")).fontSize),',
    ' section:parseFloat(cs(q(".gate-board-card__section")).fontSize),identity:parseFloat(cs(ident).fontSize),',
    ' status:parseFloat(cs(state).fontSize),airman:parseFloat(cs(q(".gate-dorm-airman")).fontSize),',
    ' phase:q(".gate-board-card__phase")?parseFloat(cs(q(".gate-board-card__phase")).fontSize):null,',
    ' auditorium:aud?parseFloat(cs(aud).fontSize):null,load:parseFloat(cs(load).fontSize),',
    ' timer:parseFloat(cs(timer).fontSize),loadFamily:cs(load).fontFamily,',
    ' loadWeight:cs(load).fontWeight,statusWeight:cs(state).fontWeight,',
    ' stateForeground:cs(state).color,stateBackground:cs(state).backgroundColor,',
    ' cardBackground:base.backgroundColor,bodyBackground:cs(document.body).backgroundColor,',
    ' paddingLeft:parseFloat(base.paddingLeft),paddingRight:parseFloat(base.paddingRight)},',
    ' identityOver:overflow(ident),timerOver:overflow(timer),loadOver:overflow(load),statusOver:overflow(state),',
    ' outerBorder:base.borderLeftColor,shadow:base.boxShadow,alertContent:ps.content,alertPointer:ps.pointerEvents,',
    ' alertAnim:ps.animationName,alertInset:ps.top,progressWidth:getComputedStyle(track).width};',
    '};',
    'const out={};',
    'for(const theme of ["night","day"]){',
    ' document.body.classList.toggle("theme-light",theme==="day");',
    ' out[theme]=elements.map(snap);',
    '}',
    'document.getElementById("results").textContent=JSON.stringify(out);',
    '})();'
  ].join('\n');
  const dir=await mkdtemp(join(tmpdir(),'gate-board-card-ref-'));
  try{
    const file=join(dir,'fixture.html');
    for(const width of [260,280,320,375,420]){
      const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
      '<link rel="stylesheet" href="'+href+'"></head><body><div id="page-board">'+
      '<div id="col-closed" style="display:grid;grid-template-columns:minmax(0,1fr);width:'+width+'px;gap:12px">'+cardHtml+
      '</div></div><pre id="results"></pre><script>'+script+'</script></body></html>';
      await writeFile(file,html,'utf8');
      const run=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
        '--no-first-run','--disable-background-networking','--user-data-dir='+join(dir,'chrome-'+width),
        '--window-size=1280,900','--dump-dom',pathToFileURL(file).href
      ],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
      assert.equal(run.status,0,width+'px Chromium fixture failed: '+String(run.stderr||'').slice(-400));
      const match=run.stdout.match(/<pre id="results">([^<]+)<\/pre>/);
      assert.ok(match,width+'px missing computed geometry');
      const results=JSON.parse(match[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));
      const intersects=(a,b)=>a.x<b.right-1&&b.x<a.right-1&&a.y<b.bottom-1&&b.y<a.bottom-1;
      const luminance=value=>{
        const channels=value.match(/[0-9.]+/g).slice(0,3).map(Number).map(n=>{
          const v=n/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;
        });
        return channels[0]*0.2126+channels[1]*0.7152+channels[2]*0.0722;
      };
      const composite=(foreground,background)=>{
        const fg=foreground.match(/[0-9.]+/g).map(Number),bg=background.match(/[0-9.]+/g).map(Number);
        const a=fg.length>3?fg[3]:1;
        return 'rgb('+fg.slice(0,3).map((v,i)=>Math.round(v*a+bg[i]*(1-a))).join(', ')+')';
      };
      const contrast=(a,b)=>{const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (hi+0.05)/(lo+0.05);};
      for(const [theme,cards] of Object.entries(results))for(const c of cards){
        const context=width+'px/'+theme+'/'+c.id;
        assert.ok(Math.abs(c.card.w-width)<2,context+' card not within specified width');
        assert.ok(!intersects(c.left,c.ident),context+' identity intersects dorm name');
        assert.ok(!intersects(c.ident,c.right),context+' identity intersects status');
        assert.ok(!intersects(c.left,c.right),context+' name intersects status');
        assert.ok(c.header.bottom<=c.center.y+1,context+' header overlaps timer');
        assert.ok(c.center.bottom<=c.footer.y+1,context+' timer overlaps footer');
        assert.ok(c.footer.bottom<=c.track.y+1,context+' footer overlaps progress');
        assert.ok(c.track.bottom<=c.card.bottom+1,context+' progress below card');
        assert.ok(c.timer.x>=c.card.x-1&&c.timer.right<=c.card.right+1,context+' timer outside card');
        assert.ok(c.load.right<=c.card.right+1,context+' load outside card');
        if(c.aud)assert.ok(c.aud.right<=c.load.x+1,context+' auditorium overlaps load');
        assert.ok(c.nameOver<=1&&c.identityOver<=1&&c.statusOver<=1,context+' header glyph overflow');
        assert.ok(c.timerOver<=1&&c.loadOver<=1,context+' timer/load glyph overflow');
        assert.ok(c.scroll<=1,context+' card horizontal overflow');
        for(const [label,px] of Object.entries(c.text)){
          if(typeof px==='number'&&px!==null&&label!=='paddingLeft'&&label!=='paddingRight')
            assert.ok(px>=12,context+' '+label+' font below 12px: '+px);
        }
        assert.ok(c.text.paddingLeft>=12&&c.text.paddingRight>=12,context+' card padding below 12px');
        assert.match(c.text.loadFamily,/Mono|mono/i,context+' load counts not in mono/tabular type');
        assert.equal(c.text.loadWeight,'700',context+' load weight should be bold');
        assert.equal(c.text.statusWeight,'700',context+' state label should be bold');
        const badgeSurface=composite(c.text.stateBackground,
          composite(c.text.cardBackground,c.text.bodyBackground));
        const badgeContrast=contrast(c.text.stateForeground,badgeSurface);
        assert.ok(badgeContrast>=4.5,
          context+' badge state text contrast below 4.5:1: '+JSON.stringify({badgeContrast,
            foreground:c.text.stateForeground,state:c.text.stateBackground,
            card:c.text.cardBackground,body:c.text.bodyBackground,resolved:badgeSurface}));
      }
      const female=results.night.find(x=>x.id==='2D1'),space=results.night.find(x=>x.id==='2D2');
      assert.notEqual(female.outerBorder,space.outerBorder,'Female outer red identity border lost');
      assert.equal(female.alertContent,'none','Closed female card should have no animated band');
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});
