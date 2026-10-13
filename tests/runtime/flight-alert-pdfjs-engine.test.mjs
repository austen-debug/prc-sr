import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { extractFlightAlertPdf } from '../../public/app/features/input/flight-alert-pdf.mjs';
import { parseFlightAlertText } from '../../public/app/features/input/flight-alert-parser.mjs';

const require = createRequire(import.meta.url);
const pdfjs = require('../../public/vendor/pdfjs/pdf.min.js');
pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../public/vendor/pdfjs/pdf.worker.min.js', import.meta.url).pathname;

/**
 * Generate a completely synthetic Excel-like PDF with an Identity-H Type0
 * font and ToUnicode CMap. The raw content stream has encoded CIDs, not
 * searchable ASCII: this is what the old lightweight reader could not decode.
 * No source Flight Alert PDF or its metadata is checked into the repository.
 */
function makeEncodedFlightAlert() {
  const cells = [];
  const put = (x, y, value) => cells.push({ x, y, text: String(value) });
  [['SQD', 55], ['SEC', 95], ['INTER/SECT', 130], ['DORM', 190],
    ['SEX', 240], ['LOAD', 280]].forEach(([heading, x]) => put(x, 520, heading));
  const groups = [
    { sq: '321', begin: 1, end: 4 },
    { sq: '322', begin: 5, end: 7 },
    { sq: '323', begin: 8, end: 11 },
    { sq: '324', begin: 12, end: 13 },
    { sq: '326', begin: 14, end: 16 }
  ];
  for (const group of groups) {
    const mid = 506 - ((group.begin - 1) + (group.end - 1)) * 5;
    put(55, mid, group.sq);
    put(98, mid, '0');
  }
  const dorms = ['3A1', '3A2', '2D2', '2D1', 'A06', 'B07', 'A07',
    '2A1', '2A2', '4A2', '4A1', 'A03', 'B03', 'A06', 'B07', 'A07'];
  const loads = [60, 60, 60, 46, 60, 47, 59, 59, 59, 59, 46, 59, 59, 59, 46, 59];
  for (let i = 0; i < dorms.length; i++) {
    const y = 506 - i * 10;
    put(148, y, String(i + 1));
    put(195, y + (i === 6 ? 0.6 : 0), dorms[i]);
    put(245, y, [3, 5, 10, 14].includes(i) ? 'F' : 'M');
    put(285, y + (i === 6 ? -0.6 : 0), loads[i]);
  }
  put(360, 307, 'TOTAL FLTS - 16');
  put(87, 299, 'AAFES: 897');
  put(405, 506, 'FLT/SQUADRON');
  put(490, 506, 'PROC DAY');
  put(412, 475, '017/321');

  const encode = value => [...value].map(char =>
    (256 + char.charCodeAt(0)).toString(16).padStart(4, '0')).join('');
  const content = cells.map(cell =>
    `BT /F1 9 Tf 1 0 0 1 ${cell.x} ${cell.y} Tm <${encode(cell.text)}> Tj ET`).join('\n');
  const characters = [...new Set(cells.flatMap(cell => [...cell.text]))].sort();
  const mappings = characters.map(char =>
    `<${(256 + char.charCodeAt(0)).toString(16).padStart(4, '0')}> <${char.charCodeAt(0).toString(16).padStart(4, '0')}>`).join('\n');
  const cmap = `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /GATE-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <ffff>
endcodespacerange
${characters.length} beginbfchar
${mappings}
endbfchar
endcmap
CMapName currentdict /CMap defineresource pop
end
end`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Resources << /Font << /F1 4 0 R >> >> /Contents 8 0 R >>',
    '<< /Type /Font /Subtype /Type0 /BaseFont /GATEFakeCID /Encoding /Identity-H /DescendantFonts [5 0 R] /ToUnicode 6 0 R >>',
    '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /GATEFakeCID /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 7 0 R /DW 500 >>',
    `<< /Length ${cmap.length} >>
stream
${cmap}
endstream`,
    '<< /Type /FontDescriptor /FontName /GATEFakeCID /Flags 4 /FontBBox [0 -250 1000 1000] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 85 >>',
    `<< /Length ${content.length} >>
stream
${content}
endstream`
  ];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((value, index) => {
    offsets.push(output.length);
    output += `${index + 1} 0 obj\n${value}\nendobj\n`;
  });
  const xref = output.length;
  output += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => {
    output += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  output += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new TextEncoder().encode(output);
  return { name: 'synthetic-encoded-flight-alert.pdf', size: bytes.length, arrayBuffer: async () => bytes.slice().buffer };
}

test('pinned local PDF.js and worker decode Type0 Identity-H /ToUnicode text', async () => {
  assert.equal(pdfjs.version, '3.2.146');
  const file = makeEncodedFlightAlert();
  const document = await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()), useSystemFonts:true}).promise;
  try {
    assert.equal(document.numPages, 1);
    const page = await document.getPage(1);
    const text = (await page.getTextContent()).items.map(item => item.str);
    assert.ok(text.some(value => value.includes('INTER/SECT')), 'PDF.js must decode the Unicode header');
    assert.ok(text.some(value => value.includes('A07')), 'PDF.js must decode custom-encoded dorm labels');
  } finally {
    await document.destroy();
  }
});

test('actual PDF.js import path preserves all 16 numbered flights and SEC zero', async () => {
  const file = makeEncodedFlightAlert();
  const extracted = await extractFlightAlertPdf(file, pdfjs);
  const result = parseFlightAlertText(extracted);
  assert.equal(result.ok, true, JSON.stringify({issues: result.issues, extracted}));
  assert.equal(result.rows.length, 16);
  assert.deepEqual(result.rows.map(row => row.inter_sec), Array.from({length:16}, (_,i)=>String(i+1)));
  assert.equal(result.rows[6].sdq, '322 TRS');
  assert.equal(result.rows[6].dorm_name, 'A07');
  assert.equal(result.rows[6].sex, 'male');
  assert.equal(result.rows[6].load, '59');
  assert.equal(result.rows[15].sdq, '326 TRS');
  assert.equal(result.rows[15].dorm_name, 'A07');
  assert.ok(result.rows.every(row => row.sec === '0'), 'PDF zero-valued SEC must survive into the review draft');
  assert.equal(result.publishedTotal, 897);
  assert.equal(result.calculatedTotal, 897);
  assert.equal(result.variance, 0);
  assert.doesNotMatch(extracted, /017\/321|PROC DAY/, 'right-side schedule must not pollute the dorm table');
});
