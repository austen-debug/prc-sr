import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseFlightAlertText } from '../../../public/app/features/input/flight-alert-parser.mjs';
import { extractFlightAlertPdf } from '../../../public/app/features/input/flight-alert-pdf.mjs';

const sixColumns = `SQD SEC INTER/SECT DORM SEX LOAD
322 1 1 A03 M 56
2 B03 M 56
323 4 3 3D2 M 56
4 3D1 M 56
TOTAL FLT'S - 4
AAFES: 224`;

function fixture(source) {
  const bytes = new TextEncoder().encode(source);
  return { name: 'FlightAlert.pdf', size: bytes.length, arrayBuffer: async () => bytes.buffer };
}

test('six-column Flight Alert carries merged SQD/SEC cells, INTER/SECT and AAFES into the draft', () => {
  const result = parseFlightAlertText(sixColumns);
  assert.equal(result.ok, true);
  assert.equal(result.format, 'six-column-v2');
  assert.equal(result.rows.length, 4);
  assert.deepEqual(result.rows.map(row => row.sdq), ['322 TRS', '322 TRS', '323 TRS', '323 TRS']);
  assert.deepEqual(result.rows.map(row => row.sec), ['1', '1', '4', '4']);
  assert.deepEqual(result.rows.map(row => row.inter_sec), ['1', '2', '3', '4']);
  assert.deepEqual(result.rows.map(row => row.dorm_name), ['A03', 'B03', '3D2', '3D1']);
  assert.equal(result.publishedTotal, 224);
  assert.equal(result.calculatedTotal, 224);
  assert.equal(result.variance, 0);
});

test('missing or invalid six-column rows cannot produce a silently partial import', () => {
  const missing = parseFlightAlertText(sixColumns.replace('2 B03 M 56\n', ''));
  assert.equal(missing.ok, false);
  assert.ok(missing.issues.some(issue => issue.code === 'row_count'));
  const invalid = parseFlightAlertText(sixColumns.replace('2 B03 M 56', '2 B03 M UNKNOWN'));
  assert.equal(invalid.ok, false);
  assert.ok(invalid.issues.some(issue => issue.code === 'row_count'));
});

test('five-column Flight Alerts remain supported without falsely inventing INTER/SEC', () => {
  const result = parseFlightAlertText('SQUADRON SECTION DORM SEX LOAD\n535 TRS 1 4A1 MALE 48\n321 TRS 2 A01 FEMALE 42\nTOTAL EXPECTED LOAD: 90');
  assert.equal(result.ok, true);
  assert.equal(result.format, 'five-column-v1');
  assert.deepEqual(result.rows.map(row => row.inter_sec), ['', '']);
});

test('positioned PDF cell extraction restores row order and excludes the neighboring flight schedule', async () => {
  const cells = [
    ['SQD', 100, 700], ['SEC', 140, 700], ['INTER/SECT', 180, 700], ['DORM', 245, 700], ['SEX', 295, 700], ['LOAD', 345, 700],
    ['FLT/SQUADRON', 450, 700], ['PROC DAY', 550, 700],
    ['322', 100, 680], ['1', 140, 680], ['1', 180, 680], ['A03', 245, 680], ['M', 295, 680], ['56', 345, 680],
    ['5S', 450, 680], ['782/322', 500, 680], ['THURSDAY', 560, 680],
    ['2', 180, 660], ['B03', 245, 660], ['M', 295, 660], ['56', 345, 660],
    ['AAFES: 112', 150, 620]
  ];
  const content = cells.map(([text, x, y]) => `BT /F1 12 Tf 1 0 0 1 ${x} ${y} Tm (${text}) Tj ET`).join('\n');
  const pdf = `%PDF-1.4\n1 0 obj << /Length ${content.length} >> stream\n${content}\nendstream\nendobj\n%%EOF`;
  const text = await extractFlightAlertPdf(fixture(pdf));
  assert.doesNotMatch(text, /THURSDAY/);
  const result = parseFlightAlertText(text);
  assert.equal(result.ok, true);
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows.map(row => row.inter_sec), ['1', '2']);
  assert.equal(result.publishedTotal, 112);
});

