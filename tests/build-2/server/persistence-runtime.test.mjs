import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const runtime = readFileSync(new URL('../../../public/js/gate-persistence-runtime.js', import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 8; i += 1) await new Promise(resolve => setImmediate(resolve)); };

function fixture({legacy='', cycle=null, draft=null, loseCloseoutResponse=false}={}) {
  const elements = new Map();
  const listeners = new Map();
  const hooks = new Map();
  const rows = [{rowIndex:0,sdq:'321 TRS',sec:'01',inter_sec:'02',dorm_name:'3A1',sex:'male',band:false,space_force:false,load:54}];
  const calls = [];
  const state = {legacy,cycle,draft,archives:0,closeouts:0,adoptions:0,initializations:0,reviewSaves:[]};
  const header = { appendChild(el){elements.set(el.id,el);} };
  function element(id) {
    const listeners = new Map();
    return {id,value:'',disabled:false,style:{},dataset:{},className:'',textContent:'',
      classList:{remove(){},add(){}},setAttribute(){},remove(){elements.delete(id);},
      insertAdjacentElement(_position,node){elements.set(node.id,node);},
      addEventListener(name,cb){listeners.set(name,cb);},
      trigger(name='click'){return listeners.get(name)?.();},
      closest(selector){
        if (id==='wg-batch-input' && selector==='.flex-shrink-0') return header;
        if (selector.includes(`#${id}`)) return this;
        if (id==='draft-field' && selector.includes('#batch-rows-container')) return this;
        return null;
      }};
  }
  for(const id of ['wg-batch-input','init-wg-btn','closeout-btn','init-success-overlay',
    'receiving_day_one_start','receiving_day_one_end','receiving_day_two_start','receiving_day_two_end']) {
    elements.set(id,element(id));
  }
  const document = {
    readyState:'complete',getElementById:id=>elements.get(id)||null,
    createElement:()=>element(''),querySelector:()=>null,
    querySelectorAll:selector=>selector.includes('#wg-batch-input') ? [elements.get('wg-batch-input'),elements.get('receiving_day_one_start')] : []
  };
  // Dynamic status and adoption nodes acquire their IDs after createElement.
  header.appendChild = el => {elements.set(el.id,el);};
  elements.get('wg-batch-input').value = legacy;
  const window = {
    GatePermissionGuard:{isInstructor:()=>true},
    GateInputPageController:{getRows:()=>rows,renderBatchGrid(){}},
    addEventListener(name,cb){listeners.set(name,cb);},
    registerGateHook(name,cb){hooks.set(name,cb);},
    runGateHooks(name){hooks.get(name)?.();},
    confirm:()=>true,
    async refresh(){},
    location:{reload(){throw Error('unexpected reload');}}
  };
  let closeoutResponseLost = loseCloseoutResponse;
  async function fetch(url,init={}) {
    if (url.includes('mode=health')) return response({isOk:true,enabled:true,ready:true,legacy_week_group:state.legacy,cycle:state.cycle,adoption_required:!!state.legacy&&!state.cycle});
    if (url.includes('mode=draft')) return response({isOk:true,draft:state.draft});
    const body=JSON.parse(init.body);calls.push(body);
    if(body.action==='save_draft') {
      if(state.cycle||state.legacy) return response({isOk:false,code:'conflict',error:'active group'},409);
      if(state.draft && state.draft.draft_id===body.draft_id && state.draft.revision!==body.revision) return response({isOk:false,code:'draft_conflict',error:'stale'},409);
      state.draft={...body,draft_id:body.draft_id||'draft-1',revision:state.draft?state.draft.revision+1:1,status:'draft'};
      state.reviewSaves.push(state.draft.import_review);
      return response({isOk:true,draft:state.draft},body.draft_id?200:201);
    }
    if(body.action==='adopt') {
      state.adoptions++;
      if(!state.legacy) return response({isOk:false,error:'no legacy'},409);
      state.cycle={cycle_id:'adopted-1',week_group:state.legacy,state:'active'};
      return response({isOk:true,cycle_id:state.cycle.cycle_id});
    }
    if(body.action==='initialize') {
      state.initializations++;
      if(state.cycle) return response({isOk:false,error:'active'},409);
      state.cycle={cycle_id:'cycle-new',week_group:state.draft.proposed_week_group,state:'active'};
      state.legacy=state.cycle.week_group;
      return response({isOk:true,cycle_id:state.cycle.cycle_id,week_group:state.legacy,dorm_count:rows.length});
    }
    if(body.action==='closeout') {
      state.closeouts++;
      if(state.cycle?.cycle_id===body.cycle_id) {state.cycle=null;state.legacy='';state.archives++;}
      if(closeoutResponseLost) {closeoutResponseLost=false;throw new TypeError('response lost');}
      return response({isOk:true,idempotent:state.closeouts>1,archive_id:'archive-1',week_group:'WG26050'});
    }
    throw Error(`Unsupported action ${body.action}`);
  }
  function response(body,status=200){return {ok:status<400,status,async json(){return body;}};}
  let scheduled=null;
  const context={window,document,fetch,console,TypeError,setTimeout(cb){scheduled=cb;return 1;},clearTimeout(){scheduled=null;}};
  runInNewContext(runtime,context,{filename:'gate-persistence-runtime.js'});
  async function event(id) {
    let prevented=false;
    const node=elements.get(id);
    listeners.get('click')?.({target:node,preventDefault(){prevented=true;},stopPropagation(){},stopImmediatePropagation(){}});
    await settle();
    return prevented;
  }
  return {state,elements,rows,calls,event,window,async settle(){await settle();},async edit(){
    const node=element('draft-field');
    listeners.get('input')?.({target:node});
    if(scheduled){const callback=scheduled;scheduled=null;callback();}
    await settle();
  }};
}

