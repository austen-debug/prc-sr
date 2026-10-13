import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFlightAlertText, validateFlightAlertRows, normalizeDorm, normalizeSection, normalizeSquadron } from '../../public/app/features/input/flight-alert-parser.mjs';
import { extractFlightAlertPdf } from '../../public/app/features/input/flight-alert-pdf.mjs';
import { relocateWeekGroupActions } from '../../public/app/features/input/week-group-action-placement.mjs';
const sample = 'SQUADRON SECTION DORM SEX LOAD\n535 TRS 1 4A1 MALE 48\n321 TRS 2 A01 FEMALE 42\n324 TRS 3 4B2 M 45\nTOTAL EXPECTED LOAD: 135';
test('extract Week Group and preserve dorm leading zeros', () => {
 const result = parseFlightAlertText(sample);
 assert.equal(result.ok,true); assert.equal(result.rows.length,3);
 assert.equal(result.rows[0].space_force,true);
 assert.equal(result.rows[1].band,false);
 assert.equal(result.rows[1].dorm_name,'A01');
 assert.equal(result.rows[0].capacity,48);
 assert.equal(result.variance,0);
 assert.equal(result.issues.filter(i=>i.code==='inter_sec').length,3);
});
test('variance is advisory rather than a parser failure',()=>{
 const result=parseFlightAlertText(sample.replace('135','140'));
 assert.equal(result.ok,true);assert.equal(result.variance,-5);
 assert.equal(result.issues.find(i=>i.code==='variance').level,'warning');
});
test('duplicate identity and non-321 Band flag are reported',()=>{
 const parsed=parseFlightAlertText('535 TRS 1 4A1 MALE 48\n535 TRS 2 4A1 FEMALE 42\nGRAND TOTAL 90');
 assert.equal(parsed.issues.some(i=>i.code==='duplicate'),true);
 assert.equal(validateFlightAlertRows([{...parsed.rows[0],band:true}],48).issues.some(i=>i.code==='band'),true);
});
test('malformed flight lines do not silently produce a partial import',()=>{
 const parsed=parseFlightAlertText('535 TRS 9 4A1 MALE 48\nTOTAL LOAD: 48');
 assert.equal(parsed.ok,false);assert.equal(parsed.issues.some(i=>i.code==='unparsed_row'),true);
});
test('ambiguous totals require explicit correction',()=>{
 const parsed=parseFlightAlertText(sample+'\nGRAND TOTAL 135');
 assert.equal(parsed.ok,false);assert.equal(parsed.publishedTotal,null);
});
test('field normalization accepts only defined formats',()=>{
 assert.equal(normalizeSquadron('535'),'535 TRS');
 assert.equal(normalizeDorm('a01'),'A01');
 assert.equal(normalizeDorm('331'),'');
 assert.equal(normalizeSection('5'),'');
});
function fixture(source){ const bytes=new TextEncoder().encode(source);return {name:'FlightAlert.pdf',size:bytes.length,arrayBuffer:async()=>bytes.buffer}; }
test('local text PDF extraction feeds structured parser',async()=>{
 const content=['SQUADRON SECTION DORM SEX LOAD','535 TRS 1 4A1 MALE 48','321 TRS 2 A01 FEMALE 42','TOTAL EXPECTED LOAD: 90'].map(t=>`BT /F1 12 Tf (${t}) Tj ET`).join('\n');
 const text=await extractFlightAlertPdf(fixture(`%PDF-1.4\n1 0 obj << /Length ${content.length} >> stream\n${content}\nendstream\nendobj\n%%EOF`));
 const parsed=parseFlightAlertText(text);assert.equal(parsed.ok,true);assert.equal(parsed.rows.length,2);assert.equal(parsed.variance,0);
});
test('unsupported PDF fails closed',async()=>{
 await assert.rejects(extractFlightAlertPdf(fixture('%PDF-1.4\n%%EOF')),/extract/);
 await assert.rejects(extractFlightAlertPdf({name:'other.txt',size:100,arrayBuffer:async()=>new ArrayBuffer(100)}),/PDF/);
});


