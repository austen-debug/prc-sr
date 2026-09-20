/** Local-only PDF extraction. Text PDFs only; intentionally fails closed on unfamiliar layouts. */
const MAX_BYTES = 6 * 1024 * 1024;
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
function tokensFromContent(stream) {
  const results = [];
  const segments = stream.match(/\bBT\b[\s\S]*?\bET\b/g) || [];
  for (const segment of segments) {
    const pieces = [];
    const pattern = /\(((?:\\.|[^\\)])*)\)|<([0-9a-fA-F\s]+)>/g;
    for (const match of segment.matchAll(pattern)) {
      if (match[1] !== undefined) pieces.push(pdfLiteral(match[1]));
      else if (match[2] && match[2].replace(/\s/g, '').length % 2 === 0) {
        const hex = match[2].replace(/\s/g, '');
        let decoded = '';
        for (let i=0; i<hex.length; i+=2) decoded += String.fromCharCode(parseInt(hex.slice(i,i+2),16));
        pieces.push(decoded);
      }
    }
    if (pieces.length) results.push(pieces.join(' '));
  }
  return results;
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
  const rows = [];
  let match;
  while ((match = streamRegex.exec(pdf)) !== null) {
    const dictionary = pdf.slice(Math.max(0, match.index - 800), match.index);
    const flate = /\/Filter\s*(?:\/FlateDecode|\[\s*\/FlateDecode)/.test(dictionary);
    const unsupported = /\/Filter\b/.test(dictionary) && !flate;
    if (unsupported) continue;
    try { rows.push(...tokensFromContent(await decodeStream(match[1], flate))); }
    catch { /* Unsupported streams are not treated as successful extraction. */ }
  }
  if (!rows.length) throw new Error('Unable to extract flight rows from this PDF. Copy and paste the text instead.');
  return rows.join('\n');
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
        const buckets = new Map();
        for (const item of content.items || []) {
          if (!item.str?.trim()) continue;
          const y = Math.round((item.transform?.[5] ?? 0) / 3) * 3;
          const bucket = buckets.get(y) || [];
          bucket.push({ x: item.transform?.[4] ?? 0, str: item.str });
          buckets.set(y, bucket);
        }
        for (const y of [...buckets.keys()].sort((a,b)=>b-a)) {
          result.push(buckets.get(y).sort((a,b)=>a.x-b.x).map(item=>item.str).join(' '));
        }
      }
      if (!result.length) throw new Error('This PDF has no extractable text. Use Paste text.');
      return result.join('\n');
    } finally { await doc?.destroy?.(); await task.destroy?.(); }
  }
  return extractFallback(bytes);
}
