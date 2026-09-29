// GATE canonical Receiving Day window engine.
// Pure operational logic: no DOM, storage, network, or role dependencies.
(function (root) {
  'use strict';

  const TIME_ZONE = 'America/Chicago';
  const DEFINITIONS = Object.freeze([
    Object.freeze({ day: 'one', key: 'dayOne', label: 'Receiving Day One', startField: 'receiving_day_one_start', endField: 'receiving_day_one_end' }),
    Object.freeze({ day: 'two', key: 'dayTwo', label: 'Receiving Day Two', startField: 'receiving_day_two_start', endField: 'receiving_day_two_end' })
  ]);
  const clock = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  });

  function clean(value) {
    return String(value ?? '').trim();
  }

  function offsetAt(instant) {
    const parts = Object.fromEntries(clock.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - instant;
  }

  function toEpoch(value) {
    const text = clean(value);
    if (!text) return Number.NaN;
    if (/[zZ]$|[+-]\d\d:?\d\d$/.test(text)) {
      const parsed = Date.parse(text);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/.exec(text);
    if (!match) return Number.NaN;
    const second = +(match[6] || 0);
    const target = Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], second);
    let instant = target - offsetAt(target);
    instant = target - offsetAt(instant);
    return Number.isFinite(instant) ? instant : Number.NaN;
  }

  function toIso(value) {
    const epoch = toEpoch(value);
    return Number.isFinite(epoch) ? new Date(epoch).toISOString() : null;
  }

  function normalizeWindows(windows = {}) {
    return DEFINITIONS.map(definition => {
      const rawStart = clean(windows?.[definition.startField]);
      const rawEnd = clean(windows?.[definition.endField]);
      const start = toEpoch(rawStart);
      const end = toEpoch(rawEnd);
      return Object.freeze({
        ...definition,
        rawStart,
        rawEnd,
        start,
        end,
        startIso: Number.isFinite(start) ? new Date(start).toISOString() : null,
        endIso: Number.isFinite(end) ? new Date(end).toISOString() : null
      });
    });
  }

  function validateWindows(windows = {}) {
    const normalized = normalizeWindows(windows);
    const errors = [];
    for (const window of normalized) {
      const hasStart = Boolean(window.rawStart);
      const hasEnd = Boolean(window.rawEnd);
      if (hasStart !== hasEnd) errors.push(`${window.label} requires both a start and end date/time.`);
      if (hasStart && !Number.isFinite(window.start)) errors.push(`${window.label} start is invalid.`);
      if (hasEnd && !Number.isFinite(window.end)) errors.push(`${window.label} end is invalid.`);
      if (Number.isFinite(window.start) && Number.isFinite(window.end) && window.end <= window.start) {
        errors.push(`${window.label} end must be after start.`);
      }
    }
    const configured = normalized.filter(window => Number.isFinite(window.start) && Number.isFinite(window.end));
    for (let index = 1; index < configured.length; index += 1) {
      if (configured[index].start < configured[index - 1].end) {
        errors.push(`${configured[index].label} cannot overlap ${configured[index - 1].label}.`);
      }
    }
    return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), windows: Object.freeze(normalized) });
  }

  function inWindow(value, windowOrStart, maybeEnd) {
    const valueEpoch = typeof value === 'number' ? value : toEpoch(value);
    const start = typeof windowOrStart === 'object' && windowOrStart !== null
      ? windowOrStart.start
      : toEpoch(windowOrStart);
    const end = typeof windowOrStart === 'object' && windowOrStart !== null
      ? windowOrStart.end
      : toEpoch(maybeEnd);
    return Number.isFinite(valueEpoch) && Number.isFinite(start) && Number.isFinite(end) &&
      valueEpoch >= start && valueEpoch < end;
  }

  function windowAt(value = Date.now(), windows = {}) {
    const validation = validateWindows(windows);
    if (!validation.valid) return null;
    const epoch = typeof value === 'number' ? value : toEpoch(value);
    if (!Number.isFinite(epoch)) return null;
    return validation.windows.find(window => Number.isFinite(window.start) && Number.isFinite(window.end) && inWindow(epoch, window)) || null;
  }

  function nonNegativeInteger(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
  }

  function confirmedArrival(bus) {
    return String(bus?.status || '').trim().toLowerCase() === 'arrived' && Number.isFinite(toEpoch(bus?.arrived_at));
  }

  function totalsFor(buses) {
    return buses.reduce((totals, bus) => {
      const total = nonNegativeInteger(bus?.otw_count);
      totals.arrived += total;
      totals.naturalization += Math.min(nonNegativeInteger(bus?.nat_count), total);
      totals.female += Math.min(nonNegativeInteger(bus?.female_count), total);
      totals.spaceForce += Math.min(nonNegativeInteger(bus?.space_force_count), total);
      totals.busCount += 1;
      return totals;
    }, { arrived: 0, naturalization: 0, female: 0, spaceForce: 0, busCount: 0 });
  }

  function summarizeArrivals(buses = [], windows = {}) {
    const validation = validateWindows(windows);
    const eligible = (Array.isArray(buses) ? buses : []).filter(confirmedArrival);
    const assigned = new Set();
    const days = validation.windows.map(window => {
      const matching = validation.valid && Number.isFinite(window.start) && Number.isFinite(window.end)
        ? eligible.filter(bus => inWindow(bus.arrived_at, window))
        : [];
      matching.forEach(bus => assigned.add(bus));
      return Object.freeze({
        ...window,
        buses: Object.freeze([...matching]),
        totals: Object.freeze(totalsFor(matching))
      });
    });
    const unassigned = eligible.filter(bus => !assigned.has(bus));
    return Object.freeze({
      validation,
      eligible: Object.freeze([...eligible]),
      days: Object.freeze(days),
      dayOne: days[0],
      dayTwo: days[1],
      total: Object.freeze(totalsFor(eligible)),
      unassigned: Object.freeze([...unassigned]),
      unassignedTotals: Object.freeze(totalsFor(unassigned))
    });
  }

  root.GateReceivingWindowEngine = Object.freeze({
    TIME_ZONE,
    DEFINITIONS,
    toEpoch,
    toIso,
    normalizeWindows,
    validateWindows,
    inWindow,
    windowAt,
    confirmedArrival,
    summarizeArrivals
  });
})(globalThis);