function syntheticAlertPdf({ withSection = false } = {}) {
  // Coordinate-based text PDF: 16 flights, merged SQD, intentionally empty SEC,
  // separate right-hand schedule, and numeric INTER/SECT values 1–16.
  const items = [];
  const put = (x,y,value) => items.push(`BT /F1 10 Tf 1 0 0 1 ${x} ${y} Tm (${value}) Tj ET`);
  [['SQD',40],['SEC',120],['INTER/SECT',185],['DORM',290],['SEX',366],['LOAD',436]]
    .forEach(([label,x])=>put(x,685,label));
  // These columns are unrelated to the dorm roster and must be ignored.
  put(620,685,'FLT/SQUADRON');put(710,685,'PROC DAY');
  const names=['3A1','3A2','2D2','2D1','A06','B07','A07','2A1','2A2','4A2','4A1','A03','B03','A06','B07','A07'];
  const sqGroups=[{sdq:321,first:0,count:4},{sdq:322,first:4,count:3},
    {sdq:323,first:7,count:4},{sdq:324,first:11,count:2},{sdq:326,first:13,count:3}];
  const loads=[60,60,60,47,60,46,59,59,59,59,56,59,59,59,46,59];
  const females=new Set([3,5,10,14]);
  for(const group of sqGroups) {
    const middle=650-(group.first+(group.count-1)/2)*12;
    put(44,middle,group.sdq);
  }
  for(let i=0;i<16;i++) {
    const y=650-i*12;
    if(withSection && i===0)put(127,y,'2');
    put(194,y,String(i+1));
    put(298,y,names[i]);
    put(374,y,females.has(i)?'F':'M');
    put(442,y,String(loads[i]));
    put(625,y,'01/7/321'); // Must not contaminate the dorm column.
  }
  put(50,390,'AAFES: 898');
  put(620,375,'TOTAL FLTS - 16');
  const content=items.join('\n');
  return fixture(`%PDF-1.4
1 0 obj << /Length ${content.length} >> stream
${content}
endstream
endobj
%%EOF`);
}

test('header-aligned PDF import preserves all 16 flights with blank SEC and numbered INTER/SECT',async()=>{
  const extracted=await extractFlightAlertPdf(syntheticAlertPdf());
  const parsed=parseFlightAlertText(extracted);
  assert.equal(parsed.ok,true,JSON.stringify(parsed.issues));
  assert.equal(parsed.rows.length,16);
  assert.equal(parsed.rows[0].sdq,'321 TRS');
  assert.equal(parsed.rows[0].dorm_name,'3A1');
  assert.equal(parsed.rows[3].sex,'female');
  assert.equal(parsed.rows[15].sdq,'326 TRS');
  assert.equal(parsed.rows[15].inter_sec,'16');
  assert.ok(parsed.rows.every(row=>row.sec===''), 'blank SEC must never be invented');
  assert.deepEqual(parsed.rows.map(row=>row.inter_sec),Array.from({length:16},(_,i)=>String(i+1)));
  assert.equal(parsed.publishedTotal,898);
  assert.equal(parsed.issues.filter(issue=>issue.code==='section'&&issue.level==='warning').length,16);
  assert.equal(parsed.issues.some(issue=>issue.code==='row_count'),false);
});

test('a populated SEC on one PDF row is not copied into adjacent blank rows',async()=>{
  const extracted=await extractFlightAlertPdf(syntheticAlertPdf({withSection:true}));
  const parsed=parseFlightAlertText(extracted);
  assert.equal(parsed.ok,true,JSON.stringify(parsed.issues));
  assert.equal(parsed.rows[0].sec,'2');
  assert.ok(parsed.rows.slice(1).every(row=>row.sec===''));
});

