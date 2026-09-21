import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFlightAlertText, validateFlightAlertRows, normalizeDorm, normalizeSection, normalizeSquadron } from '../../public/app/features/input/flight-alert-parser.mjs';
import { extractFlightAlertPdf } from '../../public/app/features/input/flight-alert-pdf.mjs';
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
