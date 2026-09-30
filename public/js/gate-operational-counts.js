// GATE live operational accounting contract
// ARRIVED = trainees physically at PRC (bus/local records whose status is arrived).
// LOADED = trainees assigned to dorms (sum of dorm current_load).
// AWAITING = ARRIVED - LOADED. Read-only: this helper never mutates records.
(function (global) {
  'use strict';

  function nonNegativeCount(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.trunc(parsed));
  }

  function normalizeWeekGroup(value) {
    return String(value ?? '').trim().toUpperCase();
  }

  function matchesWeekGroup(record, weekGroup) {
    const requested = normalizeWeekGroup(weekGroup);
    return !requested || normalizeWeekGroup(record?.week_group) === requested;
  }

  function isPhysicalArrival(record) {
    return record?.type === 'bus' && String(record?.status ?? '').trim().toLowerCase() === 'arrived';
  }

  function calculatePhysicalArrivalTotal(records = [], weekGroup = '') {
    return (Array.isArray(records) ? records : [])
      .filter(record => matchesWeekGroup(record, weekGroup) && isPhysicalArrival(record))
      .reduce((sum, bus) => sum + nonNegativeCount(bus.otw_count), 0);
  }

  function calculateLoadedTotal(records = [], weekGroup = '') {
    return (Array.isArray(records) ? records : [])
      .filter(record => record?.type === 'dorm' && matchesWeekGroup(record, weekGroup))
      .reduce((sum, dorm) => sum + nonNegativeCount(dorm.current_load), 0);
  }

  function calculateAssignmentSummary(records = [], weekGroup = '') {
    const arrived = calculatePhysicalArrivalTotal(records, weekGroup);
    const loaded = calculateLoadedTotal(records, weekGroup);
    return Object.freeze({
      weekGroup: normalizeWeekGroup(weekGroup),
      arrived,
      loaded,
      awaitingAssignment: Math.max(arrived - loaded, 0),
      overAssigned: Math.max(loaded - arrived, 0)
    });
  }

  global.GateOperationalCounts = Object.freeze({
    isCanonicalLiveAccountingOwner: true,
    calculatePhysicalArrivalTotal,
    calculateLoadedTotal,
    calculateAssignmentSummary
  });
})(window);