test('source-delimited blank section cells are review warnings, but nonblank invalid fields still fail',()=>{
  const source='SQD SEC INTER/SECT DORM SEX LOAD\n321||15|3A1|M|60\n|2||3A2|F|46\nAAFES: 106';
  const result=parseFlightAlertText(source);
  assert.equal(result.ok,true,JSON.stringify(result.issues));
  assert.deepEqual(result.rows.map(row=>[row.sec,row.inter_sec]),[['','15'],['2','']]);
  assert.equal(result.issues.some(issue=>issue.code==='section'&&issue.level==='warning'),true);
  assert.equal(result.issues.some(issue=>issue.code==='inter_sec'&&issue.level==='warning'),true);
  const invalid=validateFlightAlertRows([{...result.rows[0],sec:'9'}],60);
  assert.equal(invalid.issues.some(issue=>issue.code==='section'&&issue.level==='error'),true);
});

test('the Flight Alert UI requires explicit review before an incomplete draft can be imported',async()=>{
  const ui=await (await import('node:fs/promises')).readFile(new URL('../../public/app/features/input/flight-alert-import.mjs',import.meta.url),'utf8');
  assert.match(ui,/function drawImportReview\(parsed\)/);
  assert.match(ui,/gate-import-validated/);
  assert.match(ui,/if \(!checkbox\.checked\)/);
  assert.match(ui,/validateFlightAlertRows\(candidateRows,parsed\.publishedTotal\)/);
  assert.match(ui,/sec:item\.sec \|\| ''/);
  assert.match(ui,/inter_sec:item\.inter_sec \|\| ''/);
  assert.doesNotMatch(ui,/if\(!existing\.length\)\{applyCandidate\(parsed\);return;\}/);
  assert.match(ui,/Validate & add to draft/);
});