test('existing active WG is locked until verified adoption and closeout; a second group cannot initialize',async()=>{
  const f=fixture({legacy:'WG26050'});
  await f.settle();
  assert.equal(f.elements.get('wg-batch-input').disabled,true);
  assert.equal(await f.event('init-wg-btn'),true);
  assert.equal(f.state.initializations,0);
  assert.ok(f.elements.get('gate-persistence-adopt'));
  f.elements.get('gate-persistence-adopt').trigger();
  await f.settle();
  assert.equal(f.state.adoptions,1);
  assert.equal(f.state.cycle.week_group,'WG26050');
  assert.equal(await f.event('init-wg-btn'),true);
  assert.equal(f.state.initializations,0);
  assert.equal(await f.event('closeout-btn'),true);
  assert.equal(f.state.archives,1);
  assert.equal(f.state.cycle,null);
  assert.equal(f.elements.get('wg-batch-input').disabled,false);
});

test('a lost closeout response reuses the same cycle and creates exactly one archive',async()=>{
  const f=fixture({legacy:'WG26050',cycle:{cycle_id:'cycle-existing',week_group:'WG26050',state:'active'},loseCloseoutResponse:true});
  await f.settle();
  assert.equal(await f.event('closeout-btn'),true);
  const closeouts=f.calls.filter(call=>call.action==='closeout');
  assert.equal(closeouts.length,2);
  assert.deepEqual(closeouts.map(item=>item.cycle_id),['cycle-existing','cycle-existing']);
  assert.equal(f.state.archives,1);
  assert.equal(f.state.cycle,null);
  assert.equal(f.elements.get('wg-batch-input').disabled,false);
});

test('restored draft retains confirmed Flight Alert review on unrelated Input changes',async()=>{
  const original={draft_id:'draft-1',revision:2,status:'draft',proposed_week_group:'WG26051',
    rows:[{rowIndex:0,sdq:'321 TRS',sec:'01',inter_sec:'02',dorm_name:'3A1',sex:'male',band:false,space_force:false,load:54}],
    receiving_windows:{receiving_day_one_start:'',receiving_day_one_end:'',receiving_day_two_start:'',receiving_day_two_end:''},
    import_review:{published_total:54,band_decision:'none'}};
  const f=fixture({draft:original});
  await f.settle();
  assert.equal(f.elements.get('wg-batch-input').value,'WG26051');
  assert.equal(f.rows[0].load,54);
  f.rows[0].load=53;
  await f.edit();
  assert.equal(f.state.reviewSaves.length,1);
  assert.equal(f.state.reviewSaves[0].published_total,54);
  assert.equal(f.state.reviewSaves[0].band_decision,'none');
  assert.equal(f.state.draft.rows[0].load,53);
});
