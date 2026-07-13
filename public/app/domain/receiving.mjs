import { normalizeText, normalizeTimestamp, normalizeWeekGroup } from './normalization.mjs';
import {
  calculateBusTotals,
  calculateCapacityTotals,
  selectConfirmedArrivals
} from './operational-metrics.mjs';

const WINDOW_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: 'nightOne',
    label: 'Receiving Night One',
    startField: 'receiving_day_one_start',
    endField: 'receiving_day_one_end'
  }),
  Object.freeze({
    key: 'nightTwo',
    label: 'Receiving Night Two',
    startField: 'receiving_day_two_start',
    endField: 'receiving_day_two_end'
  })
]);

function toEpoch(timestamp) {
  return timestamp ? Date.parse(timestamp) : Number.NaN;
}

export function normalizeReceivingWindows(windows = {}) {
  return WINDOW_DEFINITIONS.map(definition => {
    const rawStart = normalizeText(windows[definition.startField]);
    const rawEnd = normalizeText(windows[definition.endField]);
    return Object.freeze({
      ...definition,
      rawStart,
      rawEnd,
      start: normalizeTimestamp(rawStart),
      end: normalizeTimestamp(rawEnd)
    });
  });
}

export function validateReceivingWindows(windows = {}) {
  const normalized = normalizeReceivingWindows(windows);
  const errors = [];

  for (const window of normalized) {
    const hasRawStart = Boolean(window.rawStart);
    const hasRawEnd = Boolean(window.rawEnd);
    if (hasRawStart !== hasRawEnd) errors.push(`${window.label} requires both start and end timestamps.`);
    if (hasRawStart && !window.start) errors.push(`${window.label} start must include a valid timezone offset.`);
    if (hasRawEnd && !window.end) errors.push(`${window.label} end must include a valid timezone offset.`);
    if (window.start && window.end && toEpoch(window.end) <= toEpoch(window.start)) {
      errors.push(`${window.label} end must be after start.`);
    }
  }

  const configured = normalized.filter(window => window.start && window.end);
  for (let index = 1; index < configured.length; index += 1) {
    const previous = configured[index - 1];
    const current = configured[index];
    if (toEpoch(current.start) < toEpoch(previous.end)) {
      errors.push(`${current.label} cannot overlap ${previous.label}.`);
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    windows: Object.freeze(normalized)
  });
}

export function isTimestampInWindow(timestamp, window) {
  if (!timestamp || !window?.start || !window?.end) return false;
  const value = toEpoch(timestamp);
  return Number.isFinite(value) && value >= toEpoch(window.start) && value < toEpoch(window.end);
}

export function calculateReceivingSummary({ records = [], weekGroup = '', windows = {} } = {}) {
  const normalizedWeekGroup = normalizeWeekGroup(weekGroup);
  const validation = validateReceivingWindows(windows);
  const confirmedBuses = selectConfirmedArrivals(records, normalizedWeekGroup);
  const confirmed = Object.freeze({
    weekGroup: normalizedWeekGroup,
    buses: Object.freeze([...confirmedBuses]),
    ...calculateBusTotals(confirmedBuses)
  });
  const projected = calculateCapacityTotals(records, normalizedWeekGroup);

  const cumulative = {
    total: 0,
    airForce: 0,
    spaceForce: 0,
    female: 0,
    naturalization: 0
  };
  const assignedBuses = new Set();

  const nights = validation.windows.map(window => {
    const buses = validation.valid && window.start && window.end
      ? confirmedBuses.filter(bus => isTimestampInWindow(bus.arrivedAt, window))
      : [];

    buses.forEach(bus => assignedBuses.add(bus));
    const totals = calculateBusTotals(buses);
    cumulative.total += totals.total;
    cumulative.airForce += totals.airForce;
    cumulative.spaceForce += totals.spaceForce;
    cumulative.female += totals.female;
    cumulative.naturalization += totals.naturalization;

    return Object.freeze({
      key: window.key,
      label: window.label,
      start: window.start,
      end: window.end,
      busIds: Object.freeze(buses.map(bus => bus.id)),
      totals: Object.freeze(totals),
      cumulative: Object.freeze({ ...cumulative })
    });
  });

  const unassignedConfirmedBuses = confirmedBuses.filter(bus => !assignedBuses.has(bus));

  return Object.freeze({
    weekGroup: normalizedWeekGroup,
    validation,
    projected,
    confirmed,
    nights: Object.freeze(nights),
    unassignedConfirmedBuses: Object.freeze(unassignedConfirmedBuses),
    unassignedConfirmedTotals: Object.freeze(calculateBusTotals(unassignedConfirmedBuses))
  });
}

export function buildReceivingReportModel(summary) {
  if (!summary || !Array.isArray(summary.nights)) {
    throw new TypeError('A receiving summary is required.');
  }

  const includeSpaceForce = summary.projected.spaceForce > 0 || summary.confirmed.spaceForce > 0;

  return Object.freeze({
    weekGroup: summary.weekGroup,
    projected: Object.freeze({
      total: summary.projected.total,
      airForce: summary.projected.airForce,
      spaceForce: summary.projected.spaceForce
    }),
    confirmed: Object.freeze({
      total: summary.confirmed.total,
      airForce: summary.confirmed.airForce,
      spaceForce: summary.confirmed.spaceForce,
      naturalization: summary.confirmed.naturalization
    }),
    includeSpaceForce,
    nights: Object.freeze(summary.nights.map(night => Object.freeze({
      key: night.key,
      label: night.label,
      start: night.start,
      end: night.end,
      standard: Object.freeze({
        processed: night.totals.airForce,
        projected: summary.projected.airForce,
        cumulative: night.cumulative.airForce
      }),
      naturalization: Object.freeze({
        tonight: night.totals.naturalization,
        cumulative: night.cumulative.naturalization
      }),
      spaceForce: includeSpaceForce ? Object.freeze({
        processed: night.totals.spaceForce,
        projected: summary.projected.spaceForce,
        cumulative: night.cumulative.spaceForce
      }) : null,
      totalProcessed: night.totals.total,
      cumulativeTotalProcessed: night.cumulative.total
    })))
  });
}
