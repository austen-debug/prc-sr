/** Local-only PDF extraction. Text PDFs only; intentionally fails closed on unfamiliar layouts. */
const MAX_BYTES = 6 * 1024 * 1024;
const NUMBER = '[-+]?(?:\\d+\\.?\\d*|\\.\\d+)';
const DORM_CELL = /^(?:[0-9][A-Z][0-9]|[A-Z][0-9]{2})$/;
const HEADER_ALIASES = Object.freeze({
  sdq: ['SQD', 'SDQ', 'SQUADRON'],
  sec: ['SEC', 'SECTION'],
  inter: ['INTER/SECT', 'INTER/SEC'],
  dorm: ['DORM', 'DORMITORY'],
  sex: ['SEX', 'GENDER'],
  load: ['LOAD', 'EXPECTED']
});

function latin1(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 16384) {
    text += String.fromCharCode(...bytes.subarray(i, i + 16384));
  }
  return text;
}
function pdfLiteral(raw) {
  return raw.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, value) => {
    const special = { n:'\n', r:'\r', t:'\t', b:'\b', f:'\f' };
    return special[value] ?? (/^[0-7]/.test(value) ? String.fromCharCode(parseInt(value, 8)) : value);
  });
}
function compact(value) {
  return String(value ?? '').replace(/\s+/g, '').toUpperCase();
}
function textPieces(source) {
  const pieces = [];
  const pattern = /\(((?:\\.|[^\\)])*)\)|<([0-9a-fA-F\s]+)>/g;
  for (const match of source.matchAll(pattern)) {
    if (match[1] !== undefined) pieces.push(pdfLiteral(match[1]));
    else if (match[2] && match[2].replace(/\s/g, '').length % 2 === 0) {
      const hex = match[2].replace(/\s/g, '');
      let decoded = '';
      for (let i = 0; i < hex.length; i += 2) decoded += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
      pieces.push(decoded);
    }
  }
  return pieces;
}

/**
 * Extract every text-show operation with its current text position.
 * Excel/Acrobat Flight Alerts use merged cells expressed with TD/Td moves inside
 * one BT/ET block; treating the whole block as one string loses SQD/SEC geometry.
 */
