import { normalizeWeekGroup } from './normalization.mjs';
import {
  calculateBusTotals,
  calculateCapacityTotals,
  selectConfirmedArrivals
} from './operational-metrics.mjs';
import '../../js/gate-receiving-window-engine.js';

const engine = globalThis.GateReceivingWindowEngine;

const WINDOW_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: 'nightOne',
    dayKey: 'dayOne',
    label: 'Receiving Day One',
    startField: 'receiving_day_one_start',
    endField: 'receiving_day_one_end'
  }),
  Object.freeze({
    key: 'nightTwo',
    dayKey: 'dayTwo',
    label: 'Receiving Day Two',
    startField: 'receiving_day_two_start',
    endField: 'receiving_day_two_end'
  })
]);

export function normalizeReceivingWindows(windows = {}) {
  const normalized = engine.normalizeWindows(windows);
  return WINDOW_DEFINITIONS.map((definition, index) => Object.freeze({
    ...definition,
    rawStart: normalized[index].rawStart,
    rawEnd: normalized[index].rawEnd,
    start: normalized[index].startIso,
    end: normalized[index].endIso
  }));
}

export function validateReceivingWindows(windows = {}) {
  const validation = engine.validateWindows(windows);
  const normalized = normalizeReceivingWindows(windows);
  return Object.freeze({
    valid: validation.valid,
    errors: Object.freeze([...validation.errors]),
    windows: Object.freeze(normalized)
  });
}

export function isTimestampInWindow(timestamp, window) {
  if (!timestamp || !window?.start || !window?.end) return false;
  return engine.inWindow(timestamp, window.start, window.end);
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
