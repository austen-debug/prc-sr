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
