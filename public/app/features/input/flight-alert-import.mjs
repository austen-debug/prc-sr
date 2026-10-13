/** GATE Input enhancement: Flight Alert import changes draft rows only, never operational records. */
import './week-group-action-placement.mjs';
import { parseFlightAlertText, validateFlightAlertRows, normalizeSquadron, orderFlightAlertRows, prepareFlightAlertReviewRows } from './flight-alert-parser.mjs?v=flight-alert-parser-20261013-no-rows';
import { extractFlightAlertPdf } from './flight-alert-pdf.mjs?v=flight-alert-pdf-20261013-no-rows';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const state = { imported: false, published: null, sourcePublished: null, bandDecision: null, sourceLines: [], busy: false, candidate: null, activeMode: 'pdf', lastInvoker: null, selectedPdf: null };
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
    panel.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-2"><div><strong class="text-sm">FLIGHT ALERT</strong><p class="text-xs text-muted">Prepare the Input table; initialize separately.</p></div><div class="flex flex-wrap gap-2"><button id="gate-import-open" type="button" class="${BTN}" style="border-color:var(--border);background:var(--surface);color:var(--text)">Import Flight Alert</button><button id="gate-import-inter" type="button" class="${BTN}" style="border-color:var(--border);background:var(--surface);color:var(--text)" hidden>Review INTER/SEC</button></div></div><div id="gate-import-summary" aria-live="polite"></div><p id="gate-import-message" class="text-sm" role="status" hidden></p>`;
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
  const missingSec = current.issues.filter(i=>i.code === 'section' && i.level === 'warning').length;
  const missingInter = current.issues.filter(i=>i.code === 'inter_sec' && i.level === 'warning').length;
  const bandRows = rows().map((row,index)=>({row,index})).filter(({row})=>normalizeSquadron(row.sdq)==='321 TRS' && row.dorm_name);
  const variance = current.variance;
  const totalText = current.published == null ? 'Published total: not extracted' : `Published total: ${current.published}`;
  const varianceText = variance === null ? 'Enter the published total to reconcile.' : variance === 0 ? 'Reconciled' : `Discrepancy: ${variance > 0 ? '+' : ''}${variance} (warning only)`;
  el.innerHTML = `<div class="grid gap-2 text-sm"><p><strong>${activeRows().length} dorms loaded into draft.</strong> ${missingSec} SEC and ${missingInter} INTER/SEC fields blank (reviewed). No operational records created.</p><div class="flex flex-wrap gap-3 items-center"><span>${esc(totalText)}</span><span>Calculated: ${current.calculated}</span><strong style="color:${variance !== 0 ? 'var(--yellow)' : 'var(--green)'}">${esc(varianceText)}</strong></div><label class="flex flex-wrap items-center gap-2">Published total <input id="gate-import-total" aria-label="Published Flight Alert total" type="number" min="0" step="1" value="${current.published ?? ''}" class="border rounded px-2 py-1 w-28" style="border-color:var(--border);color:var(--text)"></label><div id="gate-import-band"></div><div id="gate-import-issues" role="status"></div></div>`;
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
  const critical = current.issues.filter(i=>i.level==='error');
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
    for (const [selector, field, label] of [['.batch-sec','sec','SEC'],['.batch-inter','inter_sec','INTER/SEC']]) {
      const input = el.querySelector(selector);
      if (!input) continue;
      const missing = !!(row.sdq || row.dorm_name || row.load) && !String(row[field] || '').trim();
      input.toggleAttribute('aria-invalid', missing);
      input.style.borderColor = missing ? 'var(--yellow)' : COLORS.border;
      if (missing) input.title = label + ' was left blank in the source; verify against the Flight Alert before initialization.';
      else input.removeAttribute('title');
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
    else if (['sec','sex','load'].some(field=>String(old[field])!==String(row[field])) || (row.inter_sec && String(old.inter_sec)!==String(row.inter_sec))) changed++;
  }
  const removed=[...previous.keys()].filter(key=>!incoming.has(key)).length;
  return {added,changed,removed};
}
function applyCandidate(candidate) {
  if (disabledReason()) { modalError(disabledReason()); return; }
  if (Number.isSafeInteger(candidate.declaredRowCount) && candidate.rows.length !== candidate.declaredRowCount) {
    modalError(`Complete all ${candidate.declaredRowCount} declared flights before applying the draft.`);
    return;
  }
  const defects = validateFlightAlertRows(candidate.rows,candidate.publishedTotal).issues.filter(issue=>issue.level==='error');
  if (defects.length) { modalError(defects.slice(0,4).map(issue=>issue.message).join(' ')); return; }
  const sourceOrdered = orderFlightAlertRows(candidate.rows, candidate.declaredRowCount ?? null);
  const draft = sourceOrdered.map((item,index)=>({ rowIndex:index, sdq:item.sdq, sec:item.sec || '', inter_sec:item.inter_sec || '', dorm_name:item.dorm_name, sex:item.sex, band:false, space_force:item.space_force, load:item.load }));
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
  const missingSec = candidate.rows.filter(row=>!String(row.sec||'').trim()).length;
  const missingInter = candidate.rows.filter(row=>!String(row.inter_sec||'').trim()).length;
  notice(`${candidate.rows.length} dorms added to the Input draft. ${missingSec} SEC and ${missingInter} INTER/SEC fields remain blank as reviewed. Verify any blanks before INITIALIZE WEEK GROUP.`);
}
function modalError(message) { const el=$('gate-import-modal-error'); if(el) { el.textContent=message; el.hidden=false; } }
function clearError() { const el=$('gate-import-modal-error'); if(el) {el.textContent='';el.hidden=true;} }
function ensureModal() {
  if ($('gate-import-dialog')) return $('gate-import-dialog');
  const dialog=element('dialog','rounded-xl border shadow-2xl p-0');
  dialog.id='gate-import-dialog';
  dialog.setAttribute('aria-labelledby','gate-import-dialog-title');
  dialog.style.cssText='width:min(760px,calc(100vw - 24px));max-height:calc(100dvh - 32px);overflow:auto;border-color:var(--border);background:var(--surface);color:var(--text);padding:0;z-index:var(--mg-z-modal);';
  dialog.innerHTML=`<div class="p-4 sm:p-6 grid gap-4"><header class="flex gap-3 justify-between items-start"><div><h2 id="gate-import-dialog-title" class="text-lg font-bold">Import Flight Alert</h2><p id="gate-import-dialog-help" class="text-xs text-muted">Extract data into the Input draft. Initialization stays separate.</p></div><button type="button" id="gate-import-close" class="${BTN}" aria-label="Close Flight Alert dialog">Close</button></header><div id="gate-import-dialog-main" class="grid gap-4"></div><p id="gate-import-modal-error" role="alert" class="text-sm" style="color:var(--red)" hidden></p></div>`;
  document.body.append(dialog);
  dialog.addEventListener('close',()=>{
    const main=$('gate-import-dialog-main'); if(main) main.replaceChildren();
    state.candidate=null;state.busy=false;state.selectedPdf=null;
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
  $('gate-import-dialog-title').textContent=mode==='inter'?'Review SEC / INTER/SEC':'Import Flight Alert';
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
      area.append(label,element('p','text-xs text-muted','Text-based PDFs only. PDF extraction stays in this browser. Blank SEC / INTER/SEC fields can be reviewed before import, without copying PDF text.'));
      if (state.selectedPdf) {
        const retry = element('button',BTN,'Retry selected PDF: ' + state.selectedPdf.name);
        retry.type = 'button'; retry.style.borderColor = COLORS.border;
        retry.title = 'Retry the same PDF without selecting it again';
        retry.addEventListener('click',()=>processPdfFile(state.selectedPdf));
        area.append(retry);
      }
      input.addEventListener('change',()=>{
        const file=input.files?.[0]; if(!file)return;
        state.selectedPdf=file;
        void processPdfFile(file);
      });
    } else {
      const label=element('label','grid gap-2 text-sm font-semibold','Flight Alert text');
      const textarea=element('textarea','w-full rounded-lg border p-3 text-sm');textarea.rows=9;textarea.maxLength=250000;
      textarea.placeholder='SQD SEC INTER/SECT DORM SEX LOAD\n322 1 1 A03 M 56\n2 B03 M 56\nAAFES: 112';
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
async function processPdfFile(file) {
  if (!file || state.busy) return;
  clearError();
  state.busy=true;
  try {
    const extracted=await extractFlightAlertPdf(file,window.pdfjsLib||null);
    processText(extracted);
  } catch (error) {
    modalError(error?.message || 'PDF extraction failed. Select a different PDF or retry the same file.');
  } finally {
    state.busy=false;
    // Never reset the file input: operators must be able to retry or inspect a
    // recoverable extraction without hunting for the same PDF again.
  }
}

function processText(text) {
  const parsed=parseFlightAlertText(text);
  if (!parsed.ok && !parsed.recoverable) {
    const errors = parsed.issues.filter(issue=>issue.level==='error').map(issue=>issue.message);
    if (parsed.issues.some(issue=>issue.code==='no_rows')) {
      const lines = String(text || '').split(/\r?\n/).filter(line=>line.trim());
      const headerRecognized = /SQD|SQUADRON|SDQ/i.test(text) &&
        /DORM/i.test(text) && /LOAD/i.test(text);
      errors.push(`Diagnostic: ${lines.length} extracted text lines; roster headers ${headerRecognized ? 'detected' : 'not detected'}. The chosen PDF is retained for retry. A PDF without a usable text layer requires a different extraction method; it cannot be safely guessed from the image.`);
    }
    modalError(errors.join(' ')||'Flight Alert extraction failed.');
    return;
  }
  if (disabledReason()) { modalError(disabledReason()); return; }
  state.candidate=parsed;
  drawImportReview(parsed);
}

/** Review is separate from Input initialization. Recoverable 15/16 imports
 *  stay in this dialog until the missing flight is manually completed. */
function drawImportReview(parsed) {
  const main=$('gate-import-dialog-main');main.replaceChildren();clearError();
  const existing=activeRows();
  const incoming=prepareFlightAlertReviewRows(parsed);
  const expected=Number.isSafeInteger(parsed.declaredRowCount)?parsed.declaredRowCount:null;
  const root=element('div','grid gap-3');
  main.append(root);
  const title=element('h3','text-base font-bold','Validate extracted Flight Alert');
  root.append(title);
  const status=element('p','text-sm');
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  root.append(status);
  const totals=element('p','text-xs text-muted');
  root.append(totals);
  const scroll=element('div','overflow-x-auto rounded-lg border');
  scroll.style.borderColor=COLORS.border;
  const table=element('table','w-full text-xs text-left');
  table.style.minWidth='690px';
  scroll.append(table);root.append(scroll);
  const repair=element('div','flex flex-wrap gap-2 items-center');
  const where=element('select','border rounded px-2 py-2 text-sm');
  where.id='gate-import-insert-position';
  where.setAttribute('aria-label','Where to insert the missing flight');
  where.style.cssText='border-color:var(--border);background:var(--surface-alt);color:var(--text);min-width:150px';
  const add=element('button',BTN,'Add missing flight');
  add.type='button';add.style.borderColor=COLORS.border;
  repair.append(where,add);root.append(repair);
  const acknowledgment=element('label','flex items-start gap-2 text-sm');
  const checkbox=element('input');
  checkbox.type='checkbox';checkbox.id='gate-import-validated';checkbox.className='mt-1';
  acknowledgment.append(checkbox,document.createTextNode(
    'I verified all required flight information, preserved source order, and reviewed intentional SEC / INTER/SEC blanks.'
  ));
  root.append(acknowledgment);
  const actions=element('div','flex flex-wrap justify-end gap-2');
  const back=element('button',BTN,'Back to PDF');
  back.type='button';back.style.borderColor=COLORS.border;
  back.addEventListener('click',()=>{clearError();drawImportForm();});
  const confirm=element('button',BTN,existing.length?'Validate & replace draft':'Validate & add to draft');
  confirm.type='button';
  confirm.style.cssText='background:var(--yellow);color:var(--bg);border-color:var(--yellow)';
  actions.append(back,confirm);root.append(actions);

  function refresh() {
    const missing=expected===null?0:Math.max(0,expected-incoming.length);
    const blankSec=incoming.filter(row=>!String(row.sec||'').trim()).length;
    const blankInter=incoming.filter(row=>!String(row.inter_sec||'').trim()).length;
    const awaiting=incoming.filter(row=>row.needsReview || !String(row.sdq||'').trim() ||
      !String(row.dorm_name||'').trim() || !String(row.sex||'').trim() || !String(row.load||'').trim()).length;
    status.textContent=`${parsed.rows.length} extracted from PDF; ${incoming.length} reviewed${expected===null?'':' of '+expected+' declared'} flights. ${blankSec} blank SEC; ${blankInter} blank INTER/SEC.` +
      (missing?` ${missing} flight${missing===1?' is':'s are'} missing. Add and complete ${missing===1?'it':'them'} below.`:'') +
      (awaiting?` ${awaiting} row${awaiting===1?' needs':'s need'} required-field verification.`:'');
    status.style.color=(missing||awaiting)?'var(--yellow)':'var(--text)';
    const check=validateFlightAlertRows(incoming,parsed.publishedTotal);
    totals.textContent=`Calculated load: ${check.calculated}. Published: ${parsed.publishedTotal??'not found'}. ${check.variance===null?'':'Difference: '+check.variance+'. '}` +
      (missing?'The Input draft remains unchanged until all flights are accounted for.':'Review all values before applying the draft.');
    const fields=[
      ['sdq','SQD',7],['sec','SEC',1],['inter_sec','INTER/SECT',3],
      ['dorm_name','DORM',4],['sex','SEX',0],['load','LOAD',3]
    ];
    table.innerHTML='<thead><tr>' + ['#',...fields.map(field=>field[1])].map(label=>`<th scope="col" class="p-2">${label}</th>`).join('') +
      '</tr></thead><tbody>' + incoming.map((row,index)=>{
        const cells=fields.map(([field,label,maxLength])=>{
          if(field==='sex')return `<td class="p-1"><select class="border rounded px-1 py-1" style="border-color:var(--border);background:var(--surface-alt);color:var(--text)" data-review-index="${index}" data-review-field="sex" aria-label="Flight ${index+1} Sex"><option value="" ${row.sex?'':'selected'}>Select</option><option value="male" ${row.sex==='male'?'selected':''}>M</option><option value="female" ${row.sex==='female'?'selected':''}>F</option></select></td>`;
          const width=field==='sdq'?'w-24':field==='dorm_name'?'w-20':'w-16';
          return `<td class="p-1"><input type="text" class="${width} border rounded px-2 py-1" style="border-color:var(--border);background:var(--surface-alt);color:var(--text)" data-review-index="${index}" data-review-field="${field}" aria-label="Flight ${index+1} ${label}" maxlength="${maxLength}" placeholder="—" value="${esc(row[field]||'')}"></td>`;
        }).join('');
        return `<tr class="border-t" style="border-color:var(--border);${row.needsReview?'background:color-mix(in srgb, var(--yellow) 12%, transparent)':''}"><th scope="row" class="p-2">${index+1}${row.needsReview?' · CHECK':''}</th>${cells}</tr>`;
      }).join('') + '</tbody>';
    const selected=where.value;
    where.innerHTML='<option value="0">At beginning</option>' +
      incoming.map((row,index)=>`<option value="${index+1}">After ${index+1}: ${esc(row.dorm_name||'(new flight)')}</option>`).join('');
    if ([...where.options].some(option=>option.value===selected)) where.value=selected;
    else where.value=String(incoming.length);
    repair.hidden=expected!==null && missing===0;
    if(expected===null)repair.hidden=true;
    // Every structural edit resets the acknowledgment so it cannot be reused.
    checkbox.checked=false;
    table.querySelectorAll('[data-review-index]').forEach(input=>{
      input.addEventListener('input',()=>{
        const row=incoming[Number(input.dataset.reviewIndex)];
        if(!row)return;
        const field=input.dataset.reviewField;
        row[field]=input.value.trim();
        if(field==='sdq')row.space_force=normalizeSquadron(row.sdq)==='535 TRS';
        // Keep the editor stable while typing: re-rendering the table on
        // every field change destroys focus, caret and scroll position.
        checkbox.checked=false;
      });
      input.addEventListener('change',()=>{
        const row=incoming[Number(input.dataset.reviewIndex)];
        if(!row)return;
        if(input.dataset.reviewField==='sdq')row.sdq=normalizeSquadron(row.sdq)||row.sdq;
        if(input.dataset.reviewField==='dorm_name')row.dorm_name=row.dorm_name.toUpperCase();
        // Do not rebuild the entire table on blur; validation runs on submit.
        checkbox.checked=false;
      });
    });
  }

  add.addEventListener('click',()=>{
    if(expected===null||incoming.length>=expected)return;
    const index=Number(where.value);
    incoming.splice(index,0,{
      sourceLine:null,sdq:'',sec:'',inter_sec:'',dorm_name:'',sex:'',load:'',
      space_force:false,band:false,needsReview:true
    });
    refresh();
    const input=table.querySelector(`[data-review-index="${index}"][data-review-field="sdq"]`);
    input?.focus();
  });

  confirm.addEventListener('click',()=>{
    clearError();
    if(expected!==null && incoming.length!==expected){
      modalError(`The Flight Alert declares ${expected} flights, but ${incoming.length} are present. Add and complete the missing flight before applying the draft.`);
      return;
    }
    const defects=validateFlightAlertRows(incoming,parsed.publishedTotal).issues.filter(issue=>issue.level==='error');
    if(defects.length){modalError(defects.slice(0,5).map(issue=>issue.message).join(' '));return;}
    if(!checkbox.checked){
      modalError('Review the extracted flights and acknowledge any remaining blank SEC or INTER/SEC values before importing.');
      return;
    }
    applyCandidate({...parsed,rows:orderFlightAlertRows(incoming,expected)});
  });
  refresh();
}

function drawInterForm() {
  const main=$('gate-import-dialog-main');main.replaceChildren();
  const active=rows().map((row,index)=>({row,index})).filter(({row})=>row.sdq||row.dorm_name||row.load);
  const intro=element('p','text-sm text-muted','Review SEC and INTER/SEC values against the Flight Alert. Blank source cells may remain blank; do not guess. Nothing is saved to operational records until initialization.');
  const form=element('form','grid gap-3');
  const editing = active.map(({row,index})=>({index,row:{...row}}));
  editing.forEach(({row,index})=>{
    const wrapper=element('div','grid gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_6rem] items-center');
    wrapper.append(element('span','text-sm font-semibold',`${row.sdq} / ${row.dorm_name}`));
    for(const [field,label,size] of [['sec','SEC',1],['inter_sec','INTER/SEC',3]]) {
      const input=element('input','border rounded-lg px-2 py-2 text-sm');
      input.value=row[field]||'';input.maxLength=size;input.placeholder=label;
      input.setAttribute('aria-label',`${label} for ${row.sdq} dorm ${row.dorm_name}`);
      input.style.cssText='border-color:var(--border);background:var(--surface-alt);color:var(--text)';
      input.addEventListener('input',()=>{row[field]=input.value.trim();});
      wrapper.append(input);
    }
    form.append(wrapper);
  });
  const save=element('button',BTN,'Validate section changes');save.type='submit';save.style.borderColor=COLORS.border;
  form.append(save);
  form.addEventListener('submit',event=>{
    event.preventDefault();clearError();
    const adjusted=editing.map(({row})=>row);
    const invalid=validateFlightAlertRows(adjusted,state.published).issues.filter(issue=>issue.level==='error');
    if(invalid.length) {modalError(invalid.slice(0,3).map(issue=>issue.message).join(' '));return;}
    for(const {index,row} of editing) {rows()[index].sec=row.sec;rows()[index].inter_sec=row.inter_sec;}
    owner().renderBatchGrid();closeModal();renderState();
    notice('Section changes applied to the Input draft. Any reviewed blanks remain blank.');
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
