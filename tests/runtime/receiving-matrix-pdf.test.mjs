import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DORM_MATRIX_LAYOUT, normalizeDormMatrix, buildDormMatrixPdf } from '../../functions/lib/dorm-matrix-pdf.mjs';
import { onRequestPost } from '../../functions/api/reports/matrix.js';

const dorms = [
  { type: 'dorm', week_group: 'WG26052', dorm_name: 'A06', sdq: '324', max_load: 57, current_load: 3, sex: 'male', display_order: 3 },
  { type: 'dorm', week_group: 'WG26052', dorm_name: '3C1', sdq: '321', max_load: 52, current_load: 2, sex: 'female', band: 'true', display_order: 2 },
  { type: 'dorm', week_group: 'WG26052', dorm_name: '3C2', sdq: '321', max_load: 58, current_load: 17, sex: 'male', band: 'true', display_order: 1 },
  { type: 'dorm', week_group: 'WG26052', dorm_name: 'A09', sdq: '535', max_load: 58, current_load: 6, sex: 'male', space_force: 'true', display_order: 4 },
  { type: 'dorm', week_group: 'WG26052', dorm_name: 'B09', sdq: '535', max_load: 52, current_load: 4, sex: 'female', is_space_force: 'true', display_order: 5 }
];

function asText(bytes) {
  return new TextDecoder().decode(bytes);
}

test('Matrix columns, physical dimensions and 20 blank-capable rows fit Letter landscape', () => {
  assert.equal(DORM_MATRIX_LAYOUT.pageWidth, 792);
  assert.equal(DORM_MATRIX_LAYOUT.pageHeight, 612);
  assert.equal(DORM_MATRIX_LAYOUT.rowsPerPage, 20);
  const total = DORM_MATRIX_LAYOUT.columnWidths.reduce((sum, width) => sum + width, 0);
  assert.equal(total, 726);
  assert.equal(DORM_MATRIX_LAYOUT.tableLeft + total, 759);
  const bottom = DORM_MATRIX_LAYOUT.tableTop - DORM_MATRIX_LAYOUT.headerHeight - DORM_MATRIX_LAYOUT.rowsPerPage * DORM_MATRIX_LAYOUT.rowHeight;
  assert.equal(bottom, 109);
  const pdf = asText(buildDormMatrixPdf({ weekGroup: 'WG26052', dorms, notes: 'Prepare the receiving area.' }));
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /\/MediaBox \[0 0 792 612\]/);
  assert.match(pdf, /\/Count 1/);
  for (const label of ['M/F', 'DORM', 'SQ', 'Area', 'Assigned', 'MAX ENROLLED', 'Orders', 'Line', 'Fit Check', 'Water', 'Eat TOTM', 'HOA Assigned', 'Start Time', 'Stop Time']) {
    assert.ok(pdf.includes('(' + label + ') Tj'), 'Missing heading: ' + label);
  }
  assert.match(pdf, /\(WEEK GROUP: WG26052\) Tj/);
  assert.match(pdf, /\(Prepare the receiving area\.\) Tj/);
  assert.match(pdf, /\(NOTES\) Tj/);
  assert.match(pdf, /\(GATE \| RECEIVING MATRIX \| AIRMEN PROGRESS TRACKER\) Tj/);
  assert.match(pdf, /\(page 1 of 1\) Tj/);
  assert.doesNotMatch(pdf, /\(UNCLASSIFIED\) Tj/);
  const cui = [...pdf.matchAll(/1 0 0 1 ([\d.]+) (587|19) Tm\n\(CUI\) Tj/g)];
  assert.equal(cui.length, 2, 'CUI must appear in the upper and lower center of every page');
  assert.equal(cui[0][1], cui[1][1], 'the top and bottom CUI markings must share a centered x coordinate');
  const center = Number(cui[0][1]) + 8.235;
  assert.ok(Math.abs(center - DORM_MATRIX_LAYOUT.pageWidth / 2) < 2, 'CUI must be horizontally centered');
  assert.doesNotMatch(pdf, /\(current_load\) Tj/);
});

test('Matrix preserves Input order, sex colors, squadron flags, maximum load and unused cells', () => {
  const rows = normalizeDormMatrix(dorms);
  assert.deepEqual(rows.map(row => row.dorm), ['3C2', '3C1', 'A06', 'A09', 'B09']);
  assert.deepEqual(rows.map(row => row.maxEnrolled), ['58', '52', '57', '58', '52']);
  assert.deepEqual(rows.map(row => row.sex), ['M', 'F', 'M', 'M', 'F']);
  assert.deepEqual(rows.map(row => row.band), [true, true, false, false, false]);
  assert.deepEqual(rows.map(row => row.spaceForce), [false, false, false, true, true]);
  assert.equal(normalizeDormMatrix([{ type: 'dorm', dorm_name: 'Missing', sex: 'unknown' }])[0].sex, '');
  assert.equal(normalizeDormMatrix([{ type: 'dorm', dorm_name: 'Missing' }])[0].maxEnrolled, '');
  const pdf = asText(buildDormMatrixPdf({ weekGroup: 'WG26052', dorms }));
  assert.match(pdf, /\(3C2\) Tj/);
  assert.match(pdf, /\(58\) Tj/);
  assert.match(pdf, /0\.86 0\.1 0\.1 rg[\s\S]{0,120}\(F\) Tj/);
  assert.match(pdf, /0\.1 0\.49 0\.22 rg[\s\S]{0,120}\(321\) Tj/);
  assert.match(pdf, /0\.03 0\.47 0\.9 rg[\s\S]{0,120}\(535\) Tj/);
  assert.doesNotMatch(pdf, /\(Assigned Airman\) Tj/);
});

