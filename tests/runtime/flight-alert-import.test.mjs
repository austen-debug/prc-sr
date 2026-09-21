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
test('Week Group actions are safely separated while original handlers and feedback are retained', () => {
 const {doc, page, processingHeader, footer, initialize, closeout, localBus, initStatus, archiveStatus} = actionFixture();
 const originalInitialize = initialize.onclick;
 const originalCloseout = closeout.onclick;
 assert.equal(relocateWeekGroupActions(doc), true);
 const startPanel = doc.getElementById('gate-week-group-initialize-panel');
 const finishPanel = doc.getElementById('gate-week-group-closeout-panel');
 assert.deepEqual(startPanel.children.slice(-2), [initialize, initStatus]);
 assert.deepEqual(finishPanel.children.slice(-2), [closeout, archiveStatus]);
 assert.equal(initialize.onclick, originalInitialize);
 assert.equal(closeout.onclick, originalCloseout);
 assert.equal(closeout.onclick(), 'canonical archive');
 assert.equal(initialize.attributes['aria-describedby'], 'gate-week-group-initialize-panel-description');
 assert.equal(closeout.attributes['aria-describedby'], 'gate-week-group-closeout-panel-description');
 assert.equal(initialize.style.minHeight, '48px');
 assert.equal(closeout.style.minHeight, '44px');
 assert.match(finishPanel.style.borderColor, /mg-red/);
 assert.equal(initStatus.attributes.role, 'status');
 assert.equal(archiveStatus.attributes.role, 'status');
 assert.deepEqual(processingHeader.children.filter(node => node.tagName === 'BUTTON'), [localBus]);
 assert.equal(page.contains(footer), false);
 assert.equal(relocateWeekGroupActions(doc), true);
 assert.deepEqual(startPanel.children.slice(-2), [initialize, initStatus]);
 assert.deepEqual(finishPanel.children.slice(-2), [closeout, archiveStatus]);
 assert.equal(page.children.filter(node => node.id === 'gate-week-group-actions').length, 0); // Panel lives in header.
 assert.equal(doc.getElementById('gate-week-group-actions').children.length, 2);
});
test('Week Group action relocation does nothing if either original button is missing', () => {
 const {doc, closeout} = actionFixture(); closeout.remove();
 assert.equal(relocateWeekGroupActions(doc), false);
 assert.equal(doc.getElementById('gate-week-group-actions'), undefined);
});
