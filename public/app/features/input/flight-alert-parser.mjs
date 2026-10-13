/** Flight Alert text contract. Pure, memory-only; never persists source text or PII. */
const DORM = /^(?:[0-9][A-Z][0-9]|[A-Z][0-9]{2})$/;
const SQUADRON = /^(\d{3})(?:\s*TRS)?$/i;
const SIX_COLUMN_HEADER = /\bINTER\s*\/\s*SECT?\b/i;
const HEADERS = /\b(?:SQUADRON|SQDN|SDQ)\b.*\b(?:SECTION|SEC)\b.*\bDORM\b/i;
const TOTAL = /\b(?:AAFES|GRAND\s+TOTAL|TOTAL\s+(?:EXPECTED\s+)?(?:LOAD|STRENGTH)|EXPECTED\s+TOTAL|TOTAL\s+EXPECTED)\b\s*[:=\-]?\s*([\d,]+)\b/i;
const ROW_COUNT = /\bTOTAL\s+FLT\s*['’]?\s*S\s*[:=\-]?\s*(\d+)\b/i;
const HEADER_FIELD = /^(?:SQUADRON|SQDN|SDQ|SECTION|SEC|INTER|SECT|DORM|DORMITORY|MALE|FEMALE|SEX|GENDER|LOAD|EXPECTED|COUNT|TOTAL)$/i;

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

/** Delimiter-preserved, coordinate-extracted PDF rows keep empty fields empty. */
function parseDelimitedLine(line, sourceLine, context) {
  const cells = line.split('|').map(value => value.trim().toUpperCase());
  if (cells.length !== 6) return null;
  const [rawSq, sec, interSec, dorm, sex, load] = cells;
  const sqMatch = rawSq ? rawSq.match(SQUADRON) : null;
  const squadron = sqMatch?.[1] || (rawSq ? '' : context.squadron);
  if (!squadron || !DORM.test(dorm) || !/^(?:MALE|FEMALE|M|F)$/.test(sex) ||
      !/^\d{1,3}$/.test(load) ||
      (sec && !normalizeSection(sec)) || (interSec && !/^\d{1,3}$/.test(interSec))) return null;
  context.squadron = squadron;
  context.section = sec; // Blank SEC remains blank; do not inherit or guess it.
  return {
    sourceLine, sdq: squadron + ' TRS', sec, inter_sec: interSec,
    dorm_name: dorm, sex: sex === 'FEMALE' || sex === 'F' ? 'female' : 'male',
    load: String(Number(load)), band: false,
    space_force: squadron === '535', capacity: Number(load)
  };
}

/** Supports both legacy five-column rows and six-column alerts with merged SQD/SEC cells. */
function parseLine(line, sourceLine, context, sixColumns) {
  if (line.includes('|')) return parseDelimitedLine(line, sourceLine, context);
  const tokens = line.toUpperCase().replace(/[|,;\t]+/g, ' ').trim().split(/\s+/);
  if (tokens.length < 3) return null;
  const loadToken = tokens.at(-1);
  const sexToken = tokens.at(-2);
  const dormToken = tokens.at(-3);
  if (!/^\d{1,3}$/.test(loadToken) || !/^(?:MALE|FEMALE|M|F)$/.test(sexToken) || !DORM.test(dormToken)) return null;

  const leading = tokens.slice(0, -3);
  let rawSq = '';
  if (/^\d{3}(?:TRS)?$/.test(leading[0] || '')) {
    rawSq = leading.shift().slice(0, 3);
    if (leading[0] === 'TRS') leading.shift();
  }
  if (!leading.every(token => /^\d{1,3}$/.test(token)) || leading.length > 2) return null;

  let section = '';
  let interSec = '';
  let squadron = rawSq || context.squadron;
  if (rawSq && !sixColumns) {
    if (leading.length !== 1) return null;
    section = leading[0]; // Legacy five-column layout has no INTER/SEC.
  } else if (sixColumns) {
    if (leading.length === 2) [section, interSec] = leading;
    else if (leading.length === 1) { interSec = leading[0]; section = rawSq ? '' : context.section; }
    else if (!rawSq) section = context.section;
    // Only delimiter-preserved coordinate extraction unambiguously identifies
    // a blank SEC/INTER cell. A single numeric token is treated as INTER/SEC
    // for six-column text fallback, and the resulting draft requires review.
  } else {
    return null;
  }
  if (!squadron || (section && !normalizeSection(section))) return null;
  context.squadron = squadron;
  context.section = section;
  return {
    sourceLine,
    sdq: `${squadron} TRS`, sec: section, inter_sec: interSec,
    dorm_name: dormToken,
    sex: sexToken === 'FEMALE' || sexToken === 'F' ? 'female' : 'male',
    load: String(Number(loadToken)), band: false,
    space_force: squadron === '535', capacity: Number(loadToken)
  };
}
function plausibleRow(line) {
  // Detect broken rows, including continuation rows whose merged SQD/SEC cells are blank.
  return /\b(?:\d[A-Z]\d|[A-Z]\d{2})\b\s+(?:MALE|FEMALE|M|F)\s+\d{1,3}\s*$/i.test(line);
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
    if (!String(row.sec ?? '').trim()) issues.push(diagnostic('section', `Row ${index + 1}: SEC is blank; review before importing.`, location, 'warning'));
    else if (!section) issues.push(diagnostic('section', `Row ${index + 1}: section must be 1–4 if supplied.`, location));
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
    if (!String(row.inter_sec ?? '').trim()) issues.push(diagnostic('inter_sec', `Row ${index + 1}: INTER/SEC is blank; review before importing.`, location, 'warning'));
    else if (!/^\d{1,3}$/.test(String(row.inter_sec).trim())) issues.push(diagnostic('inter_sec_invalid', `Row ${index + 1}: INTER/SEC must be numeric if supplied.`, location));
  });
  const total = Number(publishedTotal);
  const hasTotal = publishedTotal !== '' && publishedTotal !== null && publishedTotal !== undefined && Number.isInteger(total) && total >= 0;
  const variance = hasTotal ? calculated - total : null;
  if (!hasTotal) issues.push(diagnostic('published_total', 'Enter the published AAFES or grand total from the Flight Alert.', null, 'warning'));
  else if (variance !== 0) issues.push(diagnostic('variance', `Dorm loads ${calculated} differ from published total ${total} by ${variance > 0 ? '+' : ''}${variance}.`, null, 'warning'));
  return Object.freeze({ calculated, published: hasTotal ? total : null, variance, issues: Object.freeze(issues) });
}
export function parseFlightAlertText(text) {
  if (typeof text !== 'string' || !text.trim()) return Object.freeze({ ok: false, rows: [], publishedTotal: null, issues: [diagnostic('empty', 'No Flight Alert text was provided.')] });
  if (text.length > 250_000) return Object.freeze({ ok: false, rows: [], publishedTotal: null, issues: [diagnostic('size', 'Flight Alert text exceeds the processing limit.')] });
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const sixColumns = SIX_COLUMN_HEADER.test(text);
  const context = { squadron:'', section:'' };
  const rows = [];
  const issues = [];
  const totals = [];
  const declaredRows = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim().replace(/\s+/g, ' ');
    if (!line) continue;
    const totalMatch = line.match(TOTAL);
    if (totalMatch) {
      totals.push(Number(totalMatch[1].replaceAll(',', '')));
      continue;
    }
    const countMatch = line.match(ROW_COUNT);
    if (countMatch) { declaredRows.push(Number(countMatch[1])); continue; }
    if (HEADERS.test(line) || line.split(/[\s|,;\/]+/).every(token => HEADER_FIELD.test(token))) continue;
    const parsed = parseLine(line, i + 1, context, sixColumns);
    if (parsed) rows.push(parsed);
    else if (plausibleRow(line)) issues.push(diagnostic('unparsed_row', `Line ${i + 1} resembles a flight row but could not be safely parsed. Check its column order or merged squadron/section cells.`, i + 1));
  }
  if (totals.length > 1) issues.push(diagnostic('ambiguous_total', 'Multiple published totals found; enter the authoritative AAFES or grand total manually.'));
  const publishedTotal = totals.length === 1 ? totals[0] : null;
  if (declaredRows.length > 1 && new Set(declaredRows).size > 1) issues.push(diagnostic('ambiguous_row_count', 'Conflicting flight counts were found.'));
  else if (declaredRows.length && declaredRows[0] !== rows.length) issues.push(diagnostic('row_count', `Flight Alert declares ${declaredRows[0]} flights, but only ${rows.length} dorm rows were extracted. No draft was changed.`));
  if (!rows.length) issues.push(diagnostic('no_rows', 'No flight rows matched the supported layout. Keep your existing Input draft and use pasted text or manual entry.'));
  const audit = validateFlightAlertRows(rows, publishedTotal);
  return Object.freeze({
    ok: rows.length > 0 && !issues.some(issue => issue.level === 'error') && !audit.issues.some(issue => issue.level === 'error'),
    rows: Object.freeze(rows.map(row => Object.freeze(row))),
    publishedTotal,
    issues: Object.freeze([...issues, ...audit.issues]),
    calculatedTotal: audit.calculated,
    variance: audit.variance,
    format: sixColumns ? 'six-column-v2' : 'five-column-v1'
  });
}