function positionedItems(content) {
  const items = [];
  let order = 0;
  const tmPattern = new RegExp(`(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s+Tm\\b`);
  const tdPattern = new RegExp(`(${NUMBER})\\s+(${NUMBER})\\s+(Td|TD)\\b`);
  for (const block of content.match(/\bBT\b[\s\S]*?\bET\b/g) || []) {
    let a = 1, b = 0, c = 0, d = 1, x = 0, y = 0;
    // Acrobat may emit several text operators on one physical line. Split only
    // after actual PDF operators (not matching text inside a literal string).
    const commands = block.replace(/(Tm|Td|TD|Tj|TJ)(?=\s|$)/g, '$1\n');
    for (const rawLine of commands.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const tm = line.match(tmPattern);
      if (tm) {
        a = Number(tm[1]); b = Number(tm[2]); c = Number(tm[3]); d = Number(tm[4]);
        x = Number(tm[5]); y = Number(tm[6]);
      }
      const td = line.match(tdPattern);
      if (td) {
        const tx = Number(td[1]);
        const ty = Number(td[2]);
        // Td/TD translate in text space, so preserve the active Tm scale.
        x += (tx * a) + (ty * c);
        y += (tx * b) + (ty * d);
      }
      if (!/\b(?:Tj|TJ)\b/.test(line)) continue;
      const text = textPieces(line).join('');
      if (!text.trim() || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      items.push({ text, x, y, order: order++ });
    }
  }
  return items;
}

function nearestField(x, headers) {
  return Object.keys(headers).reduce((best, field) => (
    Math.abs(x - headers[field].x) < Math.abs(x - headers[best].x) ? field : best
  ), 'sdq');
}
function nearestY(candidates, y, maxDistance) {
  let best = null;
  let distance = Infinity;
  for (const item of candidates) {
    const next = Math.abs(item.y - y);
    if (next < distance || (next === distance && item.order < (best?.order ?? Infinity))) {
      best = item;
      distance = next;
    }
  }
  return best && distance <= maxDistance ? best : null;
}

/**
 * Convert a positioned six-column dorm table into canonical parser text.
 * SQD can be merged vertically; blank SEC / INTER/SEC remain explicitly empty
 * rather than shifting one column to the left or inventing a section value.
 */
function flightAlertTableText(items) {
  if (!Array.isArray(items) || !items.length) return '';
  const headers = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const accepted = new Set(aliases.map(compact));
    headers[field] = items.find(item => accepted.has(compact(item.text))) || null;
  }
  if (Object.values(headers).some(value => !value)) return '';

  const headerY = Object.values(headers).reduce((sum, item) => sum + item.y, 0) / Object.keys(headers).length;
  const leftLimit = headers.load.x + Math.max(60, Math.abs(headers.load.x - headers.sex.x) * 1.5);
  const left = items.filter(item => item.x <= leftLimit && item.y < headerY - 1);
  const dorms = left
    .filter(item => nearestField(item.x, headers) === 'dorm' && DORM_CELL.test(compact(item.text)))
    .sort((a, b) => b.y - a.y || a.order - b.order);
  const allInter = left
    .filter(item => nearestField(item.x, headers) === 'inter' && /^\d{1,3}$/.test(compact(item.text)))
    .sort((a, b) => b.y - a.y || a.order - b.order);
  if (!dorms.length && !allInter.length) return '';

  // A dorm label is not the only reliable row anchor: INTER/SECT cells are
  // individually numbered even when a dorm's PDF text is mispositioned.
  // Prefer that numbered spine only if it is unambiguous (unique positive IDs).
  const distinctInter = new Set(allInter.map(item => Number(compact(item.text))));
  const interSpine = allInter.length >= dorms.length &&
    distinctInter.size === allInter.length &&
    allInter.every(item => Number(compact(item.text)) >= 1 && Number(compact(item.text)) <= 100);
  const anchors = interSpine ? allInter : dorms;
  if (!anchors.length) return '';
  const gaps = anchors.slice(1).map((item, index) => anchors[index].y - item.y).filter(gap => gap > 0.1).sort((a,b)=>a-b);
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 10;
  // Row-boundary tolerance follows the actual PDF row pitch instead of a
  // hard-coded two-point text-baseline match.
  const rowTolerance = Math.max(2, medianGap * 0.46);
  const minY = anchors.at(-1).y;
  const region = left.filter(item => item.y >= minY - Math.max(20, medianGap * 1.5));
  const candidates = (field, predicate) => region.filter(
    item => nearestField(item.x, headers) === field && predicate(compact(item.text))
  );
  const squadrons = candidates('sdq', value => /^\d{3}$/.test(value));
  const sections = candidates('sec', value => /^[0-4]$/.test(value));
  const inters = candidates('inter', value => /^\d{1,3}$/.test(value));
  const sexes = candidates('sex', value => /^(?:M|F|MALE|FEMALE)$/.test(value));
  const loads = candidates('load', value => /^\d{1,3}$/.test(value) && Number(value) >= 1 && Number(value) <= 100);
  if (!squadrons.length) return '';

  // A vertically merged squadron is valid across a flight block. Its center
  // need not be within 20 PDF points of the first or last row.
  const assigned = anchors.map(anchor => ({
    anchor,
    squadron: nearestY(squadrons, anchor.y, Infinity)
  }));
  const groupRows = new Map();
  for (const { anchor, squadron } of assigned) {
    if (!squadron) continue;
    const group = groupRows.get(squadron.order) || [];
    group.push(anchor.y);
    groupRows.set(squadron.order, group);
  }
  const sectionFor = (anchor, squadron) => {
    const ys = groupRows.get(squadron.order) || [anchor.y];
    const top = Math.max(...ys), bottom = Math.min(...ys);
    const groupSections = sections.filter(item => item.y <= top + rowTolerance && item.y >= bottom - rowTolerance);
    if (!groupSections.length) return null;
    const nearest = nearestY(groupSections, anchor.y, Math.max(15, medianGap * 2));
    if (!nearest) return null;
    if (groupSections.length > 1) return nearest;
    const midpoint = (top + bottom) / 2;
    return Math.abs(nearest.y - anchor.y) <= rowTolerance ||
      (ys.length > 1 && Math.abs(nearest.y - midpoint) <= medianGap * 0.6) ? nearest : null;
  };

  const rows = [];
  for (const { anchor, squadron } of assigned) {
    const dorm = interSpine ? nearestY(dorms, anchor.y, rowTolerance) : anchor;
    const inter = interSpine ? anchor : nearestY(inters, anchor.y, rowTolerance);
    const sex = nearestY(sexes, anchor.y, rowTolerance);
    const load = nearestY(loads, anchor.y, rowTolerance);
    const section = sectionFor(anchor, squadron);
    // Preserve a source row even if its DORM, SEX or LOAD is unreadable. The
    // review screen will require correction; no partial draft can initialize.
    rows.push([
      squadron ? compact(squadron.text) : '',
      section ? compact(section.text) : '',
      inter ? compact(inter.text) : '',
      dorm ? compact(dorm.text) : '',
      sex ? compact(sex.text) : '',
      load ? Number(compact(load.text)) : ''
    ].join('|'));
  }

  let publishedTotal = null;
  for (const item of items) {
    const match = compact(item.text).match(/^AAFES[:=\-]?([\d,]+)$/);
    if (match) {
      publishedTotal = Number(match[1].replaceAll(',', ''));
      break;
    }
  }

  let declaredRows = null;
  for (const item of items) {
    const match = compact(item.text).match(/^TOTALFLT'?S[:=\-]?(\d+)$/);
    if (match) {
      declaredRows = Number(match[1]);
      break;
    }
  }

  const output = ['SQD SEC INTER/SECT DORM SEX LOAD', ...rows];
  if (Number.isSafeInteger(declaredRows)) output.push(`TOTAL FLTS - ${declaredRows}`);
  if (Number.isSafeInteger(publishedTotal)) output.push(`AAFES: ${publishedTotal}`);
  return output.join('\n');
}

function genericTextFromItems(items) {
  if (!items.length) return '';
  const distinctCoordinates = new Set(items.map(item => `${Math.round(item.x * 10)}:${Math.round(item.y * 10)}`));
  if (distinctCoordinates.size < 2) {
    return [...items].sort((a, b) => a.order - b.order).map(item => item.text).join('\n');
  }
  const schedule = items.filter(item => /FLT\s*\/\s*SQUADRON/i.test(item.text));
  const cutoff = schedule.length ? Math.min(...schedule.map(item => item.x)) - 2 : Infinity;
  const buckets = new Map();
  for (const item of items) {
    if (item.x >= cutoff) continue;
    const y = Math.round(item.y / 2) * 2;
    const bucket = buckets.get(y) || [];
    bucket.push(item);
    buckets.set(y, bucket);
  }
  return [...buckets.keys()].sort((a, b) => b - a)
    .map(y => buckets.get(y).sort((a, b) => a.x - b.x || a.order - b.order).map(item => item.text).join(' '))
    .join('\n');
}
async function decodeStream(raw, compressed) {
  if (!compressed) return raw;
  if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot decode compressed PDF text. Use Paste text.');
  const bytes = Uint8Array.from(raw, char => char.charCodeAt(0) & 255);
  const decoded = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  const buffer = await new Response(decoded).arrayBuffer();
  if (buffer.byteLength > 2 * 1024 * 1024) throw new Error('PDF text stream exceeds processing limit.');
  return latin1(new Uint8Array(buffer));
}
async function extractFallback(bytes) {
  const pdf = latin1(bytes);
  if (/\/Encrypt\b/.test(pdf)) throw new Error('Encrypted PDFs are unsupported. Use Paste text.');
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const candidates = [];
  let match;
  while ((match = streamRegex.exec(pdf)) !== null) {
    const dictionary = pdf.slice(Math.max(0, match.index - 800), match.index);
    const flate = /\/Filter\s*(?:\/FlateDecode|\[\s*\/FlateDecode)/.test(dictionary);
    const unsupported = /\/Filter\b/.test(dictionary) && !flate;
    if (unsupported) continue;
    try {
      const decoded = await decodeStream(match[1], flate);
      const items = positionedItems(decoded);
      if (!items.length) continue;
      const table = flightAlertTableText(items);
      candidates.push({ text: table || genericTextFromItems(items), score: (table ? 1_000_000 : 0) + items.length });
    } catch { /* Unsupported streams are not treated as successful extraction. */ }
  }
  const best = candidates.filter(candidate => candidate.text.trim()).sort((a, b) => b.score - a.score)[0];
  if (!best) throw new Error('Unable to extract flight rows from this PDF. Copy and paste the text instead.');
  return best.text;
}
/** Never transmits or stores the file. The caller discards buffers after parsing. */
export async function extractFlightAlertPdf(file, pdfEngine = null) {
  if (!file || !/\.pdf$/i.test(file.name || '')) throw new Error('Select a PDF file.');
  if (file.size < 8 || file.size > MAX_BYTES) throw new Error('PDF must be between 8 bytes and 6 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (latin1(bytes.subarray(0, 8)).slice(0, 5) !== '%PDF-') throw new Error('Selected file is not a valid PDF.');
  if (pdfEngine && typeof pdfEngine.getDocument === 'function') {
    // Parse only; do not evaluate PDF-provided JavaScript-like font programs.
    // isEvalSupported=false is essential for older PDF.js 3.x runtimes.
    const task = pdfEngine.getDocument({ data: bytes, useSystemFonts: true, isEvalSupported: false, enableXfa: false });
    let doc;
    try {
      doc = await task.promise;
      const result = [];
      for (let number = 1; number <= doc.numPages; number++) {
        const page = await doc.getPage(number);
        const content = await page.getTextContent();
        const items = (content.items || []).filter(item => item.str?.trim()).map((item, order) => ({
          text: item.str,
          x: Number(item.transform?.[4] ?? 0),
          y: Number(item.transform?.[5] ?? 0),
          order
        }));
        const table = flightAlertTableText(items);
        result.push(table || genericTextFromItems(items));
      }
      const text = result.filter(Boolean).join('\n');
      if (!text.trim()) throw new Error('This PDF has no extractable text. Use Paste text.');
      return text;
    } finally { await doc?.destroy?.(); await task.destroy?.(); }
  }
  return extractFallback(bytes);
}
