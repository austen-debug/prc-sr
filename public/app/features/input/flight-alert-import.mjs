/** GATE Input enhancement: Flight Alert import changes draft rows only, never operational records. */
import { parseFlightAlertText, validateFlightAlertRows, normalizeSquadron } from './flight-alert-parser.mjs';
import { extractFlightAlertPdf } from './flight-alert-pdf.mjs';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const state = { imported: false, published: null, sourcePublished: null, bandDecision: null, sourceLines: [], busy: false, candidate: null, activeMode: 'pdf', lastInvoker: null };
const CLASSES = 'rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2';
const BTN = `${CLASSES} min-h-[44px]`;
const COLORS = { border: 'var(--border)', text:'var(--text)', surface:'var(--surface)', raised:'var(--surface-alt)' };

function owner() { return window.GateInputPageController; }
function rows() { return owner()?.getRows?.() || []; }
function weekGroup() { return String($('wg-batch-input')?.value || '').trim().toUpperCase(); }
function allowed() { return window.GatePermissionGuard?.isInstructor?.() === true; }
function initialized() {
  const wg = weekGroup();
  if (!wg) return false;
  const records = typeof allData !== 'undefined' ? allData : window.allData;
  // An unavailable record cache cannot authorize an import; initialization remains the existing owner's responsibility.
  if (!Array.isArray(records)) return true;
  return String(window.getActiveWG?.() || '').trim().toUpperCase() === wg || records.some(item => item?.type === 'dorm' && String(item.week_group || '').trim().toUpperCase() === wg);
}
function activeRows() { return rows().filter(r => Object.values(r).some((v,i) => i && v !== '' && v !== false && v !== 'male' && v != null) && (r.sdq || r.dorm_name || r.load)); }
function validation() { return validateFlightAlertRows(rows().filter(r => r.sdq || r.sec || r.dorm_name || r.load), state.published); }
function disabledReason() {
  if (!allowed()) return 'Instructor access is required.';
  if (!weekGroup()) return 'Enter a Week Group ID before importing.';
  if (initialized()) return 'This Week Group is already initialized. Flight Alert import is unavailable.';
  if ($('init-wg-btn')?.disabled) return 'Initialization is in progress; Flight Alert import is unavailable.';
  return '';
}
function element(tag, className='', text='') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text;
  return el;
}
function notice(text, danger=false) {
  const target = $('gate-import-message');
  if (target) { target.textContent = text; target.hidden = !text; target.style.color = danger ? 'var(--red)' : 'var(--text)'; }
}
function toolbar() {
  const page = $('page-input');
  const header = $('wg-batch-input')?.closest('.flex-shrink-0');
  if (!page || !header || !owner()) return;
  let panel = $('gate-flight-alert-toolbar');
  if (!panel) {
    panel = element('section','mt-3 rounded-lg border p-3 grid gap-3');
    panel.id = 'gate-flight-alert-toolbar';
    panel.style.borderColor = COLORS.border;
    panel.style.background = COLORS.raised;
    panel.setAttribute('aria-label', 'Flight Alert import and configuration review');
    panel.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-2"><div><strong class="text-sm">FLIGHT ALERT</strong><p class="text-xs text-muted">Prepare the Input table; initialize separately.</p></div><div class="flex flex-wrap gap-2"><button id="gate-import-open" type="button" class="${BTN}" style="border-color:var(--border);background:var(--surface);color:var(--text)">Import Flight Alert</button><button id="gate-import-inter" type="button" class="${BTN}" style="border-color:var(--border);background:var(--surface);color:var(--text)" hidden>Complete INTER/SEC</button></div></div><div id="gate-import-summary" aria-live="polite"></div><p id="gate-import-message" class="text-sm" role="status" hidden></p>`;
    header.insertBefore(panel, $('receiving-windows-panel') || null);
    $('gate-import-open').addEventListener('click', ()=>openModal('import'));
    $('gate-import-inter').addEventListener('click', ()=>openModal('inter'));
  }
  const reason = disabledReason();
  $('gate-import-open').disabled = !!reason || state.busy;
  $('gate-import-open').title = reason;
  $('gate-import-inter').hidden = !state.imported || !!reason;
  renderSummary();
}
function renderSummary() {
  const el = $('gate-import-summary');
  if (!el) return;
  if (document.activeElement?.id === 'gate-import-total') return;
  if (!state.imported) { el.innerHTML = ''; return; }
  const current = validation();
  const missing = current.issues.filter(i=>i.code === 'inter_sec').length;
  const bandRows = rows().map((row,index)=>({row,index})).filter(({row})=>normalizeSquadron(row.sdq)==='321 TRS' && row.dorm_name);
  const variance = current.variance;
  const totalText = current.published == null ? 'Published total: not extracted' : `Published total: ${current.published}`;
  const varianceText = variance === null ? 'Enter the published total to reconcile.' : variance === 0 ? 'Reconciled' : `Discrepancy: ${variance > 0 ? '+' : ''}${variance} (warning only)`;
  el.innerHTML = `<div class="grid gap-2 text-sm"><p><strong>${activeRows().length} dorms loaded into draft.</strong> ${missing} INTER/SEC entries missing. No operational records created.</p><div class="flex flex-wrap gap-3 items-center"><span>${esc(totalText)}</span><span>Calculated: ${current.calculated}</span><strong style="color:${variance !== 0 ? 'var(--yellow)' : 'var(--green)'}">${esc(varianceText)}</strong></div><label class="flex flex-wrap items-center gap-2">Published total <input id="gate-import-total" aria-label="Published Flight Alert total" type="number" min="0" step="1" value="${current.published ?? ''}" class="border rounded px-2 py-1 w-28" style="border-color:var(--border);color:var(--text)"></label><div id="gate-import-band"></div><div id="gate-import-issues" role="status"></div></div>`;
  $('gate-import-total').addEventListener('change', event=>{
    const val = event.target.value.trim();
    state.published = /^\d+$/.test(val) ? Number(val) : null;
    renderSummary();
  });
  const band = $('gate-import-band');
  if (bandRows.length) {
    const selected = bandRows.filter(({row})=>row.band).length;
    band.innerHTML = `<div class="rounded-lg border p-2" style="border-color:var(--border)"><strong>321 TRS: Does this alert include Band flights?</strong><div class="flex flex-wrap gap-2 mt-2"><button type="button" data-band="none" class="${BTN}" aria-pressed="${state.bandDecision==='none'}">No Band flights</button><button type="button" data-band="some" class="${BTN}" aria-pressed="${state.bandDecision==='some'}">Yes — select dorms</button></div><div id="gate-import-band-list" class="mt-2 grid gap-1"></div><p class="text-xs text-muted">${state.bandDecision === null ? 'Band confirmation is required before initialization.' : state.bandDecision === 'some' ? `${selected} selected.` : 'No Band flights confirmed.'}</p></div>`;
    band.querySelectorAll('[data-band]').forEach(button=>{
      button.style.borderColor = COLORS.border;
      button.style.background = button.dataset.band === state.bandDecision ? 'var(--surface)' : 'transparent';
      button.addEventListener('click', ()=>{
        state.bandDecision = button.dataset.band;
        if (state.bandDecision === 'none') bandRows.forEach(({row})=>row.band=false);
        owner().renderBatchGrid(); renderSummary(); decorateRows();
      });
    });
    const list = $('gate-import-band-list');
    if (state.bandDecision === 'some') {
      bandRows.forEach(({row,index})=>{
        const label = element('label','flex gap-2 items-center text-sm');
        const input = element('input'); input.type = 'checkbox'; input.checked = !!row.band;
        input.setAttribute('aria-label', `${row.sdq}, section ${row.sec}, dorm ${row.dorm_name} is Band`);
        input.addEventListener('change',()=>{ row.band = input.checked; row.space_force = false; owner().renderBatchGrid(); renderSummary(); decorateRows(); });
        label.append(input,document.createTextNode(`${row.sdq} · Section ${row.sec} · Dorm ${row.dorm_name}`));
        list.append(label);
      });
    }
  }
  const critical = current.issues.filter(i=>i.level==='error' && i.code!=='inter_sec');
  $('gate-import-issues').textContent = critical.length ? `${critical.length} data issues require correction. ${critical.slice(0,3).map(i=>i.message).join(' ')}` : '';
  $('gate-import-issues').style.color = 'var(--red)';
}
function decorateRows() {
  if (!state.imported) return;
  const currentRows = rows();
  const grid = $('batch-rows-container');
  if (!grid) return;
  currentRows.forEach((row,i)=>{
    const el = grid.querySelector(`[data-input-row="${i}"]`);
    if (!el) return;
    const inter = el.querySelector('.batch-inter');
    if (inter) {
      const missing = !!(row.sdq || row.dorm_name || row.load) && !String(row.inter_sec||'').trim();
      inter.toggleAttribute('aria-invalid',missing);
      inter.style.borderColor = missing ? 'var(--yellow)' : COLORS.border;
      if (missing) inter.title='INTER/SEC is required from the separate system.';
      else inter.removeAttribute('title');
    }
    if (i>=25) {
      ['batch-sdq','batch-sec','batch-inter','batch-dorm','batch-sex','batch-band','batch-space-force','batch-load'].forEach((name,col)=>{
        const field = el.querySelector(`.${name}`);
        if (field) field.tabIndex = i*8 + col + 1;
      });
    }
  });
}
function renderState() { toolbar(); decorateRows(); }
function candidateDiff(candidate) {
  const previous = new Map(activeRows().map(row => [`${normalizeSquadron(row.sdq)}::${String(row.dorm_name).toUpperCase()}`,row]));
  const incoming = new Set(); let added=0, changed=0;
  for (const row of candidate.rows) {
    const key=`${normalizeSquadron(row.sdq)}::${row.dorm_name}`;
    incoming.add(key);
    const old = previous.get(key);
    if (!old) added++;
    else if (['sec','sex','load'].some(field=>String(old[field])!==String(row[field]))) changed++;
  }
  const removed=[...previous.keys()].filter(key=>!incoming.has(key)).length;
  return {added,changed,removed};
}
function applyCandidate(candidate) {
  if (disabledReason()) { modalError(disabledReason()); return; }
  const previous = new Map(activeRows().map(row=>[`${normalizeSquadron(row.sdq)}::${String(row.dorm_name).toUpperCase()}::${row.sec}`,row]));
  const draft = candidate.rows.map((item,index)=>{
    const prior = previous.get(`${normalizeSquadron(item.sdq)}::${item.dorm_name}::${item.sec}`);
    return { rowIndex:index, sdq:item.sdq, sec:item.sec, inter_sec:prior?.inter_sec||'', dorm_name:item.dorm_name, sex:item.sex, band:false, space_force:item.space_force, load:item.load };
  });
  const count = Math.max(25,draft.length);
  const empty = index=>({rowIndex:index,sdq:'',sec:'',inter_sec:'',dorm_name:'',sex:'male',band:false,space_force:false,load:''});
  while (draft.length<count) draft.push(empty(draft.length));
  const target=rows();
  target.splice(0,target.length,...draft);
  state.imported=true;
  state.published=candidate.publishedTotal;
  state.sourcePublished=candidate.publishedTotal;
  state.bandDecision=draft.some(row=>normalizeSquadron(row.sdq)==='321 TRS')?null:'none';
  state.sourceLines=candidate.rows.map(row=>row.sourceLine);
  state.candidate=null;
  owner().renderBatchGrid();
  closeModal(); renderState();
  notice(`${candidate.rows.length} dorms added to the Input draft. Complete INTER/SEC and review warnings before INITIALIZE WEEK GROUP.`);
}
function modalError(message) { const el=$('gate-import-modal-error'); if(el) { el.textContent=message; el.hidden=false; } }
function clearError() { const el=$('gate-import-modal-error'); if(el) {el.textContent='';el.hidden=true;} }
function ensureModal() {
  if ($('gate-import-dialog')) return $('gate-import-dialog');
  const dialog=element('dialog','rounded-xl border shadow-2xl p-0');
  dialog.id='gate-import-dialog';
  dialog.setAttribute('aria-labelledby','gate-import-dialog-title');
  dialog.style.cssText='width:min(760px,calc(100vw - 24px));max-height:calc(100dvh - 32px);overflow:auto;border-color:var(--border);background:var(--surface);color:var(--text);padding:0;z-index:10050;';
  dialog.innerHTML=`<div class="p-4 sm:p-6 grid gap-4"><header class="flex gap-3 justify-between items-start"><div><h2 id="gate-import-dialog-title" class="text-lg font-bold">Import Flight Alert</h2><p id="gate-import-dialog-help" class="text-xs text-muted">Extract data into the Input draft. Initialization stays separate.</p></div><button type="button" id="gate-import-close" class="${BTN}" aria-label="Close Flight Alert dialog">Close</button></header><div id="gate-import-dialog-main" class="grid gap-4"></div><p id="gate-import-modal-error" role="alert" class="text-sm" style="color:var(--red)" hidden></p></div>`;
  document.body.append(dialog);
  dialog.addEventListener('close',()=>{
    const main=$('gate-import-dialog-main'); if(main) main.replaceChildren();
    state.candidate=null;state.busy=false;
    state.lastInvoker?.focus?.();state.lastInvoker=null;
  });
  $('gate-import-close').addEventListener('click',closeModal);
  return dialog;
}
function closeModal() { const modal=$('gate-import-dialog'); if(modal?.open) modal.close(); }
function openModal(mode) {
  const reason=disabledReason(); if(reason){notice(reason,true);return;}
  state.lastInvoker=document.activeElement;
  const dialog=ensureModal(); clearError();
  $('gate-import-dialog-title').textContent=mode==='inter'?'Complete INTER/SEC':'Import Flight Alert';
  if(mode==='inter') drawInterForm(); else drawImportForm();
  if(!dialog.open)dialog.showModal();
  dialog.querySelector('input,textarea,button')?.focus();
}
function drawImportForm() {
  const main=$('gate-import-dialog-main');main.replaceChildren();
  const tabs=element('div','flex flex-wrap gap-2');
  const pdfButton=element('button',BTN,'Upload PDF'); pdfButton.type='button';
  const pasteButton=element('button',BTN,'Paste PDF text'); pasteButton.type='button';
  [pdfButton,pasteButton].forEach(button=>button.style.borderColor=COLORS.border);
  tabs.append(pdfButton,pasteButton);
  const area=element('div','grid gap-3');
  main.append(tabs,area);
  function select(method) {
    state.activeMode=method;
    pdfButton.setAttribute('aria-pressed',String(method==='pdf'));
    pasteButton.setAttribute('aria-pressed',String(method==='paste'));
    area.replaceChildren();
    if(method==='pdf') {
      const label=element('label','grid gap-2 text-sm font-semibold','Select Flight Alert PDF');
      const input=element('input','rounded-lg border p-3'); input.type='file'; input.accept='.pdf,application/pdf';input.style.borderColor=COLORS.border;
      label.append(input);
      area.append(label,element('p','text-xs text-muted','Text-based PDFs only. Files remain in this browser and are not uploaded to a server. If extraction fails, use Paste PDF text.'));
      input.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;clearError();state.busy=true;try{const text=await extractFlightAlertPdf(file,window.pdfjsLib||null);processText(text);}catch(e){modalError(e.message||'PDF extraction failed. Paste the text instead.');}finally{state.busy=false;input.value='';}});
    } else {
      const label=element('label','grid gap-2 text-sm font-semibold','Flight Alert text');
      const textarea=element('textarea','w-full rounded-lg border p-3 text-sm');textarea.rows=9;textarea.maxLength=250000;
      textarea.placeholder='Squadron Section Dorm Sex Load\n535 TRS 1 4A1 MALE 48\nTOTAL EXPECTED LOAD: 48';
      textarea.style.cssText='border-color:var(--border);background:var(--surface-alt);color:var(--text);min-height:180px;';
      label.append(textarea);
      const button=element('button',BTN,'Process pasted text');button.type='button'; button.style.borderColor=COLORS.border;
      button.addEventListener('click',()=>{const text=textarea.value;textarea.value='';processText(text);});
      area.append(label,button);
    }
  }
  pdfButton.addEventListener('click',()=>select('pdf'));
  pasteButton.addEventListener('click',()=>select('paste'));
  select(state.activeMode);
}
function processText(text) {
  const parsed=parseFlightAlertText(text);
  if(!parsed.ok){modalError(parsed.issues.filter(i=>i.level==='error').map(i=>i.message).join(' ')||'Flight Alert extraction failed.');return;}
  if(disabledReason()){modalError(disabledReason());return;}
  const existing=activeRows();
  if(!existing.length){applyCandidate(parsed);return;}
  state.candidate=parsed;
  const summary=candidateDiff(parsed);
  const main=$('gate-import-dialog-main');main.replaceChildren();
  const title=element('h3','text-base font-bold','Review replacement draft');
  const desc=element('p','text-sm',`${parsed.rows.length} incoming dorms. ${summary.added} added, ${summary.changed} changed, ${summary.removed} removed. Existing draft records will be replaced; matching dorm INTER/SEC entries are retained.`);
  const warning=element('p','text-sm','Nothing has been changed yet. Review the replacement Flight Alert before proceeding.');
  const list=element('div','rounded-lg border p-3 grid gap-2 text-sm');list.style.borderColor=COLORS.border;
  const previous=new Map(existing.map(r=>[`${normalizeSquadron(r.sdq)}::${String(r.dorm_name).toUpperCase()}`,r]));
  parsed.rows.forEach(row=>{const key=`${normalizeSquadron(row.sdq)}::${row.dorm_name}`;const old=previous.get(key);const text=old?`Existing ${old.load} → incoming ${row.load}`:'New';list.append(element('p','',`${key} · Section ${row.sec} · Load ${row.load} · ${text}`));});
  const actions=element('div','flex flex-wrap justify-end gap-2');
  const back=element('button',BTN,'Cancel replacement');back.type='button';back.style.borderColor=COLORS.border;back.addEventListener('click',drawImportForm);
  const replace=element('button',BTN,'Replace uninitialized draft');replace.type='button';replace.style.cssText='background:var(--yellow);color:var(--bg);border-color:var(--yellow)';replace.addEventListener('click',()=>applyCandidate(parsed));
  actions.append(back,replace);main.append(title,desc,warning,list,actions);
}
function drawInterForm() {
  const main=$('gate-import-dialog-main');main.replaceChildren();
  const active=rows().map((row,index)=>({row,index})).filter(({row})=>row.sdq||row.dorm_name||row.load);
  const intro=element('p','text-sm text-muted','Enter INTER/SEC from the separate source. Values remain in the Input draft until you initialize.');
  const form=element('form','grid gap-3');
  active.forEach(({row,index})=>{
    const label=element('label','grid sm:grid-cols-[1fr_1fr] gap-2 items-center text-sm');
    const span=element('span','font-semibold',`${row.sdq} / Sec ${row.sec} / ${row.dorm_name}`);
    const input=element('input','border rounded-lg px-3 py-2');input.name=String(index);input.value=row.inter_sec||'';input.required=true;input.style.cssText='border-color:var(--border);background:var(--surface-alt);color:var(--text)';
    input.setAttribute('aria-label',`INTER/SEC for ${row.sdq} dorm ${row.dorm_name}`);
    label.append(span,input);form.append(label);
  });
  const save=element('button',BTN,'Apply INTER/SEC to Input');save.type='submit';save.style.borderColor=COLORS.border;
  form.append(save);
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const inputs=form.querySelectorAll('input');
    for(const input of inputs){if(!input.value.trim()){input.focus();modalError('Complete all INTER/SEC entries before applying.');return;}}
    for(const input of inputs) rows()[Number(input.name)].inter_sec=input.value.trim();
    owner().renderBatchGrid();closeModal();renderState();notice('INTER/SEC values applied to the draft. Initialize Week Group separately.');
  });
  main.append(intro,form);
}
function checkBeforeInitialize(event) {
  if(!state.imported || !event.target?.closest?.('#init-wg-btn, [data-gate-input-action="initialize-week-group"]'))return;
  const current=validation();
  const critical=current.issues.filter(i=>i.level==='error');
  const bandPending=state.bandDecision===null || (state.bandDecision==='some' && !rows().some(r=>r.band));
  if(current.published===null || critical.length || bandPending) {
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();
    const msg=current.published===null?'Enter the published Flight Alert total.':critical.length?critical[0].message:'Confirm Band classifications before initialization.';
    notice(msg,true);
    $('gate-flight-alert-toolbar')?.scrollIntoView?.({behavior:'smooth',block:'center'});
  }
  // Total variance alone is explicitly advisory: the existing initializer remains authoritative.
}
function start() {
  // The import feature is an enhancement to the visible Build 1 Input owner, not a second initializer.
  if(!owner())return;
  toolbar();
  window.addEventListener('click',checkBeforeInitialize,true);
  document.addEventListener('input',event=>{if(state.imported&&event.target?.closest?.('#batch-rows-container'))queueMicrotask(renderState);});
  document.addEventListener('change',event=>{if(state.imported&&event.target?.closest?.('#batch-rows-container'))queueMicrotask(renderState);});
  window.registerGateHook?.('afterPageChange',()=>requestAnimationFrame(renderState));
  window.registerGateHook?.('afterDataChanged',()=>requestAnimationFrame(renderState));
  window.registerGateHook?.('afterRenderAll',()=>requestAnimationFrame(renderState));
  window.registerGateHook?.('afterCloseout',()=>{
    state.imported=false;state.published=null;state.sourcePublished=null;state.sourceLines=[];state.bandDecision=null;
    requestAnimationFrame(renderState);
  });
  $('wg-batch-input')?.addEventListener('change',()=>{
    state.imported=false;state.published=null;state.sourcePublished=null;state.sourceLines=[];state.bandDecision=null;
    requestAnimationFrame(renderState);
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
