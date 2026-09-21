/** Flight Alert text contract. Pure, memory-only; never persists source text or PII. */
const DORM = /^(?:[0-9][A-Z][0-9]|[A-Z][0-9]{2})$/;
const SQUADRON = /^(\d{3})(?:\s*TRS)?$/i;
const HEADERS = /\b(?:SQUADRON|SQDN|SDQ)\b.*\b(?:SECTION|SEC)\b.*\bDORM\b/i;
const TOTAL = /\b(?:GRAND\s+TOTAL|TOTAL\s+(?:EXPECTED\s+)?(?:LOAD|STRENGTH)|EXPECTED\s+TOTAL|TOTAL\s+EXPECTED)\b\s*[:=\-]?\s*([\d,]+)\b/i;
const ROW = /^\s*(\d{3})(?:\s*TRS)?\s*[|,;\t ]+([1-4])\s*[|,;\t ]+([0-9][A-Z][0-9]|[A-Z][0-9]{2})\s*[|,;\t ]+(MALE|FEMALE|M|F)\s*[|,;\t ]+(\d{1,3})\s*$/i;
const HEADER_FIELD = /^(?:SQUADRON|SQDN|SDQ|SECTION|SEC|DORM|DORMITORY|MALE|FEMALE|SEX|GENDER|LOAD|EXPECTED|COUNT|TOTAL)$/i;

export function normalizeSquadron(value) {
  const match = String(value ?? '').trim().match(SQUADRON);
  return match ? `${match[1]} TRS` : '';
}
export function normalizeDorm(value) {
  const dorm = String(value ?? '').trim().toUpperCase();
  return DORM.test(dorm) ? dorm : '';
}
export function normalizeSection(value) {
  const section = String(value ?? '').trim();
  return /^[1-4]$/.test(section) ? section : '';
}
function diagnostic(code, message, line = null, level = 'error') {
  return Object.freeze({ code, message, line, level });
}
function parseLine(line, sourceLine) {
  const upper = line.toUpperCase();
  const six = upper.match(ROW6);
  const five = six ? null : upper.match(ROW5);
  const match = six || five;
  if (!match) return null;
  const [, rawSq, rawSec, rawInter, rawDorm, rawSex, rawLoad] = six
    ? match
    : [match[0], match[1], match[2], '', match[3], match[4], match[5]];
  const load = Number(rawLoad);
  return {
    sourceLine,
    sdq: `${rawSq} TRS`, sec: rawSec, dorm_name: rawDorm,
    sex: rawSex === 'FEMALE' || rawSex === 'F' ? 'female' : 'male',
    load: String(load), inter_sec: rawInter,
    band: false, space_force: rawSq === '535',
    capacity: load
  };
}
function plausibleRow(line) {
  // Flag failed rows containing a squadron and dorm-looking token rather than silently omitting them.
  return /\b\d{3}(?:\s+TRS)?\b/i.test(line) && /\b(?:\d[A-Z]\d|[A-Z]\d{2})\b/i.test(line);
}
export function validateFlightAlertRows(rows, publishedTotal) {
  const issues = [];
  const seen = new Set();
  let calculated = 0;
  rows.forEach((row, index) => {
    const location = row.sourceLine ?? index + 1;
    const squadron = normalizeSquadron(row.sdq);
    const section = normalizeSection(row.sec);
    const dorm = normalizeDorm(row.dorm_name);
    const load = Number(row.load);
    if (!squadron) issues.push(diagnostic('squadron', `Row ${index + 1}: unrecognized squadron.`, location));
    if (!section) issues.push(diagnostic('section', `Row ${index + 1}: section must be 1–4.`, location));
    if (!dorm) issues.push(diagnostic('dorm', `Row ${index + 1}: invalid dorm identifier.`, location));
    if (!Number.isInteger(load) || load < 1 || load > 100) issues.push(diagnostic('load', `Row ${index + 1}: load must be 1–100.`, location));
    else calculated += load;
    if (!['male', 'female'].includes(row.sex)) issues.push(diagnostic('sex', `Row ${index + 1}: select Male or Female.`, location));
    if (squadron && dorm) {
      const key = `${squadron}::${dorm}`;
      if (seen.has(key)) issues.push(diagnostic('duplicate', `Duplicate dorm: ${key}.`, location));
      seen.add(key);
    }
    if (row.band && squadron !== '321 TRS') issues.push(diagnostic('band', `Row ${index + 1}: Band requires 321 TRS.`, location));
    if (row.band && row.space_force) issues.push(diagnostic('classification', `Row ${index + 1}: Band and Space Force conflict.`, location));
    if (!String(row.inter_sec ?? '').trim()) issues.push(diagnostic('inter_sec', `Row ${index + 1}: enter INTER/SEC from the separate system.`, location));
  });
  const total = Number(publishedTotal);
  const hasTotal = publishedTotal !== '' && publishedTotal !== null && publishedTotal !== undefined && Number.isInteger(total) && total >= 0;
  const variance = hasTotal ? calculated - total : null;
  if (!hasTotal) issues.push(diagnostic('published_total', 'Enter the published grand total from the Flight Alert.', null, 'warning'));
  else if (variance !== 0) issues.push(diagnostic('variance', `Dorm loads ${calculated} differ from published total ${total} by ${variance > 0 ? '+' : ''}${variance}.`, null, 'warning'));
  return Object.freeze({ calculated, published: hasTotal ? total : null, variance, issues: Object.freeze(issues) });
}
export function parseFlightAlertText(text) {
  if (typeof text !== 'string' || !text.trim()) return Object.freeze({ ok: false, rows: [], publishedTotal: null, issues: [diagnostic('empty', 'No Flight Alert text was provided.')] });
  if (text.length > 250_000) return Object.freeze({ ok: false, rows: [], publishedTotal: null, issues: [diagnostic('size', 'Flight Alert text exceeds the processing limit.')] });
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const rows = [];
  const issues = [];
  const totals = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim().replace(/\s+/g, ' ');
    if (!line) continue;
    const totalMatch = line.match(TOTAL);
    if (totalMatch) {
      totals.push(Number(totalMatch[1].replaceAll(',', '')));
      continue;
    }
    if (HEADERS.test(line) || line.split(/[\s|,;]+/).every(token => HEADER_FIELD.test(token))) continue;
    const parsed = parseLine(line, i + 1);
    if (parsed) rows.push(parsed);
    else if (plausibleRow(line)) issues.push(diagnostic('unparsed_row', `Line ${i + 1} resembles a flight row but could not be safely parsed. Check its column order.`, i + 1));
  }
  if (totals.length > 1) issues.push(diagnostic('ambiguous_total', 'Multiple published totals found; enter the authoritative grand total manually.'));
  const publishedTotal = totals.length === 1 ? totals[0] : null;
  if (!rows.length) issues.push(diagnostic('no_rows', 'No flight rows matched the supported layout. Keep your existing Input draft and use pasted text or manual entry.'));
  const audit = validateFlightAlertRows(rows, publishedTotal);
  return Object.freeze({
    ok: rows.length > 0 && !issues.some(issue => issue.level === 'error'),
    rows: Object.freeze(rows.map(row => Object.freeze(row))),
    publishedTotal,
    issues: Object.freeze([...issues, ...audit.issues]),
    calculatedTotal: audit.calculated,
    variance: audit.variance,
    format: rows.some(row => row.inter_sec) ? 'six-column-prc-v2' : 'five-column-v1'
  });
}