test('Input import retains extracted INTER/SEC and falls back to existing manual values only when missing', async () => {
  const code = await readFile(new URL('../../../public/app/features/input/flight-alert-import.mjs', import.meta.url), 'utf8');
  assert.match(code, /inter_sec:item\.inter_sec\s*\|\|\s*prior\?\.inter_sec\s*\|\|\s*''/);
  assert.match(code, /Review INTER\/SEC/);
  assert.doesNotMatch(code, /inter_sec:prior\?\.inter_sec\|\|''/);
});

test('WG26052 Excel/Acrobat layout reconstructs all merged SQD/SEC rows and reconciles AAFES 697', async () => {
  const show=(text,x,y)=>`BT 9 0 0 9 ${x} ${y} Tm (${text})Tj ET`;
  const cells=[
    show('SQD',50,520), show('SEC',85,520), show('INTER/SECT',114,520), show('DORM',177,520), show('SEX',225,520), show('LOAD',265,520),
    show('FLT/SQUADRON',352,520), show('PROC DAY',450,520),
    // Merged squadron cells: TD moves are in text space and must preserve the Tm scale.
    'BT 9 0 0 9 53 507 Tm (323)Tj 0 -3.111111 TD (324)Tj 0 -3.666667 TD (331)Tj 0 -4.111111 TD (320)Tj ET',
    show('322',53,371),
    show('4',92,507), show('1',92,479), show('4',92,451), show('1',92,436), show('3',92,409), show('4',92,371)
  ];
  const expected=[
    ['323','4','1','2D1','M','57',511],['323','4','2','2D2','M','57',502],
    ['324','1','3','A01','M','57',483],['324','1','4','A02','F','48',474],
    ['331','4','5','3D1','M','57',455],['331','4','6','3D2','M','56',446],['331','1','7','3A1','F','47',436],
    ['320','3','8','3C2','M','56',418],['320','3','9','4C1','F','47',408],['320','3','10','3C1','M','56',399],
    ['322','4','11','A09','M','56',380],['322','4','12','B10','F','47',371],['322','4','13','A10','M','56',362]
  ];
  for (const [sdq,sec,inter,dorm,sex,load,y] of expected) {
    cells.push(show(inter,139,y),show(dorm,183,y-.2),show(sex,230,y-.2),show(load,273,y));
  }
  cells.push(show('1S',312,492),show('798/323',360,492),show('WEDNESDAY',420,492));
  cells.push(show('AAFES: 697',99,318),show('TOTAL FLTS - 13',360,318));
  const content=cells.join('\n');
  const pdf=`%PDF-1.4\n1 0 obj << /Length ${content.length} >> stream\n${content}\nendstream\nendobj\n%%EOF`;
  const text=await extractFlightAlertPdf(fixture(pdf));
  const result=parseFlightAlertText(text);
  assert.equal(result.ok,true);
  assert.equal(result.format,'six-column-v2');
  assert.equal(result.rows.length,13);
  assert.equal(result.publishedTotal,697);
  assert.equal(result.calculatedTotal,697);
  assert.equal(result.variance,0);
  assert.deepEqual(result.rows.map(row=>[row.sdq,row.sec,row.inter_sec,row.dorm_name,row.sex,row.load]),[
    ['323 TRS','4','1','2D1','male','57'],['323 TRS','4','2','2D2','male','57'],
    ['324 TRS','1','3','A01','male','57'],['324 TRS','1','4','A02','female','48'],
    ['331 TRS','4','5','3D1','male','57'],['331 TRS','4','6','3D2','male','56'],['331 TRS','1','7','3A1','female','47'],
    ['320 TRS','3','8','3C2','male','56'],['320 TRS','3','9','4C1','female','47'],['320 TRS','3','10','3C1','male','56'],
    ['322 TRS','4','11','A09','male','56'],['322 TRS','4','12','B10','female','47'],['322 TRS','4','13','A10','male','56']
  ]);
  assert.doesNotMatch(text,/798\/323|WEDNESDAY/);
});

