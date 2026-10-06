// GATE Dorm Folder Tag PDF renderer
// Pure vector-PDF generation. No DOM, network, persistence, or operational state ownership.

export const DORM_TAG_LAYOUT = Object.freeze({
  pageWidth: 792,
  pageHeight: 612,
  tagWidth: 216,
  tagHeight: 144,
  columns: 3,
  rows: 3,
  tagsPerPage: 9,
  marginX: 54,
  marginY: 72,
  gapX: 18,
  gapY: 18
});

const BAND_RGB = Object.freeze([0.10, 0.49, 0.22]);
const SPACE_FORCE_RGB = Object.freeze([0.05, 0.47, 0.68]);
const FEMALE_RGB = Object.freeze([0.86, 0.10, 0.10]);
const BLACK_RGB = Object.freeze([0, 0, 0]);

function truthy(value) {
  return value === true || value === 1 || value === '1' || String(value || '').trim().toLowerCase() === 'true';
}

function wholeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function cleanText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function ascii(value) {
  return cleanText(value).replace(/[^\x20-\x7E]/g, '?');
}

function displayOrder(record, fallback) {
  for (const value of [record?.display_order, record?.input_order, record?.source_row_index]) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function normalizeDormTags(dorms = []) {
  return (Array.isArray(dorms) ? dorms : [])
    .filter(record => record && record.type === 'dorm')
    .map((record, index) => {
      const spaceForce = truthy(record.space_force) || truthy(record.is_space_force);
      return Object.freeze({
        squadron: ascii(record.sdq || record.squadron || ''),
        dorm: ascii(record.dorm_name || record.name || ''),
        load: wholeNumber(record.max_load ?? record.load),
        female: String(record.sex || '').trim().toLowerCase() === 'female',
        band: !spaceForce && truthy(record.band),
        spaceForce,
        order: displayOrder(record, index + 1),
        sourceIndex: index
      });
    })
    .sort((left, right) =>
      left.order - right.order ||
      left.sourceIndex - right.sourceIndex ||
      left.squadron.localeCompare(right.squadron, undefined, { numeric: true }) ||
      left.dorm.localeCompare(right.dorm, undefined, { numeric: true })
    );
}

function pdfEscape(value) {
  return ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function number(value) {
  return String(Math.round(Number(value) * 100) / 100);
}

function textWidth(value, fontSize, bold = false) {
  const text = ascii(value);
  let units = 0;
  for (const char of text) {
    if (char === ' ') units += 0.28;
    else if (/[ilI1|]/.test(char)) units += 0.30;
    else if (/[MW@#%]/.test(char)) units += 0.84;
    else if (/[A-Z0-9]/.test(char)) units += bold ? 0.61 : 0.57;
    else units += bold ? 0.56 : 0.52;
  }
  return units * fontSize;
}

function fitSize(value, maxWidth, preferred, minimum, bold = true) {
  let size = preferred;
  while (size > minimum && textWidth(value, size, bold) > maxWidth) size -= 0.5;
  return size;
}

function setRgb(rgb) {
  return rgb.map(number).join(' ') + ' rg';
}

function textCommand(value, { x, y, size, font = 'F2', rgb = BLACK_RGB }) {
  return [
    'BT',
    `/${font} ${number(size)} Tf`,
    setRgb(rgb),
    `1 0 0 1 ${number(x)} ${number(y)} Tm`,
    `(${pdfEscape(value)}) Tj`,
    'ET'
  ].join('\n');
}

function centeredText(value, { centerX, y, size, font = 'F2', rgb = BLACK_RGB, maxWidth = 192, minimum = 14 }) {
  const actualSize = fitSize(value, maxWidth, size, minimum, font === 'F2');
  const width = textWidth(value, actualSize, font === 'F2');
  return textCommand(value, { x: centerX - width / 2, y, size: actualSize, font, rgb });
}

function rightText(value, { rightX, y, size, font = 'F2', rgb = BLACK_RGB }) {
  const width = textWidth(value, size, font === 'F2');
  return textCommand(value, { x: rightX - width, y, size, font, rgb });
}

function tagCommands(tag, x, y) {
  const identity = [tag.squadron, tag.dorm].filter(Boolean).join(' / ') || 'SQDR / DORM';
  const commands = [
    'q',
    '1.5 w',
    '0 0 0 RG',
    `${number(x)} ${number(y)} ${DORM_TAG_LAYOUT.tagWidth} ${DORM_TAG_LAYOUT.tagHeight} re S`,
    'Q'
  ];

  if (tag.spaceForce) {
    commands.push(textCommand('SPACE FORCE', {
      x: x + 12,
      y: y + DORM_TAG_LAYOUT.tagHeight - 24,
      size: 15.5,
      font: 'F2',
      rgb: SPACE_FORCE_RGB
    }));
  } else if (tag.band) {
    commands.push(textCommand('BAND', {
      x: x + 12,
      y: y + DORM_TAG_LAYOUT.tagHeight - 24,
      size: 16.5,
      font: 'F2',
      rgb: BAND_RGB
    }));
  }

  commands.push(centeredText(identity, {
    centerX: x + DORM_TAG_LAYOUT.tagWidth / 2,
    y: y + 79,
    size: 26,
    minimum: 17,
    maxWidth: DORM_TAG_LAYOUT.tagWidth - 24
  }));

  commands.push(centeredText(`LOAD: ${tag.load}`, {
    centerX: x + DORM_TAG_LAYOUT.tagWidth / 2,
    y: y + 52,
    size: 17,
    minimum: 14,
    maxWidth: DORM_TAG_LAYOUT.tagWidth - 32
  }));

  if (tag.female) {
    commands.push(rightText('FEMALE', {
      rightX: x + DORM_TAG_LAYOUT.tagWidth - 12,
      y: y + 14,
      size: 15.5,
      font: 'F2',
      rgb: FEMALE_RGB
    }));
  }

  return commands.join('\n');
}

function pageContent(tags, weekGroup, pageNumber, pageCount) {
  const commands = [];
  const header = `GATE  |  ${ascii(weekGroup || 'ACTIVE WEEK GROUP')}  |  FOLDER TAGS  |  PAGE ${pageNumber} / ${pageCount}`;
  commands.push(textCommand(header, { x: DORM_TAG_LAYOUT.marginX, y: 580, size: 8, font: 'F1', rgb: [0.25, 0.29, 0.34] }));

  tags.forEach((tag, index) => {
    const column = index % DORM_TAG_LAYOUT.columns;
    const row = Math.floor(index / DORM_TAG_LAYOUT.columns);
    const x = DORM_TAG_LAYOUT.marginX + column * (DORM_TAG_LAYOUT.tagWidth + DORM_TAG_LAYOUT.gapX);
    const y = DORM_TAG_LAYOUT.pageHeight
      - DORM_TAG_LAYOUT.marginY
      - DORM_TAG_LAYOUT.tagHeight
      - row * (DORM_TAG_LAYOUT.tagHeight + DORM_TAG_LAYOUT.gapY);
    commands.push(tagCommands(tag, x, y));
  });

  const printNote = 'PRINT AT ACTUAL SIZE / 100%  -  EACH TAG IS 3 x 2 INCHES';
  const noteWidth = textWidth(printNote, 7.5, true);
  commands.push(textCommand(printNote, {
    x: (DORM_TAG_LAYOUT.pageWidth - noteWidth) / 2,
    y: 30,
    size: 7.5,
    font: 'F2',
    rgb: [0.25, 0.29, 0.34]
  }));

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
    output += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n`;
  output += '0000000000 65535 f \n';
  for (let index = 1; index <= objects.length; index += 1) {
    output += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new TextEncoder().encode(output);
}

export function buildDormTagPdf({ weekGroup = '', dorms = [] } = {}) {
  const tags = normalizeDormTags(dorms);
  if (!tags.length) throw new Error('The current Week Group does not contain any dorms.');

  const pageCount = Math.ceil(tags.length / DORM_TAG_LAYOUT.tagsPerPage);
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
  ];

  const pageRefs = [];
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageObjectNumber = 5 + pageIndex * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    pageRefs.push(`${pageObjectNumber} 0 R`);
    const pageTags = tags.slice(
      pageIndex * DORM_TAG_LAYOUT.tagsPerPage,
      (pageIndex + 1) * DORM_TAG_LAYOUT.tagsPerPage
    );
    const content = pageContent(pageTags, weekGroup, pageIndex + 1, pageCount);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${DORM_TAG_LAYOUT.pageWidth} ${DORM_TAG_LAYOUT.pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    );
    objects.push(`<< /Length ${byteLength(content)} >>\nstream\n${content}endstream`);
  }

  objects[1] = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageCount} >>`;
  return buildPdf(objects);
}