// Simulate native DOM reparenting: the original live node and its onclick survive the move.
class ElementStub {
 constructor(tag, id = '') { this.tagName = tag.toUpperCase(); this.id = id; this.className = ''; this.dataset = {}; this.style = {}; this.attributes = {}; this.parentElement = null; this.nodes = []; this.ownText = ''; }
 get children() { return this.nodes; }
 get firstElementChild() { return this.nodes[0] || null; }
 get nextSibling() { if (!this.parentElement) return null; return this.parentElement.nodes[this.parentElement.nodes.indexOf(this) + 1] || null; }
 get textContent() { return this.ownText + this.nodes.map(node => node.textContent).join(''); }
 set textContent(value) { this.ownText = String(value); this.nodes.forEach(node => { node.parentElement = null; }); this.nodes = []; }
 get classList() { return { contains: value => this.className.split(/\s+/).includes(value) }; }
 append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
 appendChild(node) { node.remove(); node.parentElement = this; this.nodes.push(node); return node; }
 insertBefore(node, reference) { node.remove(); const index = reference ? this.nodes.indexOf(reference) : -1; node.parentElement = this; this.nodes.splice(index < 0 ? this.nodes.length : index, 0, node); return node; }
 remove() { if (this.parentElement) { const nodes = this.parentElement.nodes; nodes.splice(nodes.indexOf(this), 1); this.parentElement = null; } }
 contains(node) { return node === this || this.nodes.some(child => child.contains(node)); }
 closest(selector) { let node = this; while (node) { if (selector.startsWith('.') && node.classList.contains(selector.slice(1))) return node; node = node.parentElement; } return null; }
 setAttribute(name, value) { this.attributes[name] = value; }
}
function actionFixture() {
 const body = new ElementStub('body');
 const page = new ElementStub('div', 'page-input');
 const processing = new ElementStub('div', 'page-processing');
 const header = new ElementStub('div'); header.className = 'flex-shrink-0 border-b';
 const summary = new ElementStub('div');
 const wg = new ElementStub('input', 'wg-batch-input');
 header.append(summary, wg);
 const grid = new ElementStub('div', 'batch-grid-wrapper');
 const footer = new ElementStub('div'); footer.className = 'flex-shrink-0 border-t';
 const initStatus = new ElementStub('div', 'init-status-msg');
 const initialize = new ElementStub('button', 'init-wg-btn'); initialize.onclick = () => 'canonical initialize';
 footer.append(initStatus, initialize);
 page.append(header, grid, footer);
 const processingHeader = new ElementStub('div');
 const localBus = new ElementStub('button', 'local-bus-action');
 const closeout = new ElementStub('button', 'closeout-btn'); closeout.onclick = () => 'canonical archive';
 const archiveStatus = new ElementStub('div', 'closeout-safety-msg');
 const hint = new ElementStub('div', 'processing-edit-hint');
 processingHeader.append(localBus, closeout, archiveStatus, hint);
 processing.append(processingHeader);
 body.append(page, processing);
 const doc = { getElementById(id) { const visit = node => node.id === id ? node : node.nodes.map(visit).find(Boolean); return visit(body); }, createElement(tag) { return new ElementStub(tag); } };
 return {doc, page, processingHeader, footer, initialize, closeout, localBus, initStatus, archiveStatus};
}
test('Week Group action cards keep identical structures, aligned buttons and reserved status areas while preserving their handlers', () => {
 const {doc,page,processingHeader,footer,initialize,closeout,localBus,initStatus,archiveStatus}=actionFixture();
 const initializeHandler=initialize.onclick, closeoutHandler=closeout.onclick;
 assert.equal(relocateWeekGroupActions(doc),true);
 const startPanel=doc.getElementById('gate-week-group-initialize-panel');
 const finishPanel=doc.getElementById('gate-week-group-closeout-panel');
 const startFeedback=doc.getElementById('gate-week-group-initialize-panel-feedback');
 const finishFeedback=doc.getElementById('gate-week-group-closeout-panel-feedback');
 assert.deepEqual(startPanel.children.slice(-2),[startFeedback,initialize]);
 assert.deepEqual(finishPanel.children.slice(-2),[finishFeedback,closeout]);
 assert.deepEqual(startFeedback.children,[initStatus]);
 assert.deepEqual(finishFeedback.children,[archiveStatus]);
 assert.equal(startPanel.style.minHeight,finishPanel.style.minHeight);
 assert.equal(startFeedback.style.minHeight,finishFeedback.style.minHeight);
 assert.equal(initialize.style.minHeight,closeout.style.minHeight);
 assert.equal(initialize.style.fontSize,closeout.style.fontSize);
 assert.equal(initialize.style.padding,closeout.style.padding);
 assert.equal(initialize.style.marginTop,'auto');
 assert.equal(closeout.style.marginTop,'auto');
 assert.equal(initialize.onclick,initializeHandler);
 assert.equal(closeout.onclick,closeoutHandler);
 assert.equal(initialize.onclick(),'canonical initialize');
 assert.equal(closeout.onclick(),'canonical archive');
 assert.equal(initStatus.attributes.role,'status');
 assert.equal(archiveStatus.attributes.role,'status');
 assert.equal(initialize.attributes['aria-describedby'],'gate-week-group-initialize-panel-description');
 assert.equal(closeout.attributes['aria-describedby'],'gate-week-group-closeout-panel-description');
 assert.match(finishPanel.style.borderColor,/mg-red/);
 assert.deepEqual(processingHeader.children.filter(node=>node.tagName==='BUTTON'),[localBus]);
 assert.equal(page.contains(footer),false);
 initStatus.textContent='At least one row with load required';
 assert.equal(relocateWeekGroupActions(doc),true);
 assert.deepEqual(startFeedback.children,[initStatus]);
 assert.deepEqual(finishFeedback.children,[archiveStatus]);
 assert.deepEqual(startPanel.children.slice(-2),[startFeedback,initialize]);
 assert.deepEqual(finishPanel.children.slice(-2),[finishFeedback,closeout]);
 assert.equal(page.children.filter(node=>node.id==='gate-week-group-actions').length,0);
 assert.equal(doc.getElementById('gate-week-group-actions').children.length,2);
});
test('Week Group action relocation does nothing if either original button is missing', () => {
 const {doc,closeout}=actionFixture();closeout.remove();
 assert.equal(relocateWeekGroupActions(doc),false);
 assert.equal(doc.getElementById('gate-week-group-actions'),undefined);
});
