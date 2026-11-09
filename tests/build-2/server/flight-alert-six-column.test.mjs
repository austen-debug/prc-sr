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

test('Input import preserves intentional section blanks and requires operator review before draft replacement', async () => {
  const code = await readFile(new URL('../../../public/app/features/input/flight-alert-import.mjs', import.meta.url), 'utf8');
  assert.match(code, /inter_sec:item\.inter_sec\s*\|\|\s*''/);
  assert.match(code, /sec:item\.sec\s*\|\|\s*''/);
  assert.doesNotMatch(code, /prior\?\.inter_sec/, 'existing manual section values must not be silently substituted for reviewed PDF blanks');
  assert.match(code, /Review SEC \/ INTER\/SEC/);
  assert.match(code, /gate-import-validated/);
  assert.match(code, /if\(!checkbox\.checked\)/);
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



test('WG27006 Flight Alert: SECT heading, merged squadron cells, 16 flights and AAFES 898', async () => {
  // Synthetic, source-layout regression from the 6-Nov-2026 Flight Alert.
  // No operational PDF or trainee information is committed to the repository.
  const records = [
    ['320', '4', '3D2', 'M', 57], ['320', '4', '3D1', 'M', 57],
    ['320', '4', '4D2', 'M', 57], ['320', '4', '4D1', 'F', 54],
    ['321', '1', '2A1', 'M', 57], ['321', '1', '2A2', 'M', 57],
    ['321', '1', '3A2', 'M', 57], ['321', '1', '3A1', 'F', 54],
    ['322', '2', 'B06', 'M', 57], ['322', '2', 'B09', 'M', 57],
    ['323', '3', '2C1', 'M', 57], ['323', '3', '2C2', 'M', 57],
    ['323', '1', '3A1', 'M', 57], ['323', '1', '3A2', 'F', 54],
    ['324', '1', 'A03', 'M', 56], ['324', '1', 'B03', 'F', 53]
  ];
  const yPositions = [510, 496, 482, 468, 440, 426, 412, 398, 370, 356, 328, 314, 286, 272, 244, 230];
  const cells = [];
  const put = (text, x, y) => cells.push({ text: String(text), x, y });
  [['SQD', 50], ['SECT', 105], ['INTER/SECT', 180], ['DORM', 258],
    ['SEX', 325], ['LOAD', 380]].forEach(([text, x]) => put(text, x, 540));
  put('FLT/SQUADRON', 500, 540);
  put('PROC DAY', 590, 540);
  put('TRNG START DATE/WEEK GROUP 27006', 520, 558);
  for (const [squadron, y] of [['320', 489], ['321', 419], ['322', 363], ['323', 300], ['324', 237]]) {
    put(squadron, 55, y);
  }
  for (const [section, y] of [['4', 489], ['1', 419], ['2', 363],
    ['3', 321], ['1', 279], ['1', 237]]) put(section, 111, y);
  records.forEach(([squadron, section, dorm, sex, load], index) => {
    const y = yPositions[index];
    put(index + 1, 190, y);
    put(dorm, 260, y);
    put(sex, 330, y);
    put(load, 385, y);
  });
  put('B067/321', 505, 412); // Right-hand schedule is not a dorm row.
  put('THURSDAY', 590, 412);
  put('TOTAL FLTS - 16', 510, 185);
  put('AAFES: 898', 105, 185);
  const content = cells.map(cell =>
    'BT /F1 10 Tf 1 0 0 1 ' + cell.x + ' ' + cell.y +
    ' Tm (' + cell.text + ') Tj ET').join('\n');
  const pdf = '%PDF-1.4\n1 0 obj << /Length ' + content.length +
    ' >> stream\n' + content + '\nendstream\nendobj\n%%EOF';
  const extracted = await extractFlightAlertPdf(fixture(pdf));
  const result = parseFlightAlertText(extracted);
  assert.equal(result.ok, true, JSON.stringify({ extracted, issues: result.issues }));
  assert.equal(result.format, 'six-column-v2');
  assert.equal(result.declaredRowCount, 16);
  assert.equal(result.rows.length, 16);
  assert.equal(result.publishedTotal, 898);
  assert.equal(result.calculatedTotal, 898);
  assert.equal(result.variance, 0);
  assert.deepEqual(result.rows.map(row => [
    row.sdq, row.sec, row.inter_sec, row.dorm_name, row.sex, row.load
  ]), records.map(([squadron, section, dorm, sex, load], index) => [
    squadron + ' TRS', section, String(index + 1), dorm,
    sex === 'F' ? 'female' : 'male', String(load)
  ]));
  assert.doesNotMatch(extracted, /THURSDAY|B067\/321/);
  assert.equal(result.rows[6].dorm_name, '3A2');
  assert.equal(result.rows[7].dorm_name, '3A1');
});


test('alternate split PDF headings resolve SQDRN/SECT/INTERNAL SECTION/DORMITORY/GENDER/FLIGHT LOAD',async()=>{
  const cells=[];
  const put=(text,x,y)=>cells.push([text,x,y]);
  [['SQDRN',50],['SECT',110],['INTERNAL',180],['SECTION',226],
    ['DORMITORY',287],['GENDER',365],['FLIGHT',430],['LOAD',462]]
    .forEach(([value,x])=>put(value,x,520));
  put('535',55,480);put('1',115,480);put('1',190,480);put('A01',290,480);
  put('F',368,480);put('300',436,480);
  put('320',55,451);put('2',115,451);put('2',190,451);put('3A2',290,451);
  put('M',368,451);put('61',436,451);
  put('FLT/SQUADRON',540,520);put('PROC DAY',645,520);put('THURSDAY',645,480);
  put('TOTAL FLTS - 2',545,402);put('AAFES: 361',108,402);
  const content=cells.map(([value,x,y])=>'BT /F1 12 Tf 1 0 0 1 '+x+' '+y+' Tm ('+value+') Tj ET').join('\n');
  const pdf='%PDF-1.4\n1 0 obj << /Length '+content.length+' >> stream\n'+content+'\nendstream\nendobj\n%%EOF';
  const extracted=await extractFlightAlertPdf(fixture(pdf));
  const parsed=parseFlightAlertText(extracted);
  assert.equal(parsed.ok,true,JSON.stringify({extracted,issues:parsed.issues}));
  assert.equal(parsed.format,'six-column-v2');
  assert.deepEqual(parsed.rows.map(row=>[
    row.sdq,row.sec,row.inter_sec,row.dorm_name,row.sex,row.load,row.space_force
  ]),[
    ['535 TRS','1','1','A01','female','300',true],
    ['320 TRS','2','2','3A2','male','61',false]
  ]);
  assert.equal(parsed.calculatedTotal,361);
  assert.equal(parsed.publishedTotal,361);
  assert.equal(parsed.issues.some(i=>i.code==='load_confirmation'),true);
  assert.doesNotMatch(extracted,/THURSDAY/);
});
