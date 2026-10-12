// GATE Receiving Matrix PDF renderer.
// Pure, read-only vector output. Physical dimensions use PDF points (Letter landscape).
export const DORM_MATRIX_LAYOUT = Object.freeze({
  pageWidth: 792,
  pageHeight: 612,
  tableLeft: 33,
  tableTop: 533,
  headerHeight: 24,
  rowHeight: 20,
  rowsPerPage: 20,
  columnWidths: Object.freeze([22, 34, 51, 41, 41, 56, 70, 47, 39, 52, 45, 56, 66, 53, 53])
});

const HEADINGS = Object.freeze([
  '#', 'M/F', 'DORM', 'SQ', 'Area', 'Assigned', 'MAX ENROLLED',
  'Orders', 'Line', 'Fit Check', 'Water', 'Eat TOTM',
  'HOA Assigned', 'Start Time', 'Stop Time'
]);
const BLACK = [0, 0, 0];
const RED = [0.86, 0.10, 0.10];
const BAND_GREEN = [0.10, 0.49, 0.22];
const SPACE_BLUE = [0.03, 0.47, 0.90];

function text(value) {
  return String(value ?? '').trim().replace(/[^\x20-\x7E]/g, '?');
}

function flag(value) {
  return value === true || value === 1 || value === '1' || String(value ?? '').trim().toLowerCase() === 'true';
}

function orderNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function explicitOrder(record) {
  for (const key of ['display_order', 'input_order', 'source_row_index', 'row_index']) {
    const value = orderNumber(record[key]);
    if (value !== null) return value;
  }
  return null;
}

function createdTime(record) {
  const result = Date.parse(record.created_at || '');
  return Number.isFinite(result) ? result : null;
}

function compareDorms(a, b) {
  const left = explicitOrder(a.record);
  const right = explicitOrder(b.record);
  if (left !== null && right !== null && left !== right) return left - right;
  if (left !== null && right === null) return -1;
  if (left === null && right !== null) return 1;
  const leftTime = createdTime(a.record);
  const rightTime = createdTime(b.record);
  if (leftTime !== null && rightTime !== null && leftTime !== rightTime) return leftTime - rightTime;
  if (leftTime !== null && rightTime === null) return -1;
  if (leftTime === null && rightTime !== null) return 1;
  return a.index - b.index;
}

export function normalizeDormMatrix(dorms = []) {
  return (Array.isArray(dorms) ? dorms : [])
    .filter(record => record && String(record.type || 'dorm').toLowerCase() === 'dorm')
    .map((record, index) => ({ record, index }))
    .sort(compareDorms)
    .map(({ record }) => {
      const sex = String(record.sex || '').trim().toLowerCase();
      const capacity = orderNumber(record.max_load);
      const spaceForce = flag(record.space_force) || flag(record.is_space_force);
      return Object.freeze({
        sex: sex === 'female' || sex === 'f' ? 'F' : sex === 'male' || sex === 'm' ? 'M' : '',
        dorm: text(record.dorm_name || record.name || ''),
        squadron: text(record.sdq || record.squadron || ''),
        maxEnrolled: capacity !== null && capacity >= 0 && Number.isInteger(capacity) ? String(capacity) : '',
        band: !spaceForce && flag(record.band),
        spaceForce
      });
    });
}

