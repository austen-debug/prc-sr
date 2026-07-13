export function normalizeText(value) {
  return String(value ?? '').trim();
}

export function normalizeWeekGroup(value) {
  return normalizeText(value).toUpperCase();
}

export function toNonNegativeNumber(value, { integer = true } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  const clamped = Math.max(0, parsed);
  return integer ? Math.trunc(clamped) : clamped;
}

export function normalizeTimestamp(value) {
  const raw = normalizeText(value);
  if (!raw) return null;

  // Build 2 domain calculations require an explicit UTC or numeric offset.
  // Build 1 datetime-local values are normalized at the repository boundary in Phase 1C.
  const hasExplicitZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  if (!hasExplicitZone) return null;

  const milliseconds = Date.parse(raw);
  if (!Number.isFinite(milliseconds)) return null;
  return new Date(milliseconds).toISOString();
}

export function normalizeStatus(value) {
  const status = normalizeText(value).toLowerCase().replace(/[_-]+/g, ' ');
  if (status === 'arrived') return 'arrived';
  if (['active', 'otw', 'en route', 'enroute'].includes(status)) return 'active';
  return status || 'unknown';
}

export function normalizeBoolean(value) {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

export function normalizeBusRecord(record = {}) {
  const total = toNonNegativeNumber(record.otw_count ?? record.total_count ?? record.total);
  const female = Math.min(toNonNegativeNumber(record.female_count), total);
  const naturalization = Math.min(toNonNegativeNumber(record.nat_count), total);
  const spaceForce = Math.min(toNonNegativeNumber(record.space_force_count), total);
  const status = normalizeStatus(record.status);
  const arrivedAt = normalizeTimestamp(record.arrived_at);

  return Object.freeze({
    id: normalizeText(record.__backendId || record.id),
    type: 'bus',
    weekGroup: normalizeWeekGroup(record.week_group),
    busId: normalizeText(record.bus_id),
    busType: normalizeText(record.bus_type || 'airport').toLowerCase(),
    status,
    total,
    female,
    naturalization,
    spaceForce,
    airForce: Math.max(total - spaceForce, 0),
    createdAt: normalizeTimestamp(record.created_at),
    departedAt: normalizeTimestamp(record.departed_at),
    arrivedAt,
    isConfirmedArrival: status === 'arrived' && Boolean(arrivedAt),
    isActive: status === 'active',
    raw: record
  });
}

export function normalizeDormRecord(record = {}) {
  const capacity = toNonNegativeNumber(record.max_load ?? record.capacity);
  const load = Math.min(toNonNegativeNumber(record.current_load ?? record.loaded), capacity);
  const spaceForce = normalizeBoolean(record.space_force) || normalizeBoolean(record.is_space_force);

  return Object.freeze({
    id: normalizeText(record.__backendId || record.id),
    type: 'dorm',
    weekGroup: normalizeWeekGroup(record.week_group),
    name: normalizeText(record.dorm_name || record.name),
    capacity,
    load,
    spaceForce,
    state: normalizeText(record.state || 'empty').toLowerCase(),
    phase: normalizeText(record.phase),
    openedAt: normalizeTimestamp(record.opened_at),
    closedAt: normalizeTimestamp(record.closed_at),
    closedTimer: normalizeText(record.closed_timer),
    raw: record
  });
}

export function matchesWeekGroup(normalizedRecord, weekGroup) {
  const requested = normalizeWeekGroup(weekGroup);
  return !requested || normalizedRecord.weekGroup === requested;
}