test('Matrix uses 20 numbered rows on every page and handles legacy ordering', () => {
  const manyDorms = Array.from({ length: 21 }, (_, index) => ({
    type: 'dorm', dorm_name: 'D' + index, sdq: '324',
    max_load: index + 40, sex: 'male', display_order: index + 1
  }));
  const pdf = asText(buildDormMatrixPdf({ weekGroup: 'WG26052', dorms: manyDorms }));
  assert.match(pdf, /\/Count 2/);
  assert.match(pdf, /\(page 1 of 2\) Tj/);
  assert.match(pdf, /\(page 2 of 2\) Tj/);
  assert.equal([...pdf.matchAll(/\(CUI\) Tj/g)].length, 4, 'both pages require top and bottom CUI markings');
  assert.equal([...pdf.matchAll(/\(GATE \| RECEIVING MATRIX \| AIRMEN PROGRESS TRACKER\) Tj/g)].length, 2);
  assert.equal([...pdf.matchAll(/\(WEEK GROUP: WG26052\) Tj/g)].length, 2);
  assert.match(pdf, /\(21\) Tj/);
  const legacy = normalizeDormMatrix([
    { type: 'dorm', dorm_name: 'Later', created_at: '2026-10-12T09:10:00Z', max_load: 0 },
    { type: 'dorm', dorm_name: 'Earlier', created_at: '2026-10-12T09:00:00Z', max_load: 20 },
  ]);
  assert.deepEqual(legacy.map(row => row.dorm), ['Earlier', 'Later']);
  assert.equal(legacy[1].maxEnrolled, '0');
  assert.throws(() => buildDormMatrixPdf({ weekGroup: 'WG26052', dorms: [] }), /does not contain any dorms/);
  assert.throws(() => buildDormMatrixPdf({ weekGroup: 'WG26052', dorms, notes: 'x'.repeat(221) }), /220 characters/);
});

function fakeDatabase(active = 'WG26052') {
  const config = {
    type: 'config', data: JSON.stringify({ type: 'config', key: 'week_group', value: active }),
    created_at: '2026-10-12T08:00:00Z', updated_at: '2026-10-12T08:00:00Z'
  };
  const rows = dorms.map((item, index) => ({
    type: 'dorm', week_group: item.week_group, data: JSON.stringify(item),
    created_at: '2026-10-12T08:0' + index + ':00Z'
  }));
  return {
    prepare(sql) {
      const state = { args: [] };
      return {
        bind(...args) { state.args = args; return this; },
        async first() { return sql.includes("type = 'config'") ? config : null; },
        async all() {
          return { results: sql.includes("type = 'dorm'") ? rows.filter(row => row.week_group === state.args[0]) : [] };
        }
      };
    }
  };
}

function formRequest(notes = 'Attention: gate receiving.', weekGroup = 'WG26052') {
  const form = new URLSearchParams({ notes, week_group: weekGroup });
  return new Request('https://gate.example/api/reports/matrix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });
}

test('Matrix endpoint checks role, Week Group consistency and note boundaries', async () => {
  const env = { DB: fakeDatabase() };
  const denied = await onRequestPost({ env, request: formRequest(), data: { session: { role: 'airman' } } });
  assert.equal(denied.status, 403);
  const changed = await onRequestPost({ env, request: formRequest('test', 'WG26053'), data: { session: { role: 'instructor' } } });
  assert.equal(changed.status, 409);
  const tooLong = await onRequestPost({ env, request: formRequest('x'.repeat(221)), data: { session: { role: 'instructor' } } });
  assert.equal(tooLong.status, 400);
  const response = await onRequestPost({ env, request: formRequest(), data: { session: { role: 'instructor' } } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'application/pdf');
  assert.match(response.headers.get('Content-Disposition'), /GATE_WG26052_MATRIX\.pdf/);
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  const pdf = asText(new Uint8Array(await response.arrayBuffer()));
  assert.match(pdf, /\(Attention: gate receiving\.\) Tj/);
});

test('Archive button and dialog retain isolated handlers and scoped spacing', async () => {
  const js = await readFile(new URL('../../public/js/gate-archive-controller.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../../public/css/military-glass-terminal.css', import.meta.url), 'utf8');
  assert.match(js, /id="print-current-summary-btn"/);
  assert.match(js, /id="print-tags-btn"/);
  assert.match(js, /id="print-matrix-btn"/);
  assert.match(js, /function ensureMatrixDialog\(\)/);
  assert.match(js, /method="post" action="\/api\/reports\/matrix" target="_blank" rel="noopener"/);
  assert.match(js, /maxlength="220"/);
  assert.match(js, /dialog\.showModal\(\)/);
  assert.match(js, /event\.target\?\.closest\?\.\('#print-matrix-btn'\)/);
  assert.doesNotMatch(js, /matrixButton\.onclick\s*=/);
  assert.match(css, /#page-archives \.gate-archive-matrix-action\s*\{/);
  assert.match(css, /#gate-matrix-dialog\s*\{/);
  assert.match(css, /#gate-matrix-dialog \.gate-matrix-dialog-actions button\s*\{/);
});
