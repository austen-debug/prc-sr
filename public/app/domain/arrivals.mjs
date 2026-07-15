import { normalizeWeekGroup } from './normalization.mjs';
import {
  calculateBusTotals,
  calculateConfirmedArrivalTotals,
  selectConfirmedArrivals
} from './operational-metrics.mjs';

export function selectLastConfirmedArrival(records = [], weekGroup = '') {
  const arrivals = [...selectConfirmedArrivals(records, weekGroup)]
    .filter(bus => Boolean(bus.arrivedAt))
    .sort((left, right) => Date.parse(right.arrivedAt) - Date.parse(left.arrivedAt));
  return arrivals[0] || null;
}

export function selectLocalArrivals(records = [], weekGroup = '') {
  return Object.freeze(selectConfirmedArrivals(records, weekGroup)
    .filter(bus => bus.busType === 'local'));
}

export function calculateLocalArrivalTotals(records = [], weekGroup = '') {
  const buses = selectLocalArrivals(records, weekGroup);
  return Object.freeze({
    weekGroup: normalizeWeekGroup(weekGroup),
    buses,
    ...calculateBusTotals(buses)
  });
}

export function buildArrivalSummary(records = [], weekGroup = '') {
  const confirmed = calculateConfirmedArrivalTotals(records, weekGroup);
  const local = calculateLocalArrivalTotals(records, weekGroup);
  const last = selectLastConfirmedArrival(records, weekGroup);
  return Object.freeze({
    weekGroup: normalizeWeekGroup(weekGroup),
    confirmed,
    local,
    lastConfirmedArrival: last ? Object.freeze({
      id: last.id,
      busId: last.busId,
      busType: last.busType,
      arrivedAt: last.arrivedAt,
      total: last.total
    }) : null
  });
}
