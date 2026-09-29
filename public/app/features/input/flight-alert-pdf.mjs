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
 * This specifically preserves merged SQD/SEC values by assigning each dorm row
 * to the nearest merged-cell center rather than relying on visual line breaks.
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
  if (!dorms.length) return '';

  const minDormY = dorms.at(-1).y;
  const region = left.filter(item => item.y >= minDormY - 20);
  const candidates = (field, predicate) => region.filter(item => nearestField(item.x, headers) === field && predicate(compact(item.text)));
  const squadrons = candidates('sdq', value => /^\d{3}$/.test(value));
  const sections = candidates('sec', value => /^[1-4]$/.test(value));
  const inters = candidates('inter', value => /^\d{1,3}$/.test(value));
  const sexes = candidates('sex', value => /^(?:M|F|MALE|FEMALE)$/.test(value));
  const loads = candidates('load', value => /^\d{1,3}$/.test(value) && Number(value) >= 1 && Number(value) <= 100);

  const rows = [];
  const seen = new Set();
  for (const dorm of dorms) {
    const squadron = nearestY(squadrons, dorm.y, 20);
    const section = nearestY(sections, dorm.y, 15);
    const inter = nearestY(inters, dorm.y, 2);
    const sex = nearestY(sexes, dorm.y, 2);
    const load = nearestY(loads, dorm.y, 2);
    if (!squadron || !section || !inter || !sex || !load) return '';
    const dormName = compact(dorm.text);
    const key = `${compact(squadron.text)}::${dormName}`;
    if (seen.has(key)) return '';
    seen.add(key);
    rows.push(`${compact(squadron.text)} ${compact(section.text)} ${compact(inter.text)} ${dormName} ${compact(sex.text)} ${Number(compact(load.text))}`);
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
    const task = pdfEngine.getDocument({ data: bytes, useSystemFonts: true });
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