function pdfEscape(value) {
  return text(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function number(value) {
  return String(Math.round(value * 100) / 100);
}

function rgb(values) {
  return values.map(number).join(' ') + ' rg';
}

function approximateWidth(value, size, bold = false) {
  let units = 0;
  for (const char of text(value)) {
    if (char === ' ') units += 0.28;
    else if (/[ilI1|]/.test(char)) units += 0.30;
    else if (/[MW@#%]/.test(char)) units += 0.82;
    else if (/[A-Z0-9]/.test(char)) units += bold ? 0.61 : 0.57;
    else units += bold ? 0.56 : 0.52;
  }
  return units * size;
}

function drawText(value, x, y, size = 9, color = BLACK, bold = false) {
  return [
    'BT', '/F' + (bold ? '2' : '1') + ' ' + number(size) + ' Tf',
    rgb(color), '1 0 0 1 ' + number(x) + ' ' + number(y) + ' Tm',
    '(' + pdfEscape(value) + ') Tj', 'ET'
  ].join('\n');
}

function centered(value, x, width, y, size, color = BLACK, bold = false) {
  const fitted = Math.max(5.5, Math.min(size, (width - 5) / Math.max(approximateWidth(value, 1, bold), 1)));
  return drawText(value, x + (width - approximateWidth(value, fitted, bold)) / 2, y, fitted, color, bold);
}

function wrapNotes(notes, maxWidth, size, maxLines) {
  const lines = [];
  const original = String(notes || '').replace(/\r\n?/g, '\n').replace(/[^\x20-\x7E\n]/g, '?');
  for (const paragraph of original.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const trial = line ? line + ' ' + word : word;
      if (line && approximateWidth(trial, size) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = trial;
      }
      // Break exceptionally long unspaced words rather than printing outside the box.
      while (line && approximateWidth(line, size) > maxWidth) {
        let position = 1;
        while (position < line.length && approximateWidth(line.slice(0, position + 1), size) <= maxWidth) position++;
        lines.push(line.slice(0, position));
        line = line.slice(position);
      }
    }
    lines.push(line);
  }
  return lines.slice(0, maxLines);
}

function contentForPage(rows, weekGroup, pageNumber, pageCount, notes) {
  const { tableLeft, tableTop, headerHeight, rowHeight, rowsPerPage, columnWidths } = DORM_MATRIX_LAYOUT;
  const width = columnWidths.reduce((sum, current) => sum + current, 0);
  const bottom = tableTop - headerHeight - rowHeight * rowsPerPage;
  const commands = [];
  // Controlled document markings: same top line, centered CUI and right-aligned pagination.
  commands.push(centered('CUI', 0, DORM_MATRIX_LAYOUT.pageWidth, 587, 9, BLACK, true));
  const pageLabel = 'page ' + pageNumber + ' of ' + pageCount;
  commands.push(drawText(pageLabel, tableLeft + width - approximateWidth(pageLabel, 8), 587, 8));
  commands.push(drawText('GATE | RECEIVING MATRIX | AIRMEN PROGRESS TRACKER', tableLeft, 568, 11, BLACK, true));
  commands.push(drawText('WEEK GROUP: ' + text(weekGroup), tableLeft, 551, 10, BLACK, true));
  commands.push('0.91 0.93 0.95 rg\n' + number(tableLeft) + ' ' + number(tableTop - headerHeight) + ' ' + number(width) + ' ' + number(headerHeight) + ' re f');
  commands.push('0.25 0.28 0.31 RG\n0.55 w');
  commands.push(number(tableLeft) + ' ' + number(bottom) + ' ' + number(width) + ' ' + number(tableTop - bottom) + ' re S');
  let x = tableLeft;
  HEADINGS.forEach((heading, column) => {
    const cellWidth = columnWidths[column];
    const headerSize = heading === 'MAX ENROLLED' || heading === 'HOA Assigned' ? 6.3 : 7.2;
    commands.push(centered(heading, x, cellWidth, tableTop - 15, headerSize, BLACK, true));
    if (column > 0) commands.push(number(x) + ' ' + number(bottom) + ' m ' + number(x) + ' ' + number(tableTop) + ' l S');
    x += cellWidth;
  });
  for (let i = 0; i < rowsPerPage; i++) {
    const y = tableTop - headerHeight - i * rowHeight;
    commands.push(number(tableLeft) + ' ' + number(y) + ' m ' + number(tableLeft + width) + ' ' + number(y) + ' l S');
    const rowBottom = y - rowHeight;
    const row = rows[i];
    const columns = [
      String((pageNumber - 1) * rowsPerPage + i + 1),
      row?.sex || '', row?.dorm || '', row?.squadron || '', '', '',
      row?.maxEnrolled || '', '', '', '', '', '', '', '', ''
    ];
    let cellX = tableLeft;
    columns.forEach((value, column) => {
      if (value) {
        const color = column === 1 && value === 'F' ? RED :
          column === 3 && row?.spaceForce ? SPACE_BLUE :
          column === 3 && row?.band ? BAND_GREEN : BLACK;
        commands.push(centered(value, cellX, columnWidths[column], rowBottom + 7, column === 0 ? 8 : 9, color, column === 1 || column === 3));
      }
      cellX += columnWidths[column];
    });
  }
  commands.push('0.25 0.28 0.31 RG\n0.65 w');
  commands.push(number(tableLeft) + ' 32 ' + number(width) + ' 56 re S');
  commands.push(drawText('NOTES', tableLeft + 8, 76, 8, BLACK, true));
  const noteLines = wrapNotes(notes, width - 16, 8.5, 3);
  noteLines.forEach((line, i) => {
    if (line) commands.push(drawText(line, tableLeft + 8, 63 - 11 * i, 8.5));
  });
  commands.push(centered('CUI', 0, DORM_MATRIX_LAYOUT.pageWidth, 19, 9, BLACK, true));
  return commands.join('\n') + '\n';
}

function byteLength(value) {
  return new TextEncoder().encode(value).length;
}

function buildPdf(objects) {
  let output = '%PDF-1.4\n%GATE\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets[index + 1] = byteLength(output);
    output += String(index + 1) + ' 0 obj\n' + body + '\nendobj\n';
  });
  const xref = byteLength(output);
  output += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    output += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  output += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return new TextEncoder().encode(output);
}

export function buildDormMatrixPdf({ weekGroup = '', dorms = [], notes = '' } = {}) {
  const rows = normalizeDormMatrix(dorms);
  if (!text(weekGroup)) throw new Error('A Week Group is required.');
  if (!rows.length) throw new Error('The active Week Group does not contain any dorms.');
  if (String(notes).length > 220) throw new Error('Matrix notes must be 220 characters or fewer.');
  const pageCount = Math.ceil(rows.length / DORM_MATRIX_LAYOUT.rowsPerPage);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
  ];
  const pageRefs = [];
  for (let index = 0; index < pageCount; index++) {
    const pageNo = 5 + index * 2;
    const contentNo = pageNo + 1;
    pageRefs.push(String(pageNo) + ' 0 R');
    const content = contentForPage(
      rows.slice(index * DORM_MATRIX_LAYOUT.rowsPerPage, (index + 1) * DORM_MATRIX_LAYOUT.rowsPerPage),
      weekGroup, index + 1, pageCount, notes
    );
    objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + contentNo + ' 0 R >>');
    objects.push('<< /Length ' + byteLength(content) + ' >>\nstream\n' + content + 'endstream');
  }
  objects[1] = '<< /Type /Pages /Kids [' + pageRefs.join(' ') + '] /Count ' + pageCount + ' >>';
  return buildPdf(objects);
}
