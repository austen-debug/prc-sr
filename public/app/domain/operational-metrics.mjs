import {
  matchesWeekGroup,
  normalizeBusRecord,
  normalizeDormRecord,
  normalizeText,
  normalizeWeekGroup
} from './normalization.mjs';

function recordsOfType(records, type) {
  const requestedType = normalizeText(type).toLowerCase();
  return Array.isArray(records)
    ? records.filter(record => normalizeText(record?.type).toLowerCase() === requestedType)
    : [];
}

export function selectBuses(records, weekGroup) {
  return recordsOfType(records, 'bus')
    .map(normalizeBusRecord)
    .filter(bus => matchesWeekGroup(bus, weekGroup));
}

export function selectDorms(records, weekGroup) {
  return recordsOfType(records, 'dorm')
    .map(normalizeDormRecord)
    .filter(dorm => matchesWeekGroup(dorm, weekGroup));
}

export function selectConfirmedArrivals(records, weekGroup) {
  return selectBuses(records, weekGroup).filter(bus => bus.isConfirmedArrival);
}

export function selectActiveBuses(records, weekGroup) {
  return selectBuses(records, weekGroup).filter(bus => bus.isActive && !bus.isConfirmedArrival);
}

export function calculateBusTotals(buses = []) {
  return buses.reduce((totals, bus) => {
    totals.busCount += 1;
    totals.total += bus.total;
    totals.airForce += bus.airForce;
    totals.spaceForce += bus.spaceForce;
    totals.female += bus.female;
    totals.naturalization += bus.naturalization;
    return totals;
  }, {
    busCount: 0,
    total: 0,
    airForce: 0,
    spaceForce: 0,
    female: 0,
    naturalization: 0
  });
}

export function calculateConfirmedArrivalTotals(records, weekGroup) {
  const buses = selectConfirmedArrivals(records, weekGroup);
  return Object.freeze({
    weekGroup: normalizeWeekGroup(weekGroup),
    buses: Object.freeze([...buses]),
    ...calculateBusTotals(buses)
  });
}

export function calculateManifestedBusTotals(records, weekGroup) {
  const buses = selectBuses(records, weekGroup);
  return Object.freeze({
    weekGroup: normalizeWeekGroup(weekGroup),
    buses: Object.freeze([...buses]),
    ...calculateBusTotals(buses)
  });
}

export function calculateCapacityTotals(records, weekGroup) {
  const dorms = selectDorms(records, weekGroup);
  const totals = dorms.reduce((result, dorm) => {
    result.dormCount += 1;
    result.total += dorm.capacity;
    if (dorm.spaceForce) result.spaceForce += dorm.capacity;
    else result.airForce += dorm.capacity;
    return result;
  }, { dormCount: 0, total: 0, airForce: 0, spaceForce: 0 });

  return Object.freeze({
    weekGroup: normalizeWeekGroup(weekGroup),
    dorms: Object.freeze([...dorms]),
    ...totals
  });
}

export function calculateLoadTotals(records, weekGroup) {
  const dorms = selectDorms(records, weekGroup);
  const totals = dorms.reduce((result, dorm) => {
    result.dormCount += 1;
    result.loaded += dorm.load;
    result.capacity += dorm.capacity;
    return result;
  }, { dormCount: 0, loaded: 0, capacity: 0 });

  return Object.freeze({
    weekGroup: normalizeWeekGroup(weekGroup),
    dorms: Object.freeze([...dorms]),
    ...totals
  });
}

export function calculateAssignmentSummary(records, weekGroup) {
  const arrivals = calculateConfirmedArrivalTotals(records, weekGroup);
  const loads = calculateLoadTotals(records, weekGroup);
  return Object.freeze({
    weekGroup: normalizeWeekGroup(weekGroup),
    arrived: arrivals.total,
    loaded: loads.loaded,
    awaitingAssignment: Math.max(arrivals.total - loads.loaded, 0),
    overAssigned: Math.max(loads.loaded - arrivals.total, 0)
  });
}
