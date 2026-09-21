// Dedicated Squadron display: sole renderer and owner of its restricted data endpoint.
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const setText = (id,value) => { const el=byId(id); const text=String(value); if(el && el.textContent!==text) el.textContent=text; };
  const node = (tag,className,text) => { const el=document.createElement(tag); if(className) el.className=className; if(text!==undefined) el.textContent=String(text); return el; };
  const clock = value => {
    const at=Date.parse(value||'');
    return Number.isFinite(at) ? new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(at)) : '—';
  };
  const elapsed = value => {
    const at=Date.parse(value||'');
    if(!Number.isFinite(at)) return '—';
    const seconds=Math.max(0,Math.floor((Date.now()-at)/1000));
    return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  };
  let pending=false, lastBuses='', lastColumns=new Map(), previous=null;
  function connection(text,state='live') {
    const el=byId('sq-connection');
    setText('sq-connection',text);
    if(el) el.dataset.state=state;
    document.body.dataset.freshness=state;
  }
  function metrics(data) {
    setText('sq-week-group',data.week_group || 'No active Week Group');
    setText('sq-arrived',data.metrics.arrived);
    setText('sq-expected',data.metrics.expected);
    setText('sq-latest',clock(data.metrics.latest_confirmed_arrival));
    setText('sq-final',data.metrics.final_airport_arrival || '—');
    setText('sq-updated',data.updated_at ? `Last operational change: ${clock(data.updated_at)} CT` : 'No confirmed operational update');
  }
  function traffic(data) {
    const value=data.traffic;
    const meter=document.querySelector('.tempo');
    if(meter) meter.dataset.level=value.level;
    setText('sq-traffic-count',value.level==='unavailable'?'STATUS UNAVAILABLE':value.level.toUpperCase());
    setText('sq-traffic-description',`${value.dispatched_last_hour} airport ${value.dispatched_last_hour===1?'bus':'buses'} dispatched in the past hour`);
    const warning=byId('sq-traffic-warning');
    if(warning) {
      warning.hidden=value.level!=='unavailable';
      warning.textContent=value.level==='unavailable'
        ? `Inbound tempo cannot be confirmed: ${value.uncertain_dispatches} recent movement ${value.uncertain_dispatches===1?'record needs':'records need'} a valid dispatch time.`:'';
    }
  }
  function busCard(bus) {
    const card=node('article','bus-card');
    card.append(node('strong','',bus.bus_type==='local'?`LOCAL BUS ${bus.bus_id||'—'}`:`AIRPORT BUS ${bus.bus_id||'—'}`));
    card.append(node('span','',`${bus.otw_count} trainees · EN ROUTE`));
    card.append(node('span','',`Dispatched ${clock(bus.departed_at)} CT`));
    return card;
  }
  function buses(data) {
    const signature=JSON.stringify(data.active_buses);
    setText('sq-active-count',`${data.active_buses.length} en route`);
    if(signature===lastBuses) return;
    lastBuses=signature;
    const container=byId('sq-buses');
    if(!container) return;
    const cards=data.active_buses.length?data.active_buses.map(busCard):[node('p','empty','No buses are currently en route.')];
    container.replaceChildren(...cards);
  }
  function dormCard(dorm) {
    const card=node('article','dorm-card');
    card.dataset.female=String(dorm.female);
    if(dorm.space_force) card.append(node('div','dorm-banner','SPACE FORCE'));
    else if(dorm.band) card.append(node('div','dorm-banner band','BAND'));
    const body=node('div','dorm-body');
    const top=node('div','dorm-top');
    const title=node('div');
    title.append(node('div','dorm-name',dorm.dorm_name||'Unnamed dorm'));
    title.append(node('div','dorm-squadron',dorm.squadron||'Squadron not configured'));
    top.append(title,node('span','dorm-state',dorm.state.toUpperCase()));
    body.append(top);
    if(dorm.female) body.append(node('div','female-label','FEMALE DORM'));
    const detail=node('div','dorm-detail');
    detail.append(node('strong','dorm-load',`${dorm.current_load} / ${dorm.max_load}`));
    const time=node('span','dorm-timer',dorm.state==='open'?elapsed(dorm.opened_at):dorm.state==='closed'?(dorm.closed_timer||'—'):'—');
    if(dorm.state==='open' && dorm.opened_at) time.dataset.opened=dorm.opened_at;
    detail.append(time);
    body.append(detail);
    if(dorm.phase) body.append(node('p','dorm-phase',dorm.phase));
    card.append(body);
    return card;
  }
  function dorms(data) {
    for(const state of ['empty','open','closed']) {
      const current=data.dorms.filter(dorm=>dorm.state===state);
      setText(`sq-${state}-count`,current.length);
      const signature=JSON.stringify(current);
      if(lastColumns.get(state)===signature) continue;
      lastColumns.set(state,signature);
      const target=byId(`sq-${state}`);
      if(target) target.replaceChildren(...(current.length?current.map(dormCard):[node('p','empty',`No ${state} dorms.`)]));
    }
  }
  function render(data) {
    // Unchanged rows, tooltips and focus remain intact between refreshes.
    previous=data;
    metrics(data);traffic(data);buses(data);dorms(data);
    connection(data.week_group?'Data confirmed · read only':'No active Week Group · read only');
  }
  function updateTimers() {
    document.querySelectorAll('.dorm-timer[data-opened]').forEach(el=>{
      const value=elapsed(el.dataset.opened);
      if(el.textContent!==value) el.textContent=value;
    });
  }
  async function refresh() {
    if(pending) return;
    pending=true;
    const abort=new AbortController();
    const timeout=setTimeout(()=>abort.abort(),12000);
    try {
      const response=await fetch('/api/squadron-board',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:abort.signal});
      if(response.status===401) return window.location.replace('/login/');
      if(response.status===403) throw new Error('Access denied. Sign in with an authorized Squadron or Instructor account.');
      if(!response.ok) throw new Error('Operational data could not be confirmed.');
      const data=await response.json();
      if(!data.isOk || !data.metrics || !data.traffic || !Array.isArray(data.active_buses) || !Array.isArray(data.dorms)) throw new Error('Operational response failed validation.');
      render(data);
    } catch(error) {
      connection(previous?'Connection interrupted · displayed figures are stale':'Operational data unavailable',previous?'stale':'error');
      const meter=document.querySelector('.tempo');if(meter)meter.dataset.level='unavailable';
      setText('sq-traffic-count','STATUS UNAVAILABLE');
      const warning=byId('sq-traffic-warning');
      if(warning){warning.hidden=false;warning.textContent=error.message || 'Data cannot be verified. Do not use displayed figures as live.';}
    } finally {clearTimeout(timeout);pending=false;}
  }
  async function boot() {
    try {
      const response=await fetch('/api/session',{credentials:'same-origin',cache:'no-store'});
      if(response.status===401) return window.location.replace('/login/');
      if(!response.ok) throw new Error('Session verification is unavailable.');
      const session=await response.json();
      if(!session.isOk || !['squadron','instructor'].includes(session.role)) throw new Error('This account cannot open the Squadron Board.');
      if(session.role==='instructor') byId('return-to-gate').hidden=false;
      await refresh();
      setInterval(refresh,20000);
      setInterval(updateTimers,1000);
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
      window.addEventListener('online',()=>void refresh());
    } catch(error) {connection(error.message||'Session unavailable','error');}
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('.info-button');
    document.querySelectorAll('.info[data-open=true]').forEach(info=>{
      if(info!==button?.closest('.info')){info.dataset.open='false';info.querySelector('button')?.setAttribute('aria-expanded','false');}
    });
    if(button){const info=button.closest('.info');const open=info.dataset.open!=='true';info.dataset.open=String(open);button.setAttribute('aria-expanded',String(open));}
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.info[data-open=true]').forEach(info=>{info.dataset.open='false';info.querySelector('button')?.setAttribute('aria-expanded','false');});});
  byId('squadron-fullscreen').addEventListener('click',async()=>{
    try {if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
    catch {connection('Fullscreen is unavailable on this device','stale');}
  });
  document.addEventListener('fullscreenchange',()=>setText('squadron-fullscreen',document.fullscreenElement?'Exit fullscreen':'Fullscreen'));
  byId('squadron-logout').addEventListener('click',async()=>{
    const button=byId('squadron-logout');button.disabled=true;
    try {const response=await fetch('/api/logout',{method:'POST',credentials:'same-origin'});if(!response.ok)throw Error();window.location.replace('/login/');}
    catch {button.disabled=false;connection('Sign-out failed; retry before leaving this display.','error');}
  });
  void boot();
})();
