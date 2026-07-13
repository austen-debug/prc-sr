import {
  normalizeText,
  normalizeTimestamp,
  normalizeWeekGroup,
  toNonNegativeNumber
} from '../domain/normalization.mjs';

export const DEFAULT_OPERATIONAL_TIME_ZONE = 'America/Chicago';

const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function dateTimePartsInZone(instantMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(instantMs));

  const map = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second)
  };
}

function sameWallClock(parts, target) {
  return parts.year === target.year &&
    parts.month === target.month &&
    parts.day === target.day &&
    parts.hour === target.hour &&
    parts.minute === target.minute &&
    parts.second === target.second;
}

function offsetAt(instantMs, timeZone) {
  const rounded = Math.trunc(instantMs / 1000) * 1000;
  const parts = dateTimePartsInZone(rounded, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - rounded;
}

function parseLocalDateTime(value) {
  const match = LOCAL_DATE_TIME_PATTERN.exec(normalizeText(value));
  if (!match) return null;
  const milliseconds = Number(String(match[7] || '0').padEnd(3, '0'));
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0),
    milliseconds
  };
}

export function convertLocalDateTimeToIso(value, { timeZone = DEFAULT_OPERATIONAL_TIME_ZONE } = {}) {
  const target = parseLocalDateTime(value);
  if (!target) return Object.freeze({ value: null, ambiguous: false, error: 'Invalid datetime-local value.' });

  const wallMs = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second,
    target.milliseconds
  );

  let guess = wallMs;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const next = wallMs - offsetAt(guess, timeZone);
    if (Math.abs(next - guess) < 1) {
      guess = next;
      break;
    }
    guess = next;
  }

  const candidateOffsets = new Set([
    offsetAt(guess, timeZone),
    offsetAt(guess - 60 * 60 * 1000, timeZone),
    offsetAt(guess + 60 * 60 * 1000, timeZone)
  ]);
  const candidates = [...candidateOffsets]
    .map(offset => wallMs - offset)
    .filter(candidate => sameWallClock(dateTimePartsInZone(candidate, timeZone), target))
    .sort((a, b) => a - b);

  if (!candidates.length) {
    return Object.freeze({ value: null, ambiguous: false, error: `Local time does not exist in ${timeZone}.` });
  }

  return Object.freeze({
    value: new Date(candidates[0]).toISOString(),
    ambiguous: candidates.length > 1,
    error: null
  });
}

export function normalizeLegacyTimestamp(value, options = {}) {
  const raw = normalizeText(value);
  if (!raw) return Object.freeze({ value: null, source: 'empty', warning: null });

  const explicit = normalizeTimestamp(raw);
  if (explicit) return Object.freeze({ value: explicit, source: 'explicit-offset', warning: null });

  const converted = convertLocalDateTimeToIso(raw, options);
  if (!converted.value) {
    return Object.freeze({ value: null, source: 'invalid', warning: converted.error });
  }

  return Object.freeze({
    value: converted.value,
    source: 'operational-time-zone',
    warning: converted.ambiguous
      ? `Ambiguous local timestamp ${raw} resolved to the earliest matching instant.`
      : null
  });
}

export function normalizeLegacyConfigKey(value) {
  const key = normalizeText(value).toLowerCase();
  if (['active_wg', 'active-week-group', 'weekgroup', 'week_group'].includes(key)) return 'week_group';
  if (['last_airport', 'last-arrival', 'last_arrival'].includes(key)) return 'last_airport';
  return key;
}

export function parseLegacyArray(value, { field = 'array' } = {}) {
  if (Array.isArray(value)) return Object.freeze({ value: cloneJson(value), warning: null });
  const raw = normalizeText(value);
  if (!raw) return Object.freeze({ value: [], warning: null });
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return Object.freeze({ value: [], warning: `${field} was not an array.` });
    return Object.freeze({ value: parsed, warning: null });
  } catch {
    return Object.freeze({ value: [], warning: `${field} contained invalid JSON.` });
  }
}

export function normalizeRecordVersion(value) {
  return toNonNegativeNumber(value, { integer: true });
}

export function legacySchemaVersion(record = {}) {
  return normalizeText(record.schema_version || record.schemaVersion || record.archive_schema_version) || `build-1.${normalizeText(record.type || 'unknown').toLowerCase()}.legacy`;
}

export function legacyWeekGroup(record = {}) {
  return normalizeWeekGroup(record.week_group ?? record.weekGroup);
}

export function cloneLegacyRecord(record = {}) {
  return cloneJson(record) || {};
}
